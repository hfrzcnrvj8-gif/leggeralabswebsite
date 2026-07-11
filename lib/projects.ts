// Czysta logika projektów/wdrożeń — bez "use client", żeby mogła być
// re-używana zarówno przez UI, jak i serwerowe route'y (agregacja
// dashboardu, dzienny raport mailowy). Wzorowane 1:1 na lib/leads.ts.

export type Project = {
  id: string;
  tytul: string;
  opis: string;
  status: string;
  priorytet: string;
  zdrowie: string;
  start: string | null;
  termin: string | null;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
  /** Agregat z listy /api/projects — liczba zadań łącznie/ukończonych.
   * Opcjonalne, bo endpointy pojedynczego projektu ich nie zwracają
   * (tam liczymy bezpośrednio z pełnej listy `tasks`). */
  task_total?: number;
  task_done?: number;
};

export type ProjectTask = {
  id: string;
  project_id: string;
  text: string;
  done: boolean;
  position: number;
  milestone_id: string | null;
  created_at: string;
};

export type ProjectActivity = {
  id: string;
  project_id: string;
  text: string;
  /** "note" = ręczny wpis użytkownika, "system" = automatyczny log zmiany
   * (status/priorytet/zdrowie/data), renderowany dyskretnie. */
  kind: "note" | "system";
  created_at: string;
};

export type ProjectMilestone = {
  id: string;
  project_id: string;
  nazwa: string;
  termin: string | null;
  position: number;
  created_at: string;
};

export type ProjectResource = {
  id: string;
  project_id: string;
  etykieta: string;
  url: string;
  position: number;
  created_at: string;
};

export const PROJECT_STATUSES = [
  "Pomysł",
  "Planowanie",
  "W trakcie",
  "Testy / review",
  "Wdrożone",
  "Wstrzymane",
] as const;

export const PROJECT_PRIORITIES = ["Niski", "Normalny", "Wysoki", "Krytyczny"] as const;

export const PROJECT_STATUS_CLASS: Record<string, string> = {
  Pomysł: "bg-[var(--hairline)] text-muted",
  Planowanie: "bg-brand-gold/15 text-brand-gold",
  "W trakcie": "bg-brand-cyan/15 text-brand-cyan",
  "Testy / review": "bg-orange-500/15 text-orange-400",
  Wdrożone: "bg-emerald-500/20 text-emerald-400 font-semibold",
  Wstrzymane: "bg-[var(--hairline)] text-muted opacity-70",
};

export const PROJECT_STATUS_DOT: Record<string, string> = {
  Pomysł: "bg-[var(--fg-muted)]",
  Planowanie: "bg-brand-gold",
  "W trakcie": "bg-brand-cyan",
  "Testy / review": "bg-orange-500",
  Wdrożone: "bg-emerald-600",
  Wstrzymane: "bg-[var(--hairline)]",
};

const CLOSED_PROJECT_STATUSES = new Set(["Wdrożone"]);

/** Projekt "wymaga działania" jeśli ma minięty/dzisiejszy termin i nie jest
 * zamknięty — ten sam duch co isOverdue() dla leadów. */
export function isProjectOverdue(p: Project): boolean {
  if (CLOSED_PROJECT_STATUSES.has(p.status)) return false;
  if (!p.termin) return false;
  const today = new Date().toISOString().slice(0, 10);
  return p.termin <= today;
}

/** Liczba dni od dziś do daty (dodatnia = przyszłość, 0 = dziś, ujemna =
 * przeszłość). null gdy brak/niepoprawna data. */
export function daysFromToday(s: string | null | undefined): number | null {
  if (!s) return null;
  const target = new Date(`${s.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/** Krótka etykieta względna terminu: „dziś", „jutro", „za 3 dni", „wczoraj",
 * „3 dni po terminie". Pusty string gdy brak daty. */
export function relativeDeadline(s: string | null | undefined): string {
  const d = daysFromToday(s);
  if (d == null) return "";
  if (d === 0) return "dziś";
  if (d === 1) return "jutro";
  if (d === -1) return "wczoraj";
  if (d > 1) return `za ${d} dni`;
  return `${-d} dni po terminie`;
}

// "Zdrowie" — ręcznie ustawiana ocena, niezależna od statusu na tablicy
// (styl Linear: projekt może być "W trakcie" i jednocześnie "Zagrożony").
export const PROJECT_HEALTHS = ["Na dobrej drodze", "Zagrożony", "Zerwany"] as const;

export const PROJECT_HEALTH_CLASS: Record<string, string> = {
  "Na dobrej drodze": "bg-emerald-500/15 text-emerald-400",
  Zagrożony: "bg-orange-500/15 text-orange-400",
  Zerwany: "bg-red-500/15 text-red-400",
};

/** Postęp checklisty/kamienia milowego jako "X% z Y" — bezpieczny na 0/0. */
export function progressOf(tasks: { done: boolean }[]): { pct: number; total: number; done: number } {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { pct: total === 0 ? 0 : Math.round((done / total) * 100), total, done };
}

/** Waliduje "sensowną" datę (YYYY-MM-DD, rok 2000–2100) — chroni przed
 * pułapką natywnego <input type="date">, gdzie da się przypadkowo zapisać
 * niepełny rok (np. wpisanie "202" i odkliknięcie pola zanim dopiszesz "6"). */
export function isPlausibleDateString(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const year = Number(m[1]);
  return year >= 2000 && year <= 2100;
}

/** Formatuje datę ISO (YYYY-MM-DD, ew. z częścią czasową) na czytelną
 * postać pl-PL — używane wszędzie tam, gdzie wcześniej wyciekały surowe
 * stringi/timestampy prosto z bazy. */
export function formatPlDate(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(`${s.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}
