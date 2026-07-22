"use client";

// Klienckie re-eksporty czystej logiki + drobne komponenty UI Przypomnień —
// ten sam wzorzec, co `notes/shared.tsx` i reszta modułów (CLAUDE.md).

export {
  REMINDER_LIST_COLORS,
  DEFAULT_LIST_COLOR,
  PRIORITY_LABEL,
  priorityMark,
  listColorClass,
  listDotClass,
  isOverdue,
  compareReminders,
} from "@/lib/reminders";
export type { Reminder, ReminderList, ReminderListColor } from "@/lib/reminders";

import { listDotClass, priorityMark, type Reminder } from "@/lib/reminders";
import { formatPlDate } from "@/lib/projects";

/** Kropka koloru listy — ten sam znak, co w apce. */
export function KropkaListy({ kolor }: { kolor: string | null | undefined }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${listDotClass(kolor)}`} />;
}

/** Wykrzykniki priorytetu. Złoto = „wymaga ruchu", zgodnie ze słownikiem
 * koloru panelu (patrz `slownik-koloru-audyt`, brand.gold przy terminach). */
export function ZnakPriorytetu({ priorytet }: { priorytet: number }) {
  const znak = priorityMark(priorytet);
  if (!znak) return null;
  return <span className="font-semibold text-brand-gold" title={`Priorytet: ${znak}`}>{znak}</span>;
}

/** Termin przypomnienia. Po terminie na czerwono — jedyne miejsce w tym
 * module, gdzie czerwień w ogóle występuje, i znaczy to samo, co wszędzie
 * indziej w panelu (zaległość). Data ZAWSZE przez `formatPlDate` — nigdy
 * surowy ISO z bazy (CLAUDE.md, pułapka `<input type="date">`). */
export function TerminPrzypomnienia({ r, dzisISO }: { r: Reminder; dzisISO: string }) {
  if (!r.termin) return null;
  const poTerminie = !r.ukonczone && r.termin < dzisISO;
  return (
    <span className={`text-[11.5px] ${poTerminie ? "text-red-400" : "text-muted"}`}>
      {formatPlDate(r.termin)}
      {r.godzina ? `, ${r.godzina}` : ""}
    </span>
  );
}
