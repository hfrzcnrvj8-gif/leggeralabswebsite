"use client";

// Wzorem app/[lang]/admin/clients/shared.tsx — typy i czysta logika w
// lib/costs.ts, tu tylko re-eksport + StatusTag specyficzny dla kosztów.
export {
  type Cost,
  type CostCategory,
  type CostStatus,
  type PaymentMethod,
  COST_CATEGORIES,
  COST_STATUSES,
  COST_STATUS_CLASS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHOD_ICON,
  PAYMENT_METHOD_CLASS,
  VAT_RATES,
  AMORTYZACJA_PROG_NETTO,
  VAT_ODLICZENIE_OPTIONS,
  VAT_ODLICZENIE_LABEL,
  costBrutto,
  vatDoOdliczenia,
  formatMoney,
} from "@/lib/costs";

import { COST_STATUSES, COST_STATUS_CLASS, type CostStatus } from "@/lib/costs";
import { StatusPill } from "../components";

export function StatusTag({
  status,
  onChange,
  className = "",
}: {
  status: CostStatus;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <StatusPill value={status} options={COST_STATUSES} classMap={COST_STATUS_CLASS} onChange={onChange} className={className} />
  );
}
