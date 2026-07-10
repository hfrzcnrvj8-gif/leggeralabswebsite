"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type Project,
  type ProjectTask,
  type ProjectActivity,
  type ProjectMilestone,
  type ProjectResource,
  PROJECT_PRIORITIES,
  ProjectStatusTag,
  ProjectHealthTag,
  progressOf,
} from "./shared";
import { EditableText, EditableTextarea } from "../components";
import { useUI } from "../ui";
import type { Lead } from "@/lib/leads";

/** Rdzeń widoku szczegółów projektu, w stylu Linear: treść + kamienie
 * milowe + log aktywności po lewej, metadane (zdrowie/status/terminy/
 * powiązania/zasoby) w bocznym pasku po prawej. Używany zarówno jako
 * wysuwany panel ("peek"), jak i jako samodzielna podstrona. */
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
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [resources, setResources] = useState<ProjectResource[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [newResourceLabel, setNewResourceLabel] = useState("");
  const [newResourceUrl, setNewResourceUrl] = useState("");

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
    const data = (await res.json()) as {
      project: Project;
      tasks: ProjectTask[];
      activity: ProjectActivity[];
      milestones: ProjectMilestone[];
      resources: ProjectResource[];
    };
    setProject(data.project);
    setTasks(data.tasks);
    setActivity(data.activity);
    setMilestones(data.milestones);
    setResources(data.resources);
  }, [id]);

  useEffect(() => {
    setProject(null);
    setNotFound(false);
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/leads").then((r) => (r.ok ? r.json() : null)).then((d) => d && setLeads(d.leads));
  }, []);

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

  const addMilestone = async () => {
    const nazwa = await prompt("Nazwa kamienia milowego:", { placeholder: "np. Beta" });
    if (!nazwa) return;
    const res = await fetch(`/api/projects/${id}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nazwa }),
    });
    if (res.ok) {
      const data = (await res.json()) as { milestones: ProjectMilestone[] };
      setMilestones(data.milestones);
    } else {
      toast("Nie udało się dodać kamienia milowego.", "error");
    }
  };

  const updateMilestone = async (milestoneId: string, field: "nazwa" | "termin", value: string) => {
    setMilestones((prev) => prev.map((m) => (m.id === milestoneId ? { ...m, [field]: value } : m)));
    const res = await fetch(`/api/projects/${id}/milestones/${milestoneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) toast("Nie udało się zapisać.", "error");
  };

  const deleteMilestone = async (milestoneId: string) => {
    const ok = await confirm("Usunąć ten kamień milowy? Zadania pod nim zostaną, ale przestaną być z nim powiązane.", { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/projects/${id}/milestones/${milestoneId}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć.", "error");
      return;
    }
    setMilestones((prev) => prev.filter((m) => m.id !== milestoneId));
    setTasks((prev) => prev.map((t) => (t.milestone_id === milestoneId ? { ...t, milestone_id: null } : t)));
  };

  const addTask = async (milestoneId: string | null) => {
    const text = await prompt("Nowe zadanie:", { placeholder: "np. przygotować ofertę" });
    if (!text) return;
    const res = await fetch(`/api/projects/${id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, milestone_id: milestoneId }),
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

  const addResource = async () => {
    if (!newResourceLabel.trim() || !newResourceUrl.trim()) return;
    const res = await fetch(`/api/projects/${id}/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etykieta: newResourceLabel.trim(), url: newResourceUrl.trim() }),
    });
    if (res.ok) {
      const data = (await res.json()) as { resources: ProjectResource[] };
      setResources(data.resources);
      setNewResourceLabel("");
      setNewResourceUrl("");
    } else {
      toast("Nie udało się dodać zasobu.", "error");
    }
  };

  const deleteResource = async (resourceId: string) => {
    const res = await fetch(`/api/projects/${id}/resources/${resourceId}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć.", "error");
      return;
    }
    setResources((prev) => prev.filter((r) => r.id !== resourceId));
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

  const unmilestoned = tasks.filter((t) => !t.milestone_id);

  return (
    <div>
      <PanelHeader onClose={onClose} />

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Kolumna główna: treść, kamienie milowe, log aktywności */}
        <div className="min-w-0 space-y-6">
          <div className="card-paper rounded-3xl p-6 sm:p-8">
            <input
              value={project.tytul}
              onChange={(e) => setProject((prev) => (prev ? { ...prev, tytul: e.target.value } : prev))}
              onBlur={(e) => updateProject("tytul", e.target.value)}
              className="w-full bg-transparent font-serif text-2xl font-semibold tracking-tight text-[var(--fg)] outline-none"
            />
            <div className="mt-4">
              <EditableTextarea value={project.opis} onSave={(v) => updateProject("opis", v)} />
            </div>
          </div>

          <div className="card-paper rounded-3xl p-6 sm:p-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold">Kamienie milowe</h2>
              <button onClick={addMilestone} className="rounded-full border hairline px-3 py-1 text-xs">
                + Nowy kamień milowy
              </button>
            </div>

            {milestones.length === 0 && unmilestoned.length === 0 ? (
              <p className="text-sm text-muted opacity-60">Brak zadań — dodaj kamień milowy albo zadanie poniżej.</p>
            ) : (
              <div className="space-y-5">
                {milestones.map((m) => {
                  const mTasks = tasks.filter((t) => t.milestone_id === m.id);
                  const { pct, done, total } = progressOf(mTasks);
                  return (
                    <div key={m.id}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <EditableText value={m.nazwa} onSave={(v) => updateMilestone(m.id, "nazwa", v)} />
                        </div>
                        <input
                          type="date"
                          value={m.termin ?? ""}
                          onChange={(e) => updateMilestone(m.id, "termin", e.target.value)}
                          className="shrink-0 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-muted hover:border-[var(--hairline)] focus:border-brand-cyan/60 focus:outline-none"
                        />
                        <span className="shrink-0 text-[11px] text-muted">{pct}% z {total}</span>
                        <button
                          onClick={() => deleteMilestone(m.id)}
                          className="shrink-0 text-muted hover:text-red-400"
                          aria-label="Usuń kamień milowy"
                          title="Usuń"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--hairline)]">
                        <div
                          className="h-full rounded-full bg-brand-cyan transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <TaskList tasks={mTasks} onToggle={toggleTask} onDelete={deleteTask} />
                      <button
                        onClick={() => addTask(m.id)}
                        className="mt-1 text-[11px] text-muted hover:text-[var(--fg)]"
                      >
                        + dodaj zadanie
                      </button>
                    </div>
                  );
                })}

                {(unmilestoned.length > 0 || milestones.length === 0) && (
                  <div>
                    {milestones.length > 0 && (
                      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                        Bez kamienia milowego
                      </h3>
                    )}
                    <TaskList tasks={unmilestoned} onToggle={toggleTask} onDelete={deleteTask} />
                    <button
                      onClick={() => addTask(null)}
                      className="mt-1 text-[11px] text-muted hover:text-[var(--fg)]"
                    >
                      + dodaj zadanie
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card-paper rounded-3xl p-6 sm:p-8">
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

        {/* Boczny pasek: metadane, styl Linear */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="card-paper space-y-3 rounded-2xl p-4">
            <SidebarField label="Zdrowie">
              <ProjectHealthTag zdrowie={project.zdrowie} onChange={(v) => updateProject("zdrowie", v)} />
            </SidebarField>
            <SidebarField label="Status">
              <ProjectStatusTag status={project.status} onChange={(v) => updateProject("status", v)} />
            </SidebarField>
            <SidebarField label="Priorytet">
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
            </SidebarField>
            <SidebarField label="Start">
              <input
                type="date"
                value={project.start ?? ""}
                onChange={(e) => updateProject("start", e.target.value)}
                className="w-full rounded-lg border hairline bg-transparent px-2 py-1.5 text-sm text-[var(--fg)]"
              />
            </SidebarField>
            <SidebarField label="Termin">
              <input
                type="date"
                value={project.termin ?? ""}
                onChange={(e) => updateProject("termin", e.target.value)}
                className="w-full rounded-lg border hairline bg-transparent px-2 py-1.5 text-sm text-[var(--fg)]"
              />
            </SidebarField>
            <SidebarField label="Powiązany lead">
              <select
                value={project.lead_id ?? ""}
                onChange={(e) => updateProject("lead_id", e.target.value)}
                className="w-full rounded-lg border hairline bg-transparent px-2 py-1.5 text-sm text-[var(--fg)]"
              >
                <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">— brak —</option>
                {(leads ?? []).map((l) => (
                  <option key={l.id} value={l.id} className="bg-[var(--bg-soft)] text-[var(--fg)]">{l.firma}</option>
                ))}
              </select>
            </SidebarField>
          </div>

          <div className="card-paper rounded-2xl p-4">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Zasoby</h3>
            {resources.length > 0 && (
              <ul className="mb-2 space-y-1">
                {resources.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <a href={r.url} target="_blank" rel="noreferrer" className="truncate text-liquid hover:underline">
                      {r.etykieta}
                    </a>
                    <button
                      onClick={() => deleteResource(r.id)}
                      className="shrink-0 text-muted hover:text-red-400"
                      aria-label="Usuń zasób"
                      title="Usuń"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-1.5">
              <input
                value={newResourceLabel}
                onChange={(e) => setNewResourceLabel(e.target.value)}
                placeholder="Nazwa (np. Figma)"
                className="w-full rounded-lg border hairline bg-transparent px-2 py-1 text-xs text-[var(--fg)] placeholder:text-muted"
              />
              <input
                value={newResourceUrl}
                onChange={(e) => setNewResourceUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-lg border hairline bg-transparent px-2 py-1 text-xs text-[var(--fg)] placeholder:text-muted"
              />
              <button
                onClick={addResource}
                disabled={!newResourceLabel.trim() || !newResourceUrl.trim()}
                className="w-full rounded-lg border hairline px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Dodaj link
              </button>
            </div>
          </div>

          <button
            onClick={deleteProject}
            className="w-full rounded-full border hairline px-3 py-1.5 text-xs text-red-400"
          >
            Usuń projekt
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskList({
  tasks,
  onToggle,
  onDelete,
}: {
  tasks: ProjectTask[];
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  if (tasks.length === 0) return <p className="text-xs text-muted opacity-50">Brak zadań.</p>;
  return (
    <ul className="space-y-1">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-[var(--hairline)]">
          <input
            type="checkbox"
            checked={t.done}
            onChange={(e) => onToggle(t.id, e.target.checked)}
            className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-brand-cyan"
          />
          <span className={`flex-1 text-sm ${t.done ? "text-muted line-through" : ""}`}>{t.text}</span>
          <button
            onClick={() => onDelete(t.id)}
            className="text-muted hover:text-red-400"
            aria-label="Usuń zadanie"
            title="Usuń"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
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

function SidebarField({ label, children }: { label: string; children: React.ReactNode }) {
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
