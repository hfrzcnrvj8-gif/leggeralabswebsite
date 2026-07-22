// Drugi składnik logowania — warstwa na bazie (Moduł 41, 2026-07-22).
//
// Sama arytmetyka TOTP siedzi w `lib/totp.ts` i nie wie nic o Postgresie.
// Tutaj jest wszystko, co wymaga pamięci: sekret, kody zapasowe, zużyte kody
// i decyzja „czy logowanie ma w ogóle pytać o drugi krok".
//
// **Domknięcie Audytu 1.** Hamulec z tamtego audytu (`lib/rateLimit.ts`)
// zamknął ZGADYWANIE hasła. Nie zamyka jego WYCIEKU: hasło wpisane na
// podrobionej stronie albo wyjęte z menedżera haseł działa za pierwszym
// razem, więc żaden licznik prób go nie zatrzyma. Drugi składnik jest jedyną
// rzeczą, która ten scenariusz przerywa.

import { createHash, randomUUID } from "node:crypto";
import { getSql, ensureTwoFactorSchema } from "./db";
import { zapiszBlad } from "./errorLog";
import {
  KODOW_ZAPASOWYCH,
  adresOtpauth,
  nowyKodZapasowy,
  nowySekret,
  sekretDoPrzepisania,
  sprawdzKod,
  znormalizujKodZapasowy,
} from "./totp";

/** Jedyny wiersz w `two_factor`. Panel jest jednoosobowy — patrz CLAUDE.md. */
const WIERSZ = "admin";

/** Jak długo pamiętamy zużyty kod. Musi przykryć całą tolerancję (±1 okno =
 * 90 s) z zapasem na wolne żądanie; 5 minut kosztuje kilka wierszy. */
const PAMIEC_ZUZYTYCH_MINUT = 5;

function skrot(tekst: string): string {
  return createHash("sha256").update(tekst).digest("hex");
}

/**
 * **Wyłącznik awaryjny — TRZECIA droga powrotu, nie główna.**
 *
 * `TOTP_DISABLED=1` w zmiennych środowiskowych Vercela wyłącza pytanie
 * o kod (sekret i kody zapasowe zostają w bazie nietknięte — po skasowaniu
 * zmiennej wszystko wraca).
 *
 * Świadomie NIE jest opisywany właścicielowi jako podstawowe wyjście
 * z zatrzaśnięcia. Prowadzi przez łańcuch Vercel → GitHub → Apple →
 * skrzynka pocztowa, który wg ustalenia 12 Audytu 1 **był zerwany przez pół
 * roku i nie dawał żadnego objawu**. Właściciel wybrał jako główne drogi
 * papierowe kody zapasowe i ten sam sekret na dwóch urządzeniach; ta linia
 * jest tym, co zostaje, gdy przepadną obie naraz.
 *
 * Osobno, i to jest częsty błędny odruch: **zmiana `ADMIN_PASSWORD` nie
 * wyłącza drugiego składnika.** Unieważnia sesje w przeglądarce (ustalenie 9
 * Audytu 1) i nic poza tym.
 */
export function wylacznikAwaryjny(): boolean {
  return process.env.TOTP_DISABLED === "1";
}

type Wiersz = { secret: string; confirmed_at: string | null };

async function wczytaj(): Promise<Wiersz | null> {
  await ensureTwoFactorSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT secret, confirmed_at FROM two_factor WHERE id = ${WIERSZ};
  `) as unknown as Wiersz[];
  return rows[0] ?? null;
}

export type StanDrugiegoSkladnika = {
  /** Czy logowanie MA pytać o kod. Uwzględnia wyłącznik awaryjny. */
  aktywny: boolean;
  /** Kiedy potwierdzono włączenie (ISO z bazy) — `null`, gdy nieaktywny. */
  wlaczonyOd: string | null;
  /** Ile kodów zapasowych zostało niezużytych. */
  kodowZapasowych: number;
  /** Sekret istnieje, ale nigdy nie potwierdzono go kodem — czyli ktoś
   *  zaczął włączać i zamknął kartę. Panel ma wtedy zaproponować start od
   *  nowa, a nie udawać, że coś działa. */
  oczekujeNaPotwierdzenie: boolean;
  /** Wyłącznik `TOTP_DISABLED=1` jest włączony (sekret w bazie zostaje). */
  wylaczonyAwaryjnie: boolean;
};

export async function stanDrugiegoSkladnika(): Promise<StanDrugiegoSkladnika> {
  const wiersz = await wczytaj();
  const potwierdzony = Boolean(wiersz?.confirmed_at);
  const sql = getSql();
  const kody = potwierdzony
    ? ((await sql`
        SELECT COUNT(*)::int AS ile FROM two_factor_backup_codes WHERE used_at IS NULL;
      `) as unknown as { ile: number }[])[0]?.ile ?? 0
    : 0;
  return {
    aktywny: potwierdzony && !wylacznikAwaryjny(),
    wlaczonyOd: potwierdzony ? wiersz!.confirmed_at : null,
    kodowZapasowych: kody,
    oczekujeNaPotwierdzenie: Boolean(wiersz) && !potwierdzony,
    wylaczonyAwaryjnie: potwierdzony && wylacznikAwaryjny(),
  };
}

/** Czy `POST /api/admin/login` ma po haśle zażądać kodu. */
export async function wymaganyDrugiSkladnik(): Promise<boolean> {
  if (wylacznikAwaryjny()) return false;
  const wiersz = await wczytaj();
  return Boolean(wiersz?.confirmed_at);
}

/**
 * Krok 1 włączania: nowy sekret **jako oczekujący**.
 *
 * Nadpisuje poprzedni oczekujący sekret (ktoś zaczął, zamknął kartę, zaczyna
 * znowu), ale **nigdy potwierdzonego** — na to jest osobna, jawna droga
 * (`wylacz`), która żąda kodu.
 */
export async function rozpocznijWlaczanie(): Promise<
  { ok: true; sekret: string; sekretCzytelny: string; adres: string } | { ok: false; powod: string }
> {
  const istniejacy = await wczytaj();
  if (istniejacy?.confirmed_at) {
    return { ok: false, powod: "Drugi składnik jest już włączony." };
  }
  const sekret = nowySekret();
  const sql = getSql();
  await sql`
    INSERT INTO two_factor (id, secret, confirmed_at) VALUES (${WIERSZ}, ${sekret}, NULL)
    ON CONFLICT (id) DO UPDATE SET secret = EXCLUDED.secret, confirmed_at = NULL, created_at = now();
  `;
  return { ok: true, sekret, sekretCzytelny: sekretDoPrzepisania(sekret), adres: adresOtpauth(sekret) };
}

/** Losuje osiem nowych kodów, kasując wszystkie stare. Zwraca je jawnie —
 * jedyny moment, w którym w ogóle istnieją poza kartką właściciela. */
async function wydajKodyZapasowe(): Promise<string[]> {
  const sql = getSql();
  const kody = Array.from({ length: KODOW_ZAPASOWYCH }, () => nowyKodZapasowy());
  await sql`DELETE FROM two_factor_backup_codes;`;
  for (const kod of kody) {
    await sql`
      INSERT INTO two_factor_backup_codes (id, code_hash)
      VALUES (${randomUUID()}, ${skrot(znormalizujKodZapasowy(kod))});
    `;
  }
  return kody;
}

/**
 * Krok 2 włączania: **dopóki tu nie wejdzie poprawny kod, nic nie chroni
 * logowania**.
 *
 * To nie jest formalność. Bez tego kroku literówka przy ręcznym przepisaniu
 * sekretu do menedżera haseł zamyka właściciela przed jego własnym panelem
 * i orientuje się o tym dopiero przy następnym logowaniu — czyli wtedy, gdy
 * nie ma już jak tego cofnąć.
 */
export async function potwierdzWlaczanie(
  kod: string
): Promise<{ ok: true; kodyZapasowe: string[] } | { ok: false; powod: string }> {
  const wiersz = await wczytaj();
  if (!wiersz) return { ok: false, powod: "Najpierw zacznij włączanie (brak sekretu do potwierdzenia)." };
  if (wiersz.confirmed_at) return { ok: false, powod: "Drugi składnik jest już włączony." };
  if (sprawdzKod(wiersz.secret, kod) === null) {
    return {
      ok: false,
      powod: "Ten kod się nie zgadza. Sprawdź, czy aplikacja pokazuje kod dla wpisu „Leggera Hub”, i spróbuj jeszcze raz.",
    };
  }
  const sql = getSql();
  await sql`UPDATE two_factor SET confirmed_at = now() WHERE id = ${WIERSZ};`;
  const kodyZapasowe = await wydajKodyZapasowe();
  await zapiszBlad({
    zakres: "logowanie",
    waga: "ostrzezenie",
    komunikat: "Włączono drugi składnik logowania (TOTP).",
    klucz: "2fa:wlaczone",
  });
  return { ok: true, kodyZapasowe };
}

/** Nowa ósemka kodów zapasowych — po wpisaniu aktualnego kodu z aplikacji.
 * Bez tego zużyte kody po cichu likwidują papierową drogę powrotu. */
export async function odnowKodyZapasowe(
  kod: string
): Promise<{ ok: true; kodyZapasowe: string[] } | { ok: false; powod: string }> {
  const wynik = await weryfikuj(kod, { dopuscKodyZapasowe: false });
  if (!wynik.ok) return { ok: false, powod: wynik.powod };
  return { ok: true, kodyZapasowe: await wydajKodyZapasowe() };
}

/**
 * Wyłączenie — **wymaga aktualnego kodu** (decyzja właściciela 2026-07-22).
 *
 * Powód: bez tego ktoś, kto przejmie otwartą sesję w przeglądarce, zdejmuje
 * drugi składnik jednym kliknięciem i cała ochrona sprowadza się z powrotem
 * do samego hasła. Kod zapasowy też przechodzi — właściciel bez telefonu
 * musi mieć czym to wyłączyć.
 */
export async function wylaczDrugiSkladnik(kod: string): Promise<{ ok: true } | { ok: false; powod: string }> {
  const wynik = await weryfikuj(kod, { dopuscKodyZapasowe: true });
  if (!wynik.ok) return { ok: false, powod: wynik.powod };
  const sql = getSql();
  await sql`DELETE FROM two_factor_backup_codes;`;
  await sql`DELETE FROM two_factor WHERE id = ${WIERSZ};`;
  await zapiszBlad({
    zakres: "logowanie",
    waga: "blad",
    komunikat: "WYŁĄCZONO drugi składnik logowania (TOTP). Jeśli to nie Ty — panel chroni już tylko hasło.",
    klucz: "2fa:wylaczone",
  });
  return { ok: true };
}

/**
 * Sprawdza kod — z aplikacji albo zapasowy. Jedno wejście dla logowania,
 * wyłączania i odnawiania kodów.
 *
 * **Zużyty kod z aplikacji nie wchodzi drugi raz.** Bez tego kod podejrzany
 * przez ramię (albo przechwycony przez podrobioną stronę, która zaraz
 * przekazuje go dalej) działa przez całe swoje okno — a to jest dokładnie
 * ten scenariusz, dla którego ten moduł powstał. Blokada opiera się na
 * kluczu głównym w bazie, nie na warunku w kodzie: dwa żądania wysłane
 * równocześnie odbiją się o `ON CONFLICT`, a nie o wyścig.
 */
async function weryfikuj(
  kod: string,
  opcje: { dopuscKodyZapasowe: boolean }
): Promise<{ ok: true; uzytoKoduZapasowego: boolean } | { ok: false; powod: string }> {
  const wiersz = await wczytaj();
  if (!wiersz?.confirmed_at) return { ok: false, powod: "Drugi składnik nie jest włączony." };
  const sql = getSql();
  const czysty = (kod ?? "").trim();

  // Kod zapasowy poznajemy po długości (10 cyfr wobec 6) — nie po myślniku,
  // bo właściciel przepisuje go z kartki i myślnik gubi się nagminnie.
  const cyfry = znormalizujKodZapasowy(czysty);
  if (cyfry.length === 10) {
    if (!opcje.dopuscKodyZapasowe) {
      return { ok: false, powod: "Tutaj wpisz aktualny kod z aplikacji (6 cyfr), nie kod zapasowy." };
    }
    // Jedno zapytanie zamiast „sprawdź, potem oznacz": drugie użycie tego
    // samego kodu nie ma szansy przecisnąć się między odczytem a zapisem.
    const uzyte = (await sql`
      UPDATE two_factor_backup_codes SET used_at = now()
      WHERE code_hash = ${skrot(cyfry)} AND used_at IS NULL
      RETURNING id;
    `) as unknown as { id: string }[];
    if (uzyte.length === 0) {
      return { ok: false, powod: "Ten kod zapasowy nie działa — albo jest błędny, albo został już użyty." };
    }
    const zostalo = ((await sql`
      SELECT COUNT(*)::int AS ile FROM two_factor_backup_codes WHERE used_at IS NULL;
    `) as unknown as { ile: number }[])[0]?.ile ?? 0;
    await zapiszBlad({
      zakres: "logowanie",
      waga: zostalo <= 2 ? "blad" : "ostrzezenie",
      komunikat: `Użyto kodu zapasowego do logowania. Zostało ${zostalo} z ${KODOW_ZAPASOWYCH}.${
        zostalo <= 2 ? " Wygeneruj i wydrukuj nową ósemkę w panelu (Dwuskładnikowe)." : ""
      }`,
      klucz: "2fa:kod-zapasowy",
    });
    return { ok: true, uzytoKoduZapasowego: true };
  }

  const okno = sprawdzKod(wiersz.secret, czysty);
  if (okno === null) return { ok: false, powod: "Kod się nie zgadza." };

  const wstawione = (await sql`
    INSERT INTO two_factor_used (id) VALUES (${skrot(`${okno}:${czysty}`)})
    ON CONFLICT (id) DO NOTHING
    RETURNING id;
  `) as unknown as { id: string }[];
  if (wstawione.length === 0) {
    return { ok: false, powod: "Ten kod został już użyty. Poczekaj, aż aplikacja pokaże następny." };
  }
  // Sprzątanie tutaj, a nie w cronie — wykonuje się rzadko (tylko przy
  // udanym logowaniu) i nie potrzebuje nadzoru, tak samo jak w hamulcu.
  await sql`
    DELETE FROM two_factor_used
    WHERE created_at < now() - (${PAMIEC_ZUZYTYCH_MINUT} || ' minutes')::interval;
  `;
  return { ok: true, uzytoKoduZapasowego: false };
}

/** Wejście dla trasy logowania: kod z aplikacji ALBO zapasowy. */
export async function weryfikujPrzyLogowaniu(
  kod: string
): Promise<{ ok: true; uzytoKoduZapasowego: boolean } | { ok: false; powod: string }> {
  return weryfikuj(kod, { dopuscKodyZapasowe: true });
}
