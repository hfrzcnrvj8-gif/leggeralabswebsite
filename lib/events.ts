import { todayLocalISO } from "./dates";

// Nazwane HubEvent, żeby nie kolidować z wbudowanym DOM-owym typem Event.
export type HubEvent = {
  id: string;
  tytul: string;
  opis: string;
  data: string; // YYYY-MM-DD
  godzina: string | null; // "HH:MM" albo null (wydarzenie całodniowe)
  lead_id: string | null;
  project_id: string | null;
  created_at: string;
};

export function todayISO(): string {
  return todayLocalISO();
}

export function isPast(dateStr: string): boolean {
  return dateStr < todayISO();
}
