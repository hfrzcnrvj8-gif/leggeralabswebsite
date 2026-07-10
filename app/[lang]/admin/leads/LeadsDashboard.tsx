"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Locale } from "@/i18n/config";
import { type Lead, STATUSES, SEED, SummaryCard, isOverdue, overdueReason } from "./shared";
import { KanbanBoard } from "./KanbanBoard";
import { TableView } from "./TableView";
import { DiscoverPanel } from "./DiscoverPanel";
import { LeadDetailPanel } from "./LeadDetailPanel";
import { useUI, useRegisterActions } from "../ui";

type ViewMode = "kanban" | "table";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function LeadsDashboard({ lang }: { lang: Locale }) {
  const { toast, confirm, prompt } = useUI();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterZrodlo, setFilterZrodlo] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("kanban");
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sendingReport, setSendingReport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/leads");
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    const data = (await res.json()) as { leads: Lead[] };
    setLeads(data.leads);
  }, []);

  useEffect(() => {
    load();
    const saved = window.localStorage.getItem("leggera_leads_view");
    if (saved === "table" || saved === "kanban") setView(saved);
  }, [load]);

  const switchView = useCallback((v: ViewMode) => {
    setView(v);
    window.localStorage.setItem("leggera_leads_view", v);
  }, []);

  const updateLead = useCallback(async (id: string, field: string, value: string) => {
    setLeads((prev) => prev?.map((l) => (l.id === id ? { ...l, [field]: value } : l)) ?? prev);
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) toast("Nie udało się zapisać zmiany.", "error");
  }, [toast]);

  // Panel szczegółów sam wykonuje zapis — tu tylko odzwierciedlamy zmianę w
  // lokalnym stanie listy, żeby kanban/tabela od razu pokazały nowy stan.
  const reflectFieldChange = useCallback((id: string, field: string, value: string) => {
    setLeads((prev) => prev?.map((l) => (l.id === id ? { ...l, [field]: value } : l)) ?? prev);
  }, []);

  const addLead = useCallback(async () => {
    const firma = await prompt("Nazwa firmy nowego leada:", { placeholder: "np. Kancelaria Kowalski" });
    if (!firma) return;
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firma, zrodlo: "Ręcznie dodane", status: "Do kontaktu" }),
    });
    if (res.ok) {
      toast("Dodano leada.");
      load();
    } else {
      toast("Nie udało się dodać leada.", "error");
    }
  }, [prompt, toast, load]);

  const deleteLead = useCallback(async (id: string, firma: string) => {
    const ok = await confirm(`Usunąć "${firma}" z listy?`, { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć leada.", "error");
      return;
    }
    setLeads((prev) => prev?.filter((l) => l.id !== id) ?? prev);
    toast("Lead usunięty.");
  }, [confirm, toast]);

  const seedInitial = useCallback(async () => {
    if (!leads) return;
    const existing = new Set(leads.map((l) => l.firma));
    const toAdd = SEED.filter((s) => !existing.has(s.firma));
    if (toAdd.length === 0) {
      toast("Wszystkie firmy ze startowej listy już są w rejestrze.");
      return;
    }
    const ok = await confirm(`Dodać ${toAdd.length} firm ze startowej listy?`);
    if (!ok) return;
    for (const s of toAdd) {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
    }
    toast(`Dodano ${toAdd.length} firm.`);
    load();
  }, [leads, confirm, toast, load]);

  const sendReportNow = useCallback(async () => {
    setSendingReport(true);
    try {
      const res = await fetch("/api/leads/notify", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast("Raport wysłany na kontakt@leggeralabs.pl.");
      } else {
        toast(data?.error ?? "Nie udało się wysłać raportu.", "error");
      }
    } catch {
      toast("Nie udało się połączyć z serwerem.", "error");
    } finally {
      setSendingReport(false);
    }
  }, [toast]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((checked: boolean, ids: string[]) => {
    setSelectedIds(checked ? new Set(ids) : new Set());
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const bulkUpdateStatus = useCallback(async (status: string) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkBusy(true);
    for (const id of ids) {
      await updateLead(id, "status", status);
    }
    setBulkBusy(false);
    toast(`Zaktualizowano status dla ${ids.length} leadów.`);
    clearSelection();
  }, [selectedIds, updateLead, toast, clearSelection]);

  const bulkDelete = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const ok = await confirm(`Usunąć ${ids.length} zaznaczonych leadów?`, { danger: true });
    if (!ok) return;
    setBulkBusy(true);
    for (const id of ids) {
      await fetch(`/api/leads/${id}`, { method: "DELETE" });
    }
    setBulkBusy(false);
    setLeads((prev) => prev?.filter((l) => !selectedIds.has(l.id)) ?? prev);
    toast(`Usunięto ${ids.length} leadów.`);
    clearSelection();
  }, [selectedIds, confirm, toast, clearSelection]);

  const zrodla = useMemo(() => [...new Set((leads ?? []).map((l) => l.zrodlo))], [leads]);

  const filtered = useMemo(() => {
    let list = leads ?? [];
    if (filterStatus) list = list.filter((l) => l.status === filterStatus);
    if (filterZrodlo) list = list.filter((l) => l.zrodlo === filterZrodlo);
    if (search) list = list.filter((l) => l.firma.toLowerCase().includes(search.toLowerCase()));
    return [...list].sort((a, b) => {
      const ao = isOverdue(a) ? 0 : 1;
      const bo = isOverdue(b) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return a.firma.localeCompare(b.firma);
    });
  }, [leads, filterStatus, filterZrodlo, search]);

  useEffect(() => {
    setSelectedIndex(0);
    clearSelection();
  }, [filterStatus, filterZrodlo, search, view, clearSelection]);

  // Skróty lokalne dla tego widoku: "/" fokus wyszukiwarki, "j"/"k"
  // nawigacja w tabeli, Esc zamyka peek panel. Cmd+K i "n" (dodaj) obsługuje
  // globalny AppShell — patrz useRegisterActions poniżej.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (openLeadId) setOpenLeadId(null);
        return;
      }
      if (isTypingTarget(e.target)) return;

      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (view === "table" && (e.key === "j" || e.key === "k")) {
        e.preventDefault();
        setSelectedIndex((i) => {
          const delta = e.key === "j" ? 1 : -1;
          return Math.min(Math.max(i + delta, 0), Math.max(filtered.length - 1, 0));
        });
        return;
      }
      if (view === "table" && e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        setOpenLeadId(filtered[selectedIndex].id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openLeadId, view, filtered, selectedIndex]);

  // Akcje zgłoszone do globalnej palety poleceń (Cmd+K) w AppShell.
  useRegisterActions(
    [
      { id: "add", label: "+ Dodaj leada", hint: "N", run: addLead },
      { id: "kanban", label: "Widok: Tablica", run: () => switchView("kanban") },
      { id: "table", label: "Widok: Tabela", run: () => switchView("table") },
      { id: "discover", label: "✨ Znajdź nowe leady", run: () => setDiscoverOpen(true) },
      { id: "report", label: "Wyślij dzienny raport teraz", run: sendReportNow },
    ],
    [addLead, switchView, sendReportNow]
  );

  if (!leads) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--hairline)]" />
        <div className="flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 w-28 animate-pulse rounded-2xl bg-[var(--hairline)]" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--hairline)]" />
      </div>
    );
  }

  const overdue = leads.filter(isOverdue);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length]));
  const selectedId = view === "table" ? filtered[selectedIndex]?.id ?? null : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
          Rejestr <span className="text-liquid">leadów</span>
        </h1>
        <p className="text-sm text-muted">Zgłoszenia z formularza na stronie trafiają tu automatycznie.</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <SummaryCard label="Wszystkie" value={leads.length} />
        <SummaryCard label="Nowe ze strony" value={counts["Nowe zgłoszenie ze strony"]} />
        <SummaryCard label="Do kontaktu" value={counts["Do kontaktu"]} />
        <SummaryCard label="Czeka na odpowiedź" value={counts["Napisano - czeka na odpowiedź"]} />
        <SummaryCard label="Rozmowa umówiona" value={counts["Rozmowa umówiona"]} />
        <SummaryCard label="Pilotaż w trakcie" value={counts["Pilotaż w trakcie"]} />
        <SummaryCard label="Zamknięte sukcesem" value={counts["Zamknięte - sukces"]} />
        <SummaryCard label="Wymaga działania" value={overdue.length} alert />
      </div>

      {overdue.length > 0 && (
        <div className="mb-6 rounded-2xl border border-orange-500/30 bg-orange-500/[0.05] p-4">
          <h2 className="mb-2 text-sm font-semibold text-orange-400">⚠ Wymaga działania dziś</h2>
          {overdue.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between border-b border-orange-500/15 py-1.5 text-sm last:border-0"
            >
              <span>
                <b>{l.firma}</b> — {overdueReason(l)}
              </span>
              <button
                onClick={async () => {
                  await updateLead(l.id, "status", "Przypomnienie wysłane");
                  await updateLead(l.id, "ostatni_kontakt", new Date().toISOString().slice(0, 10));
                }}
                className="rounded-full border border-orange-500/40 px-2 py-1 text-xs text-orange-400"
              >
                Oznacz jako obsłużone
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={addLead} className="btn-primary rounded-full px-3 py-1.5 text-xs font-semibold">
          + Dodaj lead
        </button>
        <DiscoverPanel open={discoverOpen} onOpenChange={setDiscoverOpen} onDiscovered={load} />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-full border hairline bg-transparent px-2 py-1.5 text-xs text-[var(--fg)]"
        >
          <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">
            Wszystkie statusy
          </option>
          {STATUSES.map((s) => (
            <option key={s} value={s} className="bg-[var(--bg-soft)] text-[var(--fg)]">
              {s}
            </option>
          ))}
        </select>
        <select
          value={filterZrodlo}
          onChange={(e) => setFilterZrodlo(e.target.value)}
          className="rounded-full border hairline bg-transparent px-2 py-1.5 text-xs text-[var(--fg)]"
        >
          <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">
            Wszystkie źródła
          </option>
          {zrodla.map((z) => (
            <option key={z} value={z} className="bg-[var(--bg-soft)] text-[var(--fg)]">
              {z}
            </option>
          ))}
        </select>
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj po nazwie firmy… (/)"
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
            onClick={() => switchView("table")}
            className={
              view === "table"
                ? "bg-[var(--fg)] px-3 py-1.5 font-medium text-[var(--bg)]"
                : "px-3 py-1.5 text-muted hover:text-[var(--fg)]"
            }
          >
            Tabela
          </button>
        </div>
        <button
          onClick={sendReportNow}
          disabled={sendingReport}
          className="rounded-full border hairline px-3 py-1.5 text-xs disabled:opacity-50"
        >
          {sendingReport ? "Wysyłam…" : "Wyślij raport teraz"}
        </button>
        <button onClick={seedInitial} className="rounded-full border hairline px-3 py-1.5 text-xs">
          Wczytaj listę startową
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div className="card-paper sticky top-2 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-full px-4 py-2 text-xs">
          <span className="font-semibold">Zaznaczono: {selectedIds.size}</span>
          <select
            disabled={bulkBusy}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) bulkUpdateStatus(e.target.value);
              e.target.value = "";
            }}
            className="rounded-full border hairline bg-transparent px-2 py-1 text-xs text-[var(--fg)] disabled:opacity-50"
          >
            <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">
              Zmień status na…
            </option>
            {STATUSES.map((s) => (
              <option key={s} value={s} className="bg-[var(--bg-soft)] text-[var(--fg)]">
                {s}
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
        <KanbanBoard
          leads={filtered}
          lang={lang}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onUpdate={updateLead}
          onDelete={deleteLead}
          onOpen={setOpenLeadId}
        />
      ) : (
        <TableView
          leads={filtered}
          lang={lang}
          selectedId={selectedId}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={(checked) => toggleSelectAll(checked, filtered.map((l) => l.id))}
          onUpdate={updateLead}
          onDelete={deleteLead}
          onOpen={setOpenLeadId}
        />
      )}

      {/* Wysuwany panel szczegółów leada — "peek", bez opuszczania listy. */}
      <AnimatePresence>
        {openLeadId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-[2px]"
            onClick={() => setOpenLeadId(null)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="glass ml-auto h-full w-full max-w-2xl overflow-y-auto p-4 sm:p-6"
            >
              <LeadDetailPanel
                id={openLeadId}
                onClose={() => setOpenLeadId(null)}
                onFieldChange={reflectFieldChange}
                onDeleted={(id) => {
                  setLeads((prev) => prev?.filter((l) => l.id !== id) ?? prev);
                  setOpenLeadId(null);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
