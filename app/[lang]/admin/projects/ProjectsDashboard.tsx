"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Locale } from "@/i18n/config";
import { type Project, PROJECT_STATUSES, PROJECT_PRIORITIES, isProjectOverdue, formatPlDate } from "./shared";
import { SummaryCard, SavedViews } from "../components";
import { ProjectKanban } from "./ProjectKanban";
import { ProjectTimeline } from "./ProjectTimeline";
import { ProjectDetailPanel } from "./ProjectDetailPanel";
import { useUI, useRegisterActions } from "../ui";

type ViewMode = "kanban" | "timeline";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function ProjectsDashboard({ lang }: { lang: Locale }) {
  const { toast, confirm, prompt } = useUI();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("kanban");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // Oś czasu pobiera dane niezależnie od listy Kanban (osobny, lżejszy
  // endpoint) — bez tego licznika edycje zrobione w panelu szczegółów, gdy
  // jesteśmy w widoku "Oś czasu", nie były tam widoczne bez przeładowania
  // strony. Zmiana wartości wymusza remount <ProjectTimeline> (key={...}),
  // czyli świeży fetch.
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);
  const bumpTimelineRefresh = useCallback(() => setTimelineRefreshKey((k) => k + 1), []);

  const load = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    const data = (await res.json()) as { projects: Project[] };
    setProjects(data.projects);
  }, []);

  useEffect(() => {
    load();
    const saved = window.localStorage.getItem("leggera_projects_filters");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { status?: string; priority?: string };
        if (parsed.status) setFilterStatus(parsed.status);
        if (parsed.priority) setFilterPriority(parsed.priority);
      } catch {
        // ignoruj uszkodzony zapis
      }
    }
    const savedView = window.localStorage.getItem("leggera_projects_view");
    if (savedView === "kanban" || savedView === "timeline") setView(savedView);
  }, [load]);

  const switchView = useCallback((v: ViewMode) => {
    setView(v);
    window.localStorage.setItem("leggera_projects_view", v);
  }, []);

  // Zapamiętane filtry — "zapisany widok", żeby nie ustawiać ich od nowa
  // przy każdej wizycie.
  useEffect(() => {
    window.localStorage.setItem(
      "leggera_projects_filters",
      JSON.stringify({ status: filterStatus, priority: filterPriority })
    );
  }, [filterStatus, filterPriority]);

  const updateProject = useCallback(async (id: string, field: string, value: string) => {
    setProjects((prev) => prev?.map((p) => (p.id === id ? { ...p, [field]: value } : p)) ?? prev);
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) toast("Nie udało się zapisać zmiany.", "error");
    bumpTimelineRefresh();
  }, [toast, bumpTimelineRefresh]);

  const reflectFieldChange = useCallback((id: string, field: string, value: string) => {
    setProjects((prev) => prev?.map((p) => (p.id === id ? { ...p, [field]: value } : p)) ?? prev);
    bumpTimelineRefresh();
  }, [bumpTimelineRefresh]);

  const addProject = useCallback(async () => {
    const tytul = await prompt("Nazwa nowego projektu / wdrożenia:", { placeholder: "np. Wdrożenie automatyzacji u klienta X" });
    if (!tytul) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tytul }),
    });
    if (res.ok) {
      toast("Dodano projekt.");
      load();
      bumpTimelineRefresh();
    } else {
      toast("Nie udało się dodać projektu.", "error");
    }
  }, [prompt, toast, load, bumpTimelineRefresh]);

  const deleteProject = useCallback(async (id: string, tytul: string) => {
    const ok = await confirm(`Usunąć "${tytul}"?`, { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć.", "error");
      return;
    }
    setProjects((prev) => prev?.filter((p) => p.id !== id) ?? prev);
    toast("Projekt usunięty.");
  }, [confirm, toast]);

  const filtered = useMemo(() => {
    let list = projects ?? [];
    if (filterStatus) list = list.filter((p) => p.status === filterStatus);
    if (filterPriority) list = list.filter((p) => p.priorytet === filterPriority);
    if (search) list = list.filter((p) => p.tytul.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [projects, filterStatus, filterPriority, search]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  useEffect(() => {
    clearSelection();
  }, [filterStatus, filterPriority, search, view, clearSelection]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const bulkUpdateField = useCallback(async (field: "status" | "priorytet", value: string) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkBusy(true);
    for (const id of ids) {
      await updateProject(id, field, value);
    }
    setBulkBusy(false);
    toast(`Zaktualizowano ${ids.length} projektów.`);
    clearSelection();
  }, [selectedIds, updateProject, toast, clearSelection]);

  const bulkDelete = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const ok = await confirm(`Usunąć ${ids.length} zaznaczonych projektów?`, { danger: true });
    if (!ok) return;
    setBulkBusy(true);
    for (const id of ids) {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
    }
    setBulkBusy(false);
    setProjects((prev) => prev?.filter((p) => !selectedIds.has(p.id)) ?? prev);
    toast(`Usunięto ${ids.length} projektów.`);
    clearSelection();
  }, [selectedIds, confirm, toast, clearSelection]);

  useRegisterActions(
    [{ id: "add", label: "+ Dodaj projekt", hint: "N", run: addProject }],
    [addProject]
  );

  // Gdy panel szczegółów projektu jest otwarty, cyfry 1-6 zmieniają status
  // (kolejność jak w PROJECT_STATUSES) — ten sam duch co skrót w Leadach.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (openId) setOpenId(null);
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (/^[1-9]$/.test(e.key) && openId) {
        const status = PROJECT_STATUSES[Number(e.key) - 1];
        if (status) {
          e.preventDefault();
          updateProject(openId, "status", status);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openId, updateProject]);

  if (!projects) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--hairline)]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--hairline)]" />
      </div>
    );
  }

  const overdue = projects.filter(isProjectOverdue);
  const counts = Object.fromEntries(PROJECT_STATUSES.map((s) => [s, projects.filter((p) => p.status === s).length]));

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
          Projekty <span className="text-liquid">i wdrożenia</span>
        </h1>
        <p className="text-sm text-muted">Twoje własne projekty — od pomysłu, przez wdrożenie, do zamknięcia.</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <SummaryCard label="Wszystkie" value={projects.length} />
        <SummaryCard label="Pomysły" value={counts["Pomysł"]} />
        <SummaryCard label="W trakcie" value={counts["W trakcie"]} />
        <SummaryCard label="Wdrożone" value={counts["Wdrożone"]} />
        <SummaryCard label="Wymaga działania" value={overdue.length} alert />
      </div>

      {overdue.length > 0 && (
        <div className="mb-6 rounded-2xl border border-orange-500/30 bg-orange-500/[0.05] p-4">
          <h2 className="mb-2 text-sm font-semibold text-orange-400">⚠ Mija/minął termin</h2>
          {overdue.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-orange-500/15 py-1.5 text-sm last:border-0">
              <span>
                <b>{p.tytul}</b> — termin {formatPlDate(p.termin)}
              </span>
              <button
                onClick={() => setOpenId(p.id)}
                className="rounded-full border border-orange-500/40 px-2 py-1 text-xs text-orange-400"
              >
                Otwórz
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={addProject} className="btn-primary rounded-full px-3 py-1.5 text-xs font-semibold">
          + Dodaj projekt
        </button>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-full border hairline bg-transparent px-2 py-1.5 text-xs text-[var(--fg)]"
        >
          <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">
            Wszystkie statusy
          </option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s} className="bg-[var(--bg-soft)] text-[var(--fg)]">
              {s}
            </option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="rounded-full border hairline bg-transparent px-2 py-1.5 text-xs text-[var(--fg)]"
        >
          <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">
            Wszystkie priorytety
          </option>
          {PROJECT_PRIORITIES.map((p) => (
            <option key={p} value={p} className="bg-[var(--bg-soft)] text-[var(--fg)]">
              {p}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj po nazwie…"
          className="rounded-full border hairline bg-transparent px-3 py-1.5 text-xs text-[var(--fg)] placeholder:text-muted"
        />
        <span className="flex-1" />
        <div className="flex overflow-hidden rounded-full border hairline text-xs">
          <button
            onClick={() => switchView("kanban")}
            className={
              view === "kanban"
                ? "bg-[var(--fg)] px-3 py-1.5 font-medium text-[var(--bg)]"
                : "px-3 py-1.5 text-muted hover:text-[var(--fg)]"
            }
          >
            Tablica
          </button>
          <button
            onClick={() => switchView("timeline")}
            className={
              view === "timeline"
                ? "bg-[var(--fg)] px-3 py-1.5 font-medium text-[var(--bg)]"
                : "px-3 py-1.5 text-muted hover:text-[var(--fg)]"
            }
          >
            Oś czasu
          </button>
        </div>
      </div>

      <div className="mb-4">
        <SavedViews
          storageKey="leggera_projects_saved_views"
          currentFilters={{ status: filterStatus, priorytet: filterPriority }}
          onApply={(f) => {
            setFilterStatus(f.status ?? "");
            setFilterPriority(f.priorytet ?? "");
          }}
        />
      </div>

      {view === "kanban" && selectedIds.size > 0 && (
        <div className="card-paper sticky top-2 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-full px-4 py-2 text-xs">
          <span className="font-semibold">Zaznaczono: {selectedIds.size}</span>
          <select
            disabled={bulkBusy}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) bulkUpdateField("status", e.target.value);
              e.target.value = "";
            }}
            className="rounded-full border hairline bg-transparent px-2 py-1 text-xs text-[var(--fg)] disabled:opacity-50"
          >
            <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">
              Zmień status na…
            </option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-[var(--bg-soft)] text-[var(--fg)]">
                {s}
              </option>
            ))}
          </select>
          <select
            disabled={bulkBusy}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) bulkUpdateField("priorytet", e.target.value);
              e.target.value = "";
            }}
            className="rounded-full border hairline bg-transparent px-2 py-1 text-xs text-[var(--fg)] disabled:opacity-50"
          >
            <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">
              Zmień priorytet na…
            </option>
            {PROJECT_PRIORITIES.map((p) => (
              <option key={p} value={p} className="bg-[var(--bg-soft)] text-[var(--fg)]">
                {p}
              </option>
            ))}
          </select>
          <button
            onClick={bulkDelete}
            disabled={bulkBusy}
            className="rounded-full border border-red-500/40 px-3 py-1 text-red-400 disabled:opacity-50"
          >
            ✕ Usuń zaznaczone
          </button>
          <span className="flex-1" />
          <button onClick={clearSelection} className="rounded-full border hairline px-3 py-1 text-muted">
            Odznacz wszystko
          </button>
        </div>
      )}

      {view === "kanban" ? (
        <ProjectKanban
          projects={filtered}
          lang={lang}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onUpdate={updateProject}
          onDelete={deleteProject}
          onOpen={setOpenId}
        />
      ) : (
        <ProjectTimeline key={timelineRefreshKey} lang={lang} onOpen={setOpenId} />
      )}

      <AnimatePresence>
        {openId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-[2px]"
            onClick={() => setOpenId(null)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="glass ml-auto h-full w-full max-w-2xl overflow-y-auto p-4 sm:p-6"
            >
              <ProjectDetailPanel
                id={openId}
                onClose={() => {
                  setOpenId(null);
                  bumpTimelineRefresh();
                }}
                onFieldChange={reflectFieldChange}
                onDeleted={(id) => {
                  setProjects((prev) => prev?.filter((p) => p.id !== id) ?? prev);
                  setOpenId(null);
                  bumpTimelineRefresh();
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
