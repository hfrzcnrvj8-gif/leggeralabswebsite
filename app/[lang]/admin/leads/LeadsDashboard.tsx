"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconPlus, IconSparkles, IconMailForward, IconDownload, IconFilter, IconX, IconTag, IconFileExport, IconCheck } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Lead,
  STATUSES,
  SEED,
  isOverdue,
  overdueReason,
  leadSourceLabel,
  guessSourceCategory,
  findSimilarLead,
  CONTACT_CHANNELS,
  CONTACT_CHANNEL_LABEL,
} from "./shared";
import { KanbanBoard } from "./KanbanBoard";
import { TableView } from "./TableView";
import { DiscoverPanel } from "./DiscoverPanel";
import { LeadDetailPanel } from "./LeadDetailPanel";
import { SavedViews } from "../components";
import { Modal } from "../Modal";
import { ViewTabs, ViewSwitch } from "../ViewTabs";
import { Popover, MenuRow, MenuLabel, MenuDivider, ContextMenu, ContextMenuItem, useContextMenu } from "../Menu";
import { Tooltip } from "../Tooltip";
import { ExpandingIconButton } from "../ExpandingIconButton";
import { useUI, useRegisterActions, isTypingTarget } from "../ui";
import { todayLocalISO } from "@/lib/dates";

type ViewMode = "kanban" | "table";

export function LeadsDashboard({ lang }: { lang: Locale }) {
  const { toast, confirm, prompt } = useUI();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  // Moduł 34 — filtr po ostatnim kanale kontaktu. Ustawiany klikiem w odznakę
  // kanału na liście: ikona przestała być ozdobą, a stała się wejściem w
  // "pokaż wszystkich, z którymi gadałem tak samo".
  const [filterKanal, setFilterKanal] = useState("");
  const [filterZrodlo, setFilterZrodlo] = useState("");
  const [filterMiasto, setFilterMiasto] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("kanban");
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sendingReport, setSendingReport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [tidyingSources, setTidyingSources] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  // Menu pod prawym przyciskiem przy ikonie eksportu (Moduł 34). Do tej pory
  // klik zawsze brał CAŁY rejestr — nawet przy włączonych filtrach albo
  // zaznaczonych wierszach — i nic tego nie mówiło.
  const exportCtl = useContextMenu<null>();

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
    if (saved === "table" || saved === "kanban") {
      setView(saved);
      return;
    }
    // Moduł 5 (mobilny) — bez zapisanego wyboru na wąskim ekranie startujemy od
    // Tabeli (na telefonie renderowanej jako lista kart). Kanban wymaga
    // poziomego przeciągania kolumn i na 375 px jest nieczytelny. To TYLKO
    // domyślka — świadomy wybór właściciela (localStorage) ma pierwszeństwo,
    // a przełącznik Tablica/Tabela zostaje dostępny również na telefonie.
    if (window.matchMedia("(max-width: 767px)").matches) setView("table");
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

    // Miękkie ostrzeżenie, nie blokada — auto-wyszukiwanie (OSM) sprawdza
    // duplikaty po nazwie od razu, ręczne dodawanie do tej pory nie
    // sprawdzało wcale.
    const similar = leads ? findSimilarLead(firma, leads) : null;
    if (similar) {
      const proceed = await confirm(
        `Podobny lead już jest w rejestrze: „${similar.firma}" (status: ${similar.status}). Dodać mimo to jako nowy?`
      );
      if (!proceed) return;
    }

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firma, zrodlo_kategoria: "Ręcznie dodane", status: "Do kontaktu" }),
    });
    if (res.ok) {
      toast("Dodano leada.");
      load();
    } else {
      toast("Nie udało się dodać leada.", "error");
    }
  }, [prompt, toast, load, leads, confirm]);

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

  /** Jednorazowe (ale bezpieczne do powtarzania — idempotentne, dotyka
   * tylko leadów bez kategorii) doklasyfikowanie starych leadów sprzed
   * rozbicia "Źródła" na kategorię+szczegóły (patrz guessSourceCategory,
   * lib/leads.ts) — deterministyczne dopasowanie po słowach kluczowych,
   * zero AI/LLM. Sam tekst `zrodlo` zostaje nietknięty. */
  const tidySources = useCallback(async () => {
    if (!leads) return;
    const targets = leads.filter((l) => !l.zrodlo_kategoria);
    if (targets.length === 0) {
      toast("Wszystkie leady mają już przypisaną kategorię źródła.");
      return;
    }
    const ok = await confirm(
      `Automatycznie przypisać kategorię źródła dla ${targets.length} leadów, które jej jeszcze nie mają (na podstawie dotychczasowego tekstu w polu „Źródło")? Sam tekst zostaje bez zmian, tylko dojdzie kategoria.`
    );
    if (!ok) return;
    setTidyingSources(true);
    for (const l of targets) {
      await updateLead(l.id, "zrodlo_kategoria", guessSourceCategory(l.zrodlo));
    }
    setTidyingSources(false);
    toast(`Uporządkowano źródło dla ${targets.length} leadów.`);
  }, [leads, confirm, toast, updateLead]);

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

  const zrodla = useMemo(() => [...new Set((leads ?? []).map(leadSourceLabel))], [leads]);
  const miasta = useMemo(
    () => [...new Set((leads ?? []).map((l) => l.miasto).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [leads]
  );
  const activeFilterCount = (filterStatus ? 1 : 0) + (filterZrodlo ? 1 : 0) + (filterMiasto ? 1 : 0) + (filterKanal ? 1 : 0);

  const filtered = useMemo(() => {
    let list = leads ?? [];
    if (filterStatus) list = list.filter((l) => l.status === filterStatus);
    if (filterZrodlo) list = list.filter((l) => leadSourceLabel(l) === filterZrodlo);
    if (filterMiasto) list = list.filter((l) => l.miasto === filterMiasto);
    if (filterKanal) list = list.filter((l) => l.ostatni_kanal === filterKanal);
    if (search) {
      const q = search.toLowerCase();
      // Szuka nie tylko po nazwie firmy, ale wszędzie tam, gdzie realnie
      // można pamiętać jakiś fragment (osoba kontaktowa, branża, miasto,
      // notatka) — samo dopasowanie do nazwy firmy było za wąskie.
      list = list.filter((l) =>
        [l.firma, l.osoba_kontaktowa, l.branza, l.miasto, l.notatki].some((f) => f.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      const ao = isOverdue(a) ? 0 : 1;
      const bo = isOverdue(b) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return a.firma.localeCompare(b.firma);
    });
  }, [leads, filterStatus, filterZrodlo, filterMiasto, filterKanal, search]);

  useEffect(() => {
    setSelectedIndex(0);
    clearSelection();
  }, [filterStatus, filterZrodlo, filterMiasto, filterKanal, search, view, clearSelection]);

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
      if (/^[1-9]$/.test(e.key)) {
        const targetId = openLeadId ?? (view === "table" ? filtered[selectedIndex]?.id : undefined);
        const status = STATUSES[Number(e.key) - 1];
        if (targetId && status) {
          e.preventDefault();
          updateLead(targetId, "status", status);
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
        setOpenLeadId(filtered[selectedIndex].id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openLeadId, view, filtered, selectedIndex, updateLead]);

  // Akcje zgłoszone do globalnej palety poleceń (Cmd+K) w AppShell.
  useRegisterActions(
    [
      { id: "add", label: "+ Dodaj leada", hint: "N", run: addLead },
      { id: "kanban", label: "Widok: Tablica", run: () => switchView("kanban") },
      { id: "table", label: "Widok: Tabela", run: () => switchView("table") },
      { id: "discover", label: "Znajdź nowe leady", run: () => setDiscoverOpen(true) },
      { id: "report", label: "Wyślij dzienny raport teraz", run: sendReportNow },
      { id: "tidy-sources", label: "Uporządkuj źródła (auto-kategoryzacja)", run: tidySources },
    ],
    [addLead, switchView, sendReportNow, tidySources]
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
  const selectedId = view === "table" ? filtered[selectedIndex]?.id ?? null : null;

  return (
    // `flex flex-1 flex-col md:min-h-0` (Moduł 35) — przekazanie wysokości okna
    // do Tablicy/Tabeli, żeby kończyły się na krawędzi ekranu, nie na treści.
    <div className="-mx-4 flex flex-1 flex-col sm:-mx-6 md:min-h-0">
      {/* Kompaktowy pasek — zakładki widoku + filtry + akcje jako małe ikony,
          bez dużego nagłówka strony i bez kolorowych kart statystyk. */}
      <div className="flex shrink-0 items-center gap-1 border-b hairline px-4 sm:px-6" style={{ height: "44px" }}>
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
            <button
              onClick={open}
              className="flex h-6 items-center gap-1 rounded-md px-2 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
            >
              <IconFilter size={14} /> Filtry
              {activeFilterCount > 0 && (
                <span className="ml-0.5 rounded-full bg-[#4ea7fc]/20 px-1.5 text-[10px] font-medium text-[#4ea7fc]">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        >
          {() => (
            <div className="max-h-[60vh] overflow-y-auto">
              <MenuLabel>Status</MenuLabel>
              <MenuRow label="Wszystkie" selected={!filterStatus} onClick={() => setFilterStatus("")} />
              {STATUSES.map((s) => (
                <MenuRow key={s} label={s} selected={filterStatus === s} onClick={() => setFilterStatus(filterStatus === s ? "" : s)} />
              ))}
              <MenuDivider />
              <MenuLabel>Źródło</MenuLabel>
              <MenuRow label="Wszystkie" selected={!filterZrodlo} onClick={() => setFilterZrodlo("")} />
              {zrodla.map((z) => (
                <MenuRow key={z} label={z} selected={filterZrodlo === z} onClick={() => setFilterZrodlo(filterZrodlo === z ? "" : z)} />
              ))}
              {miasta.length > 0 && (
                <>
                  <MenuDivider />
                  <MenuLabel>Miasto</MenuLabel>
                  <MenuRow label="Wszystkie" selected={!filterMiasto} onClick={() => setFilterMiasto("")} />
                  {miasta.map((m) => (
                    <MenuRow key={m} label={m} selected={filterMiasto === m} onClick={() => setFilterMiasto(filterMiasto === m ? "" : m)} />
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
                      setFilterZrodlo("");
                      setFilterMiasto("");
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
        {/* Pasek ikon (Moduł 34, runda 2) — po najechaniu ikona ROZSUWA SIĘ w
            podpisaną pigułkę, wzorem Centrum powiadomień macOS („✕" → „Wymaż
            wszystko"), na wyraźne wskazanie właściciela. Świadomie NIE dymek:
            dymek to osobne pudełko obok, tu rośnie sama kontrolka. Pigułka
            wychodzi w lewo NAD sąsiadów — patrz ExpandingIconButton.tsx. */}
        {/* Moduł 5 (mobilny) — drugorzędne akcje znikają poniżej `sm`. Na 375 px
            cały pasek (zakładki + szukaj + Filtry + 6 ikon) się nie mieścił i
            ostatnia ikona była ucięta. NIE tracimy ich na telefonie: „Znajdź
            nowe leady", „Wyślij raport" i „Uporządkuj źródła" są zarejestrowane
            w palecie poleceń (lupa w górnym pasku), a eksport/lista startowa to
            zadania biurkowe. Na iPadzie (≥ sm) wszystko wraca. */}
        <span className="hidden shrink-0 items-center gap-1 sm:flex">
          <ExpandingIconButton
            label="Znajdź nowe leady"
            icon={<IconSparkles size={15} />}
            onClick={() => setDiscoverOpen(true)}
          />
          <ExpandingIconButton
            label={sendingReport ? "Wysyłam…" : "Wyślij raport teraz"}
            ariaLabel="Wyślij raport teraz"
            icon={<IconMailForward size={15} />}
            onClick={sendReportNow}
            disabled={sendingReport}
          />
          <ExpandingIconButton
            label="Wczytaj listę startową"
            icon={<IconDownload size={15} />}
            onClick={seedInitial}
          />
          <ExpandingIconButton
            label="Uporządkuj źródła"
            icon={<IconTag size={15} />}
            onClick={tidySources}
            disabled={tidyingSources}
          />
          {/* Eksport ma dodatkowo menu pod prawym przyciskiem (zakres eksportu),
              więc zostaje przy zwykłym <a> — pigułka i tak podpisuje ikonę. */}
          <span className="inline-flex shrink-0" onContextMenu={(e) => exportCtl.openAt(e, null)}>
            <ExpandingIconButton
              label="Eksport CSV"
              icon={<IconFileExport size={15} />}
              href="/api/leads/export"
            />
          </span>
        </span>
        <ExpandingIconButton label="Dodaj leada" icon={<IconPlus size={16} />} onClick={addLead} />
      </div>

      {/* Menu eksportu. Lewy klik na ikonie zostaje "cały rejestr" (jak dotąd),
          prawy daje zakres — dymek przy ikonie o tym mówi, bo samo menu pod
          prawym przyciskiem na pasku narzędzi jest niewykrywalne. */}
      <ContextMenu ctl={exportCtl} width={230}>
        {(_item, close) => (
          <>
            <MenuLabel>Eksportuj do CSV</MenuLabel>
            <ContextMenuItem
              icon={<IconFileExport size={14} />}
              label={`Cały rejestr (${leads?.length ?? 0})`}
              onClick={() => {
                close();
                window.location.href = "/api/leads/export";
              }}
            />
            <ContextMenuItem
              icon={<IconFilter size={14} />}
              label={`Tylko widoczne (${filtered.length})`}
              onClick={() => {
                close();
                window.location.href = `/api/leads/export?ids=${filtered.map((l) => l.id).join(",")}`;
              }}
            />
            {selectedIds.size > 0 && (
              <ContextMenuItem
                icon={<IconCheck size={14} />}
                label={`Tylko zaznaczone (${selectedIds.size})`}
                onClick={() => {
                  close();
                  window.location.href = `/api/leads/export?ids=${[...selectedIds].join(",")}`;
                }}
              />
            )}
          </>
        )}
      </ContextMenu>

      <DiscoverPanel open={discoverOpen} onOpenChange={setDiscoverOpen} onDiscovered={load} />

      <div className="flex flex-1 flex-col px-4 py-4 sm:px-6 md:min-h-0">
      {overdue.length > 0 && (
        <div className="mb-4 rounded-lg border border-orange-500/25 bg-orange-500/[0.04] p-3">
          <h2 className="mb-1.5 text-[12.5px] font-medium text-orange-400">Wymaga działania dziś</h2>
          {overdue.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between border-b border-orange-500/10 py-1 text-[13px] last:border-0"
            >
              <span>
                <b>{l.firma}</b> — {overdueReason(l)}
              </span>
              <button
                onClick={async () => {
                  await updateLead(l.id, "status", "Przypomnienie wysłane");
                  await updateLead(l.id, "ostatni_kontakt", todayLocalISO());
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
          storageKey="leggera_leads_saved_views"
          currentFilters={{ status: filterStatus, zrodlo: filterZrodlo, miasto: filterMiasto, kanal: filterKanal }}
          onApply={(f) => {
            setFilterStatus(f.status ?? "");
            setFilterZrodlo(f.zrodlo ?? "");
            setFilterMiasto(f.miasto ?? "");
            setFilterKanal(f.kanal ?? "");
          }}
        />
      </div>

      {selectedIds.size > 0 && (
        <div className="card-paper sticky top-2 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-full px-4 py-2 text-xs">
          <span className="font-semibold">Zaznaczono: {selectedIds.size}</span>
          <Popover
            align="left"
            width={240}
            trigger={(open) => (
              <button
                onClick={open}
                disabled={bulkBusy}
                className="rounded-full border hairline px-3 py-1 text-xs text-[var(--fg)] disabled:opacity-50"
              >
                Zmień status na…
              </button>
            )}
          >
            {(close) => (
              <div className="max-h-[60vh] overflow-y-auto">
                {STATUSES.map((s) => (
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
          <button
            onClick={bulkDelete}
            disabled={bulkBusy}
            className="flex items-center gap-1 rounded-full border border-red-500/40 px-3 py-1 text-red-400 disabled:opacity-50"
          >
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
          leads={filtered}
          lang={lang}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onUpdate={updateLead}
          onDelete={deleteLead}
          onOpen={setOpenLeadId}
          activeChannel={filterKanal}
          onFilterChannel={(k) => setFilterKanal((prev) => (prev === k ? "" : k))}
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
          activeChannel={filterKanal}
          onFilterChannel={(k) => setFilterKanal((prev) => (prev === k ? "" : k))}
        />
      )}
      </ViewSwitch>
      </div>

      {/* Wyśrodkowany, szeroki modal szczegółów leada (wzorem edytora
          faktury/oferty) — zastąpił dawny wąski panel wysuwany z prawej,
          który był zbyt ciasny na gęstą treść profilu (dane + adres +
          źródło + log aktywności + mapa procesu). */}
      <Modal open={!!openLeadId} onClose={() => setOpenLeadId(null)}>
        {openLeadId && (
          <LeadDetailPanel
            id={openLeadId}
            lang={lang}
            onClose={() => setOpenLeadId(null)}
            onFieldChange={reflectFieldChange}
            onDeleted={(id) => {
              setLeads((prev) => prev?.filter((l) => l.id !== id) ?? prev);
              setOpenLeadId(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
