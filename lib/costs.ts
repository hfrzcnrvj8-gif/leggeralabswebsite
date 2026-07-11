// Czysta logika modułu Koszty — bez "use client", re-używana przez UI i
// serwerowe route'y. Wzorowane na lib/invoices.ts (dokument finansowy z
// kwotami/VAT/statusem), ale odwrotny kierunek: to faktury PRZYCHODZĄCE od
// dostawców (wydatki firmy), nie sprzedażowe. Świadomie tylko PLN w v1 i bez
// uploadu załączników — patrz memory koszty-module-candidate.

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
};

/** Kwota brutto z netto + stawki VAT (np. dla auto-przeliczenia w edytorze). */
export function costBrutto(netto: number, vatStawka: string): number {
  return round2(netto * (1 + vatFraction(vatStawka)));
}
