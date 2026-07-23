// Notatnik — czysta logika (bez "use client"), re-używana przez API routes i
// UI, zgodnie z architekturą modułów z CLAUDE.md.

import type { LinkValue } from "./links";

export type Note = {
  id: string;
  tytul: string;
  tresc: string;
  /** CSV, np. "pomysł, marketing" — parsowane w UI przez parseTags(). */
  tagi: string;
  created_at: string;
  updated_at: string;
  /** Powiązania z CRM: kolumny dołożył Moduł 22, UI dał im dopiero Moduł 26.
   * `client_id`/`lead_id` są wzajemnie wyłączne — patrz linkValueFor(). */
  client_id: string | null;
  lead_id: string | null;
  /** Ustawiane przez „Przekuj w projekt". Niepuste = projekt już powstał, więc
   * przycisk zmienia się w link zamiast tworzyć kolejny (Moduł 26 pkt 1). */
  project_id: string | null;
  /** To samo co project_id, ale dla „Do kalendarza". */
  event_id: string | null;
  /** Mail, z którego powstał szkic tej notatki (Moduł 50, „Szkic notatki").
   * NULL dla notatek dodanych ręcznie — to jedyne dziś źródło szkicu, więc
   * pole nie rozróżnia SKĄD (zawsze mail), tylko CZY w ogóle. */
  source_mail_id: string | null;
  /** Przypięte lądują na górze listy, przed sortowaniem po updated_at. */
  pinned: boolean;
  /** Niepuste = notatka w archiwum. Archiwum jest domyślnym „usuwaniem"
   * (decyzja właściciela 2026-07-17); trwałe usunięcie zostaje, ale schodzi
   * do zakładki Archiwum. */
  archived_at: string | null;

  /* Pola POCHODNE — doklejane JOIN-em w GET /api/notes, nie kolumny `notes`.
   * Bez nich plakietka „przekuto w…" mogłaby napisać tylko „Projekt", zamiast
   * powiedzieć KTÓRY i NA KIEDY. Nie wysyłaj ich z powrotem PATCH-em. */
  project_tytul?: string | null;
  event_data?: string | null;
  /** Temat maila wskazanego przez source_mail_id — do plakietki „z maila".
   * Doklejane JOIN-em wzorem project_tytul/event_data, nie kolumna `notes`. */
  source_mail_subject?: string | null;
  /** Wpisy z logu sklejone w jeden string — TYLKO na potrzeby wyszukiwarki.
   * Do wyświetlania służy GET /api/notes/:id/activity (pełne rekordy z datą). */
  log_text?: string | null;
};

export type NoteActivity = {
  id: string;
  note_id: string;
  text: string;
  created_at: string;
};

export function parseTags(tagi: string): string[] {
  return tagi
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Zakładki listy. Stan (przypięta/archiwalna) i tag to dwie NIEZALEŻNE osie —
 * tak jak status vs zdrowie projektu (CLAUDE.md) — więc zakładki są osobnym
 * rzędem pigułek niż tagi, a nie jedną wspólną listą filtrów. */
export type NoteTab = "all" | "pinned" | "archived";

export const NOTE_TABS: { id: NoteTab; label: string }[] = [
  { id: "all", label: "Wszystkie" },
  { id: "pinned", label: "Przypięte" },
  { id: "archived", label: "Archiwum" },
];

/** Czy notatka należy do zakładki. Archiwalne są niewidoczne wszędzie poza
 * „Archiwum" — inaczej archiwizacja niczego by nie sprzątała z biurka. */
export function matchesTab(note: Note, tab: NoteTab): boolean {
  if (tab === "archived") return !!note.archived_at;
  if (note.archived_at) return false;
  return tab === "pinned" ? note.pinned : true;
}

/** Powiązanie notatki jako wartość dla LinkPickera (oś kontaktu: klient/lead).
 * `project_id` świadomie NIE jest tu wyborem — ustawia je przekucie w projekt,
 * więc jest śladem pochodzenia, nie polem do ręcznej edycji. */
export function noteLinkValue(note: Note): LinkValue {
  return { client_id: note.client_id, lead_id: note.lead_id };
}
