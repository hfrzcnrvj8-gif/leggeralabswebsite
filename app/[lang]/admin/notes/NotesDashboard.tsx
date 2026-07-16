"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { type Note, type NoteActivity, parseTags } from "@/lib/notes";
import { EditableText, EditableTextarea } from "../components";
import { FilterPills } from "../FilterPills";
import { useUI, useRegisterActions } from "../ui";

export function NotesDashboard({ lang }: { lang: Locale }) {
  const router = useRouter();
  const { toast, confirm } = useUI();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [newText, setNewText] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [search, setSearch] = useState("");
  const [promoting, setPromoting] = useState<string | null>(null);
  const newTextRef = useRef<HTMLTextAreaElement>(null);

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
    const saved = window.localStorage.getItem("leggera_notes_tag_filter");
    if (saved) setTagFilter(saved);
  }, [load]);

  useEffect(() => {
    window.localStorage.setItem("leggera_notes_tag_filter", tagFilter);
  }, [tagFilter]);

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
    let list = notes ?? [];
    if (tagFilter) list = list.filter((n) => parseTags(n.tagi).includes(tagFilter));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((n) => n.tytul.toLowerCase().includes(q) || n.tresc.toLowerCase().includes(q));
    }
    return list;
  }, [notes, tagFilter, search]);

  useRegisterActions(
    [{ id: "add", label: "+ Nowa notatka", hint: "N", run: () => newTextRef.current?.focus() }],
    []
  );

  if (!notes) {
    return <div className="h-48 animate-pulse rounded-2xl bg-[var(--hairline)]" />;
  }

  return (
    <div className="-mx-4 sm:-mx-6">
      <div className="flex items-center gap-2 border-b hairline px-4 sm:px-6" style={{ height: "44px" }}>
        <span className="text-[13px] text-muted">Notatnik · {notes.length}</span>
        <span className="flex-1" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj…"
          className="w-40 rounded-md bg-transparent px-2 py-1 text-[12.5px] text-[var(--fg)] placeholder:text-muted"
        />
      </div>

      <div className="px-4 py-4 sm:px-6">
      <div className="card-paper mb-6 rounded-xl border hairline p-4">
        <textarea
          ref={newTextRef}
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              addNote();
            }
          }}
          placeholder="Nowy pomysł / notatka… pierwsza linia stanie się tytułem. (Cmd+Enter, by zapisać)"
          rows={3}
          className="w-full rounded-lg border hairline bg-transparent px-3 py-2 text-sm text-[var(--fg)] placeholder:text-muted"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={addNote}
            disabled={!newText.trim()}
            className="rounded-md border hairline px-3 py-1.5 text-[12.5px] font-medium text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Zapisz notatkę
          </button>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <FilterPills
            value={tagFilter}
            onChange={setTagFilter}
            size="sm"
            pills={[{ id: "", label: "Wszystkie" }, ...allTags.map((t) => ({ id: t, label: t }))]}
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted opacity-60">📝 Brak notatek — dodaj pierwszą powyżej.</p>
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
                  className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-muted placeholder:text-muted/60 hover:border-[var(--hairline)] focus:border-[#4ea7fc]/60 focus:outline-none"
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={() => promoteToProject(n)}
                  disabled={promoting === n.id}
                  className="rounded-md border hairline px-2.5 py-1 text-[11px] text-[#4ea7fc] disabled:opacity-50"
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
              <NoteActivityLog noteId={n.id} />
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

/** Zwijany log aktywności notatki — mniejsza wersja tego, co leady/projekty
 * mają jako pełną sekcję w panelu szczegółów. Notatki nie mają osobnej
 * podstrony/peek panelu, więc log żyje bezpośrednio w karcie. */
function NoteActivityLog({ noteId }: { noteId: string }) {
  const { toast, confirm } = useUI();
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState<NoteActivity[] | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/notes/${noteId}/activity`);
    if (!res.ok) return;
    const data = (await res.json()) as { activity: NoteActivity[] };
    setActivity(data.activity);
  }, [noteId]);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (next && activity === null) load();
      return next;
    });
  };

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/notes/${noteId}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      const data = (await res.json()) as { activity: NoteActivity[] };
      setActivity(data.activity);
      setText("");
    } else {
      toast("Nie udało się zapisać wpisu.", "error");
    }
  };

  const removeEntry = async (activityId: string) => {
    const ok = await confirm("Usunąć ten wpis z logu?", { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/notes/${noteId}/activity/${activityId}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć wpisu.", "error");
      return;
    }
    setActivity((prev) => prev?.filter((a) => a.id !== activityId) ?? prev);
  };

  return (
    <div className="mt-2 border-t hairline pt-2">
      <button onClick={toggle} className="text-[11px] text-muted hover:text-[var(--fg)]">
        {open ? "▾" : "▸"} Log{activity && activity.length > 0 ? ` (${activity.length})` : ""}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex items-start gap-1.5">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Dodaj wpis… (Cmd+Enter)"
              rows={2}
              className="w-full rounded-lg border hairline bg-transparent px-2 py-1 text-[11px] text-[var(--fg)] placeholder:text-muted"
            />
            <button
              onClick={submit}
              disabled={saving || !text.trim()}
              className="shrink-0 rounded-full border hairline px-2 py-1 text-[11px] disabled:opacity-50"
            >
              {saving ? "…" : "Dodaj"}
            </button>
          </div>
          {activity === null ? (
            <p className="text-[11px] text-muted opacity-60">Wczytuję…</p>
          ) : activity.length === 0 ? (
            <p className="text-[11px] text-muted opacity-60">📭 Brak wpisów.</p>
          ) : (
            <ul className="space-y-1.5">
              {activity.map((a) => (
                <li key={a.id} className="rounded-lg border hairline p-1.5 text-[11px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="whitespace-pre-wrap">{a.text}</span>
                    <button
                      onClick={() => removeEntry(a.id)}
                      className="shrink-0 text-muted hover:text-red-400"
                      aria-label="Usuń wpis"
                      title="Usuń"
                    >
                      ✕
                    </button>
                  </div>
                  <span className="text-muted opacity-70">
                    {new Date(a.created_at).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
