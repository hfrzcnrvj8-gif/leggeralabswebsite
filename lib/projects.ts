// Czysta logika projektów/wdrożeń — bez "use client", żeby mogła być
// re-używana zarówno przez UI, jak i serwerowe route'y (agregacja
// dashboardu, dzienny raport mailowy). Wzorowane 1:1 na lib/leads.ts.

export type Project = {
  id: string;
  tytul: string;
  opis: string;
  status: string;
  priorytet: string;
  termin: string | null;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectTask = {
  id: string;
  project_id: string;
  text: string;
  done: boolean;
  position: number;
  created_at: string;
};

export type ProjectActivity = {
  id: string;
  project_id: string;
  text: string;
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
