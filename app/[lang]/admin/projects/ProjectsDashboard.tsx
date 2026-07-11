"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconPlus, IconFilter, IconAdjustmentsHorizontal, IconCircleFilled } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { type Project, PROJECT_STATUSES, PROJECT_PRIORITIES, PROJECT_HEALTHS, isProjectOverdue, formatPlDate } from "./shared";
import { SavedViews } from "../components";
import { ProjectKanban } from "./ProjectKanban";
import { ProjectTimeline } from "./ProjectTimeline";
import { ProjectDetailPanel } from "./ProjectDetailPanel";
import { Popover, MenuRow, MenuLabel, MenuDivider } from "../Menu";
import { useUI, useRegisterActions } from "../ui";

type ViewMode = "kanban" | "timeline";
type SortBy = "reczna" | "nazwa" | "termin" | "priorytet";

const PRIORITY_RANK: Record<string, number> = { "Krytyczny": 0, "Wysoki": 1, "Normalny": 2, "Niski": 3 };
const HEALTH_COLOR: Record<string, string> = {
  "Na dobrej drodze": "text-[#3fb987]",
  "Zagrożony": "text-[#e2a336]",
  "Zerwany": "text-[#e5484d]",
};
const SORT_LABEL: Record<SortBy, string> = {
  reczna: "Domyślnie",
  nazwa: "Nazwa (A→Z)",
  termin: "Termin",
  priorytet: "Priorytet",
};

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
  const [filterHealth, setFilterHealth] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("reczna");
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
    if (filterHealth) list = list.filter((p) => p.zdrowie === filterHealth);
    if (search) list = list.filter((p) => p.tytul.toLowerCase().includes(search.toLowerCase()));
    if (sortBy !== "reczna") {
      list = [...list].sort((a, b) => {
        if (sortBy === "nazwa") return a.tytul.localeCompare(b.tytul, "pl");
        if (sortBy === "termin") return (a.termin ?? "9999").localeCompare(b.termin ?? "9999");
        if (sortBy === "priorytet")
          return (PRIORITY_RANK[a.priorytet] ?? 9) - (PRIORITY_RANK[b.priorytet] ?? 9);
        return 0;
      });
    }
    return list;
  }, [projects, filterStatus, filterPriority, filterHealth, search, sortBy]);

  const activeFilterCount = [filterStatus, filterPriority, filterHealth].filter(Boolean).length;

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  useEffect(() => {
    clearSelection();
  }, [filterStatus, filterPriority, filterHealth, search, view, clearSelection]);

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

  return (
    <div className="-mx-4 sm:-mx-6">
      {/* Kompaktowy, jednowierszowy pasek — zakładki widoku po lewej,
          filtry/dodawanie jako małe ikony po prawej. Bez dużego nagłówka
          strony (Linear go nie ma — patrz docs: "reduce visual noise"). */}
      <div className="flex items-center gap-1 border-b hairline px-4 sm:px-6" style={{ height: "44px" }}>
        <button
          onClick={() => switchView("kanban")}
          className={`relative flex h-full items-center px-1 text-[13px] ${
            view === "kanban" ? "text-[var(--fg)]" : "text-muted"
          }`}
        >
          Tablica
          {view === "kanban" && (
            <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-[#7C3AED] to-[#E0A93B]" />
          )}
        </button>
        <button
          onClick={() => switchView("timeline")}
          className={`relative flex h-full items-center px-1 text-[13px] ${
            view === "timeline" ? "text-[var(--fg)]" : "text-muted"
          }`}
        >
          Oś czasu
          {view === "timeline" && (
            <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-[#7C3AED] to-[#E0A93B]" />
          )}
        </button>
        <span className="flex-1" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj…"
          className="w-32 rounded-md bg-transparent px-2 py-1 text-[12.5px] text-[var(--fg)] placeholder:text-muted"
        />
        {/* Filtry — jedno menu (Linear), realnie filtruje po statusie/priorytecie/zdrowiu */}
        <Popover
          align="right"
          width={230}
          trigger={(open, isOpen) => (
            <button
              onClick={open}
              title="Filtry"
              className={`flex h-6 items-center gap-1 rounded-md px-1.5 text-[12.5px] ${
                activeFilterCount > 0 || isOpen ? "bg-[var(--hairline)] text-[var(--fg)]" : "text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
              }`}
            >
              <IconFilter size={15} />
              {activeFilterCount > 0 && <span className="text-[11px]">{activeFilterCount}</span>}
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuLabel>Status</MenuLabel>
              <MenuRow label="Wszystkie" selected={!filterStatus} onClick={() => { setFilterStatus(""); }} />
              {PROJECT_STATUSES.map((s) => (
                <MenuRow key={s} label={s} selected={filterStatus === s} onClick={() => setFilterStatus(s)} />
              ))}
              <MenuDivider />
              <MenuLabel>Priorytet</MenuLabel>
              <MenuRow label="Wszystkie" selected={!filterPriority} onClick={() => setFilterPriority("")} />
              {PROJECT_PRIORITIES.map((p) => (
                <MenuRow key={p} label={p} selected={filterPriority === p} onClick={() => setFilterPriority(p)} />
              ))}
              <MenuDivider />
              <MenuLabel>Zdrowie</MenuLabel>
              <MenuRow label="Wszystkie" selected={!filterHealth} onClick={() => setFilterHealth("")} />
              {PROJECT_HEALTHS.map((h) => (
                <MenuRow
                  key={h}
                  label={h}
                  selected={filterHealth === h}
                  icon={<IconCircleFilled size={9} className={HEALTH_COLOR[h] ?? "text-muted"} />}
                  onClick={() => setFilterHealth(h)}
                />
              ))}
              {activeFilterCount > 0 && (
                <>
                  <MenuDivider />
                  <MenuRow
                    label="Wyczyść filtry"
                    onClick={() => { setFilterStatus(""); setFilterPriority(""); setFilterHealth(""); close(); }}
                  />
                </>
              )}
            </>
          )}
        </Popover>
        {/* Widok — sortowanie (realne) */}
        <Popover
          align="right"
          width={210}
          trigger={(open, isOpen) => (
            <button
              onClick={open}
              title="Opcje widoku"
              className={`flex h-6 w-6 items-center justify-center rounded-md ${
                isOpen ? "bg-[var(--hairline)] text-[var(--fg)]" : "text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
              }`}
            >
              <IconAdjustmentsHorizontal size={15} />
            </button>
          )}
        >
          {() => (
            <>
              <MenuLabel>Sortuj</MenuLabel>
              {(Object.keys(SORT_LABEL) as SortBy[]).map((s) => (
                <MenuRow key={s} label={SORT_LABEL[s]} selected={sortBy === s} onClick={() => setSortBy(s)} />
              ))}
            </>
          )}
        </Popover>
        <button
          onClick={addProject}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
          title="Dodaj projekt"
        >
          <IconPlus size={16} />
        </button>
      </div>

      <div className="px-4 py-4 sm:px-6">
        {overdue.length > 0 && (
          <div className="mb-4 rounded-lg border border-orange-500/25 bg-orange-500/[0.04] p-3">
            <h2 className="mb-1.5 text-[12.5px] font-medium text-orange-400">Mija/minął termin</h2>
            {overdue.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-orange-500/10 py-1 text-[13px] last:border-0">
                <span>
                  <b>{p.tytul}</b> — termin {formatPlDate(p.termin)}
                </span>
                <button onClick={() => setOpenId(p.id)} className="rounded-md px-2 py-0.5 text-[12px] text-orange-400 hover:bg-orange-500/10">
                  Otwórz
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mb-3">
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
      </div>

      <AnimatePresence>
        {openId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px] sm:p-8"
            onClick={() => setOpenId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 6 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="card-paper my-auto w-full max-w-4xl rounded-2xl border hairline p-5 sm:p-6"
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
