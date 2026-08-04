/**
 * Jedno przepisanie danych z rekordu na rekord — Faza 1 planu
 * `docs/PLAN-ZAPLECZE.md`.
 *
 * ── PO CO TO POWSTAŁO ─────────────────────────────────────────────────────
 * Mapa „dane klienta → kolumny dokumentu" istniała w PIĘCIU kopiach:
 * `OfferEditor.pickClient`, `InvoiceEditor.pickClient`, gałąź umowy i gałąź
 * DPA w `POST /api/contracts`, oraz `acceptOffer`. Każda kopia gubiła co
 * innego — i to nie teoria, tylko wynik przejścia „na sucho" z 2026-08-02
 * (`docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md`):
 *
 * - **B1** oferta z leada dostawała samą NAZWĘ (bez adresu, bez maila),
 * - **B2** faktura z oferty dostawała adres, ale nie e-mail — a to dokument,
 *   który się wysyła mailem,
 * - **B3** faktura nie wiedziała o umowie, bo powstała przed nią,
 * - **B5** umowa nie dostawała terminu realizacji,
 * - **B6** projekt nie dostawał ani dat, ani sensownej nazwy, ani statusu
 *   innego niż „Pomysł".
 *
 * Żadne z tych sześciu nie rzuciło wyjątku. Wszystkie wyszły z kodem 200.
 *
 * ── ZASADA ────────────────────────────────────────────────────────────────
 * **Kto dokłada nowy rodzaj dokumentu, dokłada wpis do `RODZAJE_DOKUMENTU` —
 * nie pisze przepisywania od nowa.** Ten plik jest jedynym miejscem, które
 * wie, jak nazywają się kolumny klienta na dokumencie.
 *
 * ── CZEMU TEN PLIK NIE IMPORTUJE `lib/db.ts` ──────────────────────────────
 * Bo tę samą mapę pól musi znać także przeglądarka: picker „Powiązany klient"
 * w edytorze oferty i faktury wypełnia dokładnie te kolumny. Gdyby plik
 * ciągnął `db.ts`, nie dałoby się go zaimportować z komponentu `"use client"`
 * i mapa rozjechałaby się po raz szósty. Zamiast tego przyjmujemy `sql`
 * parametrem (`SqlTag`).
 *
 * ── DECYZJE WŁAŚCICIELA (2026-08-02, przy starcie Fazy 1) ─────────────────
 * 1. **Kopia + auto-odświeżanie w szkicu.** Dokument dostaje komplet danych
 *    przy założeniu; dopóki jest szkicem (`odswiezDaneKlienta`), każde
 *    otwarcie dociąga poprawki z karty klienta. Od wysyłki — nic już nie
 *    rusza. Efekt „odczyt do wysyłki, kopia od wysyłki" bez przepisywania
 *    wydruków i stron publicznych.
 * 2. **Czas realizacji podaje się w TYGODNIACH od akceptacji**, nie datą.
 *    Tak się realnie mówi klientowi, zanim wiadomo, kiedy podpisze. Datę
 *    wylicza dopiero umowa — patrz `terminZCzasuRealizacji`.
 */

import { isPlausibleDateString } from "./projects";
import { warunkiZleceniaZDokumentu, wyrownajTerminProjektu } from "./warunkiObowiazujace";

/** Minimalny kształt taga `sql` — patrz „CZEMU TEN PLIK NIE IMPORTUJE db.ts".
 *  Pasuje i do `neon()`, i do PGlite z `lib/dev-db.ts`, i do transakcji. */
export type SqlTag = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

/**
 * Komplet danych klienta, jaki niesie KAŻDY dokument. Nazwy pól są neutralne
 * (`nazwa`, nie `klient_nazwa`) — tłumaczenie na kolumny robi
 * `naKolumnyDokumentu`.
 *
 * Świadomie BEZ telefonu i osoby kontaktowej: żaden z trzech wydruków ich nie
 * drukuje, a kolumny na nie nie istnieją. Dokładając je, dołóż najpierw
 * kolumny — inaczej `zapiszDaneKlienta` wywali się na pierwszym zapisie.
 */
export type DaneKlienta = {
  nazwa: string;
  nip: string;
  ulica: string;
  kod: string;
  miasto: string;
  kraj: string;
  email: string;
};

export const PUSTE_DANE_KLIENTA: DaneKlienta = {
  nazwa: "",
  nip: "",
  ulica: "",
  kod: "",
  miasto: "",
  kraj: "",
  email: "",
};

/** Kolejność pól — jedno źródło dla porównań i dla komunikatów o brakach. */
export const POLA_DANYCH_KLIENTA = ["nazwa", "nip", "ulica", "kod", "miasto", "kraj", "email"] as const;

const tekst = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

// ── Skąd dane mogą przyjść ────────────────────────────────────────────────

/** Karta klienta (`clients`) — źródło NAJPEŁNIEJSZE i jedyne, które ma NIP.
 *  To jest kanoniczny rekord: dokument jest jego odbitką, nie odwrotnie. */
export function zKlienta(c: Record<string, unknown> | null | undefined): DaneKlienta {
  if (!c) return { ...PUSTE_DANE_KLIENTA };
  return {
    nazwa: tekst(c.nazwa),
    nip: tekst(c.nip),
    ulica: tekst(c.ulica),
    kod: tekst(c.kod),
    miasto: tekst(c.miasto),
    kraj: tekst(c.kraj),
    email: tekst(c.email),
  };
}

/** Lead (`leads`) — pole nazwy nazywa się `firma`, NIP-u lead nie ma w ogóle.
 *  Używane tylko tam, gdzie nie ma jeszcze karty klienta (NDA na leadzie). */
export function zLeada(l: Record<string, unknown> | null | undefined): DaneKlienta {
  if (!l) return { ...PUSTE_DANE_KLIENTA };
  return {
    nazwa: tekst(l.firma),
    nip: "",
    ulica: tekst(l.ulica),
    kod: tekst(l.kod),
    miasto: tekst(l.miasto),
    kraj: tekst(l.kraj),
    email: tekst(l.email),
  };
}

/** Inny dokument (oferta/umowa/faktura) — kolumny `klient_*`. */
export function zDokumentu(d: Record<string, unknown> | null | undefined): DaneKlienta {
  if (!d) return { ...PUSTE_DANE_KLIENTA };
  return {
    nazwa: tekst(d.klient_nazwa),
    nip: tekst(d.klient_nip),
    ulica: tekst(d.klient_ulica),
    kod: tekst(d.klient_kod),
    miasto: tekst(d.klient_miasto),
    kraj: tekst(d.klient_kraj),
    email: tekst(d.klient_email),
  };
}

// ── Dokąd dane mają trafić ────────────────────────────────────────────────

/** Rodzaje dokumentów, które noszą dane klienta. **Nowy rodzaj = wpis tutaj.** */
export const RODZAJE_DOKUMENTU = {
  oferta: { tabela: "offers", etykieta: "oferta" },
  umowa: { tabela: "contracts", etykieta: "umowa" },
  faktura: { tabela: "invoices", etykieta: "faktura" },
} as const;

export type RodzajDokumentu = keyof typeof RODZAJE_DOKUMENTU;

/**
 * Dane klienta jako kolumny dokumentu — TA mapa jest tym jednym miejscem.
 *
 * Zwracany obiekt pasuje wprost do `PATCH /api/<moduł>/[id]`, więc picker
 * klienta w edytorze może go wysłać bez własnej listy pól.
 */
export function naKolumnyDokumentu(d: DaneKlienta): {
  klient_nazwa: string;
  klient_nip: string;
  klient_ulica: string;
  klient_kod: string;
  klient_miasto: string;
  klient_kraj: string;
  klient_email: string;
} {
  return {
    klient_nazwa: d.nazwa,
    klient_nip: d.nip,
    klient_ulica: d.ulica,
    klient_kod: d.kod,
    klient_miasto: d.miasto,
    klient_kraj: d.kraj,
    klient_email: d.email,
  };
}

/**
 * Zapisuje komplet danych klienta na dokumencie — jeden UPDATE na rodzaj.
 *
 * Trzy niemal identyczne zapytania zamiast jednego z nazwą tabeli w zmiennej:
 * `sql` jest tagged template, więc nazwy tabeli nie da się podstawić
 * parametrem, a sklejanie jej ze stringa to droga do wstrzyknięcia. Trzy
 * jawne gałęzie w JEDNEJ funkcji dalej znaczą „jedno miejsce" — a kompilator
 * wymusi czwartą, gdy dojdzie czwarty rodzaj.
 */
export async function zapiszDaneKlienta(
  sql: SqlTag,
  rodzaj: RodzajDokumentu,
  id: string,
  d: DaneKlienta
): Promise<void> {
  switch (rodzaj) {
    case "oferta":
      await sql`
        UPDATE offers SET
          klient_nazwa = ${d.nazwa}, klient_nip = ${d.nip}, klient_ulica = ${d.ulica},
          klient_kod = ${d.kod}, klient_miasto = ${d.miasto}, klient_kraj = ${d.kraj},
          klient_email = ${d.email}, updated_at = now()
        WHERE id = ${id};
      `;
      return;
    case "umowa":
      await sql`
        UPDATE contracts SET
          klient_nazwa = ${d.nazwa}, klient_nip = ${d.nip}, klient_ulica = ${d.ulica},
          klient_kod = ${d.kod}, klient_miasto = ${d.miasto}, klient_kraj = ${d.kraj},
          klient_email = ${d.email}, updated_at = now()
        WHERE id = ${id};
      `;
      return;
    case "faktura":
      await sql`
        UPDATE invoices SET
          klient_nazwa = ${d.nazwa}, klient_nip = ${d.nip}, klient_ulica = ${d.ulica},
          klient_kod = ${d.kod}, klient_miasto = ${d.miasto}, klient_kraj = ${d.kraj},
          klient_email = ${d.email}, updated_at = now()
        WHERE id = ${id};
      `;
      return;
  }
}

// ── Odświeżanie szkicu ────────────────────────────────────────────────────

/** Które pola różnią się między dwoma kompletami — puste = identyczne. */
export function roznicaDanychKlienta(a: DaneKlienta, b: DaneKlienta): string[] {
  return POLA_DANYCH_KLIENTA.filter((p) => a[p] !== b[p]);
}

/**
 * Scala dane karty klienta z tym, co JUŻ jest na dokumencie.
 *
 * Karta wygrywa wszędzie tam, gdzie ma wartość; puste pole karty **nie
 * kasuje** tego, co ktoś wpisał ręcznie na dokumencie. Bez tej asymetrii
 * odświeżanie szkicu byłoby cofaniem pracy: klient bez NIP-u w karcie
 * czyściłby NIP wpisany z palca na ofercie.
 */
export function scalDaneKlienta(zKarty: DaneKlienta, naDokumencie: DaneKlienta): DaneKlienta {
  const out = { ...naDokumencie };
  for (const p of POLA_DANYCH_KLIENTA) {
    if (zKarty[p]) out[p] = zKarty[p];
  }
  return out;
}

/**
 * Dociąga dane z karty klienta na dokument-SZKIC (decyzja 1 właściciela).
 *
 * Wywoływane przy ODCZYCIE dokumentu, więc musi być tanie i ciche:
 * — bez `client_id` albo dla dokumentu już wysłanego nie robi NIC (zero
 *   zapytań), bo wysłany dokument jest tym, co klient dostał;
 * — pisze tylko wtedy, gdy coś się faktycznie różni, żeby zwykły odczyt nie
 *   zamieniał się w zapis (i nie przestawiał `updated_at`, po którym idą
 *   sortowania i liczniki ciszy).
 *
 * Zwraca komplet po scaleniu — wołający może go od razu wstawić do wiersza,
 * który oddaje przeglądarce, zamiast czytać go drugi raz.
 */
export async function odswiezDaneKlientaWSzkicu(
  sql: SqlTag,
  rodzaj: RodzajDokumentu,
  dokument: Record<string, unknown>,
  opts: { szkic: boolean }
): Promise<DaneKlienta | null> {
  const clientId = tekst(dokument.client_id);
  if (!opts.szkic || !clientId) return null;

  const karta = (await sql`SELECT nazwa, nip, ulica, kod, miasto, kraj, email FROM clients WHERE id = ${clientId};`)[0];
  if (!karta) return null;

  const biezace = zDokumentu(dokument);
  const scalone = scalDaneKlienta(zKlienta(karta), biezace);
  if (roznicaDanychKlienta(biezace, scalone).length === 0) return null;

  await zapiszDaneKlienta(sql, rodzaj, String(dokument.id), scalone);
  return scalone;
}

// ── Czas realizacji: oferta → umowa → projekt (B5, B6) ────────────────────

/** Górny rozsądny limit — 104 tygodnie to dwa lata. Powyżej to pomyłka
 *  w polu, nie zlecenie. */
export const MAX_CZAS_REALIZACJI_TYGODNIE = 104;

/** Czyta i przycina liczbę tygodni. 0 = nie podano (blok się nie drukuje). */
export function czasRealizacjiTygodnie(v: unknown): number {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, MAX_CZAS_REALIZACJI_TYGODNIE);
}

/** „ok. 3 tygodnie od akceptacji" — jedno źródło odmiany, bo to zdanie
 *  pokazuje i edytor, i wydruk oferty. */
export function czasRealizacjiOpis(tygodnie: number): string {
  const n = czasRealizacjiTygodnie(tygodnie);
  if (!n) return "";
  const slowo = n === 1 ? "tydzień" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "tygodnie" : "tygodni";
  return `ok. ${n} ${slowo} od akceptacji`;
}

/**
 * Data terminu realizacji: dzień akceptacji + N tygodni.
 *
 * Liczone w UTC z samej części „RRRR-MM-DD", nie przez `new Date(znacznik)` —
 * znacznik z Postgresa ma spację zamiast `T` i strefę bez dwukropka, więc
 * `new Date()` oddaje na nim `Invalid Date` (lekcja `znacznik-czasu-postgresa`).
 *
 * `null`, gdy nie ma czego liczyć — umowa zostaje wtedy bez terminu, tak jak
 * dotąd, zamiast dostać datę wziętą z sufitu.
 */
export function terminZCzasuRealizacji(odDnia: string | null | undefined, tygodnie: unknown): string | null {
  const n = czasRealizacjiTygodnie(tygodnie);
  if (!n) return null;
  // `isPlausibleDateString`, nie własne `/^\d{4}-/` — sam wzorzec przepuszcza
  // rok „0202" (pułapka `<input type="date">` opisana w CLAUDE.md), a stąd
  // wychodzi DATA NA UMOWIE. Pierwsza wersja tej funkcji ją przepuszczała
  // i wyszło to dopiero z testu.
  const dzien = tekst(odDnia).slice(0, 10);
  if (!isPlausibleDateString(dzien)) return null;
  const [r, m, d] = dzien.split("-").map(Number);
  const t = Date.UTC(r, m - 1, d) + n * 7 * 86_400_000;
  const wynik = new Date(t);
  return `${wynik.getUTCFullYear()}-${String(wynik.getUTCMonth() + 1).padStart(2, "0")}-${String(wynik.getUTCDate()).padStart(2, "0")}`;
}

// ── Podpis umowy → projekt (B6) ───────────────────────────────────────────

/**
 * Przepisuje na projekt to, co niesie PODPISANY dokument: termin, start
 * i formalne wejście w realizację.
 *
 * Wołane z OBU dróg podpisu — „Oznacz jako podpisaną" w panelu i e-podpis
 * drugiej strony przez publiczny link. Jedna funkcja, bo skutek podpisu nie
 * może zależeć od tego, kto kliknął (dokładnie ten sam powód, dla którego
 * `lib/offerAccept.ts` jest wspólny dla dwóch tras akceptacji oferty).
 *
 * ── CO SIĘ ZMIENIŁO 2026-08-04 (krok 3, znalezisko A6) ────────────────────
 * Do tej daty funkcja ustawiała termin **tylko gdy projekt go nie miał**
 * (`tekst(p.termin) ? null : …`) — a szablon projektu wstawiał własny termin
 * przy zakładaniu, więc warunek nie był spełniony **nigdy**. Mechanizm
 * istniał, był wołany z obu tras i nie zadziałał ani razu: umowa mówiła
 * 25.08, projekt pokazywał 22.09 z szablonu i nic tego nie zgłaszało.
 *
 * Dziś **termin z obowiązujących warunków wygrywa** (decyzja właściciela).
 * Trzy rzeczy z tego wynikają:
 * - Liczy się nie ten dokument, tylko **warunki obowiązujące** — czyli ostatni
 *   podpisany aneks, jeśli jakiś jest (`lib/warunkiObowiazujace.ts`).
 * - **Podpis aneksu też tu wchodzi.** Wcześniej funkcja wychodziła od razu na
 *   `typ !== "umowa"`, więc podpisanie aneksu przesuwającego termin nie ruszało
 *   projektu. Aneks nie zaczyna pracy — ale zmienia jej termin.
 * - **Kamienie milowe zostają nietknięte.** Skalowanie ich przepisywałoby daty
 *   uzgodnione z klientem bez pytania; te, które wypadają po terminie, świecą
 *   ostrzeżeniem na projekcie i regułą w *Zdrowiu*.
 *
 * Co się NIE zmieniło:
 * - **`start` uzupełnia się tylko, gdy jest pusty.** Umowa nie niesie daty
 *   startu, więc wpisalibyśmy dzień podpisu na miejsce daty, którą właściciel
 *   zna lepiej.
 * - **Status podnosi tylko z „Pomysł"/„Planowanie"** i tylko przy `typ =
 *   'umowa'`. Projekt zamknięty, wstrzymany albo w testach nie ma wracać do
 *   „W trakcie" dlatego, że ktoś dopiął zaległy podpis.
 *
 * Zwraca, co faktycznie zmieniła — do wpisu na osi klienta i do testów.
 */
export async function projektPoPodpisieUmowy(
  sql: SqlTag,
  umowa: Record<string, unknown>,
  dzisiaj: string
): Promise<{
  zmienioneDaty: boolean;
  zmienionyStatus: boolean;
  wyrownanieTerminu: { przed: string | null; po: string; zrodloOpis: string } | null;
}> {
  const brak = { zmienioneDaty: false, zmienionyStatus: false, wyrownanieTerminu: null };
  const typ = tekst(umowa.typ);
  if (typ !== "umowa" && typ !== "aneks") return brak;

  const projektId = tekst(umowa.project_id);
  if (!projektId) return brak;

  const p = (await sql`SELECT id, status, start FROM projects WHERE id = ${projektId};`)[0];
  if (!p) return brak;

  // Termin bierzemy z WARUNKÓW, nie z podpisywanego wiersza: podpisanie umowy,
  // pod którą leży już podpisany aneks, nie może cofnąć terminu do pierwotnego.
  const warunki = await warunkiZleceniaZDokumentu(sql, umowa);
  const wyrownanie = warunki ? await wyrownajTerminProjektu(sql, projektId, warunki) : null;

  const start = typ === "umowa" && !tekst(p.start) ? dzisiaj : null;
  const podnosStatus = typ === "umowa" && (tekst(p.status) === "Pomysł" || tekst(p.status) === "Planowanie");

  if (start) await sql`UPDATE projects SET start = ${start}, updated_at = now() WHERE id = ${projektId};`;
  if (podnosStatus) await sql`UPDATE projects SET status = 'W trakcie', updated_at = now() WHERE id = ${projektId};`;

  return {
    zmienioneDaty: !!(start || wyrownanie),
    zmienionyStatus: podnosStatus,
    wyrownanieTerminu: wyrownanie,
  };
}

// ── Nazwa projektu (B6) ───────────────────────────────────────────────────

/**
 * Tytuł projektu z tytułu oferty.
 *
 * Oferta zakładana z leada nazywa się „Oferta — Drukarnia Helios", więc
 * projekt lądował na liście jako pozycja zaczynająca się od słowa „Oferta".
 * Zdejmujemy przedrostek, bo projekt to nie oferta — to praca, która z niej
 * wynikła. Gdyby po zdjęciu nie zostało nic, wracamy do nazwy klienta.
 */
export function tytulProjektuZOferty(tytulOferty: string, klientNazwa: string): string {
  const bezPrzedrostka = tekst(tytulOferty).replace(/^oferta\s*[—–-]\s*/i, "").trim();
  return bezPrzedrostka || tekst(klientNazwa) || "Projekt z oferty";
}
