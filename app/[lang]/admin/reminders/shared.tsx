"use client";

// Klienckie re-eksporty czystej logiki + drobne komponenty UI Przypomnień —
// ten sam wzorzec, co `notes/shared.tsx` i reszta modułów (CLAUDE.md).

export {
  REMINDER_LIST_COLORS,
  DEFAULT_LIST_COLOR,
  PRIORITY_LABEL,
  PROG_LEZY_DNI,
  priorityMark,
  listColorClass,
  listDotClass,
  isOverdue,
  dniLezenia,
  seriaMaPrzyszlosc,
  compareReminders,
} from "@/lib/reminders";
export type { Reminder, ReminderList, ReminderListColor } from "@/lib/reminders";

import { listDotClass, priorityMark, dniLezenia, type Reminder } from "@/lib/reminders";
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
  if (!r.termin) return <ZnakLezenia r={r} />;
  const poTerminie = !r.ukonczone && r.termin < dzisISO;
  return (
    <span className={`text-[11.5px] ${poTerminie ? "text-red-400" : "text-muted"}`}>
      {formatPlDate(r.termin)}
      {r.godzina ? `, ${r.godzina}` : ""}
    </span>
  );
}

/** „leży od 4 miesięcy" przy bezterminowym przypomnieniu, które przekroczyło
 * próg. ŚWIADOMIE szare i świadomie bez pigułki: brak terminu **nie jest
 * zaległością** (`isOverdue` zwraca dla niego `false` i tak zostaje), więc
 * czerwień albo tło byłyby kłamstwem o stanie. To jedyna rzecz, jaka pilnuje
 * spraw bez terminu — nic innego ich nie dotyka. Decyzja właściciela
 * z 2026-08-01; próg i uzasadnienie: `PROG_LEZY_DNI` w `lib/reminders.ts`. */
function ZnakLezenia({ r }: { r: Reminder }) {
  const dni = dniLezenia(r);
  if (dni === null) return null;
  const miesiace = Math.floor(dni / 30);
  // „od" rządzi DOPEŁNIACZEM, więc nie da się tu użyć `odmienPl` — ta funkcja
  // odmienia mianownikowe „3 miesiące", a po „od" poprawne jest „3 miesięcy"
  // dla każdej liczby poza jedynką. Wersja z `odmienPl` pisała na ekranie
  // „leży od 4 miesiące" (zobaczone w podglądzie, nie wydedukowane).
  const opis = miesiace >= 12 ? "ponad rok" : miesiace === 1 ? "miesiąca" : `${miesiace} miesięcy`;
  return (
    <span className="text-[11.5px] text-muted" title={`Bez terminu od ${dni} dni. To nie jest zaległość.`}>
      leży od {opis}
    </span>
  );
}
