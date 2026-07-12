// Czysta logika modułu Koszty — bez "use client", re-używana przez UI i
// serwerowe route'y. Wzorowane na lib/invoices.ts (dokument finansowy z
// kwotami/VAT/statusem), ale odwrotny kierunek: to faktury PRZYCHODZĄCE od
// dostawców (wydatki firmy), nie sprzedażowe. Świadomie tylko PLN w v1.

/** Dozwolone typy plików załącznika (skan/PDF faktury od dostawcy) i limit
 * rozmiaru — pilnowane też po stronie API (app/api/costs/[id]/attachment). */
export const ATTACHMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024; // 8 MB — skan/PDF faktury, nie duży plik

import { formatMoney, round2, VAT_RATES, vatFraction, type VatRate } from "./invoices";

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
