// Hamulec liczby prób — Audyt 1 (bezpieczeństwo i dostęp), 2026-07-22.
//
// **Co to naprawia.** Do tego dnia `POST /api/admin/login` przyjmował
// nieograniczoną liczbę zgadywań hasła. Zmierzone przed naprawą: 30 kolejnych
// żądań ze złym hasłem → 30× HTTP 401, ani jednego 429; 50 żądań równolegle
// w 0,28 s. Samo porównanie hasła jest odporne na atak czasowy
// (`timingSafeEqual` w lib/auth.ts) — brakowało wyłącznie hamulca. Panel ma
// JEDNO hasło i żadnego drugiego składnika, więc nielimitowane strzały to
// była najkrótsza droga do wszystkich danych klientów naraz.
//
// **Zero AI, zero nowych usług** — deterministyczne liczenie wierszy w tej
// samej bazie, zgodnie z regułą całego projektu.

import { createHash, randomUUID } from "node:crypto";
import { getSql, ensureRateLimitSchema } from "./db";
import { zapiszBlad } from "./errorLog";

/** Nazwana konfiguracja hamulca. Progi są tu, a nie w trasach, żeby dało się
 * je porównać jednym spojrzeniem — rozjechane progi w dwóch plikach to
 * dokładnie ten rodzaj długu, który ten projekt już raz zebrał. */
export type Hamulec = {
  /** Klucz zapisywany w `rate_limit_hits.akcja`. */
  akcja: string;
  /** Ile nieudanych prób z jednego miejsca mieści się w oknie. */
  prog: number;
  /** Ile prób ze WSZYSTKICH miejsc naraz. Botnet z tysiąca adresów obchodzi
   *  limit per-IP; właściciel loguje się z jednego, najwyżej dwóch. */
  progGlobalny: number;
  /** Długość okna w minutach — jednocześnie długość blokady po jego
   *  przekroczeniu (blokada mija sama, nic nie trzeba odblokowywać). */
  oknoMinut: number;
};

/** Logowanie do panelu. Próg 5/15 min — decyzja właściciela z 2026-07-22.
 *
 * Uzasadnienie liczby: właściciel myli hasło najwyżej 2–3 razy, więc 5 go nie
 * dotknie; atak spada z tysięcy prób na godzinę do 20 na dobę z jednego
 * adresu. Blokada mija sama po 15 minutach — świadomie, bo nie ma drugiego
 * kanału wejścia i blokada wymagająca odblokowania zamknęłaby właściciela
 * przed jego własnymi danymi. */
export const HAMULEC_LOGOWANIE: Hamulec = {
  akcja: "login",
  prog: 5,
  progGlobalny: 30,
  oknoMinut: 15,
};

/** Publiczny formularz kontaktowy (`POST /api/leads`). Luźniej niż przy
 * logowaniu, bo stawka jest inna: tu nie chodzi o dostęp do danych, tylko
 * o to, żeby obcy nie zalał bazy leadami i nie rozdzwonił powiadomień
 * (`zrodlo_kategoria: "Formularz na stronie"` woła `notify()`). Prawdziwy
 * klient wysyła jedno zgłoszenie, nie sześć na godzinę. */
export const HAMULEC_FORMULARZ: Hamulec = {
  akcja: "lead-form",
  prog: 5,
  progGlobalny: 60,
  oknoMinut: 60,
};

/** Ile godzin trzymamy wiersze. Hamulec potrzebuje minut; resztę zostawiamy
 * wyłącznie po to, żeby dało się zobaczyć „ktoś próbował w nocy". */
const RETENCJA_GODZIN = 24;

/**
 * Odcisk miejsca, z którego przyszło żądanie.
 *
 * **Nie zapisujemy adresu IP.** Adres IP jest daną osobową (Audyt 2 — RODO),
 * a tabela pełna adresów byłaby nieudokumentowanym zbiorem objętym prawem do
 * usunięcia. Do pytania „ile prób z tego samego miejsca" wystarcza równość
 * odcisków; nigdy nie pytamy, czyj to adres, więc nigdy nie musimy go
 * odzyskać. Sekret w skrócie chroni przed odtworzeniem adresu ze słownika
 * (przestrzeń IPv4 ma tylko 4 mld wartości — sam SHA-256 z adresu dałoby się
 * złamać w kilka godzin).
 *
 * Nagłówek `x-forwarded-for` ustawia Vercel i to on jest tu jedynym źródłem
 * prawdy — na produkcji nie da się go podszyć spoza platformy. Brak nagłówka
 * (localhost, dev) daje jeden wspólny odcisk `lokalny`, co jest poprawne:
 * lokalnie i tak wszystko idzie z jednego miejsca.
 */
export function odciskZadania(naglowki: Headers): string {
  const adres =
    naglowki.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    naglowki.get("x-real-ip")?.trim() ||
    "lokalny";
  const sol = process.env.ADMIN_SESSION_SECRET ?? "brak-sekretu";
  return createHash("sha256").update(`${adres}:${sol}`).digest("hex").slice(0, 32);
}

export type WynikHamulca = {
  /** `false` → trasa ma zwrócić 429 i NIE sprawdzać hasła. */
  dozwolone: boolean;
  /** Ile minut do zwolnienia blokady (zaokrąglone w górę, minimum 1). */
  zaMinut: number;
  /** Czy zadziałał limit globalny, a nie ten per-miejsce. Do komunikatu:
   *  „to nie ty jesteś zablokowany, to trwa atak". */
  globalny: boolean;
};

/**
 * Sprawdza, czy żądanie mieści się jeszcze w limicie. Wołać PRZED
 * sprawdzeniem hasła — inaczej hamulec nie chroni przed niczym, bo kosztowna
 * i wrażliwa część roboty i tak się wykona.
 *
 * **Fail-closed.** Gdy zapytanie do bazy padnie, zwracamy „niedozwolone".
 * Odwrotny wybór (przepuść, gdy nie wiadomo) zamieniłby awarię bazy
 * w wyłącznik hamulca — a to jest dokładnie ten stan, w którym atakujący
 * chciałby, żeby system się znalazł.
 */
export async function sprawdzHamulec(hamulec: Hamulec, odcisk: string): Promise<WynikHamulca> {
  try {
    await ensureRateLimitSchema();
    const sql = getSql();
    // Jedno zapytanie na oba liczniki — neon() płaci osobnym żądaniem HTTP
    // za każde zapytanie, więc rozbicie na dwa podwoiłoby koszt logowania.
    const rows = (await sql`
      SELECT
        COUNT(*) FILTER (WHERE odcisk = ${odcisk})::int AS moje,
        COUNT(*)::int AS wszystkie
      FROM rate_limit_hits
      WHERE akcja = ${hamulec.akcja}
        AND created_at > now() - (${hamulec.oknoMinut} || ' minutes')::interval;
    `) as unknown as { moje: number; wszystkie: number }[];

    const moje = rows[0]?.moje ?? 0;
    const wszystkie = rows[0]?.wszystkie ?? 0;
    const zablokowanyLokalnie = moje >= hamulec.prog;
    const zablokowanyGlobalnie = wszystkie >= hamulec.progGlobalny;

    return {
      dozwolone: !zablokowanyLokalnie && !zablokowanyGlobalnie,
      zaMinut: hamulec.oknoMinut,
      globalny: zablokowanyGlobalnie && !zablokowanyLokalnie,
    };
  } catch (e) {
    console.error(`[rateLimit] nie udało się sprawdzić limitu (${hamulec.akcja}) — zamykam trasę`, e);
    await zapiszBlad({
      zakres: "hamulec",
      komunikat: `Nie udało się sprawdzić limitu prób (${hamulec.akcja}) — trasa zamknięta`,
      szczegoly: e,
      klucz: `hamulec:${hamulec.akcja}:awaria`,
    });
    return { dozwolone: false, zaMinut: 1, globalny: false };
  }
}

/**
 * Odnotowuje próbę, która się nie powiodła (złe hasło, zgłoszenie
 * z formularza). Świadomie nie rzuca wyjątkiem: nieudany zapis licznika nie
 * może wywrócić trasy, która właśnie odmawiała dostępu.
 *
 * Przy okazji sprząta wiersze starsze niż doba. Sprzątanie siedzi TU, a nie
 * w cronie, bo tu wykonuje się rzadko (tylko przy nieudanych próbach)
 * i nie potrzebuje nadzoru — cron sprzątający byłby trzecim automatem do
 * pilnowania (Audyt 4) za oszczędność kilkuset wierszy.
 */
export async function odnotujProbe(hamulec: Hamulec, odcisk: string): Promise<void> {
  try {
    await ensureRateLimitSchema();
    const sql = getSql();
    await sql`
      INSERT INTO rate_limit_hits (id, akcja, odcisk)
      VALUES (${randomUUID()}, ${hamulec.akcja}, ${odcisk});
    `;
    await sql`
      DELETE FROM rate_limit_hits
      WHERE created_at < now() - (${RETENCJA_GODZIN} || ' hours')::interval;
    `;
  } catch (e) {
    console.error(`[rateLimit] nie udało się odnotować próby (${hamulec.akcja})`, e);
  }
}

/** Kasuje licznik po udanym wejściu — żeby pomyłka sprzed kwadransa nie
 * zliczała się z pomyłką za tydzień. */
export async function wyczyscPoUdanej(hamulec: Hamulec, odcisk: string): Promise<void> {
  try {
    await ensureRateLimitSchema();
    const sql = getSql();
    await sql`DELETE FROM rate_limit_hits WHERE akcja = ${hamulec.akcja} AND odcisk = ${odcisk};`;
  } catch (e) {
    console.error(`[rateLimit] nie udało się wyczyścić licznika (${hamulec.akcja})`, e);
  }
}

/**
 * Zgłasza przekroczenie progu do `error_log` (Audyt 4), skąd trafia do
 * dziennego maila.
 *
 * **Dlaczego to nie jest tabela tylko do zapisu:** ustalenie 3 Audytu 4
 * dotyczyło pola `mail_folders.last_error`, które przez cały moduł zapisywano
 * i nigdy nie czytano. Hamulec bez tego wpisu powtórzyłby ten sam błąd —
 * blokowałby ataki po cichu, a właściciel nigdy by się nie dowiedział, że
 * ktokolwiek próbował.
 *
 * `klucz` bez odcisku: dwadzieścia zablokowanych adresów to jedna linia
 * z licznikiem, nie dwadzieścia linii w mailu.
 */
export async function zglosPrzekroczenie(hamulec: Hamulec, globalny: boolean): Promise<void> {
  await zapiszBlad({
    zakres: "hamulec",
    waga: "blad",
    komunikat: globalny
      ? `Przekroczony ŁĄCZNY limit prób (${hamulec.akcja}): ponad ${hamulec.progGlobalny} w ${hamulec.oknoMinut} min ze wszystkich adresów naraz.`
      : `Zablokowano po ${hamulec.prog} nieudanych próbach (${hamulec.akcja}) w ${hamulec.oknoMinut} min z jednego adresu.`,
    klucz: `hamulec:${hamulec.akcja}:${globalny ? "globalny" : "lokalny"}`,
  });
}
