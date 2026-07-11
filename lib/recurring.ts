// Faktury cykliczne — szablon, z którego cron codziennie generuje kolejną
// fakturę (szkic) gdy nadejdzie `next_run`. Bez integracji płatności
// automatycznych — właściciel i tak musi ręcznie wystawić/wysłać wygenerowany
// szkic, to tylko oszczędza przepisywanie tych samych pozycji co miesiąc.

import type { InvoiceLang } from "./invoices";
import { todayLocalISO } from "./dates";

export const RECURRING_CYCLES = ["miesiecznie", "kwartalnie", "rocznie"] as const;
export type RecurringCycle = (typeof RECURRING_CYCLES)[number];
export const RECURRING_CYCLE_LABEL: Record<RecurringCycle, string> = {
  miesiecznie: "Co miesiąc",
  kwartalnie: "Co kwartał",
  rocznie: "Co rok",
};

export type RecurringItem = {
  nazwa: string;
  ilosc: number;
  jednostka: string;
  cena_netto: number;
  vat_stawka: string;
};

export type RecurringInvoice = {
  id: string;
  nazwa: string;
  klient_nazwa: string;
  klient_nip: string;
  klient_ulica: string;
  klient_kod: string;
  klient_miasto: string;
  klient_kraj: string;
  klient_email: string;
  waluta: string;
  jezyk: InvoiceLang;
  termin_dni: number;
  pozycje: RecurringItem[];
  cykl: RecurringCycle;
  next_run: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Kolejny termin generowania po dacie `fromIso`, wg cyklu — liczone w
 * miesiącach kalendarzowych (nie w dniach), żeby "co miesiąc" od 31. zawsze
 * trafiało na ten sam dzień miesiąca (z naturalnym obcięciem w krótszych
 * miesiącach przez `Date`). */
export function nextRunAfter(fromIso: string, cykl: RecurringCycle): string {
  const months = cykl === "miesiecznie" ? 1 : cykl === "kwartalnie" ? 3 : 12;
  const d = new Date(`${fromIso.slice(0, 10)}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return todayLocalISO();
}
