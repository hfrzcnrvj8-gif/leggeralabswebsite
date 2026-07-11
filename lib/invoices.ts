// Czysta logika modułu Faktur — bez "use client", re-używana przez UI i
// serwerowe route'y (obliczenia sum, formatowanie). Wzorowane na lib/leads.ts
// i lib/projects.ts. Świadomie lekki moduł: bez KSeF, elastyczny VAT/bez-VAT.

export type CompanySettings = {
  nazwa: string;
  nip: string;
  adres: string;
  email: string;
  telefon: string;
  konto: string; // numer konta / IBAN
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
  vat_payer: true,
  zwolnienie_podstawa: "art. 113 ust. 1 ustawy o VAT",
  domyslny_termin_dni: 14,
};

/** Język wydruku faktury — niezależny od języka panelu (klient może być
 * zagraniczny, nawet gdy właściciel akurat przegląda panel po polsku).
 * Wybierany per faktura w edytorze, domyślnie polski. */
export type InvoiceLang = "pl" | "en" | "de";
export const INVOICE_LANGS: InvoiceLang[] = ["pl", "en", "de"];
export const INVOICE_LANG_LABEL: Record<InvoiceLang, string> = { pl: "Polski", en: "English", de: "Deutsch" };

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

/** Adres nabywcy jako linie do wydruku — preferuje pola strukturalne
 * (ulica / kod+miasto / kraj), a dla starszych faktur bez nich spada na
 * zlepione pole `klient_adres`. */
export function clientAddressLines(
  inv: Pick<Invoice, "klient_ulica" | "klient_kod" | "klient_miasto" | "klient_kraj" | "klient_adres">
): string[] {
  const lines: string[] = [];
  if (inv.klient_ulica) lines.push(inv.klient_ulica);
  const kodMiasto = [inv.klient_kod, inv.klient_miasto].filter(Boolean).join(" ");
  if (kodMiasto) lines.push(kodMiasto);
  if (inv.klient_kraj) lines.push(inv.klient_kraj);
  if (lines.length > 0) return lines;
  return inv.klient_adres ? inv.klient_adres.split("\n").filter(Boolean) : [];
}

/** Dodaje N dni do daty ISO (lub do dziś, gdy brak bazowej daty) — do
 * szybkiego ustawiania terminu płatności (7/14/30 dni) bez ręcznego wyboru
 * z koła dat. */
export function addDaysISO(baseIso: string | null, days: number): string {
  const base = baseIso ? new Date(`${baseIso.slice(0, 10)}T00:00:00`) : new Date();
  const d = new Date(base.getTime() + days * 86400000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

/** Kwota słownie po polsku — uproszczona wersja dla złotych i groszy na
 * fakturze ("1 234,50 zł" → "tysiąc dwieście trzydzieści cztery zł 50/100").
 * Świadomie prosta: pełna odmiana nie jest wymagana prawnie, ale kwota słownie
 * bywa oczekiwana na fakturze. */
export function amountInWords(n: number): string {
  const zl = Math.floor(n);
  const gr = Math.round((n - zl) * 100);
  return `${zl} zł ${String(gr).padStart(2, "0")}/100`;
}
