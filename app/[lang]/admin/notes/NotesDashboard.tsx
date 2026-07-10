"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { type Note, parseTags } from "@/lib/notes";
import { EditableText, EditableTextarea } from "../components";
import { useUI } from "../ui";

export function NotesDashboard({ lang }: { lang: Locale }) {
  const router = useRouter();
  const { toast, confirm } = useUI();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [newText, setNewText] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [promoting, setPromoting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notes");
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    const data = (await res.json()) as { notes: Note[] };
    setNotes(data.notes);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addNote = async () => {
    if (!newText.trim()) return;
    const [firstLine, ...rest] = newText.trim().split("\n");
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tytul: firstLine.slice(0, 120), tresc: rest.join("\n") || firstLine }),
    });
    if (res.ok) {
      setNewText("");
      load();
    } else {
      toast("Nie udało się zapisać notatki.", "error");
    }
  };

  const updateNote = async (id: string, field: string, value: string) => {
    setNotes((prev) => prev?.map((n) => (n.id === id ? { ...n, [field]: value } : n)) ?? prev);
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) toast("Nie udało się zapisać zmiany.", "error");
  };

  const deleteNote = async (id: string) => {
    const ok = await confirm("Usunąć tę notatkę?", { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć.", "error");
      return;
    }
    setNotes((prev) => prev?.filter((n) => n.id !== id) ?? prev);
    toast("Notatka usunięta.");
  };

  const promoteToProject = async (note: Note) => {
    setPromoting(note.id);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tytul: note.tytul || "Bez tytułu", opis: note.tresc }),
    });
    setPromoting(null);
    if (res.ok) {
      toast("Przekuto w projekt.");
      router.push(`/${lang}/admin/projects`);
    } else {
      toast("Nie udało się utworzyć projektu.", "error");
    }
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    (notes ?? []).forEach((n) => parseTags(n.tagi).forEach((t) => set.add(t)));
    return [...set];
  }, [notes]);

  const filtered = useMemo(() => {
    if (!tagFilter) return notes ?? [];
    return (notes ?? []).filter((n) => parseTags(n.tagi).includes(tagFilter));
  }, [notes, tagFilter]);

  if (!notes) {
    return <div className="h-48 animate-pulse rounded-2xl bg-[var(--hairline)]" />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
          Notatnik <span className="text-liquid">/ pomysły</span>
        </h1>
        <p className="text-sm text-muted">Zapisz szybko, uporządkuj później. Pomysł możesz przekuć w projekt jednym klikiem.</p>
      </div>

      <div className="card-paper mb-6 rounded-2xl p-4">
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Nowy pomysł / notatka… pierwsza linia stanie się tytułem."
          rows={3}
          className="w-full rounded-xl border hairline bg-transparent px-3 py-2 text-sm text-[var(--fg)] placeholder:text-muted"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={addNote}
            disabled={!newText.trim()}
            className="btn-primary rounded-full px-4 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Zapisz notatkę
          </button>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            onClick={() => setTagFilter("")}
            className={`rounded-full px-2.5 py-1 text-[11px] ${!tagFilter ? "bg-[var(--fg)] text-[var(--bg)]" : "border hairline text-muted"}`}
          >
            Wszystkie
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter(t)}
              className={`rounded-full px-2.5 py-1 text-[11px] ${tagFilter === t ? "bg-[var(--fg)] text-[var(--bg)]" : "border hairline text-muted"}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted opacity-60">Brak notatek — dodaj pierwszą powyżej.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n) => (
            <div key={n.id} className="card-paper rounded-2xl p-4">
              <EditableText value={n.tytul} onSave={(v) => updateNote(n.id, "tytul", v)} />
              <div className="mt-1 text-sm">
                <EditableTextarea value={n.tresc} onSave={(v) => updateNote(n.id, "tresc", v)} />
              </div>
              <div className="mt-2">
                <input
                  key={n.id}
                  defaultValue={n.tagi}
                  onBlur={(e) => updateNote(n.id, "tagi", e.target.value)}
                  placeholder="tagi, po przecinku"
                  className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-muted placeholder:text-muted/60 hover:border-[var(--hairline)] focus:border-brand-cyan/60 focus:outline-none"
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={() => promoteToProject(n)}
                  disabled={promoting === n.id}
                  className="rounded-full border hairline px-2.5 py-1 text-[11px] text-liquid disabled:opacity-50"
                >
                  {promoting === n.id ? "Tworzę…" : "→ Przekuj w projekt"}
                </button>
                <button
                  onClick={() => deleteNote(n.id)}
                  className="text-muted hover:text-red-400"
                  aria-label="Usuń notatkę"
                  title="Usuń"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
