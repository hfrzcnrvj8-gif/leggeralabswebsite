// Moduł 19 — śledzenie czasu pracy. Czysta logika (bez "use client"), re-used
// przez API routes i UI (patrz app/[lang]/admin/projects/shared.tsx).

export type TimeEntrySource = "manual" | "timer";

export type TimeEntry = {
  id: string;
  project_id: string;
  task_id: string | null;
  source: TimeEntrySource;
  entry_date: string; // "YYYY-MM-DD"
  started_at: string | null;
  ended_at: string | null;
  minutes: number;
  note: string;
  created_at: string;
};

/** Suma minut z listy wpisów — pomija aktualnie działający stoper (jeszcze
 * nie ma ostatecznego `minutes`), żeby nie liczyć niedokończonej sesji. */
export function sumMinutes(entries: TimeEntry[]): number {
  return entries.reduce((sum, e) => (e.ended_at === null && e.source === "timer" ? sum : sum + e.minutes), 0);
}

/** "125" → "2 godz. 5 min" (0 min pomijane, 0 godz. pomijane). Świadomie bez
 * "00:00" — to narzędzie do samopoznania, nie stoper sportowy. */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0 && m === 0) return "0 min";
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} godz.`;
  return `${h} godz. ${m} min`;
}

/** Efektywna stawka godzinowa = zysk netto projektu / godziny poświęcone.
 * `null` gdy brak zalogowanego czasu — UI pokazuje wtedy podpowiedź zamiast
 * dzielenia przez zero. Świadomie liczona od ZYSKU (nie przychodu) — to ma
 * pokazać prawdziwą rentowność liczoną też czasem właściciela, nie tylko ile
 * "wpływa" z faktur. */
export function effectiveHourlyRate(zyskNetto: number, totalMinutes: number): number | null {
  if (totalMinutes <= 0) return null;
  return zyskNetto / (totalMinutes / 60);
}
