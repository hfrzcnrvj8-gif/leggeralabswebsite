"use client";

import { useCallback, useEffect, useState } from "react";
import { type Project, type ProjectTask, type ProjectActivity, PROJECT_PRIORITIES, ProjectStatusTag } from "./shared";
import { EditableText, EditableTextarea } from "../components";
import { useUI } from "../ui";

/** Rdzeń widoku szczegółów projektu — pola, checklista, log aktywności.
 * Używany zarówno jako wysuwany panel ("peek") z tablicy, jak i jako
 * samodzielna podstrona /admin/projects/[id] dla bezpośrednich linków. */
export function ProjectDetailPanel({
  id,
  onClose,
  onDeleted,
  onFieldChange,
}: {
  id: string;
  onClose?: () => void;
  onDeleted?: (id: string) => void;
  onFieldChange?: (id: string, field: string, value: string) => void;
}) {
  const { confirm, toast, prompt } = useUI();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [activity, setActivity] = useState<ProjectActivity[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    const data = (await res.json()) as { project: Project; tasks: ProjectTask[]; activity: ProjectActivity[] };
    setProject(data.project);
    setTasks(data.tasks);
    setActivity(data.activity);
  }, [id]);

  useEffect(() => {
    setProject(null);
    setNotFound(false);
    load();
  }, [load]);

  const updateProject = async (field: string, value: string) => {
    setProject((prev) => (prev ? { ...prev, [field]: value } : prev));
    onFieldChange?.(id, field, value);
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) toast("Nie udało się zapisać zmiany.", "error");
  };

  const deleteProject = async () => {
    if (!project) return;
    const ok = await confirm(`Usunąć projekt "${project.tytul}"? Tego nie da się cofnąć.`, { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć projektu.", "error");
      return;
    }
    toast("Projekt usunięty.");
    onDeleted?.(id);
  };

  const addTask = async () => {
    const text = await prompt("Nowy punkt checklisty:", { placeholder: "np. przygotować ofertę" });
    if (!text) return;
    const res = await fetch(`/api/projects/${id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const data = (await res.json()) as { tasks: ProjectTask[] };
      setTasks(data.tasks);
    } else {
      toast("Nie udało się dodać zadania.", "error");
    }
  };

  const toggleTask = async (taskId: string, done: boolean) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, done } : t)));
    const res = await fetch(`/api/projects/${id}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    });
    if (!res.ok) toast("Nie udało się zapisać.", "error");
  };

  const deleteTask = async (taskId: string) => {
    const ok = await confirm("Usunąć ten punkt checklisty?", { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/projects/${id}/tasks/${taskId}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć.", "error");
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const submitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/projects/${id}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: noteText.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      const data = (await res.json()) as { activity: ProjectActivity[] };
      setActivity(data.activity);
      setNoteText("");
      toast("Zapisano wpis.");
    } else {
      toast("Nie udało się zapisać wpisu.", "error");
    }
  };

  if (notFound) {
    return (
      <div>
        <PanelHeader onClose={onClose} />
        <p className="mt-6 text-sm text-muted">Nie znaleziono takiego projektu — może został usunięty.</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div>
        <PanelHeader onClose={onClose} />
        <div className="mt-6 space-y-3">
          <div className="h-6 w-2/3 animate-pulse rounded-lg bg-[var(--hairline)]" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-[var(--hairline)]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const done = tasks.filter((t) => t.done).length;

  return (
    <div>
      <PanelHeader onClose={onClose} />

      <div className="card-paper mt-4 rounded-3xl p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <input
            value={project.tytul}
            onChange={(e) => setProject((prev) => (prev ? { ...prev, tytul: e.target.value } : prev))}
            onBlur={(e) => updateProject("tytul", e.target.value)}
            className="w-full bg-transparent font-serif text-2xl font-semibold tracking-tight text-[var(--fg)] outline-none"
          />
          <button
            onClick={deleteProject}
            className="shrink-0 rounded-full border hairline px-3 py-1.5 text-xs text-red-400"
          >
            Usuń projekt
          </button>
        </div>

        <div className="mt-2">
          <ProjectStatusTag status={project.status} onChange={(v) => updateProject("status", v)} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Priorytet">
            <select
              value={project.priorytet}
              onChange={(e) => updateProject("priorytet", e.target.value)}
              className="w-full rounded-lg border hairline bg-transparent px-2 py-1.5 text-sm text-[var(--fg)]"
            >
              {PROJECT_PRIORITIES.map((p) => (
                <option key={p} value={p} className="bg-[var(--bg-soft)] text-[var(--fg)]">
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Termin">
            <input
              type="date"
              value={project.termin ?? ""}
              onChange={(e) => updateProject("termin", e.target.value)}
              className="w-full rounded-lg border hairline bg-transparent px-2 py-1.5 text-sm text-[var(--fg)]"
            />
          </Field>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-[11px] text-muted">Opis</label>
          <EditableTextarea value={project.opis} onSave={(v) => updateProject("opis", v)} />
        </div>
      </div>

      <div className="card-paper mt-6 rounded-3xl p-6 sm:p-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold">
            Checklista {tasks.length > 0 && <span className="text-sm font-normal text-muted">({done}/{tasks.length})</span>}
          </h2>
          <button onClick={addTask} className="rounded-full border hairline px-3 py-1 text-xs">
            + Dodaj punkt
          </button>
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted opacity-60">Brak punktów — dodaj pierwszy powyżej.</p>
        ) : (
          <ul className="space-y-1.5">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-[var(--hairline)]">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={(e) => toggleTask(t.id, e.target.checked)}
                  className="h-4 w-4 shrink-0 cursor-pointer accent-brand-cyan"
                />
                <span className={`flex-1 text-sm ${t.done ? "text-muted line-through" : ""}`}>{t.text}</span>
                <button
                  onClick={() => deleteTask(t.id)}
                  className="text-muted hover:text-red-400"
                  aria-label="Usuń punkt"
                  title="Usuń"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card-paper mt-6 rounded-3xl p-6 sm:p-8">
        <h2 className="mb-4 font-serif text-lg font-semibold">Log aktywności</h2>
        <form onSubmit={submitNote} className="mb-6 space-y-2">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Co się wydarzyło? np. wysłałem ofertę, klient poprosił o zmianę zakresu…"
            rows={3}
            className="w-full rounded-xl border hairline bg-transparent px-3 py-2 text-sm text-[var(--fg)] placeholder:text-muted"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !noteText.trim()}
              className="btn-primary rounded-full px-4 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Zapisuję…" : "Dodaj wpis"}
            </button>
          </div>
        </form>
        {activity.length === 0 ? (
          <p className="text-sm text-muted opacity-60">Brak wpisów — dodaj pierwszy powyżej.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((a) => (
              <li key={a.id} className="rounded-xl border hairline p-3 text-sm">
                <span className="text-[11px] text-muted">{formatDate(a.created_at)}</span>
                <p className="mt-1 whitespace-pre-wrap">{a.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PanelHeader({ onClose }: { onClose?: () => void }) {
  if (!onClose) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">Szczegóły projektu</span>
      <button
        onClick={onClose}
        className="rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]"
        aria-label="Zamknij"
        title="Zamknij (Esc)"
      >
        ✕ Zamknij
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-muted">{label}</label>
      {children}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
