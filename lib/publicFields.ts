/** Moduł 40, część B — białe listy pól wydawanych na publicznych trasach
 * `public/[token]` czterech modułów dokumentowych (Audyt 1, ustalenia 5 i 6).
 *
 * DLACZEGO BIAŁA, A NIE CZARNA. Cztery trasy dokumentowe robiły `SELECT *`
 * i ukrywały czarną listą kilka kolumn — a to znaczy, że **każda nowa kolumna
 * stawała się publiczna sama z siebie**. Nie teoria: tak wyciekł `client_id`
 * (dodany Modułem 30 już po napisaniu trasy, dwie sąsiednie trasy go ukrywają,
 * ta jedna nie), `wezwanie_share_token` (drugi, celowo osobny token) oraz
 * `accepted_ip` / `accepted_user_agent` osoby podpisującej umowę.
 *
 * SKĄD SIĘ BIERZE TA LISTA. Strony publiczne **re-używają komponentów wydruku
 * z `/admin`** (`app/[lang]/faktura/[token]` importuje `InvoicePrint`,
 * `umowa`/`nda` importują `ContractPrint`). Ten sam komponent działa w dwóch
 * trybach: w panelu bierze pełny wiersz z `/api/<moduł>/[id]`, publicznie
 * okrojony z `/api/<moduł>/public/[token]`. Dlatego biała lista to
 * **dokładnie te pola, które czyta komponent wydruku** — nie typ z `lib/`.
 *
 * DODAJĄC POLE DO WYDRUKU, DOPISZ JE TUTAJ. Pominięte pole nie wywali błędu:
 * wydruk po prostu pokaże pustą rubrykę u klienta. Jedyny sposób, żeby to
 * zobaczyć, to otworzyć publiczny link.
 */

/** Zostawia w obiekcie wyłącznie wymienione pola. Brakujące klucze po prostu
 * nie trafiają do wyniku (wiersz sprzed migracji nie wywróci odpowiedzi). */
export function pickFields<T extends Record<string, unknown>>(row: T, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f in row) out[f] = row[f];
  }
  return out;
}

/** Ustawienia firmy — wspólne dla wszystkich czterech wydruków (sprzedawca
 * w nagłówku, dane do przelewu w stopce). Świadomie NIE zawiera
 * `rezerwa_vat_procent` / `rezerwa_pit_procent` / `rezerwa_zus_procent` ani
 * domyślnych ustawień edytora (`domyslny_termin_dni`, `domyslne_uwagi`) —
 * to prywatne ustawienia właściciela, których wydruk nie używa.
 * `stawka_odsetek_ustawowych` czyta wyłącznie DunningPrint. */
export const COMPANY_SETTINGS_PUBLIC_FIELDS = [
  "nazwa",
  "nip",
  "adres",
  "ulica",
  "kod",
  "miasto",
  "kraj",
  "email",
  "telefon",
  "konto",
  "bank_nazwa",
  "swift",
  "osoba_podpisujaca",
  "vat_payer",
  "zwolnienie_podstawa",
  "stawka_odsetek_ustawowych",
] as const;

/**
 * Blok wystawcy do MIGAWKI dokumentu — Faza 2 planu `docs/PLAN-ZAPLECZE.md`.
 *
 * Migawka ma być tym, CO KLIENT ZOBACZYŁ. Do 2026-08-02 nie obejmowała
 * wystawcy: oferta, umowa i faktura brały dane firmy na żywo z
 * `company_settings` przy każdym otwarciu publicznego linku. Zmiana nazwy
 * firmy, NIP-u albo numeru konta zmieniała **wstecz** każdy dokument, który
 * klient wciąż mógł otworzyć — najostrzej fakturę (znalezisko A2, jedyne
 * z całego przejścia ze skutkiem prawnym).
 *
 * Zamrażamy dokładnie te pola, które wydruk czyta — czyli tę samą białą
 * listę, którą publiczna trasa wydaje z żywych ustawień. Gdyby listy się
 * rozjechały, klient zobaczyłby pod linkiem coś innego niż na wydruku.
 */
export function wystawcaDoMigawki(settings: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  return settings ? pickFields(settings, COMPANY_SETTINGS_PUBLIC_FIELDS) : null;
}

/** Faktura — pola czytane przez `InvoicePrint` (razem z pomocnikami
 * `clientAddressLines` / `recipientAddressLines` z lib/invoices.ts).
 * `koryguje_id` i `rozlicza_zaliczke_id` zostają: publiczny wydruk renderuje
 * na ich podstawie adnotację o korekcie i o rozliczonej zaliczce (treść
 * prawnie istotna), a same identyfikatory niczego nie odblokowują — trasa
 * admina i tak wymaga logowania. */
export const INVOICE_PUBLIC_FIELDS = [
  "id",
  "numer",
  "jezyk",
  "waluta",
  "typ_dokumentu",
  "data_wystawienia",
  "data_sprzedazy",
  "termin_platnosci",
  "sposob_platnosci",
  "uwagi",
  "klient_nazwa",
  "klient_nip",
  "klient_ulica",
  "klient_kod",
  "klient_miasto",
  "klient_kraj",
  "klient_adres",
  "odbiorca_nazwa",
  "odbiorca_ulica",
  "odbiorca_kod",
  "odbiorca_miasto",
  "odbiorca_kraj",
  "koryguje_id",
  "przyczyna_korekty",
  "rozlicza_zaliczke_id",
  "kurs_nbp",
  "kurs_nbp_tabela",
  "kurs_nbp_data",
  "ksef_numer",
  "ksef_qr",
  "ksef_tryb",
] as const;

/** Wezwanie do zapłaty — pola czytane przez `DunningPrint`. Znacznie węższa
 * lista niż faktura: to inny dokument (wzywa do zapłaty, nie rozlicza),
 * i celowo osobny token. `brutto` dolicza zapytanie w trasie. */
export const DUNNING_PUBLIC_FIELDS = [
  "id",
  "numer",
  "waluta",
  "created_at",
  "termin_platnosci",
  "wezwanie_wystawiono_at",
  "brutto",
  "klient_nazwa",
  "klient_nip",
  "klient_ulica",
  "klient_kod",
  "klient_miasto",
  "klient_kraj",
  "klient_adres",
] as const;

/** Oferta — pola czytane przez `OfferPrint` (+ `offerReference` = id
 * i created_at, + `clientAddressLines` z lib/offers.ts). `accepted_by_name`
 * zostaje: to podpis widoczny na samym dokumencie. */
export const OFFER_PUBLIC_FIELDS = [
  "id",
  "created_at",
  "jezyk",
  "waluta",
  // Runda 3 — blok wyliczenia zwrotu na dokumencie. Same liczby wpisane
  // przez właściciela, nic o kliencie.
  "roi_godziny",
  "roi_stawka",
  "status",
  // Drugie przejście (A2): bez tego pola strona klienta nie odróżnia oferty
  // ZASTĄPIONEJ nową wersją od zwykłej wygasłej — `ocenAkceptacje()` widziała
  // `undefined` i pokazywała „Ta oferta wygasła" zamiast „została zastąpiona
  // nowszą wersją". Serwer blokował poprawnie, bo czyta pełny wiersz; rozjazd
  // był w DANYCH, nie w logice. Nie niesie niczego o kliencie — to znacznik
  // naszego dokumentu.
  "superseded_at",
  "tytul",
  "uwagi",
  "wazna_do",
  // Faza 1 (luka B5) — czas realizacji drukuje się obok ważności, więc musi
  // przejść także na publiczny link. Pominięte pole nie wywala błędu: klient
  // zobaczyłby po prostu pustą rubrykę.
  "czas_realizacji_tygodnie",
  "accepted_at",
  "accepted_by_name",
  "klient_nazwa",
  "klient_nip",
  "klient_ulica",
  "klient_kod",
  "klient_miasto",
  "klient_kraj",
  "klient_adres",
] as const;

/** Umowa / NDA — pola czytane przez `ContractPrint` (+ `contractReference`
 * = id, typ, created_at). NIE zawiera `accepted_ip` ani
 * `accepted_user_agent`: to techniczny dowód złożenia oświadczenia woli,
 * przeznaczony dla właściciela, nie treść dokumentu (Audyt 1, ustalenie 5).
 * `accepted_by_name` zostaje — to podpis drukowany pod umową; usunięcie go
 * zostawiłoby pustą rubrykę (decyzja właściciela 2026-07-22). */
export const CONTRACT_PUBLIC_FIELDS = [
  "id",
  "created_at",
  "jezyk",
  "typ",
  "status",
  "zakres_prac",
  "cena",
  "waluta",
  "termin_realizacji",
  "uwagi",
  "accepted_at",
  "accepted_by_name",
  "klient_nazwa",
  "klient_nip",
  "klient_ulica",
  "klient_kod",
  "klient_miasto",
  "klient_kraj",
  // Aneks (Moduł 58): numer i migawka warunków umowy-matki. Bez nich wydruk
  // aneksu nie ma z czym porównać nowych warunków — cała kolumna „było"
  // stałaby pusta. `poprzednie` nie zawiera nic, czego nie ma na samym
  // dokumencie: to warunki handlowe, które druga strona już podpisała.
  // Stanowisko podpisującego i nasz podpis (2026-07-27) — obie rubryki są na
  // dokumencie, więc druga strona musi je widzieć pod swoim linkiem.
  "accepted_by_role",
  "podpis_nasz_at",
  "podpis_nasz_osoba",
  // Okres obowiązywania — to jest treść umowy, nie metadana panelu.
  "obowiazuje_od",
  "obowiazuje_do",
  "wypowiedzenie_dni",
  "odnawialna",
  "szablon",
  // DPA — pola wymagane przez art. 28 RODO i warunki płatności. To treść
  // dokumentu, więc druga strona MUSI je widzieć pod swoim linkiem; bez nich
  // wydruk powierzenia pokazywał „—" w rubrykach, których przepis wymaga.
  "dpa_kategorie_danych",
  "dpa_kategorie_osob",
  "dpa_podprocesorzy",
  "zaliczka_procent",
  "platnosci_opis",
  "aneks_nr",
  "poprzednie",
] as const;
