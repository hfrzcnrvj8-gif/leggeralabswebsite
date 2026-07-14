// Wspólna funkcja "dzisiejsza data" — bez "use client", używana zarówno w
// czystej logice (lib/*.ts) jak i w API routes / komponentach klienckich.

/** Dzisiejsza data w strefie Europe/Warsaw jako "YYYY-MM-DD". Świadomie NIE
 * `new Date().toISOString().slice(0, 10)` (to UTC) ani `d.getFullYear()`/
 * `d.getDate()` (to strefa czasowa procesu — na Vercelu domyślnie też UTC,
 * nie polska) — oba dają błędny wynik w oknie ok. 00:00–02:00 czasu
 * polskiego (w zależności od czasu letniego/zimowego), gdzie coś z
 * terminem "dziś" wygląda jeszcze jak "jutro" wg UTC. Intl z jawną strefą
 * czasową działa poprawnie niezależnie od strefy procesu i przechodzi przez
 * zmiany czasu letniego automatycznie. */
export function todayLocalISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "dateStr + N dni" jako "YYYY-MM-DD" — czysta arytmetyka dat w UTC (nie
 * realny zegar), więc odporne na przesunięcia stref/DST. Współdzielone przez
 * `addDaysLocalISO` (poniżej) i kalendarz (nawigacja tydzień/dzień, zakresy
 * wydarzeń wielodniowych). */
export function addDaysToISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(dt);
}

/** "Dziś + N dni" jako "YYYY-MM-DD" — do szybkich chipów przypomnień
 * (jutro/za 3 dni/za tydzień). */
export function addDaysLocalISO(days: number): string {
  return addDaysToISO(todayLocalISO(), days);
}

/** Liczba dni między dwiema datami ISO ("YYYY-MM-DD"), jako `b - a` — czysta
 * arytmetyka dat w UTC (nie realny zegar), spójna z `addDaysToISO`. Dodatnia,
 * gdy `b` jest późniejsze niż `a` (np. "ile dni po terminie płatności" =
 * `daysBetweenISO(termin, dziś)`). */
export function daysBetweenISO(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}
