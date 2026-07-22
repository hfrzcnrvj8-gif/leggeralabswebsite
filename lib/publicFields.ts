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
  "vat_payer",
  "zwolnienie_podstawa",
  "stawka_odsetek_ustawowych",
] as const;

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
  "status",
  "tytul",
  "uwagi",
  "wazna_do",
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
] as const;
