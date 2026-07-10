"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";
import { type Lead, STATUSES, SEED, SummaryCard, daysSince, isOverdue } from "./shared";
import { KanbanBoard } from "./KanbanBoard";
import { TableView } from "./TableView";
import { DiscoverPanel } from "./DiscoverPanel";

type ViewMode = "kanban" | "table";

export function LeadsDashboard({ lang }: { lang: Locale }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterZrodlo, setFilterZrodlo] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("kanban");

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

  const switchView = (v: ViewMode) => {
    setView(v);
    window.localStorage.setItem("leggera_leads_view", v);
  };

  const updateLead = useCallback(async (id: string, field: string, value: string) => {
    setLeads((prev) => prev?.map((l) => (l.id === id ? { ...l, [field]: value } : l)) ?? prev);
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  }, []);

  const addLead = async () => {
    const firma = window.prompt("Nazwa firmy:");
    if (!firma) return;
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firma, zrodlo: "Ręcznie dodane", status: "Do kontaktu" }),
    });
    if (res.ok) load();
  };

  const deleteLead = async (id: string, firma: string) => {
    if (!window.confirm(`Usunąć "${firma}" z listy?`)) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setLeads((prev) => prev?.filter((l) => l.id !== id) ?? prev);
  };

  const seedInitial = async () => {
    if (!leads) return;
    const existing = new Set(leads.map((l) => l.firma));
    const toAdd = SEED.filter((s) => !existing.has(s.firma));
    if (toAdd.length === 0) {
      window.alert("Wszystkie firmy ze startowej listy już są w rejestrze.");
      return;
    }
    if (!window.confirm(`Dodać ${toAdd.length} firm ze startowej listy?`)) return;
    for (const s of toAdd) {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
    }
    load();
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  };

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

  if (!leads) {
    return <p className="text-sm text-muted">Ładowanie…</p>;
  }

  const overdue = leads.filter(isOverdue);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length]));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
            Rejestr <span className="text-liquid">leadów</span>
          </h1>
          <p className="text-sm text-muted">Zgłoszenia z formularza na stronie trafiają tu automatycznie.</p>
        </div>
        <button onClick={logout} className="rounded-full border hairline px-3 py-1.5 text-xs">
          Wyloguj
        </button>
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
                <b>{l.firma}</b>
                {l.status === "Nowe zgłoszenie ze strony"
                  ? " — nowe zgłoszenie ze strony, jeszcze nieobsłużone"
                  : ` — napisano ${daysSince(l.ostatni_kontakt)} dni temu, brak odpowiedzi`}
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
        <DiscoverPanel onDiscovered={load} />
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
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj po nazwie firmy…"
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
        <button onClick={seedInitial} className="rounded-full border hairline px-3 py-1.5 text-xs">
          Wczytaj listę startową
        </button>
      </div>

      {view === "kanban" ? (
        <KanbanBoard leads={filtered} lang={lang} onUpdate={updateLead} onDelete={deleteLead} />
      ) : (
        <TableView leads={filtered} lang={lang} onUpdate={updateLead} onDelete={deleteLead} />
      )}
    </div>
  );
}
