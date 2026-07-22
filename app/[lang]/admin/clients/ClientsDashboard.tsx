"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconPlus, IconFilter, IconX, IconFileExport } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Client,
  CLIENT_STATUSES,
  isClientOverdue,
  clientOverdueReason,
  CONTACT_CHANNELS,
  CONTACT_CHANNEL_LABEL,
} from "./shared";
import { KanbanBoard } from "./KanbanBoard";
import { TableView } from "./TableView";
import { ClientDetailPanel } from "./ClientDetailPanel";
import { OrphanLinksPanel } from "./OrphanLinksPanel";
import { SavedViews } from "../components";
import { Modal } from "../Modal";
import { ViewTabs, ViewSwitch } from "../ViewTabs";
import { ExpandingIconButton } from "../ExpandingIconButton";
import { Popover, MenuRow, MenuLabel, MenuDivider } from "../Menu";
import { useUI, useRegisterActions, isTypingTarget } from "../ui";
import { todayLocalISO } from "@/lib/dates";

type ViewMode = "kanban" | "table";

export function ClientsDashboard({ lang }: { lang: Locale }) {
  const { toast, confirm, prompt } = useUI();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  // Moduł 34 — filtr po ostatnim kanale, ustawiany klikiem w odznakę na liście
  // (ten sam wzorzec co w Leadach; to o tę odznakę pytał właściciel).
  const [filterKanal, setFilterKanal] = useState("");
  const [filterBranza, setFilterBranza] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("kanban");
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [orphansOpen, setOrphansOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/clients");
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    const data = (await res.json()) as { clients: Client[] };
    setClients(data.clients);
  }, []);

  useEffect(() => {
    load();
    const saved = window.localStorage.getItem("leggera_clients_view");
    if (saved === "table" || saved === "kanban") {
      setView(saved);
      return;
    }
    // Moduł 5 (mobilny) — jak w Leadach: bez zapisanego wyboru na wąskim
    // ekranie startujemy od Tabeli (renderowanej na telefonie jako lista kart).
    // Kanban wymaga przeciągania kolumn w poziomie. Wybór właściciela wygrywa.
    if (window.matchMedia("(max-width: 767px)").matches) setView("table");
  }, [load]);

  const switchView = useCallback((v: ViewMode) => {
    setView(v);
    window.localStorage.setItem("leggera_clients_view", v);
  }, []);

  const updateClient = useCallback(
    async (id: string, field: string, value: string) => {
      setClients((prev) => prev?.map((c) => (c.id === id ? { ...c, [field]: value } : c)) ?? prev);
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) toast("Nie udało się zapisać zmiany.", "error");
    },
    [toast]
  );

  const reflectFieldChange = useCallback((id: string, field: string, value: string) => {
    setClients((prev) => prev?.map((c) => (c.id === id ? { ...c, [field]: value } : c)) ?? prev);
  }, []);

  const addClient = useCallback(async () => {
    const nazwa = await prompt("Nazwa nowego klienta:", { placeholder: "np. Kancelaria Kowalski" });
    if (!nazwa) return;
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nazwa }),
    });
    if (res.ok) {
      toast("Dodano klienta.");
      load();
    } else {
      toast("Nie udało się dodać klienta.", "error");
    }
  }, [prompt, toast, load]);

  const deleteClient = useCallback(
    async (id: string, nazwa: string) => {
      const ok = await confirm(`Usunąć "${nazwa}" z rejestru klientów?`, { danger: true });
      if (!ok) return;
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Nie udało się usunąć klienta.", "error");
        return;
      }
      setClients((prev) => prev?.filter((c) => c.id !== id) ?? prev);
      toast("Klient usunięty.");
    },
    [confirm, toast]
  );

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

  const bulkUpdateStatus = useCallback(
    async (status: string) => {
      const ids = [...selectedIds];
      if (ids.length === 0) return;
      setBulkBusy(true);
      for (const id of ids) {
        await updateClient(id, "status", status);
      }
      setBulkBusy(false);
      toast(`Zaktualizowano status dla ${ids.length} klientów.`);
      clearSelection();
    },
    [selectedIds, updateClient, toast, clearSelection]
  );

  const bulkDelete = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const ok = await confirm(`Usunąć ${ids.length} zaznaczonych klientów?`, { danger: true });
    if (!ok) return;
    setBulkBusy(true);
    for (const id of ids) {
      await fetch(`/api/clients/${id}`, { method: "DELETE" });
    }
    setBulkBusy(false);
    setClients((prev) => prev?.filter((c) => !selectedIds.has(c.id)) ?? prev);
    toast(`Usunięto ${ids.length} klientów.`);
    clearSelection();
  }, [selectedIds, confirm, toast, clearSelection]);

  const branze = useMemo(() => [...new Set((clients ?? []).map((c) => c.branza).filter(Boolean))], [clients]);
  const activeFilterCount = (filterStatus ? 1 : 0) + (filterBranza ? 1 : 0) + (filterKanal ? 1 : 0);

  const filtered = useMemo(() => {
    let list = clients ?? [];
    if (filterStatus) list = list.filter((c) => c.status === filterStatus);
    if (filterKanal) list = list.filter((c) => c.ostatni_kanal === filterKanal);
    if (filterBranza) list = list.filter((c) => c.branza === filterBranza);
    if (search) list = list.filter((c) => c.nazwa.toLowerCase().includes(search.toLowerCase()));
    return [...list].sort((a, b) => {
      const ao = isClientOverdue(a) ? 0 : 1;
      const bo = isClientOverdue(b) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return a.nazwa.localeCompare(b.nazwa);
    });
  }, [clients, filterStatus, filterBranza, filterKanal, search]);

  useEffect(() => {
    setSelectedIndex(0);
    clearSelection();
  }, [filterStatus, filterBranza, filterKanal, search, view, clearSelection]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (openClientId) setOpenClientId(null);
        return;
      }
      if (isTypingTarget(e.target)) return;

      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (/^[1-4]$/.test(e.key)) {
        const targetId = openClientId ?? (view === "table" ? filtered[selectedIndex]?.id : undefined);
        const status = CLIENT_STATUSES[Number(e.key) - 1];
        if (targetId && status) {
          e.preventDefault();
          updateClient(targetId, "status", status);
        }
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
        setOpenClientId(filtered[selectedIndex].id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openClientId, view, filtered, selectedIndex, updateClient]);

  useRegisterActions(
    [
      { id: "add", label: "+ Dodaj klienta", hint: "N", run: addClient },
      { id: "kanban", label: "Widok: Tablica", run: () => switchView("kanban") },
      { id: "table", label: "Widok: Tabela", run: () => switchView("table") },
      // Moduł 30 — porządek po rekordach sprzed naprawy przecieków client_id.
      // Tylko w palecie, bez kafelka w interfejsie: to akcja jednorazowa, nie
      // krok codziennej pracy, a Klienci to jej naturalny dom.
      { id: "orphans", label: "Powiąż wstecz oferty i faktury bez klienta", run: () => setOrphansOpen(true) },
    ],
    [addClient, switchView]
  );

  if (!clients) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--hairline)]" />
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 w-28 animate-pulse rounded-2xl bg-[var(--hairline)]" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--hairline)]" />
      </div>
    );
  }

  const overdue = clients.filter(isClientOverdue);
  const selectedId = view === "table" ? filtered[selectedIndex]?.id ?? null : null;

  return (
    // `flex flex-1 flex-col md:min-h-0` (Moduł 35) — przekazanie wysokości okna
    // do Tablicy/Tabeli, żeby kończyły się na krawędzi ekranu, nie na treści.
    <div className="-mx-4 flex flex-1 flex-col sm:-mx-6 md:min-h-0">
      {/* `overflow-x-auto` — patrz LeadsDashboard.tsx (Moduł 5, Paczka 5). */}
      <div
        className="flex shrink-0 items-center gap-1 overflow-x-auto border-b hairline px-4 sm:px-6"
        style={{ height: "44px" }}
      >
        <ViewTabs
          value={view}
          onChange={switchView}
          tabs={[
            { id: "kanban", label: "Tablica" },
            { id: "table", label: "Tabela" },
          ]}
        />
        <span className="flex-1" />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj… (/)"
          className="w-24 min-w-0 rounded-md bg-transparent px-2 py-1 text-[12.5px] text-[var(--fg)] placeholder:text-muted sm:w-32"
        />
        <Popover
          align="right"
          width={240}
          trigger={(open) => (
            <button onClick={open} className="flex h-6 items-center gap-1 rounded-md px-2 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]">
              <IconFilter size={14} /> Filtry
              {activeFilterCount > 0 && <span className="ml-0.5 rounded-full bg-[#4ea7fc]/20 px-1.5 text-[10px] font-medium text-[#4ea7fc]">{activeFilterCount}</span>}
            </button>
          )}
        >
          {() => (
            <div className="max-h-[60vh] overflow-y-auto">
              <MenuLabel>Status</MenuLabel>
              <MenuRow label="Wszystkie" selected={!filterStatus} onClick={() => setFilterStatus("")} />
              {CLIENT_STATUSES.map((s) => (
                <MenuRow key={s} label={s} selected={filterStatus === s} onClick={() => setFilterStatus(filterStatus === s ? "" : s)} />
              ))}
              {branze.length > 0 && (
                <>
                  <MenuDivider />
                  <MenuLabel>Branża</MenuLabel>
                  <MenuRow label="Wszystkie" selected={!filterBranza} onClick={() => setFilterBranza("")} />
                  {branze.map((b) => (
                    <MenuRow key={b} label={b} selected={filterBranza === b} onClick={() => setFilterBranza(filterBranza === b ? "" : b)} />
                  ))}
                </>
              )}
              <MenuDivider />
              <MenuLabel>Ostatni kanał</MenuLabel>
              <MenuRow label="Wszystkie" selected={!filterKanal} onClick={() => setFilterKanal("")} />
              {CONTACT_CHANNELS.map((k) => (
                <MenuRow
                  key={k}
                  label={CONTACT_CHANNEL_LABEL[k]}
                  selected={filterKanal === k}
                  onClick={() => setFilterKanal(filterKanal === k ? "" : k)}
                />
              ))}
              {activeFilterCount > 0 && (
                <>
                  <MenuDivider />
                  <button
                    onClick={() => {
                      setFilterStatus("");
                      setFilterBranza("");
                      setFilterKanal("");
                    }}
                    className="w-full px-2.5 py-1.5 text-left text-[12px] text-muted hover:bg-[#232327]"
                  >
                    Wyczyść filtry
                  </button>
                </>
              )}
            </div>
          )}
        </Popover>
        {/* Cały rejestr, bez zakresu dat — patrz komentarz w trasie.
            Zwykły `href`, jak w Leadach: nie ma czego wybierać w dymku. */}
        <ExpandingIconButton label="Eksport CSV" icon={<IconFileExport size={15} />} href="/api/clients/export" />
        <ExpandingIconButton label="Dodaj klienta" icon={<IconPlus size={16} />} onClick={addClient} />
      </div>

      <div className="flex flex-1 flex-col px-4 py-4 sm:px-6 md:min-h-0">
        {overdue.length > 0 && (
          <div className="mb-4 rounded-lg border border-orange-500/25 bg-orange-500/[0.04] p-3">
            <h2 className="mb-1.5 text-[12.5px] font-medium text-orange-400">Wymaga działania dziś</h2>
            {overdue.map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b border-orange-500/10 py-1 text-[13px] last:border-0">
                <span>
                  <b>{c.nazwa}</b> — {clientOverdueReason(c)}
                </span>
                <button
                  onClick={async () => {
                    await updateClient(c.id, "next_followup", "");
                    await updateClient(c.id, "ostatni_kontakt", todayLocalISO());
                  }}
                  className="rounded-md px-2 py-0.5 text-[12px] text-orange-400 hover:bg-orange-500/10"
                >
                  Oznacz jako obsłużone
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mb-3">
          <SavedViews
            storageKey="leggera_clients_saved_views"
            currentFilters={{ status: filterStatus, branza: filterBranza, kanal: filterKanal }}
            onApply={(f) => {
              setFilterStatus(f.status ?? "");
              setFilterBranza(f.branza ?? "");
              setFilterKanal(f.kanal ?? "");
            }}
          />
        </div>

        {selectedIds.size > 0 && (
          <div className="card-paper sticky top-2 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-full px-4 py-2 text-xs">
            <span className="font-semibold">Zaznaczono: {selectedIds.size}</span>
            <Popover
              align="left"
              width={200}
              trigger={(open) => (
                <button onClick={open} disabled={bulkBusy} className="rounded-full border hairline px-3 py-1 text-xs text-[var(--fg)] disabled:opacity-50">
                  Zmień status na…
                </button>
              )}
            >
              {(close) => (
                <div>
                  {CLIENT_STATUSES.map((s) => (
                    <MenuRow
                      key={s}
                      label={s}
                      onClick={() => {
                        bulkUpdateStatus(s);
                        close();
                      }}
                    />
                  ))}
                </div>
              )}
            </Popover>
            <button onClick={bulkDelete} disabled={bulkBusy} className="flex items-center gap-1 rounded-full border border-red-500/40 px-3 py-1 text-red-400 disabled:opacity-50">
              <IconX size={13} /> Usuń zaznaczone
            </button>
            <span className="flex-1" />
            <button onClick={clearSelection} className="rounded-full border hairline px-3 py-1 text-muted">
              Odznacz wszystko
            </button>
          </div>
        )}

        <ViewSwitch viewKey={view} fill>
          {view === "kanban" ? (
            <KanbanBoard
              clients={filtered}
              lang={lang}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onUpdate={updateClient}
              onDelete={deleteClient}
              onOpen={setOpenClientId}
              activeChannel={filterKanal}
              onFilterChannel={(k) => setFilterKanal((prev) => (prev === k ? "" : k))}
            />
          ) : (
            <TableView
              clients={filtered}
              lang={lang}
              selectedId={selectedId}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={(checked) => toggleSelectAll(checked, filtered.map((c) => c.id))}
              onUpdate={updateClient}
              onDelete={deleteClient}
              onOpen={setOpenClientId}
              activeChannel={filterKanal}
              onFilterChannel={(k) => setFilterKanal((prev) => (prev === k ? "" : k))}
            />
          )}
        </ViewSwitch>
      </div>

      {/* Wyśrodkowany, szeroki modal (wzorem edytora faktury/oferty) —
          zastąpił dawny wąski panel wysuwany z prawej, ten sam zabieg co w
          Leadach (LeadsDashboard.tsx), bo to identyczny wzorzec komponentu. */}
      <Modal open={!!openClientId} onClose={() => setOpenClientId(null)}>
        {openClientId && (
          <ClientDetailPanel
            id={openClientId}
            lang={lang}
            onClose={() => setOpenClientId(null)}
            onFieldChange={reflectFieldChange}
            onDeleted={(id) => {
              setClients((prev) => prev?.filter((c) => c.id !== id) ?? prev);
              setOpenClientId(null);
            }}
          />
        )}
      </Modal>

      <Modal
        open={orphansOpen}
        onClose={() => setOrphansOpen(false)}
        card="card-paper my-auto w-full max-w-3xl rounded-2xl border hairline p-5"
      >
        <OrphanLinksPanel onClose={() => setOrphansOpen(false)} />
      </Modal>
    </div>
  );
}
