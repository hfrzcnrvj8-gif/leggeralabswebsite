export type Note = {
  id: string;
  tytul: string;
  tresc: string;
  /** CSV, np. "pomysł, marketing" — parsowane w UI przez parseTags(). */
  tagi: string;
  created_at: string;
  updated_at: string;
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
