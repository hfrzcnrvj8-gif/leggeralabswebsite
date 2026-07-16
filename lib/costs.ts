// Czysta logika modułu Koszty — bez "use client", re-używana przez UI i
// serwerowe route'y. Wzorowane na lib/invoices.ts (dokument finansowy z
// kwotami/VAT/statusem), ale odwrotny kierunek: to faktury PRZYCHODZĄCE od
// dostawców (wydatki firmy), nie sprzedażowe. Świadomie tylko PLN w v1.

/** Dozwolone typy plików załącznika (skan/PDF faktury od dostawcy) i limit
 * rozmiaru — pilnowane też po stronie API (app/api/costs/[id]/attachment). */
export const ATTACHMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024; // 8 MB — skan/PDF faktury, nie duży plik

import { formatMoney, round2, VAT_RATES, vatFraction, type VatRate } from "./invoices";
import type { RecurringCycle } from "./recurring";

export { formatMoney, round2, VAT_RATES, type VatRate };

export const COST_CATEGORIES = [
  "Usługi",
  "Sprzęt",
  "Subskrypcje",
  "Biuro",
  "Marketing",
  "Podatki i ZUS",
  "Inne",
] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export type CostStatus = "Nieopłacony" | "Opłacony";
export const COST_STATUSES: CostStatus[] = ["Nieopłacony", "Opłacony"];

export const COST_STATUS_CLASS: Record<string, string> = {
  Nieopłacony: "bg-[var(--hairline)] text-muted",
  Opłacony: "bg-emerald-500/20 text-emerald-400 font-semibold",
};

/** Moduł 9 (branżowy standard) — jak koszt został/zostanie zapłacony. Czysta
 * etykieta do raportowania i uzgadniania z wyciągiem bankowym, wzorem
 * Ramp/Expensify/QuickBooks — świadomie NIE inicjuje żadnej płatności (patrz
 * docs/plany-modulow/09-koszty-branzowy-standard.md, sekcja "poza zakresem").
 * NULL/"" = nieustawiona (koszty sprzed tej funkcji, albo jeszcze niezdecydowane). */
export const PAYMENT_METHODS = ["przelew", "karta", "gotowka", "blik", "paypal", "apple_pay"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  przelew: "Przelew",
  karta: "Karta",
  gotowka: "Gotówka",
  blik: "BLIK",
  paypal: "PayPal",
  apple_pay: "Apple Pay",
};

export const PAYMENT_METHOD_ICON: Record<PaymentMethod, string> = {
  przelew: "🏦",
  karta: "💳",
  gotowka: "💵",
  blik: "📱",
  paypal: "🅿️",
  apple_pay: "🍎",
};

export const PAYMENT_METHOD_CLASS: Record<PaymentMethod, string> = {
  przelew: "bg-brand-cyan/15 text-brand-cyan",
  karta: "bg-brand-purple/15 text-brand-purple",
  gotowka: "bg-emerald-500/15 text-emerald-400",
  blik: "bg-brand-gold/15 text-brand-gold",
  paypal: "bg-blue-500/15 text-blue-400",
  apple_pay: "bg-[var(--hairline)] text-[var(--fg)]",
};

/** Moduł 9, fundamenty zgodności — próg amortyzacji (art. 22k ustawy o PIT):
 * sprzęt/środki trwałe powyżej tej kwoty netto co do zasady NIE wchodzą
 * jednorazowo w koszty, tylko przez amortyzację. Tylko miękka podpowiedź w
 * UI — panel niczego nie blokuje ani nie rozlicza automatycznie. */
export const AMORTYZACJA_PROG_NETTO = 10000;

/** Procent VAT do odliczenia — domyślnie 100%; 50% dla samochodów mieszanego
 * użytku, 0% dla reprezentacji (art. 86a i art. 88 ust. 1 pkt 2 ustawy o
 * VAT). Właściciel wybiera sam z trzech typowych wartości — panel niczego
 * nie zgaduje po kategorii/opisie. */
export const VAT_ODLICZENIE_OPTIONS = [100, 50, 0] as const;
export const VAT_ODLICZENIE_LABEL: Record<number, string> = {
  100: "100% (pełne odliczenie)",
  50: "50% (np. samochód mieszanego użytku)",
  0: "0% (np. reprezentacja)",
};

export type Cost = {
  id: string;
  dostawca_nazwa: string;
  dostawca_nip: string;
  kategoria: CostCategory | string;
  opis: string;
  data_wydatku: string;
  kwota_netto: number;
  vat_stawka: VatRate | string;
  kwota_brutto: number;
  status: CostStatus;
  data_platnosci: string | null;
  project_id: string | null;
  /** Moduł 22 — klient/lead wprost na koszcie, niezależnie od projektu.
   * Relacja wyłączna: ustawiony jest co najwyżej jeden z nich. */
  client_id: string | null;
  lead_id: string | null;
  /** Jak koszt został/zostanie zapłacony — patrz PAYMENT_METHODS. NULL = nieustawiona. */
  metoda_platnosci: PaymentMethod | string | null;
  /** Numer konta dostawcy (IBAN) — do „Kopiuj dane do przelewu", nie do
   * inicjowania płatności (panel nigdy nie przenosi pieniędzy). */
  dostawca_konto: string;
  /** Numer faktury/dokumentu od dostawcy — ustawowy element faktury VAT
   * (art. 106e) i osobne pole w rejestrze zakupów JPK_V7. Puste = brak
   * (np. paragon bez numeru albo koszt wprowadzony przed tą funkcją). */
  numer_faktury: string;
  /** Data OTRZYMANIA faktury — osobna od `data_wydatku` (data wystawienia).
   * Liczy się dla terminu odliczenia VAT, jeśli różni się od daty
   * wystawienia. NULL = nieustawiona (opcjonalna, nie każdy koszt wymaga
   * rozróżnienia obu dat). */
  data_wplywu: string | null;
  /** Procent VAT do odliczenia — patrz VAT_ODLICZENIE_OPTIONS. */
  vat_odliczenie_procent: number;
  /** Właściciel świadomie wyciszył ostrzeżenie o możliwym duplikacie tego
   * kosztu (ten sam NIP+kwota+data co inny wpis) — nie pokazuj go ponownie. */
  duplikat_potwierdzony: boolean;
  created_at: string;
  updated_at: string;
  /** Dołączane w GET /api/costs (JOIN z projects) — tylko do wyświetlenia. */
  project_tytul?: string | null;
  /** Nazwa/typ MIME załącznika — same dane pliku (`zalacznik_dane`, base64)
   * NIE są tu zwracane (bloatowałyby listę/edytor); pobierane osobno przez
   * GET /api/costs/:id/attachment. Pusta nazwa = brak załącznika. */
  zalacznik_nazwa: string;
  zalacznik_typ: string;
  /** Numer KSeF faktury zakupowej, gdy koszt powstał z automatycznego importu
   * z KSeF (Faza 3, część 2). NULL = koszt wprowadzony ręcznie. */
  ksef_numer: string | null;
  ksef_tryb: string | null;
};

/** Odgaduje etykietę stawki VAT (jedną z VAT_RATES) z kwot netto/VAT pobranych
 * z KSeF — do wyświetlenia w edytorze. Faktura zakupowa może mieszać stawki;
 * w bazie i tak trzymamy dokładne kwoty netto/brutto z KSeF, a ta etykieta jest
 * tylko poglądowa (właściciel może ją poprawić). */
export function guessVatRate(netto: number, vat: number): VatRate {
  if (!(netto > 0)) return vat > 0 ? "23" : "zw";
  const pct = Math.round((vat / netto) * 100);
  const match = (VAT_RATES as readonly string[]).find((r) => r === String(pct));
  return (match as VatRate) ?? "23";
}

/** Kwota brutto z netto + stawki VAT (np. dla auto-przeliczenia w edytorze). */
export function costBrutto(netto: number, vatStawka: string): number {
  return round2(netto * (1 + vatFraction(vatStawka)));
}

/** Kwota VAT faktycznie do odliczenia — kwota VAT z dokumentu pomnożona
 * przez `vat_odliczenie_procent` (100/50/0, patrz VAT_ODLICZENIE_OPTIONS). */
export function vatDoOdliczenia(netto: number, vatStawka: string, procent: number): number {
  const kwotaVat = costBrutto(netto, vatStawka) - netto;
  return round2((kwotaVat * procent) / 100);
}

/** Szablon kosztu cyklicznego (abonament/subskrypcja) — wzorem
 * `RecurringInvoice` (lib/recurring.ts), ale generuje SZKICE kosztów, nie
 * faktur. Dzienny raport (app/api/leads/notify) tworzy nowy koszt-szkic, gdy
 * nadejdzie `next_run`; właściciel i tak musi ręcznie sprawdzić/opłacić. */
export type RecurringCost = {
  id: string;
  nazwa: string;
  dostawca_nazwa: string;
  dostawca_nip: string;
  dostawca_konto: string;
  kategoria: CostCategory | string;
  opis: string;
  kwota_netto: number;
  vat_stawka: VatRate | string;
  metoda_platnosci: PaymentMethod | string | null;
  project_id: string | null;
  cykl: RecurringCycle;
  next_run: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};
