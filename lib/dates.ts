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
