"use client";

// Profil notatki — Moduł 26.
//
// Do tej pory Notatnik był jedynym modułem bez profilu rekordu i bez podstrony
// `[id]`; komentarz w NotesDashboard sam to przyznawał („Notatki nie mają
// osobnej podstrony/peek panelu, więc log żyje bezpośrednio w karcie"). Ten
// komponent zamyka tę niespójność z konwencją z CLAUDE.md i jest renderowany
// w DWÓCH miejscach: w modalu na liście i na `/admin/notes/[id]` — dokładnie
// jak ProjectDetailPanel.
//
// Pobiera rekord SAM (po `id`), zamiast dostawać go propsem — inaczej
// podstrona musiałaby ciągnąć całą listę, żeby znaleźć w niej jeden wiersz.

import { useCallback, useEffect, useState } from "react";
import { IconPin, IconPinFilled, IconArchive, IconArchiveOff } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { EditableText, EditableTextarea } from "../components";
import { LinkPicker } from "../LinkPicker";
import { useUI } from "../ui";
import { formatPlDate } from "@/lib/projects";
import { noteLinkValue, type Note, NoteBadges, NoteScheduleForm, useNoteActions } from "./shared";
import { NoteActivityLog } from "./NoteActivityLog";

export function NoteDetailPanel({
  id,
  lang,
  onChanged,
  onClose,
}: {
  id: string;
  lang: Locale;
  /** Woła się po każdej zmianie — lista pod modalem musi się odświeżyć. */
  onChanged?: () => void;
  /** Brak = tryb podstrony (nie ma czego zamykać). */
  onClose?: () => void;
}) {
  const [note, setNote] = useState<Note | null>(null);
  const [missing, setMissing] = useState(false);
  const { confirm } = useUI();

  const load = useCallback(async () => {
    const res = await fetch(`/api/notes/${id}`);
    if (res.status === 404) {
      setMissing(true);
      return;
    }
    if (!res.ok) return;
    const data = (await res.json()) as { note: Note };
    setNote(data.note);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    load();
    onChanged?.();
  }, [load, onChanged]);

  const { patch, togglePin, setArchived, remove, promote, schedule } = useNoteActions(refresh);

  if (missing) {
    return (
      <div className="card-paper rounded-2xl p-6">
        <p className="text-sm text-muted">Nie ma takiej notatki — mogła zostać usunięta.</p>
      </div>
    );
  }

  if (!note) {
    return <div className="h-64 animate-pulse rounded-2xl bg-[var(--hairline)]" />;
  }

  // Własny scroll i limit wysokości TYLKO w modalu (`onClose`). Na podstronie
  // przewija się cała strona — karta z wewnętrznym paskiem dawałaby scroll w
  // scrollu.
  return (
    <div
      className={`card-paper rounded-2xl p-5 sm:p-6 ${
        onClose ? "max-h-[85vh] overflow-y-auto" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={() => togglePin(note)}
          title={note.pinned ? "Odepnij" : "Przypnij na górze listy"}
          className="shrink-0 rounded-md px-1 py-0.5 text-[15px] transition-opacity hover:opacity-100"
          style={{ opacity: note.pinned ? 1 : 0.35 }}
        >
          {note.pinned ? <IconPinFilled size={15} /> : <IconPin size={15} />}
        </button>
        <div className="min-w-0 flex-1 text-[15px] font-medium">
          <EditableText value={note.tytul} onSave={(v) => patch(note.id, { tytul: v })} />
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Zamknij"
            className="shrink-0 text-muted hover:text-[var(--fg)]"
          >
            ✕
          </button>
        )}
      </div>

      <div className="mt-3 text-sm">
        <EditableTextarea value={note.tresc} onSave={(v) => patch(note.id, { tresc: v })} />
      </div>

      {/* Odręczny rysunek z Apple Pencil (apka iPad) — bez tego byłby
          widoczny tylko na urządzeniu, na którym powstał. Właściciel na
          desktopie ma go tylko oglądać/usuwać, nie edytować — rysowanie
          zostaje wyłącznie tam, gdzie jest Pencil. */}
      {note.has_attachment && (
        <div className="mt-3">
          <img
            src={`/api/notes/${note.id}/attachment`}
            alt="Odręczny rysunek"
            className="max-h-96 rounded-xl border hairline object-contain"
          />
          <button
            onClick={async () => {
              const ok = await confirm("Usunąć rysunek z tej notatki?", { danger: true });
              if (!ok) return;
              await fetch(`/api/notes/${note.id}/attachment`, { method: "DELETE" });
              refresh();
            }}
            className="mt-1.5 text-[11px] text-muted hover:text-red-400"
          >
            Usuń rysunek
          </button>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[10.5px] uppercase tracking-wide text-muted opacity-70">Powiązanie</p>
          <LinkPicker
            kinds={["client", "lead"]}
            value={noteLinkValue(note)}
            onPick={(next) => patch(note.id, next)}
          />
        </div>
        <div>
          <p className="mb-1 text-[10.5px] uppercase tracking-wide text-muted opacity-70">Tagi</p>
          <input
            defaultValue={note.tagi}
            onBlur={(e) => patch(note.id, { tagi: e.target.value })}
            placeholder="tagi, po przecinku"
            className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[12px] text-muted placeholder:text-muted/60 hover:border-[var(--hairline)] focus:border-[#4ea7fc]/60 focus:outline-none"
          />
        </div>
      </div>

      <NoteBadges note={note} lang={lang} />

      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t hairline pt-3">
        {/* Gdy projekt już istnieje, przycisku „przekuj" NIE ma — plakietka
            wyżej prowadzi do projektu. Serwer i tak by drugiego nie utworzył
            (patrz /api/notes/[id]/promote), ale przycisk, który udaje, że coś
            zrobi, a tylko przekierowuje, jest gorszy niż jego brak. */}
        {!note.project_id && (
          <button
            onClick={() => promote(note, lang)}
            className="rounded-md border hairline px-2.5 py-1 text-[11px] text-[#4ea7fc]"
          >
            → Przekuj w projekt
          </button>
        )}
        <NoteScheduleForm note={note} onSchedule={(d, g) => schedule(note, d, g)} />
        <span className="flex-1" />
        <button
          onClick={() => setArchived(note, !note.archived_at)}
          className="rounded-md border hairline px-2.5 py-1 text-[11px] text-muted transition-colors hover:text-[var(--fg)]"
        >
{note.archived_at ? (<><IconArchiveOff size={12} className="mr-1 inline align-[-2px]" />Przywróć</>) : (<><IconArchive size={12} className="mr-1 inline align-[-2px]" />Archiwizuj</>)}
        </button>
        {note.archived_at && (
          <button
            onClick={async () => {
              const gone = await remove(note);
              if (gone) onClose?.();
            }}
            className="rounded-md border hairline px-2.5 py-1 text-[11px] text-muted hover:text-red-400"
          >
            Usuń trwale
          </button>
        )}
      </div>

      <p className="mt-3 text-[10.5px] text-muted opacity-60">
        Utworzona {formatPlDate(note.created_at)} · zmieniona {formatPlDate(note.updated_at)}
        {note.archived_at && ` · w archiwum od ${formatPlDate(note.archived_at)}`}
      </p>

      <NoteActivityLog noteId={note.id} defaultOpen />
    </div>
  );
}
