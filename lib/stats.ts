// Czysta logika Pulpitu-Statystyk (Moduł 18) — bez "use client", współdzielona
// przez app/api/stats/route.ts i UI. Same agregacje po istniejących danych
// (leady, projekty, faktury, klienci) — zero nowych tabel, zero AI/LLM.

export const STATS_MONTH_LABEL = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

export function statsMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${STATS_MONTH_LABEL[m - 1]} ${String(y).slice(2)}`;
}

/** Lista kluczy "YYYY-MM" dla ostatnich `monthsCount` miesięcy licząc od
 * `todayIso` (najstarszy pierwszy) — ta sama logika co w
 * app/api/costs/analytics/route.ts, wydzielona tu, żeby route Statystyk i
 * ewentualne kolejne moduły nie duplikowały jej po raz trzeci. */
export function statsMonthKeys(todayIso: string, monthsCount: number): string[] {
  const months: string[] = [];
  const [y0, m0] = todayIso.slice(0, 7).split("-").map(Number);
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y0, m0 - 1 - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export function statsAvg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function statsRound1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Punkt jednej serii trendu miesięcznego — `value: null` = brak danych w
 * danym miesiącu (mniej mylące niż cichy 0 przy metrykach typu "średni czas"). */
export type StatsTrendPoint = { month: string; value: number | null };
