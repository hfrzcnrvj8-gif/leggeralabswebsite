"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconHeartbeat, IconChartBar, IconCalendar, IconTargetArrow, IconPointFilled, IconChevronDown, IconCheck, IconLoader2, IconArrowRight, IconLink, IconX, IconInbox, IconClipboardList } from "@tabler/icons-react";
import {
  type Project,
  type ProjectTask,
  type ProjectActivity,
  type ProjectMilestone,
  type ProjectResource,
  progressOf,
  isPlausibleDateString,
  relativeDeadline,
  daysFromToday,
} from "./shared";
import { EditableText, EditableTextarea } from "../components";
import { PropertyMenu, type MenuOption } from "../Menu";
import { DateField } from "../DatePicker";
import { STATUS_OPTS, PRIORITY_OPTS, HEALTH_OPTS, statusIconEl, HEALTH_COLOR, PriorityIcon } from "./ProjectKanban";
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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimer = useRef<number | null>(null);
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
    // Natywne <input type="date"> potrafi zapisać niepełny rok (np. "0202"
    // zamiast "2026"), jeśli pole straci fokus w trakcie wpisywania —
    // odrzucamy takie wartości zamiast zapisywać śmieciową datę.
    if ((field === "start" || field === "termin") && value && !isPlausibleDateString(value)) {
      toast("Nieprawidłowa data — sprawdź, czy rok jest w pełni wpisany (np. 2026).", "error");
      load();
      return;
    }
    setProject((prev) => (prev ? { ...prev, [field]: value } : prev));
    setSaveState("saving");
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) {
      setSaveState("idle");
      toast("Nie udało się zapisać zmiany.", "error");
      return;
    }
    setSaveState("saved");
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaveState("idle"), 1800);
    // Serwer dopisuje automatyczny wpis „system" do logu (audyt zmiany) i
    // zwraca świeżą listę — pokaż ją od razu, bez ponownego pobierania.
    const data = (await res.json().catch(() => null)) as { activity?: ProjectActivity[] } | null;
    if (data?.activity) setActivity(data.activity);
    // Dopiero PO potwierdzonym zapisie w bazie — inaczej oś czasu (która
    // odświeża się na ten sygnał) potrafiła pobrać dane zanim PATCH się
    // faktycznie zapisał (wyścig: refetch wygrywał z zapisem).
    onFieldChange?.(id, field, value);
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
    if (field === "termin" && value && !isPlausibleDateString(value)) {
      toast("Nieprawidłowa data — sprawdź, czy rok jest w pełni wpisany (np. 2026).", "error");
      load();
      return;
    }
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
  const overall = progressOf(tasks);
  const leadOptions: MenuOption<string>[] = [
    { value: "", label: "— brak —" },
    ...(leads ?? []).map((l) => ({ value: l.id, label: l.firma })),
  ];

  return (
    <div>
      <PanelHeader onClose={onClose} tytul={project.tytul} saveState={saveState} />

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Kolumna główna: treść, kamienie milowe, log aktywności */}
        <div className="min-w-0 space-y-4">
          <div>
            <input
              value={project.tytul}
              onChange={(e) => setProject((prev) => (prev ? { ...prev, tytul: e.target.value } : prev))}
              onBlur={(e) => updateProject("tytul", e.target.value)}
              className="w-full bg-transparent text-2xl font-semibold tracking-tight text-[var(--fg)] outline-none"
            />
            <div className="mt-2">
              <EditableTextarea value={project.opis} onSave={(v) => updateProject("opis", v)} />
            </div>
            {overall.total > 0 && (
              <div className="mt-3 flex items-center gap-2.5">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--hairline)]">
                  <div className="h-full rounded-full bg-[#4ea7fc] transition-all" style={{ width: `${overall.pct}%` }} />
                </div>
                <span className="shrink-0 text-[11px] text-muted tabular-nums">
                  {overall.pct}% · {overall.done}/{overall.total}
                </span>
              </div>
            )}
          </div>

          <div className="card-paper rounded-xl border hairline p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-medium">Kamienie milowe</h2>
              <button onClick={addMilestone} className="rounded-full border hairline px-3 py-1 text-xs">
                + Nowy kamień milowy
              </button>
            </div>

            {milestones.length === 0 && unmilestoned.length === 0 ? (
              <div className="flex items-start gap-2 text-sm text-muted opacity-60">
                <IconClipboardList size={15} className="mt-0.5 shrink-0" />
                <span>
                  Brak zadań — dodaj kamień milowy powyżej albo pojedyncze zadanie:{" "}
                  <button onClick={() => addTask(null)} className="text-[var(--fg)] underline underline-offset-2 opacity-100">
                    + dodaj zadanie
                  </button>
                </span>
              </div>
            ) : (
              <div className="space-y-5">
                {milestones.map((m) => {
                  const mTasks = tasks.filter((t) => t.milestone_id === m.id);
                  const { pct, done, total } = progressOf(mTasks);
                  return (
                    <div key={m.id}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span className="h-2 w-2 shrink-0 rotate-45 border border-[var(--bg)] bg-[#4ea7fc]" />
                          <div className="min-w-0 flex-1">
                            <EditableText value={m.nazwa} onSave={(v) => updateMilestone(m.id, "nazwa", v)} />
                          </div>
                        </div>
                        <span className="shrink-0 text-[12px] text-muted">
                          <DateField value={m.termin ?? ""} onChange={(v) => updateMilestone(m.id, "termin", v)} placeholder="Termin" />
                        </span>
                        <span className="shrink-0 text-[11px] text-muted">{pct}% z {total}</span>
                        <button
                          onClick={() => deleteMilestone(m.id)}
                          className="shrink-0 text-muted hover:text-red-400"
                          aria-label="Usuń kamień milowy"
                          title="Usuń"
                        >
                          <IconX size={14} />
                        </button>
                      </div>
                      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--hairline)]">
                        <div
                          className="h-full rounded-full bg-[#4ea7fc] transition-all"
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

          <div className="card-paper rounded-xl border hairline p-4">
            <h2 className="mb-3 text-[14px] font-medium">Log aktywności</h2>
            <form onSubmit={submitNote} className="mb-6 space-y-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Co się wydarzyło? np. wysłałem ofertę, klient poprosił o zmianę zakresu… (Cmd+Enter, by zapisać)"
                rows={3}
                className="w-full rounded-xl border hairline bg-transparent px-3 py-2 text-sm text-[var(--fg)] placeholder:text-muted"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !noteText.trim()}
                  className="bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 rounded-full px-4 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Zapisuję…" : "Dodaj wpis"}
                </button>
              </div>
            </form>
            {activity.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted opacity-60"><IconInbox size={15} className="shrink-0" /> Brak wpisów — dodaj pierwszy powyżej.</p>
            ) : (
              <ul className="space-y-2">
                {activity.map((a) =>
                  a.kind === "system" ? (
                    <li key={a.id} className="flex items-center gap-2 px-1 py-0.5 text-[12.5px] text-muted">
                      <IconArrowRight size={13} className="shrink-0 opacity-60" />
                      <span className="min-w-0 flex-1 truncate">{a.text}</span>
                      <span className="shrink-0 text-[11px] opacity-70">{formatDate(a.created_at)}</span>
                    </li>
                  ) : (
                    <li key={a.id} className="rounded-xl border hairline p-3 text-sm">
                      <span className="text-[11px] text-muted">{formatDate(a.created_at)}</span>
                      <p className="mt-1 whitespace-pre-wrap">{a.text}</p>
                    </li>
                  )
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Boczny pasek: metadane, styl Linear — płaskie wiersze z ikoną,
            bez kart/etykiet nad polem, zamiast formularza. */}
        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <div>
            <MetaRow icon={<IconHeartbeat size={15} />} title="Zdrowie">
              <PropertyMenu value={project.zdrowie} options={HEALTH_OPTS} onChange={(v) => updateProject("zdrowie", v)} title="Zdrowie" full>
                <PropTrigger icon={<IconPointFilled size={10} className={HEALTH_COLOR[project.zdrowie] ?? "text-muted"} />} label={project.zdrowie} />
              </PropertyMenu>
            </MetaRow>
            <MetaRow icon={statusIconEl(project.status, 15)} title="Status">
              <PropertyMenu value={project.status} options={STATUS_OPTS} onChange={(v) => updateProject("status", v)} title="Status" full>
                <PropTrigger icon={statusIconEl(project.status, 14)} label={project.status} />
              </PropertyMenu>
            </MetaRow>
            <MetaRow icon={<IconChartBar size={15} />} title="Priorytet">
              <PropertyMenu value={project.priorytet} options={PRIORITY_OPTS} onChange={(v) => updateProject("priorytet", v)} title="Priorytet" full>
                <PropTrigger icon={<PriorityIcon priorytet={project.priorytet} />} label={project.priorytet} />
              </PropertyMenu>
            </MetaRow>
            <MetaRow icon={<IconCalendar size={15} />} title="Daty">
              <div>
                <DateRangeField
                  start={project.start ?? ""}
                  termin={project.termin ?? ""}
                  onSave={(field, value) => updateProject(field, value)}
                />
                <DeadlineHint termin={project.termin} closed={project.status === "Wdrożone"} />
              </div>
            </MetaRow>
            <MetaRow icon={<IconTargetArrow size={15} />} title="Lead">
              <PropertyMenu
                value={project.lead_id ?? ""}
                options={leadOptions}
                onChange={(v) => updateProject("lead_id", v)}
                title="Powiązany lead"
                full
              >
                <PropTrigger label={project.lead_id ? (leads?.find((l) => l.id === project.lead_id)?.firma ?? "—") : "— brak —"} />
              </PropertyMenu>
            </MetaRow>
          </div>

          <div className="border-t hairline pt-4">
            <h3 className="mb-2 text-[11px] text-muted opacity-70">Zasoby</h3>
            {resources.length > 0 && (
              <ul className="mb-2 space-y-1">
                {resources.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <a href={r.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 truncate text-[#4ea7fc] hover:underline">
                      <IconLink size={13} className="shrink-0 opacity-70" />
                      <span className="truncate">{r.etykieta}</span>
                    </a>
                    <button
                      onClick={() => deleteResource(r.id)}
                      className="shrink-0 text-muted hover:text-red-400"
                      aria-label="Usuń zasób"
                      title="Usuń"
                    >
                      <IconX size={14} />
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
            className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[#4ea7fc]"
          />
          <span className={`flex-1 text-sm ${t.done ? "text-muted line-through" : ""}`}>{t.text}</span>
          <button
            onClick={() => onDelete(t.id)}
            className="text-muted hover:text-red-400"
            aria-label="Usuń zadanie"
            title="Usuń"
          >
            <IconX size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function PanelHeader({ onClose, tytul, saveState = "idle" }: { onClose?: () => void; tytul?: string; saveState?: "idle" | "saving" | "saved" }) {
  if (!onClose) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="truncate text-xs text-muted">
        Projekty {tytul ? <>/ <span className="text-[var(--fg)]">{tytul}</span></> : null}
      </span>
      <div className="flex shrink-0 items-center gap-3">
        <SaveIndicator state={saveState} />
        <button
          onClick={onClose}
          className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]"
          aria-label="Zamknij"
          title="Zamknij (Esc)"
        >
          <IconX size={13} /> Zamknij
        </button>
      </div>
    </div>
  );
}

/** Dyskretny wskaźnik autozapisu (styl Linear — zmiany zapisują się od razu,
 * bez przycisku „Zapisz"). „Zapisywanie…" podczas PATCH, potem „Zapisano ✓"
 * które po chwili znika. Daje pewność, że zmiana trafiła do bazy. */
function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" }) {
  return (
    <span
      className={`flex items-center gap-1.5 text-[11px] transition-opacity duration-300 ${
        state === "idle" ? "opacity-0" : "opacity-100"
      } ${state === "saved" ? "text-emerald-400" : "text-muted"}`}
      aria-live="polite"
    >
      {state === "saving" ? (
        <>
          <IconLoader2 size={12} className="animate-spin" />
          Zapisywanie…
        </>
      ) : (
        <>
          <IconCheck size={12} />
          Zapisano
        </>
      )}
    </span>
  );
}

/** Płaski wiersz właściwości w bocznym pasku — ikona po lewej, kontrolka
 * zajmuje resztę szerokości, bez etykiety nad polem i bez obramowania karty
 * (styl Linear: lista właściwości, nie formularz). */
/** Wartość właściwości jako klikalny wiersz (styl Linear): [ikona] etykieta,
 * chevron pojawia się na hover. Trigger dla PropertyMenu w panelu szczegółów. */
function PropTrigger({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <span className="group/pt flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-[var(--fg)] hover:bg-[var(--hairline)]">
      {icon && <span className="flex w-4 shrink-0 justify-center">{icon}</span>}
      <span className="flex-1 truncate text-left">{label}</span>
      <IconChevronDown size={13} className="shrink-0 text-muted opacity-0 group-hover/pt:opacity-100" />
    </span>
  );
}

/** Względna podpowiedź terminu pod polami dat: „za 3 dni" (wyszarzone),
 * „jutro/dziś" (bursztyn) lub „2 dni po terminie" (czerwień) — chyba że projekt
 * jest już Wdrożony (wtedy termin nie „pali"). */
function DeadlineHint({ termin, closed }: { termin: string | null | undefined; closed: boolean }) {
  const label = relativeDeadline(termin);
  if (!label) return null;
  const d = daysFromToday(termin);
  const color =
    !closed && d != null && d < 0
      ? "text-red-400"
      : !closed && d != null && d <= 2
      ? "text-amber-400"
      : "text-muted";
  return <div className={`mt-0.5 pl-1.5 text-[11px] ${color}`}>{label}</div>;
}

function MetaRow({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="flex w-24 shrink-0 items-center gap-2 text-[12.5px] text-muted" title={title}>
        <span className="flex w-4 justify-center">{icon}</span>
        <span className="truncate">{title}</span>
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Para pól start/termin z jawnym przyciskiem "Zapisz" zamiast polegania
 * apple'owy wheel picker (DateField), który zmienia datę od razu przy
 * przewinięciu koła — bez natywnego <input> i bez ryzyka niepełnego roku. */
function DateRangeField({
  start,
  termin,
  onSave,
}: {
  start: string;
  termin: string;
  onSave: (field: "start" | "termin", value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <DateField value={start} onChange={(v) => onSave("start", v)} placeholder="Start" />
      <span className="shrink-0 text-muted">→</span>
      <DateField value={termin} onChange={(v) => onSave("termin", v)} placeholder="Termin" />
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
