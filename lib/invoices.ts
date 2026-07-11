// Czysta logika modułu Faktur — bez "use client", re-używana przez UI i
// serwerowe route'y (obliczenia sum, formatowanie). Wzorowane na lib/leads.ts
// i lib/projects.ts. Świadomie lekki moduł: bez KSeF, elastyczny VAT/bez-VAT.

import { type DocLang, DOC_LANGS, DOC_LANG_LABEL, clientAddressLines as sharedClientAddressLines } from "./documents";

export type InvoiceLang = DocLang;
export { addDaysISO } from "./documents";

export type CompanySettings = {
  nazwa: string;
  nip: string;
  adres: string;
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
};

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  nazwa: "",
  nip: "",
  adres: "",
  email: "",
  telefon: "",
  konto: "",
  bank_nazwa: "",
  swift: "",
  vat_payer: true,
  zwolnienie_podstawa: "art. 113 ust. 1 ustawy o VAT",
  domyslny_termin_dni: 14,
};

/** Język wydruku faktury — niezależny od języka panelu (klient może być
 * zagraniczny, nawet gdy właściciel akurat przegląda panel po polsku).
 * Wybierany per faktura w edytorze, domyślnie polski. Typ i lista języków
 * dzielone z lib/offers.ts przez lib/documents.ts. */
export const INVOICE_LANGS = DOC_LANGS;
export const INVOICE_LANG_LABEL = DOC_LANG_LABEL;

export type InvoiceStatus = "Szkic" | "Wystawiona" | "Opłacona" | "Po terminie" | "Anulowana";
export const INVOICE_STATUSES: InvoiceStatus[] = ["Szkic", "Wystawiona", "Opłacona", "Po terminie", "Anulowana"];

export const INVOICE_STATUS_CLASS: Record<string, string> = {
  Szkic: "bg-[var(--hairline)] text-muted",
  Wystawiona: "bg-brand-cyan/15 text-brand-cyan",
  Opłacona: "bg-emerald-500/20 text-emerald-400 font-semibold",
  "Po terminie": "bg-red-500/15 text-red-400",
  Anulowana: "bg-[var(--hairline)] text-muted opacity-70",
};

/** Stawki VAT dostępne na pozycji faktury (numeryczne w %, plus "zw" zwolniony
 * i "np" nie podlega). Trzymane jako string, bo "zw"/"np" nie są liczbami. */
export const VAT_RATES = ["23", "8", "5", "0", "zw", "np"] as const;
export type VatRate = (typeof VAT_RATES)[number];

/** Waluty dostępne na fakturze. EUR odblokowuje kod QR do przelewu SEPA
 * (standard EPC069-12 jest zdefiniowany wyłącznie dla EUR). */
export const INVOICE_CURRENCIES = ["PLN", "EUR", "USD", "GBP"] as const;

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  nazwa: string;
  ilosc: number;
  jednostka: string;
  cena_netto: number;
  vat_stawka: string;
  position: number;
};

export type Invoice = {
  id: string;
  numer: string | null; // nadawany przy wystawieniu (Szkic nie ma numeru)
  lead_id: string | null;
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
  data_wystawienia: string | null;
  data_sprzedazy: string | null;
  termin_platnosci: string | null;
  status: InvoiceStatus;
  waluta: string;
  jezyk: InvoiceLang;
  uwagi: string;
  created_at: string;
  updated_at: string;
};

/** Ułamek stawki VAT (0 dla "zw"/"np"/"0"). */
export function vatFraction(rate: string): number {
  if (rate === "zw" || rate === "np" || rate === "0") return 0;
  const n = Number(rate);
  return Number.isFinite(n) ? n / 100 : 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function itemNetto(it: { ilosc: number; cena_netto: number }): number {
  return round2(it.ilosc * it.cena_netto);
}
export function itemVat(it: { ilosc: number; cena_netto: number; vat_stawka: string }): number {
  return round2(it.ilosc * it.cena_netto * vatFraction(it.vat_stawka));
}
export function itemBrutto(it: { ilosc: number; cena_netto: number; vat_stawka: string }): number {
  return round2(itemNetto(it) + itemVat(it));
}

/** Sumy faktury: netto, VAT, brutto (zaokrąglone do groszy). */
export function invoiceTotals(items: { ilosc: number; cena_netto: number; vat_stawka: string }[]): {
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
  items: { ilosc: number; cena_netto: number; vat_stawka: string }[]
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
  const today = new Date().toISOString().slice(0, 10);
  return inv.termin_platnosci < today;
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
