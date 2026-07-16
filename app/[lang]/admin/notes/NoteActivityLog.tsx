"use client";

// Log aktywności notatki.
//
// Do Modułu 26 mieszkał wewnątrz NotesDashboard i był doklejony do KAŻDEJ
// karty na liście — jedyne dostępne miejsce, bo notatka nie miała profilu.
// Efekt: rząd zwijanych „▸ Log" w gęstej siatce trzech kolumn. Teraz log żyje
// w profilu (modal + podstrona `[id]`), gdzie ma miejsce, a karta pokazuje
// samą treść. Wpisy dopisuje też serwer przy przekuciu w projekt/wydarzenie —
// stąd log bywa niepusty, choć właściciel nic w nim ręcznie nie napisał.

import { useCallback, useEffect, useState } from "react";
import { type NoteActivity } from "@/lib/notes";
import { useUI } from "../ui";

export function NoteActivityLog({
  noteId,
  defaultOpen = false,
}: {
  noteId: string;
  defaultOpen?: boolean;
}) {
  const { toast, confirm } = useUI();
  const [open, setOpen] = useState(defaultOpen);
  const [activity, setActivity] = useState<NoteActivity[] | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/notes/${noteId}/activity`);
    if (!res.ok) return;
    const data = (await res.json()) as { activity: NoteActivity[] };
    setActivity(data.activity);
  }, [noteId]);

  // Wczytujemy dopiero, gdy log jest otwarty — przy zamkniętym to żądanie na
  // darmo. `defaultOpen` (profil) ładuje od razu.
  useEffect(() => {
    if (open && activity === null) load();
  }, [open, activity, load]);

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
    <div className="mt-3 border-t hairline pt-2">
      <button onClick={() => setOpen((o) => !o)} className="text-[11px] text-muted hover:text-[var(--fg)]">
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
                    {new Date(a.created_at).toLocaleString("pl-PL", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
