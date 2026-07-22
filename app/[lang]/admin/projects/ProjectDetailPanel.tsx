"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { IconHeartbeat, IconChartBar, IconCalendar, IconTargetArrow, IconUsers, IconPointFilled, IconChevronDown, IconCheck, IconLoader2, IconArrowRight, IconLink, IconX, IconInbox, IconClipboardList, IconGripVertical, IconPlayerPlay, IconPlayerStop, IconClock, IconTrash, IconPencil } from "@tabler/icons-react";
import {
  type Project,
  type ProjectTask,
  type ProjectActivity,
  type ProjectMilestone,
  type ProjectResource,
  type ProjectOnboardingItem,
  ONBOARDING_INCOMPLETE_HINT,
  buildOnboardingWelcomeMessage,
  PROJECT_REVIEW_REQUEST_HINT,
  buildProjectClosingSummary,
  projectReviewAverage,
  progressOf,
  isPlausibleDateString,
  formatPlDate,
  relativeDeadline,
  daysFromToday,
  ProjectIconPicker,
} from "./shared";
import { EditableText, EditableTextarea, ClientLinkChip } from "../components";
import { ViewTabs, ViewSwitch } from "../ViewTabs";
import { LinkPicker, type LinkValue } from "../LinkPicker";
import { PropertyMenu, Popover, MenuRow, type MenuOption } from "../Menu";
import { DateField } from "../DatePicker";
import { STATUS_OPTS, PRIORITY_OPTS, HEALTH_OPTS, statusIconEl, HEALTH_COLOR, PriorityIcon } from "./ProjectKanban";
import { useUI, useRegisterActions } from "../ui";
import type { Lead } from "@/lib/leads";
import { formatMoney } from "@/lib/invoices";
import { type TimeEntry, formatDuration, sumMinutes, effectiveHourlyRate } from "@/lib/time-tracking";
import { todayLocalISO } from "@/lib/dates";
import { TIMER_CHANGED_EVENT } from "../AppShell";
import { ShareLinkControl } from "../ShareLinkControl";

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
  const pathname = usePathname();
  const langPrefix = pathname?.split("/")[1] ?? "pl";
  const [project, setProject] = useState<Project | null>(null);
  // Moduł 35A — profil projektu rozbity na zakładki (prośba właściciela
  // 2026-07-17: „ściana informacji" → Podgląd + osobne zakładki). Stan `tab`
  // siedzi TU, w *DetailPanel, a nie w wrapperach — dzięki temu działa i w
  // modalu z listy, i na podstronie [id], bez dublowania (wzorzec Modułu 23).
  const [tab, setTab] = useState<"overview" | "onboarding" | "time" | "closing" | "log">("overview");
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [activity, setActivity] = useState<ProjectActivity[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [resources, setResources] = useState<ProjectResource[]>([]);
  const [onboarding, setOnboarding] = useState<ProjectOnboardingItem[]>([]);
  const [client, setClient] = useState<{ nazwa: string; osoba_kontaktowa: string; email: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimer = useRef<number | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [clients, setClients] = useState<{ id: string; nazwa: string }[] | null>(null);
  const [sourceOffer, setSourceOffer] = useState<{ id: string; tytul: string } | null>(null);
  const [newResourceLabel, setNewResourceLabel] = useState("");
  const [newResourceUrl, setNewResourceUrl] = useState("");
  const [newOnboardingText, setNewOnboardingText] = useState("");
  const [seedingOnboarding, setSeedingOnboarding] = useState(false);
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const welcomeMsgInitialized = useRef(false);
  const [reviewUrl, setReviewUrl] = useState("");
  const [reviewDraft, setReviewDraft] = useState("");
  const reviewDraftInitialized = useRef(false);
  const [requestingReview, setRequestingReview] = useState(false);
  const [manualReviewOpen, setManualReviewOpen] = useState(false);
  const [manualJakosc, setManualJakosc] = useState(0);
  const [manualTerminowosc, setManualTerminowosc] = useState(0);
  const [manualKomunikacja, setManualKomunikacja] = useState(0);
  const [manualComment, setManualComment] = useState("");
  const [manualConsent, setManualConsent] = useState(false);
  const [manualConsentName, setManualConsentName] = useState("");
  const [savingManualReview, setSavingManualReview] = useState(false);
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [allProjects, setAllProjects] = useState<{ id: string; tytul: string }[]>([]);
  const [rentownosc, setRentownosc] = useState<{ przychod_netto: number; koszty_netto: number; zysk_netto: number; ma_inne_waluty: boolean } | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [activeTimer, setActiveTimer] = useState<(TimeEntry & { project_tytul?: string; task_text?: string | null }) | null>(null);
  const [, setTick] = useState(0);
  const [manualHours, setManualHours] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState("");
  const [editTaskId, setEditTaskId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [manualTaskId, setManualTaskId] = useState("");
  const [manualDate, setManualDate] = useState(todayLocalISO());
  const [manualNote, setManualNote] = useState("");

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
      onboarding: ProjectOnboardingItem[];
      dependencies?: { depends_on_id: string }[];
      rentownosc?: { przychod_netto: number; koszty_netto: number; zysk_netto: number; ma_inne_waluty: boolean };
      sourceOffer?: { id: string; tytul: string } | null;
    };
    setProject(data.project);
    setTasks(data.tasks);
    setActivity(data.activity);
    setMilestones(data.milestones);
    setResources(data.resources);
    setOnboarding(data.onboarding ?? []);
    setDependencies((data.dependencies ?? []).map((d) => d.depends_on_id));
    setRentownosc(data.rentownosc ?? null);
    setSourceOffer(data.sourceOffer ?? null);

    let loadedClient: { nazwa: string; osoba_kontaktowa: string; email: string } | null = null;
    if (data.project.client_id) {
      const cRes = await fetch(`/api/clients/${data.project.client_id}`);
      if (cRes.ok) {
        const cData = (await cRes.json()) as { client?: { nazwa: string; osoba_kontaktowa: string; email: string } };
        loadedClient = cData.client ?? null;
      }
    }
    setClient(loadedClient);

    // Szkic wiadomości powitalnej wypełnia się raz, po pierwszym pełnym
    // załadowaniu (projekt + ewentualny klient) — dalej edytowalny ręcznie,
    // nie nadpisywany przy kolejnych odświeżeniach danych.
    if (!welcomeMsgInitialized.current) {
      welcomeMsgInitialized.current = true;
      setWelcomeMsg(buildOnboardingWelcomeMessage(data.project, loadedClient));
    }

    // Zamknięcie i opinia (Moduł 15): link generuje się raz, przy pierwszym
    // załadowaniu (jeśli projekt ma klienta) — token jest idempotentny, więc
    // kolejne odświeżenia dostają zawsze ten sam link. Szkic podsumowania
    // wypełnia się raz, dopiero gdy link jest już znany, żeby zawierał
    // prawdziwy URL — dalej edytowalny ręcznie, jak wiadomość powitalna.
    if (data.project.client_id && !reviewDraftInitialized.current) {
      const rRes = await fetch(`/api/projects/${id}/review-link`, { method: "POST" });
      if (rRes.ok) {
        const rData = (await rRes.json()) as { url: string };
        setReviewUrl(rData.url);
        if (!reviewDraftInitialized.current) {
          reviewDraftInitialized.current = true;
          setReviewDraft(buildProjectClosingSummary(data.project, loadedClient, data.milestones, rData.url, data.project.jezyk));
        }
      }
    }
  }, [id]);

  useEffect(() => {
    setProject(null);
    setNotFound(false);
    setTab("overview");
    welcomeMsgInitialized.current = false;
    setWelcomeMsg("");
    reviewDraftInitialized.current = false;
    setReviewUrl("");
    setReviewDraft("");
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/leads").then((r) => (r.ok ? r.json() : null)).then((d) => d && setLeads(d.leads));
    fetch("/api/projects").then((r) => (r.ok ? r.json() : null)).then((d) => d && setAllProjects(d.projects.map((p: { id: string; tytul: string }) => ({ id: p.id, tytul: p.tytul }))));
    fetch("/api/clients").then((r) => (r.ok ? r.json() : null)).then((d) => d && setClients(d.clients.map((c: { id: string; nazwa: string }) => ({ id: c.id, nazwa: c.nazwa }))));
  }, []);

  const loadTime = useCallback(async () => {
    const res = await fetch(`/api/time?project_id=${id}`);
    if (res.ok) {
      const data = (await res.json()) as { entries: TimeEntry[] };
      setTimeEntries(data.entries);
    }
  }, [id]);

  const loadActiveTimer = useCallback(async () => {
    const res = await fetch("/api/time/active");
    if (res.ok) {
      const data = (await res.json()) as { active: (TimeEntry & { project_tytul?: string; task_text?: string | null }) | null };
      setActiveTimer(data.active);
    }
  }, []);

  useEffect(() => {
    loadTime();
  }, [loadTime]);

  useEffect(() => {
    loadActiveTimer();
  }, [loadActiveTimer]);

  // Żywy tik co sekundę, wyłącznie żeby przeliczyć widoczny czas trwania
  // aktywnego stopera — nie odpytujemy serwera w pętli.
  useEffect(() => {
    if (!activeTimer || activeTimer.ended_at) return;
    const t = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, [activeTimer]);

  const activeTimerHere = activeTimer && activeTimer.project_id === id ? activeTimer : null;
  const totalMinutes = sumMinutes(timeEntries);
  const minutesByTask = timeEntries.reduce<Record<string, number>>((m, e) => {
    if (e.ended_at === null && e.source === "timer") return m;
    const key = e.task_id ?? "__project__";
    m[key] = (m[key] ?? 0) + e.minutes;
    return m;
  }, {});

  const startTimer = async (taskId: string | null) => {
    const res = await fetch("/api/time/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: id, task_id: taskId }),
    });
    if (!res.ok) {
      toast("Nie udało się uruchomić stopera.", "error");
      return;
    }
    const data = (await res.json()) as { active: TimeEntry; stopped_previous: { minutes: number } | null };
    setActiveTimer(data.active);
    window.dispatchEvent(new Event(TIMER_CHANGED_EVENT));
    if (data.stopped_previous) {
      toast(`Zatrzymano poprzedni stoper (${formatDuration(data.stopped_previous.minutes)}) i zapisano wpis.`);
      loadTime();
    }
  };

  const stopTimer = async () => {
    const res = await fetch("/api/time/stop", { method: "POST" });
    if (!res.ok) {
      toast("Nie udało się zatrzymać stopera.", "error");
      return;
    }
    const data = (await res.json()) as { stopped: { minutes: number } | null };
    setActiveTimer(null);
    window.dispatchEvent(new Event(TIMER_CHANGED_EVENT));
    if (data.stopped) {
      toast(`Zatrzymano stoper: ${formatDuration(data.stopped.minutes)}.`);
      loadTime();
    }
  };

  const addManualTimeEntry = async () => {
    const hours = parseFloat(manualHours.replace(",", "."));
    if (!Number.isFinite(hours) || hours <= 0) {
      toast("Podaj liczbę godzin większą od zera.", "error");
      return;
    }
    const res = await fetch("/api/time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: id,
        task_id: manualTaskId || null,
        minutes: Math.round(hours * 60),
        entry_date: manualDate,
        note: manualNote.trim(),
      }),
    });
    if (!res.ok) {
      toast("Nie udało się dodać wpisu czasu.", "error");
      return;
    }
    const data = (await res.json()) as { entries: TimeEntry[] };
    setTimeEntries(data.entries);
    setManualHours("");
    setManualNote("");
  };

  const deleteTimeEntry = async (entryId: string) => {
    const ok = await confirm("Usunąć ten wpis czasu?", { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/time/${entryId}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć wpisu.", "error");
      return;
    }
    const data = (await res.json()) as { entries: TimeEntry[] };
    setTimeEntries(data.entries);
  };

  const startEditEntry = (e: TimeEntry) => {
    setEditingEntryId(e.id);
    setEditHours(String(Math.round((e.minutes / 60) * 100) / 100).replace(".", ","));
    setEditTaskId(e.task_id ?? "");
    setEditDate(e.entry_date);
    setEditNote(e.note);
  };

  const cancelEditEntry = () => setEditingEntryId(null);

  const saveEditedEntry = async () => {
    if (!editingEntryId) return;
    const hours = parseFloat(editHours.replace(",", "."));
    if (!Number.isFinite(hours) || hours <= 0) {
      toast("Podaj liczbę godzin większą od zera.", "error");
      return;
    }
    const res = await fetch(`/api/time/${editingEntryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: editTaskId || null,
        minutes: Math.round(hours * 60),
        entry_date: editDate,
        note: editNote.trim(),
      }),
    });
    if (!res.ok) {
      toast("Nie udało się zapisać zmian.", "error");
      return;
    }
    const data = (await res.json()) as { entries: TimeEntry[] };
    setTimeEntries(data.entries);
    setEditingEntryId(null);
  };

  useRegisterActions(
    [
      {
        id: "time-toggle",
        label: activeTimerHere && !activeTimerHere.ended_at ? "⏱ Zatrzymaj stoper" : "⏱ Start stopera (ten projekt)",
        run: () => (activeTimerHere && !activeTimerHere.ended_at ? stopTimer() : startTimer(null)),
      },
    ],
    [activeTimerHere?.id, activeTimerHere?.ended_at]
  );

  const addDependency = async (dependsOnId: string) => {
    const res = await fetch(`/api/projects/${id}/dependencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ depends_on_id: dependsOnId }),
    });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      toast(d.error ?? "Nie udało się dodać zależności.", "error");
      return;
    }
    setDependencies((prev) => [...new Set([...prev, dependsOnId])]);
    onFieldChange?.(id, "dependencies", "");
  };

  const dragMsRef = useRef<string | null>(null);
  const onDropMilestone = async (toId: string) => {
    const fromId = dragMsRef.current;
    dragMsRef.current = null;
    if (!fromId || fromId === toId) return;
    const arr = [...milestones];
    const from = arr.findIndex((m) => m.id === fromId);
    const to = arr.findIndex((m) => m.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    setMilestones(arr);
    await fetch(`/api/projects/${id}/milestones/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: arr.map((m) => m.id) }),
    });
  };

  const dragTaskRef = useRef<string | null>(null);
  const onDropTask = async (toId: string) => {
    const fromId = dragTaskRef.current;
    dragTaskRef.current = null;
    if (!fromId || fromId === toId) return;
    const from = tasks.findIndex((t) => t.id === fromId);
    const to = tasks.findIndex((t) => t.id === toId);
    if (from < 0 || to < 0 || tasks[from].milestone_id !== tasks[to].milestone_id) return; // reorder tylko w obrębie tej samej grupy
    const arr = [...tasks];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    setTasks(arr);
    await fetch(`/api/projects/${id}/tasks/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: arr.map((t) => t.id) }),
    });
  };

  const removeDependency = async (dependsOnId: string) => {
    const res = await fetch(`/api/projects/${id}/dependencies?depends_on_id=${encodeURIComponent(dependsOnId)}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć zależności.", "error");
      return;
    }
    setDependencies((prev) => prev.filter((x) => x !== dependsOnId));
    onFieldChange?.(id, "dependencies", "");
  };

  /** Moduł 22 — zapis powiązania. Osobno od updateProject(), bo LinkPicker
   * zmienia DWA pola naraz (wybór klienta czyści leada), a updateProject
   * przyjmuje jedno pole i jeden string. */
  const updateProjectLink = async (next: LinkValue) => {
    setProject((prev) => (prev ? { ...prev, ...next } : prev));
    setSaveState("saving");
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) {
      setSaveState("idle");
      toast("Nie udało się zapisać powiązania.", "error");
      load();
      return;
    }
    setSaveState("saved");
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaveState("idle"), 1800);
  };

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

    // Zmiana podpiętego klienta unieważnia szkice wygenerowane pod poprzedni
    // kontekst (wiadomość powitalna, podsumowanie + link do opinii — Moduł
    // 15) — resetujemy flagi "wygenerowano już raz" i odświeżamy pełne dane,
    // żeby szkice dociągnęły dane nowego klienta (albo zniknęły, gdy klienta
    // odpięto).
    if (field === "client_id") {
      welcomeMsgInitialized.current = false;
      reviewDraftInitialized.current = false;
      setReviewUrl("");
      setReviewDraft("");
      load();
    }
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

  const addOnboardingItem = async () => {
    if (!newOnboardingText.trim()) return;
    const res = await fetch(`/api/projects/${id}/onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tekst: newOnboardingText.trim() }),
    });
    if (res.ok) {
      const data = (await res.json()) as { onboarding: ProjectOnboardingItem[] };
      setOnboarding(data.onboarding);
      setNewOnboardingText("");
    } else {
      toast("Nie udało się dodać punktu.", "error");
    }
  };

  const seedDefaultOnboarding = async () => {
    setSeedingOnboarding(true);
    const res = await fetch(`/api/projects/${id}/onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seedDefaults: true }),
    });
    setSeedingOnboarding(false);
    if (res.ok) {
      const data = (await res.json()) as { onboarding: ProjectOnboardingItem[] };
      setOnboarding(data.onboarding);
    } else {
      toast("Nie udało się uzupełnić checklisty.", "error");
    }
  };

  const toggleOnboardingItem = async (itemId: string, done: boolean) => {
    setOnboarding((prev) => prev.map((it) => (it.id === itemId ? { ...it, done } : it)));
    const res = await fetch(`/api/projects/${id}/onboarding/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    });
    if (!res.ok) toast("Nie udało się zapisać.", "error");
  };

  const updateOnboardingItemText = async (itemId: string, tekst: string) => {
    setOnboarding((prev) => prev.map((it) => (it.id === itemId ? { ...it, tekst } : it)));
    const res = await fetch(`/api/projects/${id}/onboarding/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tekst }),
    });
    if (!res.ok) toast("Nie udało się zapisać.", "error");
  };

  const deleteOnboardingItem = async (itemId: string) => {
    const res = await fetch(`/api/projects/${id}/onboarding/${itemId}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć.", "error");
      return;
    }
    setOnboarding((prev) => prev.filter((it) => it.id !== itemId));
  };

  const copyWelcomeMessage = async () => {
    try {
      await navigator.clipboard.writeText(welcomeMsg);
      toast("Skopiowano do schowka.");
    } catch {
      toast("Nie udało się skopiować — zaznacz i skopiuj ręcznie.", "error");
    }
  };

  const copyReviewDraft = async () => {
    try {
      await navigator.clipboard.writeText(reviewDraft);
      toast("Skopiowano do schowka.");
    } catch {
      toast("Nie udało się skopiować — zaznacz i skopiuj ręcznie.", "error");
    }
  };

  const requestReview = async () => {
    if (!reviewDraft.trim() || requestingReview) return;
    setRequestingReview(true);
    const res = await fetch(`/api/projects/${id}/request-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reviewDraft }),
    });
    setRequestingReview(false);
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast(data.error ?? "Nie udało się wysłać wiadomości.", "error");
      return;
    }
    toast("Wysłano podsumowanie i prośbę o opinię.");
    load();
  };

  const saveManualReview = async () => {
    if (manualJakosc === 0 || manualTerminowosc === 0 || manualKomunikacja === 0 || savingManualReview) return;
    if (manualConsent && !manualConsentName.trim()) {
      toast("Podaj imię i nazwisko osoby, która wyraziła zgodę.", "error");
      return;
    }
    setSavingManualReview(true);
    const res = await fetch(`/api/projects/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jakosc: manualJakosc,
        terminowosc: manualTerminowosc,
        komunikacja: manualKomunikacja,
        comment: manualComment.trim(),
        consentCaseStudy: manualConsent,
        consentName: manualConsentName.trim(),
      }),
    });
    setSavingManualReview(false);
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast(data.error ?? "Nie udało się zapisać opinii.", "error");
      return;
    }
    toast("Opinia zapisana.");
    setManualReviewOpen(false);
    setManualJakosc(0);
    setManualTerminowosc(0);
    setManualKomunikacja(0);
    setManualComment("");
    setManualConsent(false);
    setManualConsentName("");
    load();
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

  return (
    <div>
      <PanelHeader onClose={onClose} tytul={project.tytul} saveState={saveState} />

      {/* Tożsamość rekordu — zostaje NAD zakładkami (jak nazwa/status u
          klienta), żeby tytuł, klient, opis i postęp były pod ręką niezależnie
          od aktywnej zakładki. Na podstronie [id] nie ma nagłówka, więc to
          jedyne miejsce z tytułem projektu. */}
      <div className="mt-4">
          <div>
            <div className="flex items-center gap-2.5">
              <ProjectIconPicker
                kolor={project.kolor}
                ikona={project.ikona}
                onChange={(patch) => {
                  if (patch.kolor !== undefined) updateProject("kolor", patch.kolor);
                  if (patch.ikona !== undefined) updateProject("ikona", patch.ikona);
                }}
              />
              <input
                value={project.tytul}
                onChange={(e) => setProject((prev) => (prev ? { ...prev, tytul: e.target.value } : prev))}
                onBlur={(e) => updateProject("tytul", e.target.value)}
                className="w-full bg-transparent text-2xl font-semibold tracking-tight text-[var(--fg)] outline-none"
              />
            </div>
            <ClientLinkChip clientId={project.client_id} lang={langPrefix as Locale} className="mt-1 inline-block" />
            {sourceOffer && (
              <Link
                href={`/${langPrefix}/admin/offers/${sourceOffer.id}`}
                className="mt-1 ml-3 inline-block text-[12.5px] text-muted hover:text-[var(--fg)] hover:underline"
              >
                → Powstał z oferty: {sourceOffer.tytul || "(bez tytułu)"}
              </Link>
            )}
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
      </div>

      <div className="mt-5 flex h-9 items-center gap-4 border-b hairline">
        <ViewTabs
          value={tab}
          onChange={setTab}
          layoutId="project-detail-tab-underline"
          tabs={[
            { id: "overview", label: "Podgląd" },
            { id: "onboarding", label: "Onboarding" },
            { id: "time", label: "Czas pracy i rentowność" },
            { id: "closing", label: "Zamknięcie i opinia" },
            { id: "log", label: "Log aktywności" },
          ]}
        />
      </div>

      <ViewSwitch viewKey={tab}>
        {tab === "onboarding" && (
          <div className="mt-4">
          <div className="card-paper rounded-xl border hairline p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-medium">Onboarding</h2>
              {onboarding.length > 0 && (
                <span className="text-[11px] text-muted tabular-nums">
                  {progressOf(onboarding.map((o) => ({ done: o.done }))).pct}% · {progressOf(onboarding.map((o) => ({ done: o.done }))).done}/{onboarding.length}
                </span>
              )}
            </div>

            {onboarding.length === 0 ? (
              <div className="flex items-start gap-2 text-sm text-muted opacity-60">
                <IconClipboardList size={15} className="mt-0.5 shrink-0" />
                <span>
                  Brak checklisty onboardingowej —{" "}
                  <button
                    onClick={seedDefaultOnboarding}
                    disabled={seedingOnboarding}
                    className="text-[var(--fg)] underline underline-offset-2 opacity-100 disabled:opacity-50"
                  >
                    {seedingOnboarding ? "Uzupełniam…" : "uzupełnij domyślną checklistą"}
                  </button>
                </span>
              </div>
            ) : (
              <>
                <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--hairline)]">
                  <div
                    className="h-full rounded-full bg-[#4ea7fc] transition-all"
                    style={{ width: `${progressOf(onboarding.map((o) => ({ done: o.done }))).pct}%` }}
                  />
                </div>
                <ul className="space-y-1">
                  {onboarding.map((it) => (
                    <li key={it.id} className="group/onb flex items-center gap-1.5 rounded-lg px-1 py-0.5 hover:bg-[var(--hairline)]">
                      <input
                        type="checkbox"
                        checked={it.done}
                        onChange={(e) => toggleOnboardingItem(it.id, e.target.checked)}
                        className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[#4ea7fc]"
                      />
                      <div className={`min-w-0 flex-1 text-sm ${it.done ? "text-muted line-through" : ""}`}>
                        <EditableText value={it.tekst} onSave={(v) => updateOnboardingItemText(it.id, v)} />
                      </div>
                      <button
                        onClick={() => deleteOnboardingItem(it.id)}
                        className="shrink-0 text-muted opacity-0 transition-opacity group-hover/onb:opacity-100 hover:text-red-400"
                        aria-label="Usuń punkt checklisty"
                        title="Usuń"
                      >
                        <IconX size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
                {progressOf(onboarding.map((o) => ({ done: o.done }))).pct < 100 && (
                  <p className="mt-2 text-[12.5px] text-muted opacity-80">{ONBOARDING_INCOMPLETE_HINT}</p>
                )}
              </>
            )}

            <div className="mt-2 flex items-center gap-2">
              <input
                value={newOnboardingText}
                onChange={(e) => setNewOnboardingText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addOnboardingItem()}
                placeholder="+ Dodaj punkt checklisty…"
                className="w-full rounded-lg border hairline bg-transparent px-2 py-1 text-xs text-[var(--fg)] placeholder:text-muted"
              />
              <button
                onClick={addOnboardingItem}
                disabled={!newOnboardingText.trim()}
                className="shrink-0 rounded-lg border hairline px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                Dodaj
              </button>
            </div>

            <div className="mt-4 border-t hairline pt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="text-[11px] text-muted opacity-70">Wiadomość powitalna (szkic do ręcznego wysłania)</h3>
                <button onClick={copyWelcomeMessage} className="shrink-0 rounded-full border hairline px-2.5 py-0.5 text-[11px] text-muted hover:text-[var(--fg)]">
                  Kopiuj do schowka
                </button>
              </div>
              <textarea
                value={welcomeMsg}
                onChange={(e) => setWelcomeMsg(e.target.value)}
                rows={6}
                className="w-full rounded-xl border hairline bg-transparent px-3 py-2 text-[12.5px] text-[var(--fg)] placeholder:text-muted"
              />
            </div>
          </div>
          </div>
        )}

        {tab === "closing" && (
          <div className="mt-4">
          {!project.client_id && (
            <p className="flex items-center gap-2 text-sm text-muted opacity-60">
              <IconInbox size={15} className="shrink-0" />
              Zamknięcie i prośba o opinię będą dostępne po podpięciu klienta w zakładce Podgląd.
            </p>
          )}
          {project.client_id && (
            <div className="card-paper rounded-xl border hairline p-4">
              <h2 className="text-[14px] font-medium">Zamknięcie projektu i opinia</h2>
              {project.status === "Wdrożone" && !project.review_requested_at && !project.review_submitted_at && (
                <p className="mt-2 text-[12.5px] text-muted opacity-80">{PROJECT_REVIEW_REQUEST_HINT}</p>
              )}

              {project.review_submitted_at ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-[13px] text-emerald-400">
                    <IconCheck size={15} />
                    Opinia zebrana {formatPlDate(project.review_submitted_at)} — średnia {projectReviewAverage(project)?.toFixed(1)}/5
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[12px]">
                    <div>
                      <div className="text-muted">Jakość</div>
                      <div className="font-medium text-[var(--fg)]">{project.review_rating_jakosc}/5</div>
                    </div>
                    <div>
                      <div className="text-muted">Terminowość</div>
                      <div className="font-medium text-[var(--fg)]">{project.review_rating_terminowosc}/5</div>
                    </div>
                    <div>
                      <div className="text-muted">Komunikacja</div>
                      <div className="font-medium text-[var(--fg)]">{project.review_rating_komunikacja}/5</div>
                    </div>
                  </div>
                  {project.review_comment && <p className="text-[12.5px] italic text-[var(--fg)] opacity-90">„{project.review_comment}"</p>}
                  <p className="text-[11.5px] text-muted">
                    {project.review_consent_case_study
                      ? `✓ Zgoda na referencję/case study (${project.review_consent_name ?? "—"})`
                      : "Brak zgody na referencję/case study."}
                  </p>
                </div>
              ) : (
                <>
                  {project.review_requested_at && (
                    <p className="mt-2 text-[12.5px] text-muted opacity-80">
                      Wysłano {formatPlDate(project.review_requested_at)} — czeka na odpowiedź klienta.
                    </p>
                  )}
                  <div className="mt-3 border-t hairline pt-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <h3 className="text-[11px] text-muted opacity-70">Podsumowanie + prośba o opinię (szkic do edycji)</h3>
                      <button onClick={copyReviewDraft} className="shrink-0 rounded-full border hairline px-2.5 py-0.5 text-[11px] text-muted hover:text-[var(--fg)]">
                        Kopiuj do schowka
                      </button>
                    </div>
                    <textarea
                      value={reviewDraft}
                      onChange={(e) => setReviewDraft(e.target.value)}
                      rows={7}
                      className="w-full rounded-xl border hairline bg-transparent px-3 py-2 text-[12.5px] text-[var(--fg)] placeholder:text-muted"
                    />
                    <button
                      onClick={requestReview}
                      // Po unieważnieniu linku wysyłka jest zablokowana:
                      // szkic nadal zawiera stary adres, który zwraca 410, a
                      // wysłanie go klientowi wyglądałoby jak działająca prośba
                      // o opinię (Moduł 40).
                      disabled={!reviewDraft.trim() || requestingReview || !reviewUrl || !!project.review_revoked_at}
                      title={project.review_revoked_at ? "Link do formularza jest unieważniony — wygeneruj nowy, żeby wysłać prośbę." : undefined}
                      className="btn-primary mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {requestingReview ? "Wysyłanie…" : project.review_requested_at ? "Wyślij ponownie mailem" : "Wyślij mailem"}
                    </button>
                    {/* Moduł 40 — link do formularza opinii można unieważnić
                        tak samo jak link do dokumentu. */}
                    <div className="mt-2">
                      <ShareLinkControl
                        kind="project"
                        id={id}
                        hasToken={!!reviewUrl || !!project.review_revoked_at}
                        revokedAt={project.review_revoked_at}
                        etykieta="formularza opinii"
                        onChanged={(revokedAt, url) => {
                          setProject((p) => (p ? { ...p, review_revoked_at: revokedAt } : p));
                          if (url) {
                            setReviewUrl(url);
                            // Szkic wiadomości zawiera WPISANY adres — po
                            // wygenerowaniu nowego linku trzeba go przebudować,
                            // inaczej właściciel wysłałby stary, martwy URL.
                            reviewDraftInitialized.current = false;
                            load();
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 border-t hairline pt-3">
                    {!manualReviewOpen ? (
                      <button onClick={() => setManualReviewOpen(true)} className="text-[11.5px] text-muted underline underline-offset-2 hover:text-[var(--fg)]">
                        albo wpisz opinię ręcznie (np. zebraną telefonicznie)
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <h3 className="text-[11px] text-muted opacity-70">Wpisz opinię ręcznie</h3>
                        <div className="flex flex-wrap gap-4">
                          <StarPicker value={manualJakosc} onChange={setManualJakosc} label="Jakość" />
                          <StarPicker value={manualTerminowosc} onChange={setManualTerminowosc} label="Terminowość" />
                          <StarPicker value={manualKomunikacja} onChange={setManualKomunikacja} label="Komunikacja" />
                        </div>
                        <textarea
                          value={manualComment}
                          onChange={(e) => setManualComment(e.target.value)}
                          rows={3}
                          placeholder="Komentarz (opcjonalnie)…"
                          className="w-full rounded-xl border hairline bg-transparent px-3 py-2 text-[12.5px] text-[var(--fg)] placeholder:text-muted"
                        />
                        <div className="rounded-lg border hairline p-2.5">
                          <label className="flex items-start gap-2 text-[11.5px] text-muted">
                            <input type="checkbox" checked={manualConsent} onChange={(e) => setManualConsent(e.target.checked)} className="mt-0.5" />
                            Klient wyraził zgodę na wykorzystanie referencji/case study (zaznacz tylko, jeśli faktycznie ją wyraził).
                          </label>
                          {manualConsent && (
                            <input
                              value={manualConsentName}
                              onChange={(e) => setManualConsentName(e.target.value)}
                              placeholder="Imię i nazwisko osoby, która wyraziła zgodę"
                              className="mt-2 w-full rounded-lg border hairline bg-transparent px-2.5 py-1.5 text-[12.5px] text-[var(--fg)] placeholder:text-muted"
                            />
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={saveManualReview}
                            disabled={manualJakosc === 0 || manualTerminowosc === 0 || manualKomunikacja === 0 || savingManualReview}
                            className="btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingManualReview ? "Zapisywanie…" : "Zapisz opinię"}
                          </button>
                          <button onClick={() => setManualReviewOpen(false)} className="rounded-lg border hairline px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)]">
                            Anuluj
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          </div>
        )}

        {tab === "time" && (
          <div className="mt-4 space-y-4">
          {rentownosc && (rentownosc.przychod_netto > 0 || rentownosc.koszty_netto > 0) && (
            <div className="card-paper rounded-xl border hairline p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[14px] font-medium">Rentowność</h2>
                <a href={`/${langPrefix}/admin/costs?project=${id}`} className="text-xs text-muted hover:text-[var(--fg)]">
                  Zobacz koszty projektu →
                </a>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[11px] text-muted">Przychód netto</div>
                  <div className="mt-0.5 text-[15px] font-semibold text-[var(--fg)]">{formatMoney(rentownosc.przychod_netto)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted">Koszty netto</div>
                  <div className="mt-0.5 text-[15px] font-semibold text-[var(--fg)]">{formatMoney(rentownosc.koszty_netto)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted">Zysk netto</div>
                  <div className={`mt-0.5 text-[15px] font-semibold ${rentownosc.zysk_netto >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatMoney(rentownosc.zysk_netto)}
                  </div>
                </div>
              </div>
              {rentownosc.ma_inne_waluty && (
                <div className="mt-2 text-[11px] text-muted">Pominięto faktury w walucie innej niż PLN.</div>
              )}
            </div>
          )}

          <div className="card-paper rounded-xl border hairline p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-medium">Czas pracy</h2>
              <span className="text-xs text-muted">{totalMinutes > 0 ? formatDuration(totalMinutes) : "brak wpisów"}</span>
            </div>

            <div className="mb-3 flex items-center justify-between rounded-lg border hairline px-3 py-2">
              <span className="text-[11px] text-muted">Efektywna stawka godzinowa</span>
              {(() => {
                if (!rentownosc) {
                  return <span className="text-[12px] text-muted opacity-70">brak danych o rentowności</span>;
                }
                const rate = effectiveHourlyRate(rentownosc.zysk_netto, totalMinutes);
                return rate === null ? (
                  <span className="text-[12px] text-muted opacity-70">brak zalogowanego czasu</span>
                ) : (
                  <span className={`text-[14px] font-semibold ${rate >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatMoney(rate)}/h</span>
                );
              })()}
            </div>

            {activeTimerHere && !activeTimerHere.ended_at ? (
              <div className="mb-3 flex items-center justify-between rounded-lg border hairline bg-[var(--hairline)] px-3 py-2">
                <span className="flex items-center gap-1.5 text-[12.5px] text-[var(--fg)]">
                  <IconClock size={14} className="text-emerald-400" />
                  Stoper działa{activeTimerHere.task_text ? ` — ${activeTimerHere.task_text}` : ""}
                  {" · "}
                  {formatDuration(Math.max(0, (Date.now() - new Date(activeTimerHere.started_at as string).getTime()) / 60000))}
                </span>
                <button onClick={stopTimer} className="shrink-0 rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]">
                  <IconPlayerStop size={13} className="inline -mt-0.5 mr-1" />
                  Zatrzymaj
                </button>
              </div>
            ) : (
              !activeTimer && (
                <button
                  onClick={() => startTimer(null)}
                  className="mb-3 flex items-center gap-1.5 rounded-full border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]"
                >
                  <IconPlayerPlay size={13} />
                  Start stopera (ogólnie na projekt)
                </button>
              )
            )}

            {timeEntries.filter((e) => !(e.ended_at === null && e.source === "timer")).length > 0 && (
              <ul className="mb-3 max-h-56 space-y-1 overflow-y-auto pr-1">
                {timeEntries
                  .filter((e) => !(e.ended_at === null && e.source === "timer"))
                  .map((e) =>
                    editingEntryId === e.id ? (
                      <li key={e.id} className="space-y-1.5 rounded-lg border hairline bg-[var(--hairline)] p-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            value={editHours}
                            onChange={(ev) => setEditHours(ev.target.value)}
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter") saveEditedEntry();
                              if (ev.key === "Escape") cancelEditEntry();
                            }}
                            placeholder="godz."
                            inputMode="decimal"
                            autoFocus
                            className="w-16 rounded-lg border hairline bg-transparent px-2 py-1 text-xs text-[var(--fg)] placeholder:text-muted"
                          />
                          <select
                            value={editTaskId}
                            onChange={(ev) => setEditTaskId(ev.target.value)}
                            className="rounded-lg border hairline bg-transparent px-2 py-1 text-xs text-[var(--fg)]"
                          >
                            <option value="">— ogólnie na projekt —</option>
                            {tasks.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.text}
                              </option>
                            ))}
                          </select>
                          <DateField value={editDate} onChange={(v) => v && setEditDate(v)} placeholder="Data" />
                        </div>
                        <input
                          value={editNote}
                          onChange={(ev) => setEditNote(ev.target.value)}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") saveEditedEntry();
                            if (ev.key === "Escape") cancelEditEntry();
                          }}
                          placeholder="Notatka (opcjonalnie)"
                          className="w-full rounded-lg border hairline bg-transparent px-2 py-1 text-xs text-[var(--fg)] placeholder:text-muted"
                        />
                        <div className="flex justify-end gap-1.5">
                          <button onClick={cancelEditEntry} className="rounded-lg border hairline px-2.5 py-1 text-xs text-muted hover:text-[var(--fg)]">
                            Anuluj
                          </button>
                          <button
                            onClick={saveEditedEntry}
                            disabled={!editHours.trim()}
                            className="btn-primary rounded-lg px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Zapisz
                          </button>
                        </div>
                      </li>
                    ) : (
                      <li
                        key={e.id}
                        className="group/time flex items-center justify-between gap-2 rounded-lg px-1 py-0.5 text-[12.5px] transition-colors hover:bg-[var(--hairline)]"
                      >
                        <span className="min-w-0 flex-1 truncate text-muted">
                          {formatPlDate(e.entry_date)}
                          {e.task_id && tasks.find((t) => t.id === e.task_id) ? ` · ${tasks.find((t) => t.id === e.task_id)?.text}` : ""}
                          {e.note ? ` — ${e.note}` : ""}
                        </span>
                        <span className="shrink-0 tabular-nums text-[var(--fg)]">{formatDuration(e.minutes)}</span>
                        <button
                          onClick={() => startEditEntry(e)}
                          className="shrink-0 text-muted opacity-0 transition-opacity group-hover/time:opacity-100 hover:text-[var(--fg)]"
                          aria-label="Edytuj wpis czasu"
                          title="Edytuj"
                        >
                          <IconPencil size={13} />
                        </button>
                        <button
                          onClick={() => deleteTimeEntry(e.id)}
                          className="shrink-0 text-muted opacity-0 transition-opacity group-hover/time:opacity-100 hover:text-red-400"
                          aria-label="Usuń wpis czasu"
                          title="Usuń"
                        >
                          <IconTrash size={13} />
                        </button>
                      </li>
                    )
                  )}
              </ul>
            )}

            <div className="flex flex-wrap items-center gap-1.5 border-t hairline pt-3">
              <input
                value={manualHours}
                onChange={(e) => setManualHours(e.target.value)}
                placeholder="godz."
                inputMode="decimal"
                className="w-16 rounded-lg border hairline bg-transparent px-2 py-1 text-xs text-[var(--fg)] placeholder:text-muted"
              />
              <select
                value={manualTaskId}
                onChange={(e) => setManualTaskId(e.target.value)}
                className="rounded-lg border hairline bg-transparent px-2 py-1 text-xs text-[var(--fg)]"
              >
                <option value="">— ogólnie na projekt —</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.text}
                  </option>
                ))}
              </select>
              <DateField value={manualDate} onChange={(v) => v && setManualDate(v)} placeholder="Data" />
              <input
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Notatka (opcjonalnie)"
                className="min-w-[120px] flex-1 rounded-lg border hairline bg-transparent px-2 py-1 text-xs text-[var(--fg)] placeholder:text-muted"
              />
              <button
                onClick={addManualTimeEntry}
                disabled={!manualHours.trim()}
                className="shrink-0 rounded-lg border hairline px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Dodaj wpis
              </button>
            </div>
          </div>
          </div>
        )}

        {tab === "overview" && (
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* Kolumna główna Podglądu: kamienie milowe (rdzeń projektu). */}
            <div className="min-w-0 space-y-4">
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
                    <div key={m.id} onDragOver={(e) => e.preventDefault()} onDrop={() => onDropMilestone(m.id)}>
                      <div className="group/ms mb-1.5 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span
                            draggable
                            onDragStart={(e) => {
                              dragMsRef.current = m.id;
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            className="shrink-0 cursor-grab text-muted opacity-0 transition-opacity group-hover/ms:opacity-60 active:cursor-grabbing"
                            title="Przeciągnij, aby zmienić kolejność"
                          >
                            <IconGripVertical size={14} />
                          </span>
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
                      <TaskList
                        tasks={mTasks}
                        onToggle={toggleTask}
                        onDelete={deleteTask}
                        onDragStartTask={(tid) => (dragTaskRef.current = tid)}
                        onDropTask={onDropTask}
                        minutesByTask={minutesByTask}
                        activeTaskId={activeTimerHere && !activeTimerHere.ended_at ? activeTimerHere.task_id : null}
                        onStartTimer={startTimer}
                        onStopTimer={stopTimer}
                      />
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
                    <TaskList
                      tasks={unmilestoned}
                      onToggle={toggleTask}
                      onDelete={deleteTask}
                      onDragStartTask={(tid) => (dragTaskRef.current = tid)}
                      onDropTask={onDropTask}
                      minutesByTask={minutesByTask}
                      activeTaskId={activeTimerHere && !activeTimerHere.ended_at ? activeTimerHere.task_id : null}
                      onStartTimer={startTimer}
                      onStopTimer={stopTimer}
                    />
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
            </div>

            {/* Prawa kolumna Podglądu: metadane (styl Linear — płaskie wiersze
                z ikoną), zależności, zasoby, usuwanie. */}
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
            {/* Moduł 22 — dwa osobne selecty ("Lead" i "Klient") zastąpione
                jednym polem: relacja jest wyłączna (decyzja właściciela
                2026-07-16), więc drugie pole i tak zawsze zostawało puste.
                Projekt z ZAAKCEPTOWANEJ oferty ma w bazie oba pola (dziedziczy
                je z oferty, lib/offerAccept.ts) — wtedy pokazujemy klienta
                (aktualniejsza relacja), a ręczna zmiana czyści leada. */}
            <MetaRow icon={<IconUsers size={15} />} title="Powiązanie">
              <LinkPicker
                kinds={["client", "lead"]}
                value={{ client_id: project.client_id, lead_id: project.lead_id }}
                onPick={(next) => void updateProjectLink(next)}
                trigger={(picked, open) => (
                  <button onClick={open} className="w-full text-left">
                    <PropTrigger label={picked ? picked.nazwa : "— brak —"} />
                  </button>
                )}
              />
            </MetaRow>
          </div>

          <div className="border-t hairline pt-4">
            <h3 className="mb-2 text-[11px] text-muted opacity-70">Zależy od</h3>
            {dependencies.length > 0 && (
              <ul className="mb-2 space-y-1">
                {dependencies.map((depId) => (
                  <li key={depId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      <IconArrowRight size={13} className="shrink-0 text-muted" />
                      <span className="truncate">{allProjects.find((p) => p.id === depId)?.tytul ?? "—"}</span>
                    </span>
                    <button onClick={() => removeDependency(depId)} className="shrink-0 text-muted hover:text-red-400" aria-label="Usuń zależność" title="Usuń">
                      <IconX size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Popover
              align="left"
              width={240}
              trigger={(open) => (
                <button onClick={open} className="w-full rounded-lg border hairline px-2 py-1 text-xs text-muted hover:text-[var(--fg)]">
                  + Dodaj zależność
                </button>
              )}
            >
              {(close) => {
                const opts = allProjects.filter((p) => p.id !== id && !dependencies.includes(p.id));
                return (
                  <div className="max-h-[50vh] overflow-y-auto">
                    {opts.length === 0 ? (
                      <div className="px-2.5 py-2 text-[12px] text-muted">Brak innych projektów.</div>
                    ) : (
                      opts.map((p) => (
                        <MenuRow key={p.id} label={p.tytul} onClick={() => { addDependency(p.id); close(); }} />
                      ))
                    )}
                  </div>
                );
              }}
            </Popover>
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
        )}

        {tab === "log" && (
          <div className="mt-4">
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
        )}
      </ViewSwitch>
    </div>
  );
}

function TaskList({
  tasks,
  onToggle,
  onDelete,
  onDragStartTask,
  onDropTask,
  minutesByTask,
  activeTaskId,
  onStartTimer,
  onStopTimer,
}: {
  tasks: ProjectTask[];
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onDragStartTask?: (id: string) => void;
  onDropTask?: (id: string) => void;
  minutesByTask?: Record<string, number>;
  activeTaskId?: string | null;
  onStartTimer?: (taskId: string) => void;
  onStopTimer?: () => void;
}) {
  if (tasks.length === 0) return <p className="text-xs text-muted opacity-50">Brak zadań.</p>;
  return (
    <ul className="space-y-1">
      {tasks.map((t) => {
        const minutes = minutesByTask?.[t.id] ?? 0;
        const isRunning = activeTaskId === t.id;
        return (
          <li
            key={t.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDropTask?.(t.id)}
            className="group/task flex items-center gap-1.5 rounded-lg px-1 py-0.5 hover:bg-[var(--hairline)]"
          >
            <span
              draggable
              onDragStart={(e) => {
                onDragStartTask?.(t.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              className="shrink-0 cursor-grab text-muted opacity-0 transition-opacity group-hover/task:opacity-50 active:cursor-grabbing"
              title="Przeciągnij, aby zmienić kolejność"
            >
              <IconGripVertical size={13} />
            </span>
            <input
              type="checkbox"
              checked={t.done}
              onChange={(e) => onToggle(t.id, e.target.checked)}
              className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[#4ea7fc]"
            />
            <span className={`flex-1 text-sm ${t.done ? "text-muted line-through" : ""}`}>{t.text}</span>
            {minutes > 0 && <span className="shrink-0 text-[11px] tabular-nums text-muted">{formatDuration(minutes)}</span>}
            {(onStartTimer || onStopTimer) && (
              <button
                onClick={() => (isRunning ? onStopTimer?.() : onStartTimer?.(t.id))}
                className={`shrink-0 transition-opacity ${isRunning ? "text-emerald-400" : "text-muted opacity-0 hover:text-[var(--fg)] group-hover/task:opacity-100"}`}
                aria-label={isRunning ? "Zatrzymaj stoper" : "Uruchom stoper"}
                title={isRunning ? "Zatrzymaj stoper" : "Uruchom stoper dla tego zadania"}
              >
                {isRunning ? <IconPlayerStop size={13} /> : <IconPlayerPlay size={13} />}
              </button>
            )}
            <button
              onClick={() => onDelete(t.id)}
              className="text-muted hover:text-red-400"
              aria-label="Usuń zadanie"
              title="Usuń"
            >
              <IconX size={14} />
            </button>
          </li>
        );
      })}
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

/** Wybór oceny 1-5 gwiazdkami — wersja dla ciemnego panelu admina (wzorem
 * StarRating w publicznym ProjectReviewForm.tsx, ale dopasowana kolorystyka). */
function StarPicker({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-muted">{label}</div>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n}/5`}
            className="text-lg leading-none transition-transform hover:scale-110"
            style={{ color: n <= value ? "#E0A93B" : "var(--hairline)" }}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
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
