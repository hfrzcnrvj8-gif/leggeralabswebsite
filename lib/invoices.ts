// Czysta logika modułu Faktur — bez "use client", re-używana przez UI i
// serwerowe route'y (obliczenia sum, formatowanie). Wzorowane na lib/leads.ts
// i lib/projects.ts. Świadomie lekki moduł: bez KSeF, elastyczny VAT/bez-VAT.

import { type DocLang, DOC_LANGS, DOC_LANG_LABEL, clientAddressLines as sharedClientAddressLines } from "./documents";
import { todayLocalISO, daysBetweenISO } from "./dates";
// Type-only (erased przy kompilacji) — bez cyklu w runtime: wartości płyną
// tylko z invoices.ts do ksef.ts, nigdy w drugą stronę.
import type { KsefStatus, KsefTryb } from "./ksef";

export type InvoiceLang = DocLang;
export { addDaysISO } from "./documents";

export type CompanySettings = {
  nazwa: string;
  nip: string;
  /** @deprecated jedno pole adresowe sprzed rozbicia na ulicę/kod/miasto/kraj
   * — trzymane dla wstecznej zgodności (fallback na wydruku i w FA(3), gdy pola
   * strukturalne są puste). Nowe dane wpisuj w ulica/kod/miasto/kraj. */
  adres: string;
  ulica: string;
  kod: string;
  miasto: string;
  /** Kod/nazwa kraju sprzedawcy (domyślnie PL) — na FA(3) mapowane na KodKraju. */
  kraj: string;
  email: string;
  telefon: string;
  konto: string; // numer konta / IBAN
  /** Nazwa banku prowadzącego konto — na wydruku obok numeru konta. */
  bank_nazwa: string;
  /** BIC/SWIFT — potrzebny zagranicznym klientom do przelewu SEPA/SWIFT. */
  swift: string;
  /** true = płatnik VAT (faktury z VAT), false = zwolniony (bez VAT). */
  vat_payer: boolean;
  /** Podstawa zwolnienia z VAT (pokazywana na fakturze, gdy vat_payer=false). */
  zwolnienie_podstawa: string;
  /** Domyślny termin płatności w dniach (np. 14). */
  domyslny_termin_dni: number;
  /** Domyślna treść pola "Uwagi" — auto-wstawiana przy tworzeniu nowej
   * faktury (szkicu), żeby nie przepisywać za każdym razem tej samej
   * formułki (np. "Dziękuję za współpracę. Płatność przelewem."). Można
   * potem nadpisać per faktura jak dotąd. */
  domyslne_uwagi: string;
  /** Odsetki ustawowe za opóźnienie w płatnościach — roczna stawka w %,
   * wpisywana RĘCZNIE przez właściciela (zmienia się okresowo, ogłaszana
   * przez NBP/MF) — panel nigdy jej sam nie wylicza/aktualizuje. `null` =
   * nie ustawiono, wezwania do zapłaty nie pokazują wtedy kwoty odsetek. */
  stawka_odsetek_ustawowych: number | null;
  /** Rezerwa podatkowa — trzy osobne, ręcznie ustawiane stawki % (od kwoty
   * netto faktury), pokazujące "ile warto odłożyć" na każdy z podatków. To
   * pomoc, nie automat księgowy — nie zastępuje wyliczeń księgowej. */
  rezerwa_vat_procent: number;
  rezerwa_pit_procent: number;
  rezerwa_zus_procent: number;
};

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  nazwa: "",
  nip: "",
  adres: "",
  ulica: "",
  kod: "",
  miasto: "",
  kraj: "PL",
  email: "",
  telefon: "",
  konto: "",
  bank_nazwa: "",
  swift: "",
  vat_payer: true,
  zwolnienie_podstawa: "art. 113 ust. 1 ustawy o VAT",
  domyslny_termin_dni: 14,
  domyslne_uwagi: "",
  stawka_odsetek_ustawowych: null,
  rezerwa_vat_procent: 0,
  rezerwa_pit_procent: 0,
  rezerwa_zus_procent: 0,
};

/** Język wydruku faktury — niezależny od języka panelu (klient może być
 * zagraniczny, nawet gdy właściciel akurat przegląda panel po polsku).
 * Wybierany per faktura w edytorze, domyślnie polski. Typ i lista języków
 * dzielone z lib/offers.ts przez lib/documents.ts. */
export const INVOICE_LANGS = DOC_LANGS;
export const INVOICE_LANG_LABEL = DOC_LANG_LABEL;

export type InvoiceStatus = "Szkic" | "Wystawiona" | "Opłacona" | "Po terminie" | "Anulowana";
export const INVOICE_STATUSES: InvoiceStatus[] = ["Szkic", "Wystawiona", "Opłacona", "Po terminie", "Anulowana"];

// Każdy status ma własny, wyraźnie inny kolor — żeby na liście dało się je
// rozróżnić rzutem oka. Szkic (bursztyn = w przygotowaniu), Wystawiona (cyan =
// w obiegu), Opłacona (zieleń = zamknięta pozytywnie), Po terminie (czerwień =
// wymaga akcji), Anulowana (szary + przekreślenie = unieważniona).
export const INVOICE_STATUS_CLASS: Record<string, string> = {
  Szkic: "bg-amber-400/15 text-amber-500",
  Wystawiona: "bg-brand-cyan/15 text-brand-cyan",
  Opłacona: "bg-emerald-500/20 text-emerald-400 font-semibold",
  "Po terminie": "bg-red-500/15 text-red-400",
  Anulowana: "bg-[var(--hairline)] text-muted line-through opacity-70",
};

/** Stawki VAT dostępne na pozycji faktury (numeryczne w %, plus "zw" zwolniony
 * i "np" nie podlega). Trzymane jako string, bo "zw"/"np" nie są liczbami. */
export const VAT_RATES = ["23", "8", "5", "0", "zw", "np"] as const;
export type VatRate = (typeof VAT_RATES)[number];

/** Waluty dostępne na fakturze. EUR odblokowuje kod QR do przelewu SEPA
 * (standard EPC069-12 jest zdefiniowany wyłącznie dla EUR). */
export const INVOICE_CURRENCIES = ["PLN", "EUR", "USD", "GBP"] as const;

/** Typ dokumentu: zwykła faktura / proforma (niefiskalna, własna numeracja,
 * nie liczy się do KPI/przychodu) / zaliczkowa (na poczet przyszłej faktury
 * końcowej, która ją potem rozliczy przez `rozlicza_zaliczke_id`). */
export const INVOICE_TYPES = ["faktura", "proforma", "zaliczkowa"] as const;
export type InvoiceDocType = (typeof INVOICE_TYPES)[number];
export const INVOICE_TYPE_LABEL: Record<InvoiceDocType, string> = {
  faktura: "Faktura",
  proforma: "Proforma",
  zaliczkowa: "Faktura zaliczkowa",
};

/** Sposób zapłaty pokazywany na wydruku — wybierany w edytorze, domyślnie
 * przelew (jak dotąd, gdy pole było zahardkodowane na wydruku). */
export const PAYMENT_METHODS = ["przelew", "gotowka", "karta"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  przelew: "Przelew",
  gotowka: "Gotówka",
  karta: "Karta",
};

/** Próg miesięcznej sprzedaży (brutto, PLN), do którego mikroprzedsiębiorca
 * może w 2026 r. wystawiać faktury poza KSeF (obowiązek wszedł w życie
 * 1 lutego 2026 dla dużych firm, 1 kwietnia 2026 dla reszty — zwolnienie dla
 * mikrofirm obowiązuje do 31 grudnia 2026, tylko poniżej tego progu). Po
 * przekroczeniu progu w danym miesiącu KSeF staje się obowiązkowy. Świadomie
 * tylko licznik/ostrzeżenie — bez pełnej integracji z KSeF (osobny, większy
 * zakres, patrz virtual-company-roadmap w pamięci). */
export const KSEF_MICRO_THRESHOLD_PLN = 10000;

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  nazwa: string;
  ilosc: number;
  jednostka: string;
  cena_netto: number;
  vat_stawka: string;
  /** Rabat na pozycję w procentach (0-100), naliczany od cena_netto × ilość
   * PRZED VAT — jak w Fakturowni/inFakt. Świadomie tylko %, bez osobnej
   * kwoty rabatu (dwa równoległe pola byłyby mylące), i tylko na pozycji,
   * bez osobnego rabatu na całą fakturę (ten sam efekt daje wpisanie tego
   * samego % na każdej pozycji). */
  rabat_procent: number;
  position: number;
};

export type Invoice = {
  id: string;
  numer: string | null; // nadawany przy wystawieniu (Szkic nie ma numeru)
  lead_id: string | null;
  /** Podpięty klient (patrz lib/clients.ts) — propagowany automatycznie z
   * oferty przy akceptacji, nullable dla dokumentów bez podpiętego klienta. */
  client_id: string | null;
  project_id: string | null;
  klient_nazwa: string;
  klient_nip: string;
  /** @deprecated jedno pole adresowe sprzed rozbicia na ulicę/kod/miasto/kraj
   * — trzymane tylko dla wstecznej zgodności ze starymi fakturami (fallback
   * w wydruku, gdy pola strukturalne są puste). Nowe faktury go nie używają. */
  klient_adres: string;
  klient_ulica: string;
  klient_kod: string;
  klient_miasto: string;
  klient_kraj: string;
  /** Odbiorca — opcjonalny, osobny od nabywcy (np. faktura na centralę, towar/
   * usługa fizycznie dla oddziału). Wypełniony tylko gdy właściciel włączy tę
   * opcję w edytorze; pusty `odbiorca_nazwa` = brak osobnego odbiorcy, wydruk
   * pokazuje wtedy tylko nabywcę (jak w Fakturowni/inFakt). */
  odbiorca_nazwa: string;
  odbiorca_ulica: string;
  odbiorca_kod: string;
  odbiorca_miasto: string;
  odbiorca_kraj: string;
  klient_email: string;
  share_token: string | null;
  last_reminder_at: string | null;
  /** Poziom eskalacji windykacji już wysłany (0 = żaden, 1-3 wg
   * REMINDER_LEVELS) — pilnuje, żeby ten sam poziom nie poszedł dwa razy. */
  reminder_level: number;
  /** Moment wygenerowania formalnego wezwania do zapłaty (poziom 3) — null,
   * dopóki nie wystawiono. */
  wezwanie_wystawiono_at: string | null;
  /** Token publicznego podglądu wezwania (`/wezwanie/[token]`) — osobny od
   * `share_token` faktury, bo to inny dokument. */
  wezwanie_share_token: string | null;
  typ_dokumentu: InvoiceDocType;
  /** Ustawione, gdy TA faktura jest korektą innej — pozycje tej faktury to
   * stan PO korekcie, oryginał (koryguje_id) zostaje nienaruszony. */
  koryguje_id: string | null;
  przyczyna_korekty: string;
  /** Typ skutku korekty w ewidencji VAT (FA(3) TypKorekty): "1"/"2"/"3".
   * Znaczenie ma tylko dla korekty (koryguje_id ustawione). */
  typ_korekty: string;
  /** Ustawione na fakturze KOŃCOWEJ ("rozliczeniowej", FA(3) RodzajFaktury=ROZ),
   * która rozlicza wskazaną zaliczkową — odejmuje jej kwotę od pełnej wartości. */
  rozlicza_zaliczke_id: string | null;
  /** Pełna wartość BRUTTO zamówienia/umowy (FA(3) Zamowienie/WartoscZamowienia)
   * — tylko dla faktur zaliczkowych, większa niż sama zaliczka. Null = nie
   * uzupełniono (XML nadal poprawny wg XSD, ale bez pełnego kontekstu). */
  zamowienie_wartosc: number | null;
  /** Krótki opis zamówienia/umowy — staje się jedynym wierszem Zamowienie
   * (P_7Z) w XML. Dotyczy tylko faktur zaliczkowych. */
  zamowienie_opis: string;
  kurs_nbp: number | null;
  kurs_nbp_data: string | null;
  kurs_nbp_tabela: string | null;
  data_wystawienia: string | null;
  data_sprzedazy: string | null;
  termin_platnosci: string | null;
  status: InvoiceStatus;
  waluta: string;
  jezyk: InvoiceLang;
  sposob_platnosci: PaymentMethod;
  /** Tryb wpisywania cen pozycji w edytorze: false = netto (domyślnie,
   * jak dotąd), true = brutto (właściciel wpisuje kwotę, którą ma zapłacić
   * klient — netto liczone wstecz). Wpływa WYŁĄCZNIE na UI edytora; w bazie
   * i na wydruku/w XML KSeF zawsze jest cena netto (`cena_netto`). */
  ceny_brutto: boolean;
  uwagi: string;
  /** Stan integracji z KSeF (Faza 2). Puste/`nie_wyslano` dla faktur, których
   * nie dotknął KSeF. Typy i logika w lib/ksef.ts. */
  ksef_status: KsefStatus;
  ksef_tryb: KsefTryb | null;
  ksef_numer: string | null;
  ksef_upo: string | null;
  ksef_blad: string;
  ksef_wyslano_at: string | null;
  /** Link KOD I (weryfikujący) do kodu QR na wizualizacji — ustawiany po
   * przyjęciu faktury przez KSeF. Null, dopóki nie przyjęto. */
  ksef_qr: string | null;
  created_at: string;
  updated_at: string;
};

/** Zapisana pozycja katalogu usług/produktów — do szybkiego wstawiania na
 * fakturę bez przepisywania. */
export type CatalogItem = {
  id: string;
  nazwa: string;
  cena_netto: number;
  vat_stawka: string;
  jednostka: string;
  created_at: string;
};

export type InvoicePayment = {
  id: string;
  invoice_id: string;
  kwota: number;
  data: string;
  created_at: string;
};

/** Jeden wysłany krok eskalacji windykacji (Moduł 13) — historia widoczna w
 * edytorze faktury, żeby było widać ILE już poszło i jakim tonem, nie tylko
 * "kiedy ostatnio" (jak dotąd `last_reminder_at`). */
export type InvoiceReminder = {
  id: string;
  invoice_id: string;
  level: number;
  kind: "reminder" | "wezwanie";
  sent_at: string;
};

/** Suma zarejestrowanych wpłat na fakturę. */
export function totalPaid(payments: { kwota: number }[]): number {
  return round2(payments.reduce((sum, p) => sum + p.kwota, 0));
}

/** Ułamek stawki VAT (0 dla "zw"/"np"/"0"). */
export function vatFraction(rate: string): number {
  if (rate === "zw" || rate === "np" || rate === "0") return 0;
  const n = Number(rate);
  return Number.isFinite(n) ? n / 100 : 0;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function itemNetto(it: { ilosc: number; cena_netto: number; rabat_procent?: number }): number {
  const wartosc = it.ilosc * it.cena_netto;
  const rabat = it.rabat_procent ? wartosc * (it.rabat_procent / 100) : 0;
  return round2(wartosc - rabat);
}
export function itemVat(it: { ilosc: number; cena_netto: number; vat_stawka: string; rabat_procent?: number }): number {
  return round2(itemNetto(it) * vatFraction(it.vat_stawka));
}
export function itemBrutto(it: { ilosc: number; cena_netto: number; vat_stawka: string; rabat_procent?: number }): number {
  return round2(itemNetto(it) + itemVat(it));
}
/** Kwota rabatu na pozycji (różnica między wartością przed i po rabacie) —
 * do pokazania na wydruku/w edytorze obok wartości netto. */
export function itemDiscountAmount(it: { ilosc: number; cena_netto: number; rabat_procent?: number }): number {
  if (!it.rabat_procent) return 0;
  return round2(it.ilosc * it.cena_netto * (it.rabat_procent / 100));
}

/** Cena jednostkowa BRUTTO — tylko do wygodnego wpisywania w edytorze, gdy
 * faktura ma włączone `ceny_brutto` (właściciel zna kwotę, którą ma zapłacić
 * klient, nie netto). W bazie zawsze trzymamy cenę netto (`cena_netto`) —
 * ten toggle zmienia wyłącznie sposób wpisywania, nie schemat ani wydruk. */
export function unitBrutto(it: { cena_netto: number; vat_stawka: string }): number {
  return round2(it.cena_netto * (1 + vatFraction(it.vat_stawka)));
}
/** Odwrotność `unitBrutto` — przelicza wpisaną cenę brutto z powrotem na
 * netto do zapisania w bazie. */
export function nettoFromUnitBrutto(brutto: number, vat_stawka: string): number {
  return round2(brutto / (1 + vatFraction(vat_stawka)));
}

/** Sumy faktury: netto, VAT, brutto (zaokrąglone do groszy). */
export function invoiceTotals(items: { ilosc: number; cena_netto: number; vat_stawka: string; rabat_procent?: number }[]): {
  netto: number;
  vat: number;
  brutto: number;
} {
  let netto = 0;
  let vat = 0;
  for (const it of items) {
    netto += itemNetto(it);
    vat += itemVat(it);
  }
  netto = round2(netto);
  vat = round2(vat);
  return { netto, vat, brutto: round2(netto + vat) };
}

/** Kwota w PLN sformatowana po polsku (np. "1 234,50 zł"). */
export function formatMoney(n: number, waluta = "PLN"): string {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: waluta }).format(n);
}

/** Numer faktury w formacie "kolejny/rok" (np. "7/2026"). */
export function formatInvoiceNumber(seq: number, year: number): string {
  return `${seq}/${year}`;
}

/** Adres nabywcy jako linie do wydruku (patrz lib/documents.ts). */
export function clientAddressLines(
  inv: Pick<Invoice, "klient_ulica" | "klient_kod" | "klient_miasto" | "klient_kraj" | "klient_adres">
): string[] {
  return sharedClientAddressLines(inv);
}

/** Adres sprzedawcy jako linie do wydruku — preferuje pola strukturalne
 * (ulica / kod+miasto / kraj≠PL), a dla starszych danych bez nich spada na
 * zlepione, jednoliniowe pole `adres`. Kraj PL świadomie pomijamy na wydruku
 * krajowym (pokazujemy tylko przy zagranicznym sprzedawcy). */
export function companyAddressLines(
  c: Pick<CompanySettings, "ulica" | "kod" | "miasto" | "kraj" | "adres">
): string[] {
  const lines: string[] = [];
  if (c.ulica) lines.push(c.ulica);
  const kodMiasto = [c.kod, c.miasto].filter(Boolean).join(" ");
  if (kodMiasto) lines.push(kodMiasto);
  if (c.kraj && c.kraj.trim().toUpperCase() !== "PL") lines.push(c.kraj);
  if (lines.length > 0) return lines;
  return c.adres ? c.adres.split("\n").filter(Boolean) : [];
}

/** Adres odbiorcy (jeśli inny niż nabywca) jako linie do wydruku. */
export function recipientAddressLines(
  inv: Pick<Invoice, "odbiorca_ulica" | "odbiorca_kod" | "odbiorca_miasto" | "odbiorca_kraj">
): string[] {
  return sharedClientAddressLines({
    klient_ulica: inv.odbiorca_ulica,
    klient_kod: inv.odbiorca_kod,
    klient_miasto: inv.odbiorca_miasto,
    klient_kraj: inv.odbiorca_kraj,
    klient_adres: "",
  });
}

/** Sumy faktury pogrupowane wg stawki VAT — do zestawienia "Podstawa VAT /
 * Kwota VAT / Stawka" na wydruku, wymaganego gdy pozycje mieszają stawki
 * (styl znany z faktur Apple/dużych firm). Zwraca tylko stawki faktycznie
 * użyte na fakturze, posortowane malejąco wg wysokości stawki. */
export function vatBreakdown(
  items: { ilosc: number; cena_netto: number; vat_stawka: string; rabat_procent?: number }[]
): { stawka: string; netto: number; vat: number; brutto: number }[] {
  const byRate = new Map<string, { netto: number; vat: number }>();
  for (const it of items) {
    const cur = byRate.get(it.vat_stawka) ?? { netto: 0, vat: 0 };
    cur.netto += itemNetto(it);
    cur.vat += itemVat(it);
    byRate.set(it.vat_stawka, cur);
  }
  return Array.from(byRate.entries())
    .map(([stawka, { netto, vat }]) => ({ stawka, netto: round2(netto), vat: round2(vat), brutto: round2(netto + vat) }))
    .sort((a, b) => vatFraction(b.stawka) - vatFraction(a.stawka));
}

const CLOSED_INVOICE_STATUSES = new Set<string>(["Opłacona", "Anulowana"]);

/** Czy faktura jest po terminie płatności (i nieopłacona/nieanulowana). */
export function isInvoiceOverdue(inv: Pick<Invoice, "status" | "termin_platnosci">): boolean {
  if (CLOSED_INVOICE_STATUSES.has(inv.status)) return false;
  if (inv.status === "Szkic") return false;
  if (!inv.termin_platnosci) return false;
  return inv.termin_platnosci < todayLocalISO();
}

/** Progi eskalacji windykacji (Moduł 13, decyzja właściciela 2026-07-14):
 * uprzejme przypomnienie +3 dni po terminie, stanowcze +10, formalne
 * wezwanie do zapłaty (PDF + opcjonalne odsetki) +21. Świadomie BEZ
 * przypomnienia przed terminem — reaguje tylko na już zaległą płatność. */
export const REMINDER_LEVELS: { level: 1 | 2 | 3; days: number; label: string }[] = [
  { level: 1, days: 3, label: "Uprzejme przypomnienie" },
  { level: 2, days: 10, label: "Stanowcze przypomnienie" },
  { level: 3, days: 21, label: "Wezwanie do zapłaty" },
];
export const REMINDER_LEVEL_LABEL: Record<number, string> = Object.fromEntries(REMINDER_LEVELS.map((l) => [l.level, l.label]));

/** Liczba dni po terminie płatności — `null`, gdy brak terminu (np. szkic).
 * Ujemna/zero = jeszcze nie po terminie. */
export function daysOverdue(inv: Pick<Invoice, "termin_platnosci">): number | null {
  if (!inv.termin_platnosci) return null;
  return daysBetweenISO(inv.termin_platnosci, todayLocalISO());
}

/** Docelowy poziom eskalacji (0-3) dla danej liczby dni po terminie, wg
 * REMINDER_LEVELS — 0 oznacza "jeszcze żaden próg nie minął" (dni ≤ 0, czyli
 * także pierwsze 1-2 dni po terminie, świadomie ciche wg decyzji
 * właściciela). Porównuj z `Invoice.reminder_level`, żeby nie wysłać tego
 * samego poziomu dwa razy. */
export function reminderLevelForDays(days: number | null): number {
  if (days === null || days <= 0) return 0;
  let level = 0;
  for (const l of REMINDER_LEVELS) if (days >= l.days) level = l.level;
  return level;
}

/** Kwota odsetek ustawowych za opóźnienie — proste odsetki liczone od
 * kwoty, rocznej stawki (wpisywanej ręcznie, patrz
 * CompanySettings.stawka_odsetek_ustawowych) i liczby dni opóźnienia.
 * Zwraca 0, gdy stawka nie jest ustawiona (nigdy nie licz "domyślnej"
 * stawki bez jawnej decyzji właściciela). */
export function lateInterestAmount(kwota: number, stawkaProcentRocznie: number | null, dni: number): number {
  if (!stawkaProcentRocznie || stawkaProcentRocznie <= 0 || dni <= 0 || kwota <= 0) return 0;
  return round2(kwota * (stawkaProcentRocznie / 100) * (dni / 365));
}

/** Referencja formalnego wezwania do zapłaty (np. "WZ-2026-A1B2C3") — bez
 * numeracji fiskalnej sekwencyjnej (wezwanie nie jest dokumentem fiskalnym),
 * wzorem `contractReference()` w lib/contracts.ts. */
export function dunningReference(invoiceId: string, atIso: string): string {
  const year = new Date(atIso).getFullYear();
  return `WZ-${year}-${invoiceId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/** Ostrzeżenie wyświetlane na każdym wezwaniu do zapłaty — treść to roboczy
 * szablon, nie wolno używać z prawdziwym klientem bez weryfikacji prawnika
 * (patrz docs/plany-modulow/13-faktury-windykacja.md, pytanie 5 — ten sam
 * zastrzeżenie co przy Umowach/NDA, lib/contracts.ts). */
export const DUNNING_LEGAL_NOTE =
  "SZABLON — WYMAGA WERYFIKACJI PRAWNEJ przed użyciem z prawdziwym klientem. Treść poniżej to robocza wersja, nie sprawdzona jeszcze przez prawnika.";

/** Treść e-maila dla poziomu 1 (uprzejme) / 2 (stanowcze) — scalone w jedną
 * funkcję, żeby cron (app/api/leads/notify) i ręczny trigger
 * (app/api/invoices/[id]/remind) nie trzymały dwóch kopii tego samego
 * szablonu (jak było przed Modułem 13). */
export function reminderEmailText(
  level: 1 | 2,
  opts: { numer: string; brutto: number; waluta: string; terminPlatnosci: string | null; url: string }
): { subject: string; text: string } {
  const kwota = formatMoney(opts.brutto, opts.waluta || "PLN");
  const termin = opts.terminPlatnosci ? opts.terminPlatnosci.slice(0, 10) : "—";
  if (level === 1) {
    return {
      subject: `Przypomnienie o płatności — faktura ${opts.numer}`,
      text: [
        `Dzień dobry,`,
        ``,
        `przypominamy o płatności za fakturę nr ${opts.numer} na kwotę ${kwota}, `,
        `z terminem płatności ${termin}.`,
        ``,
        opts.url,
        ``,
        `Jeśli płatność została już zrealizowana, prosimy zignorować tę wiadomość.`,
        ``,
        `Pozdrawiamy,`,
        `Leggera Labs`,
      ].join("\n"),
    };
  }
  return {
    subject: `Druga prośba o płatność — faktura ${opts.numer} po terminie`,
    text: [
      `Dzień dobry,`,
      ``,
      `nadal nie odnotowaliśmy płatności za fakturę nr ${opts.numer} na kwotę ${kwota}, `,
      `z terminem płatności ${termin} — to już druga wiadomość w tej sprawie.`,
      ``,
      `Prosimy o pilne uregulowanie należności lub kontakt, jeśli coś stoi na przeszkodzie.`,
      ``,
      opts.url,
      ``,
      `Pozdrawiamy,`,
      `Leggera Labs`,
    ].join("\n"),
  };
}

/** Treść e-maila dla poziomu 3 (formalne wezwanie do zapłaty) — osobna od
 * `reminderEmailText`, bo to inny dokument (link do `/wezwanie/[token]`,
 * inny ton, opcjonalna kwota odsetek). */
export function dunningEmailText(opts: {
  numer: string;
  brutto: number;
  waluta: string;
  terminPlatnosci: string | null;
  dni: number;
  odsetki: number;
  url: string;
  reference: string;
}): { subject: string; text: string } {
  const kwota = formatMoney(opts.brutto, opts.waluta || "PLN");
  const termin = opts.terminPlatnosci ? opts.terminPlatnosci.slice(0, 10) : "—";
  const odsetkiLine = opts.odsetki > 0 ? `Naliczone odsetki ustawowe za opóźnienie na dziś: ${formatMoney(opts.odsetki, opts.waluta || "PLN")}.\n\n` : "";
  return {
    subject: `Wezwanie do zapłaty — faktura ${opts.numer} (${opts.reference})`,
    text: [
      `Dzień dobry,`,
      ``,
      `pomimo wcześniejszych przypomnień nie odnotowaliśmy płatności za fakturę nr ${opts.numer} na kwotę ${kwota}, `,
      `z terminem płatności ${termin} (${opts.dni} dni po terminie).`,
      ``,
      `W załączeniu formalne wezwanie do zapłaty:`,
      opts.url,
      ``,
      odsetkiLine + `Prosimy o niezwłoczne uregulowanie należności.`,
      ``,
      `Pozdrawiamy,`,
      `Leggera Labs`,
    ].join("\n"),
  };
}

export type TaxReserve = { vat: number; pit: number; zus: number };

/** Rezerwa podatkowa (Moduł 13) — trzy osobne kwoty "ile odłożyć" liczone
 * jako % (ustawiany ręcznie w Danych firmy) od kwoty NETTO faktury/przychodu
 * (VAT jest już osobno wyszczególniony na fakturze, więc bazą dla rezerwy
 * jest netto, żeby nie liczyć podwójnie). To pomoc poglądowa, nie automat
 * księgowy — nie zastępuje wyliczeń księgowej. */
export function taxReserveBreakdown(
  netto: number,
  settings: Pick<CompanySettings, "rezerwa_vat_procent" | "rezerwa_pit_procent" | "rezerwa_zus_procent">
): TaxReserve {
  return {
    vat: round2(netto * (settings.rezerwa_vat_procent / 100)),
    pit: round2(netto * (settings.rezerwa_pit_procent / 100)),
    zus: round2(netto * (settings.rezerwa_zus_procent / 100)),
  };
}

const JEDNOSCI = ["", "jeden", "dwa", "trzy", "cztery", "pięć", "sześć", "siedem", "osiem", "dziewięć"];
const NASTKI = [
  "dziesięć", "jedenaście", "dwanaście", "trzynaście", "czternaście",
  "piętnaście", "szesnaście", "siedemnaście", "osiemnaście", "dziewiętnaście",
];
const DZIESIATKI = ["", "", "dwadzieścia", "trzydzieści", "czterdzieści", "pięćdziesiąt", "sześćdziesiąt", "siedemdziesiąt", "osiemdziesiąt", "dziewięćdziesiąt"];
const SETKI = ["", "sto", "dwieście", "trzysta", "czterysta", "pięćset", "sześćset", "siedemset", "osiemset", "dziewięćset"];

type PluralForms = { one: string; few: string; many: string };

/** Polska odmiana rzeczownika policzalnego wg liczby (1 / 2-4 / 5+, z wyjątkiem
 * 12-14) — działa dla wszystkich form użytych tu (złoty/tysiąc/milion/cent
 * itd. — wszystkie rodzaju męskiego, ta sama reguła odmiany). */
function pluralPL(n: number, forms: PluralForms): string {
  if (n === 1) return forms.one;
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return forms.few;
  return forms.many;
}

function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rem = n % 100;
  if (h) parts.push(SETKI[h]);
  if (rem >= 10 && rem <= 19) {
    parts.push(NASTKI[rem - 10]);
  } else {
    const d = Math.floor(rem / 10);
    const j = rem % 10;
    if (d) parts.push(DZIESIATKI[d]);
    if (j) parts.push(JEDNOSCI[j]);
  }
  return parts.join(" ");
}

/** Liczba całkowita (0–999 999 999) rozpisana słownie po polsku. "tysiąc" i
 * "milion" bez poprzedzającego "jeden" (naturalna polszczyzna: "tysiąc
 * złotych", nie "jeden tysiąc złotych" — tak samo jak przy "stu"). */
function integerToWordsPL(n: number): string {
  if (n === 0) return "zero";
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) {
    const word = millions === 1 ? "milion" : `${threeDigitsToWords(millions)} ${pluralPL(millions, { one: "milion", few: "miliony", many: "milionów" })}`;
    parts.push(word);
  }
  if (thousands) {
    const word = thousands === 1 ? "tysiąc" : `${threeDigitsToWords(thousands)} ${pluralPL(thousands, { one: "tysiąc", few: "tysiące", many: "tysięcy" })}`;
    parts.push(word);
  }
  if (rest || parts.length === 0) parts.push(threeDigitsToWords(rest));
  return parts.join(" ").trim();
}

const CURRENCY_WORDS: Record<string, { major: PluralForms }> = {
  PLN: { major: { one: "złoty", few: "złote", many: "złotych" } },
  EUR: { major: { one: "euro", few: "euro", many: "euro" } }, // euro nieodmienne w liczbie mnogiej
  USD: { major: { one: "dolar", few: "dolary", many: "dolarów" } },
  GBP: { major: { one: "funt", few: "funty", many: "funtów" } },
};

/** Kwota słownie po polsku, wg waluty faktury (domyślnie PLN) — np.
 * "Jedenaście tysięcy siedemset pięćdziesiąt osiem złotych 80/100". Grosze/
 * centy zostają cyfrą (X/100) — to standardowa polska konwencja na fakturach,
 * nie tylko złote są rozpisywane słownie. */
export function amountInWords(n: number, currency: string = "PLN"): string {
  const whole = Math.floor(n);
  const fraction = Math.round((n - whole) * 100);
  const cw = CURRENCY_WORDS[currency] ?? CURRENCY_WORDS.PLN;
  const words = integerToWordsPL(whole);
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  return `${capitalized} ${pluralPL(whole, cw.major)} ${String(fraction).padStart(2, "0")}/100`;
}
