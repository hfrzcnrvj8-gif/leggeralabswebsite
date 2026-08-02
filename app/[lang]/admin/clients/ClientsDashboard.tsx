"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconPlus, IconFilter, IconX, IconFileExport, IconUsers } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Client,
  CLIENT_STATUSES,
  isClientOverdue,
  clientOverdueReason,
  CLIENT_SORTS,
  type ClientSort,
  sortClients,
  CONTACT_CHANNELS,
  CONTACT_CHANNEL_LABEL,
} from "./shared";
import { SOURCE_CATEGORIES, guessSourceCategory } from "@/lib/leads";
import { KanbanBoard } from "./KanbanBoard";
import { TableView } from "./TableView";
import { ClientDetailPanel } from "./ClientDetailPanel";
import { OrphanLinksPanel } from "./OrphanLinksPanel";
import { SavedViews, PillPicker } from "../components";
import { SekcjaProfilu, WierszPola } from "../ProfileSection";
import { Modal } from "../Modal";
import { ViewTabs, ViewSwitch } from "../ViewTabs";
import { ExpandingIconButton } from "../ExpandingIconButton";
import { Popover, MenuRow, MenuLabel, MenuDivider } from "../Menu";
import { useUI, useRegisterActions, isTypingTarget } from "../ui";
import { StanListy, StanBledu } from "../StanPusty";
import { useSkrotyListy } from "../klawiatura";
import { PoleSzukania } from "../PoleSzukania";
import { Propozycje } from "../Propozycje";
import { pobierzJSON, komunikatBledu } from "../dane";
import { todayLocalISO } from "@/lib/dates";
import { formatPlDate } from "@/lib/projects";

type ViewMode = "kanban" | "table";

/** Trafienie w treści historii klienta (`GET /api/clients/search`). */
type HistoryHit = {
  client_id: string;
  nazwa: string;
  rodzaj: string;
  created_at: string;
  fragment: string;
};

export function ClientsDashboard({ lang }: { lang: Locale }) {
  const { toast, confirm, zadanie } = useUI();
  const [clients, setClients] = useState<Client[] | null>(null);
  // Trzeci wariant pustego stanu (paczka E) — patrz komentarz w LeadsDashboard.
  const [blad, setBlad] = useState<string | null>(null);
  // Ilu klientów jest NAPRAWDĘ w rejestrze — trasa oddaje najwyżej 1000 naraz
  // (Moduł 54, krok 3a). Gdy `total` przewyższa długość listy, mówimy o tym
  // wprost: lista, która po cichu gubi rekordy, jest gorsza niż jej brak.
  const [total, setTotal] = useState(0);
  const [filterStatus, setFilterStatus] = useState("");
  // Moduł 34 — filtr po ostatnim kanale, ustawiany klikiem w odznakę na liście
  // (ten sam wzorzec co w Leadach; to o tę odznakę pytał właściciel).
  const [filterKanal, setFilterKanal] = useState("");
  const [filterBranza, setFilterBranza] = useState("");
  const [sort, setSort] = useState<ClientSort>("Alfabetycznie");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("kanban");
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [orphansOpen, setOrphansOpen] = useState(false);
  // Okno „Nowy klient" — pola trzymane tu, bo modal renderuje ten dashboard.
  // Domyślka „Polecenie": ręcznie dodawany klient (bez leada, bez oferty) to
  // niemal zawsze kontakt z polecenia — a pusta kategoria to dokładnie ta
  // dziura, przez którą Statystyki nie widziały ani jednego polecenia.
  const [addOpen, setAddOpen] = useState(false);
  const [addNazwa, setAddNazwa] = useState("");
  const [addOsoba, setAddOsoba] = useState("");
  const [addTelefon, setAddTelefon] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addKategoria, setAddKategoria] = useState<string>("Polecenie");
  const [addSzczegoly, setAddSzczegoly] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // Trafienia w TREŚCI historii (rozmowy, zdarzenia, maile) — osobno od
  // filtrowania listy, bo to inne pytanie: nie „który klient nazywa się tak",
  // tylko „z którym klientem rozmawialiśmy o tym". Patrz api/clients/search.
  const [historyHits, setHistoryHits] = useState<HistoryHit[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await pobierzJSON<{ clients: Client[]; total?: number }>("/api/clients");
      setClients(data.clients);
      setTotal(data.total ?? data.clients.length);
      setBlad(null);
    } catch (e) {
      setBlad(komunikatBledu(e));
    }
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

  /** Okno „Nowy klient" zamiast prompta o samą nazwę (2026-07-26, audyt
   * Klientów) — dokładnie ten sam zabieg, co w Leadach przy Module 51.
   * Prompt zakładał rekord bez telefonu, maila i osoby kontaktowej, a
   * kategoria źródła zostawała pusta, więc klient „z polecenia" niczym nie
   * różnił się od zimnego kontaktu. Pola są opcjonalne poza nazwą — to nadal
   * ma być kilka sekund, nie formularz. */
  const addClient = useCallback(() => setAddOpen(true), []);

  const submitNewClient = useCallback(async () => {
    const nazwa = addNazwa.trim();
    if (!nazwa) return;
    setAddBusy(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nazwa,
        osoba_kontaktowa: addOsoba.trim(),
        telefon: addTelefon.trim(),
        email: addEmail.trim(),
        zrodlo_kategoria: addKategoria,
        zrodlo: addSzczegoly.trim(),
      }),
    });
    setAddBusy(false);
    if (res.ok) {
      setAddOpen(false);
      setAddNazwa("");
      setAddOsoba("");
      setAddTelefon("");
      setAddEmail("");
      setAddSzczegoly("");
      setAddKategoria("Polecenie");
      toast("Dodano klienta.");
      load();
    } else {
      toast("Nie udało się dodać klienta.", "error");
    }
  }, [addNazwa, addOsoba, addTelefon, addEmail, addKategoria, addSzczegoly, toast, load]);

  const deleteClient = useCallback(
    async (id: string, nazwa: string) => {
      // Poziom „mocne" (Faza 4) — trasa poprosi o przepisanie nazwy klienta,
      // a `doPrzepisania` podaje wartość do pokazania w oknie. Porównuje
      // SERWER, z danych w bazie; to tutaj jest tylko tym, co widać.
      const w = await zadanie(`/api/clients/${id}`, { method: "DELETE", doPrzepisania: nazwa });
      if (w.anulowane) return;
      if (!w.ok) {
        toast(w.dane.error || "Nie udało się usunąć klienta.", "error");
        return;
      }
      setClients((prev) => prev?.filter((c) => c.id !== id) ?? prev);
      toast("Klient usunięty.");
    },
    [zadanie, toast]
  );

  /** Jedno pole na wielu klientach — jedno żądanie zamiast N (Moduł 54, krok
   * 3b). Do 2026-07-26 pasek zaznaczenia strzelał osobnym PATCH-em na każdego
   * zaznaczonego; przy 50 to 50 rund HTTP, a `neon()` dokładał własną rundę za
   * każde zapytanie SQL po drugiej stronie. Lista aktualizuje się od razu — tak
   * samo jak przy `updateClient`, bo to ta sama operacja, tylko hurtem. */
  const bulkPatch = useCallback(
    async (ids: string[], pola: Record<string, string>) => {
      if (ids.length === 0) return false;
      setClients((prev) => prev?.map((c) => (ids.includes(c.id) ? { ...c, ...pola } : c)) ?? prev);
      const res = await fetch("/api/clients/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, pola }),
      });
      if (!res.ok) {
        toast("Nie udało się zapisać zmian.", "error");
        // Stan lokalny wyprzedził serwer, a zapis nie przeszedł — wczytujemy
        // listę od nowa, żeby ekran nie pokazywał zmiany, której nie ma.
        load();
        return false;
      }
      return true;
    },
    [toast, load]
  );

  /** Auto-kategoryzacja źródeł dla klientów sprzed rozbicia źródła na
   * kategorię + szczegóły — bliźniak `tidySources` z Leadów. Bez tego dojście
   * do sensownej „konwersji per źródło" wymagałoby ręcznego otwarcia każdej
   * karty: kategoria jest dziś pusta u WSZYSTKICH klientów założonych przed
   * 2026-07-26. Sam tekst źródła zostaje nietknięty. */
  const tidySources = useCallback(async () => {
    if (!clients) return;
    const targets = clients.filter((c) => !c.zrodlo_kategoria);
    if (targets.length === 0) {
      toast("Wszyscy klienci mają już przypisaną kategorię źródła.");
      return;
    }
    const ok = await confirm(
      `Automatycznie przypisać kategorię źródła dla ${targets.length} klientów, którzy jej jeszcze nie mają (na podstawie tekstu w polu „Źródło")? Sam tekst zostaje bez zmian, tylko dojdzie kategoria.`
    );
    if (!ok) return;
    // Grupujemy po WYLICZONEJ kategorii i wysyłamy jedno żądanie na grupę.
    // Kategorii jest kilkanaście, klientów może być setki — to ta sama pętla
    // rund HTTP, co w pasku zaznaczenia (krok 3b), tylko mniej rzucająca się
    // w oczy, bo akcja siedzi w palecie poleceń.
    const grupy = new Map<string, string[]>();
    for (const c of targets) {
      const kategoria = guessSourceCategory(c.zrodlo);
      const lista = grupy.get(kategoria);
      if (lista) lista.push(c.id);
      else grupy.set(kategoria, [c.id]);
    }
    for (const [kategoria, ids] of grupy) {
      if (!(await bulkPatch(ids, { zrodlo_kategoria: kategoria }))) return;
    }
    toast(`Uporządkowano źródło dla ${targets.length} klientów.`);
  }, [clients, confirm, toast, bulkPatch]);

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
      const ok = await bulkPatch(ids, { status });
      setBulkBusy(false);
      if (ok) toast(`Zaktualizowano status dla ${ids.length} klientów.`);
      clearSelection();
    },
    [selectedIds, bulkPatch, toast, clearSelection]
  );

  const bulkDelete = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkBusy(true);
    // Poziom „mocne": przepisuje się LICZBĘ zaznaczonych. Przy masowym
    // usuwaniu ryzykiem nie jest pomylenie klienta, tylko niezauważenie, ilu
    // ich właściwie jest w zaznaczeniu.
    const w = await zadanie("/api/clients/bulk", {
      method: "DELETE",
      body: { ids },
      doPrzepisania: String(ids.length),
    });
    setBulkBusy(false);
    if (w.anulowane) return;
    if (!w.ok) {
      toast(w.dane.error || "Nie udało się usunąć klientów.", "error");
      return;
    }
    setClients((prev) => prev?.filter((c) => !selectedIds.has(c.id)) ?? prev);
    setTotal((t) => Math.max(t - ids.length, 0));
    toast(`Usunięto ${ids.length} klientów.`);
    clearSelection();
  }, [selectedIds, zadanie, toast, clearSelection]);

  const branze = useMemo(() => [...new Set((clients ?? []).map((c) => c.branza).filter(Boolean))], [clients]);
  const activeFilterCount = (filterStatus ? 1 : 0) + (filterBranza ? 1 : 0) + (filterKanal ? 1 : 0);

  const filtered = useMemo(() => {
    let list = clients ?? [];
    if (filterStatus) list = list.filter((c) => c.status === filterStatus);
    if (filterKanal) list = list.filter((c) => c.ostatni_kanal === filterKanal);
    if (filterBranza) list = list.filter((c) => c.branza === filterBranza);
    if (search) list = list.filter((c) => c.nazwa.toLowerCase().includes(search.toLowerCase()));
    // Reguła w `lib/clients.ts` — ta sama, co w apce (bliźniak). Do 2026-07-26
    // porządek był jeden i zaszyty tutaj: zaległe na górę, reszta alfabetycznie.
    return sortClients(list, sort);
  }, [clients, filterStatus, filterBranza, filterKanal, search, sort]);

  // „/", j/k i Enter — wspólny hook (Moduł 59, paczka C). Bliźniak Leadów:
  // kursor tylko w tabeli, „/" we wszystkich widokach.
  const { kursorWidoczny, setKursor: setSelectedIndex } = useSkrotyListy({
    elementy: view === "table" ? filtered : [],
    otworz: (c) => setOpenClientId(c.id),
    szukajRef: searchRef,
    wyczyscSzukanie: () => setSearch(""),
    aktywne: !openClientId,
  });

  useEffect(() => {
    setSelectedIndex(0);
    clearSelection();
  }, [filterStatus, filterBranza, filterKanal, search, view, clearSelection, setSelectedIndex]);

  const wyczyscFiltry = useCallback(() => {
    setFilterStatus("");
    setFilterBranza("");
    setFilterKanal("");
    setSearch("");
  }, []);

  /** Trzy warianty pustego ekranu (paczka E) — bliźniak z LeadsDashboard. */
  const stanPusty = (
    <StanListy
      blad={blad}
      onPonow={load}
      filtrAktywny={activeFilterCount > 0 || search.length > 0}
      onWyczyscFiltr={wyczyscFiltry}
      filtrTytul="Żaden klient nie pasuje"
      filtrOpis="Klienci w rejestrze są, ale ten zestaw filtrów odsiał wszystkich."
      ikona={IconUsers}
      tytul="Rejestr klientów jest pusty"
      opis="Bez klienta nie ma do czego podpiąć oferty, umowy ani faktury — a rytm kontaktu nie ma kogo pilnować. Klient powstaje z wygranego leada albo ręcznie."
      akcja={
        <button onClick={() => setAddOpen(true)} className="rounded-lg border hairline px-3 py-1.5 text-[12.5px] hover:bg-[var(--hairline)]">
          + Dodaj klienta
        </button>
      }
    />
  );

  // Szukanie po TREŚCI historii — z opóźnieniem, żeby nie strzelać zapytaniem
  // na każdą literę, i dopiero od dwóch znaków (jeden zwróciłby pół rejestru).
  useEffect(() => {
    const fraza = search.trim();
    if (fraza.length < 2) {
      setHistoryHits([]);
      return;
    }
    let porzucone = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients/search?q=${encodeURIComponent(fraza)}`);
        if (!res.ok || porzucone) return;
        const data = (await res.json()) as { hits: HistoryHit[] };
        if (!porzucone) setHistoryHits(data.hits ?? []);
      } catch {
        // Cisza jest tu w porządku: to dodatek do listy, która działa i bez niego.
      }
    }, 300);
    return () => {
      porzucone = true;
      clearTimeout(t);
    };
  }, [search]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (openClientId) setOpenClientId(null);
        return;
      }
      if (isTypingTarget(e.target)) return;

      if (/^[1-4]$/.test(e.key)) {
        // Patrz bliźniaczy komentarz w LeadsDashboard — bez widocznego
        // kursora cyfra trafiałaby w pierwszy wiersz z listy.
        const targetId = openClientId ?? (view === "table" && kursorWidoczny !== null ? filtered[kursorWidoczny]?.id : undefined);
        const status = CLIENT_STATUSES[Number(e.key) - 1];
        if (targetId && status) {
          e.preventDefault();
          updateClient(targetId, "status", status);
        }
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openClientId, view, filtered, kursorWidoczny, updateClient]);

  useRegisterActions(
    [
      { id: "add", label: "+ Dodaj klienta", hint: "N", run: addClient },
      { id: "kanban", label: "Widok: Tablica", run: () => switchView("kanban") },
      { id: "table", label: "Widok: Tabela", run: () => switchView("table") },
      // Moduł 30 — porządek po rekordach sprzed naprawy przecieków client_id.
      // Tylko w palecie, bez kafelka w interfejsie: to akcja jednorazowa, nie
      // krok codziennej pracy, a Klienci to jej naturalny dom.
      { id: "orphans", label: "Powiąż wstecz oferty i faktury bez klienta", run: () => setOrphansOpen(true) },
      { id: "tidy-sources", label: "Uporządkuj źródła (auto-kategoryzacja)", run: tidySources },
    ],
    [addClient, switchView, tidySources]
  );

  if (!clients) {
    // Szkielet TYLKO wtedy, gdy naprawdę czekamy. Do paczki E awaria wczytania
    // zostawiała ten szkielet pulsujący w nieskończoność — ekran wyglądał jak
    // wieczne ładowanie i nie mówił ani co się stało, ani jak spróbować znowu.
    if (blad) {
      return (
        <div>
          <div className="card-paper rounded-2xl">
            <StanBledu blad={blad} onPonow={load} />
          </div>
        </div>
      );
    }
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
  const selectedId = view === "table" && kursorWidoczny !== null ? filtered[kursorWidoczny]?.id ?? null : null;

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
        <PoleSzukania
          ref={searchRef}
          value={search}
          onChange={setSearch}
          podpowiedz="Szuka po nazwie klienta; od dwóch znaków także w treści historii kontaktu"
        />
        <Popover
          align="right"
          width={240}
          trigger={(open) => (
            <button onClick={open} className="flex h-6 items-center gap-1 rounded-md px-2 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]">
              <IconFilter size={14} /> Filtry
              {activeFilterCount > 0 && <span className="ml-0.5 rounded-full bg-zaznaczenie/20 px-1.5 text-[10px] font-medium text-[var(--zaznaczenie)]">{activeFilterCount}</span>}
            </button>
          )}
        >
          {() => (
            <div className="max-h-[60vh] overflow-y-auto">
              {/* Sortowanie nad filtrami: filtr odejmuje wiersze, sortowanie
                  decyduje, który zobaczysz pierwszy — a przy rejestrze klientów
                  to ono odpowiada na pytanie „kto najdłużej milczy". */}
              <MenuLabel>Sortowanie</MenuLabel>
              {CLIENT_SORTS.map((s) => (
                <MenuRow key={s} label={s} selected={sort === s} onClick={() => setSort(s)} />
              ))}
              <MenuDivider />
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
        {/* Sufit trasy (Moduł 54, krok 3a). Widoczny WYŁĄCZNIE wtedy, gdy
            rejestr faktycznie przerósł limit — do tego czasu nic tu nie stoi.
            Bez tego paska filtry i liczniki liczyłyby się z niepełnej listy,
            nie mówiąc o tym ani słowa. */}
        {total > clients.length && (
          <div className="mb-4 rounded-lg border border-orange-500/25 bg-orange-500/[0.04] p-3 text-[12.5px] text-orange-400">
            Rejestr ma <b>{total}</b> klientów, a widzisz pierwszych{" "}
            <b>{clients.length}</b> (najnowszych). Filtry, sortowanie i pasek
            „Wymaga działania dziś" liczą się tylko z tego, co wczytane — czas na
            stronicowanie po stronie serwera.
          </div>
        )}

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

        {/* Propozycje dotyczące klientów (Faza 3) — pod pasem zaległości, bo
            to nie zaległość, tylko pytanie. Ten sam komponent co na Pulpicie,
            zawężony do modułu; `empty:hidden` zdejmuje margines, gdy nie ma
            o co pytać. */}
        <div className="mb-4 empty:hidden">
          <Propozycje lang={lang} modul="clients" onZmiana={load} />
        </div>

        {/* Znalezione w historii — pokazujemy TYLKO wtedy, gdy fraza trafiła
            w treść, a nie w nazwę: inaczej ta sama firma stałaby raz tu i raz
            na liście niżej. */}
        {historyHits.length > 0 && (
          <div className="mb-4 rounded-lg border hairline p-3">
            <h2 className="mb-2 text-[12.5px] font-medium text-muted">
              Znalezione w historii ({historyHits.length})
            </h2>
            <ul className="space-y-1">
              {historyHits.slice(0, 8).map((h) => (
                <li key={`${h.client_id}:${h.created_at}:${h.rodzaj}`}>
                  <button
                    onClick={() => setOpenClientId(h.client_id)}
                    className="w-full rounded-md px-2 py-1.5 text-left hover:bg-[var(--hairline)]"
                  >
                    <span className="text-[13px] font-medium">{h.nazwa}</span>
                    <span className="ml-2 rounded-full bg-[var(--hairline)] px-1.5 py-0.5 text-[10px] text-muted">
                      {h.rodzaj}
                    </span>
                    <span className="ml-2 text-[11px] text-muted">{formatPlDate(h.created_at)}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted opacity-80">{h.fragment}</span>
                  </button>
                </li>
              ))}
            </ul>
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
          {/* Tablica z pustymi kolumnami nie odróżnia awarii od zerowej bazy —
              oba przypadki przejmuje `stanPusty` (paczka E). */}
          {view === "kanban" && filtered.length === 0 ? (
            <div className="card-paper rounded-2xl">{stanPusty}</div>
          ) : view === "kanban" ? (
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
              podKursorem={selectedId}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={(checked) => toggleSelectAll(checked, filtered.map((c) => c.id))}
              stanPusty={stanPusty}
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

      {/* Nowy klient — węższe okno (jak „Nowy lead" w Leadach), bo to kilka
          pól, nie profil. */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} card="card-paper my-auto w-full max-w-lg rounded-2xl border hairline p-6">
        <h2 className="text-lg font-semibold">Nowy klient</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitNewClient();
          }}
          className="mt-4 space-y-4"
        >
          {/* Moduł 59, paczka F+ — wiersze te same, co w profilu klienta
              i w oknie „Nowy lead" (decyzja właściciela 2026-07-29). */}
          <SekcjaProfilu tytul="Dane">
            <WierszPola etykieta="Firma">
              <input
                autoFocus
                value={addNazwa}
                onChange={(e) => setAddNazwa(e.target.value)}
                placeholder="np. Kancelaria Kowalski"
                className="w-full rounded-lg border hairline bg-transparent py-1.5 outline-none"
              />
            </WierszPola>
            <WierszPola etykieta="Osoba kontaktowa">
              <input
                value={addOsoba}
                onChange={(e) => setAddOsoba(e.target.value)}
                placeholder="np. Anna Kowalska"
                className="w-full rounded-lg border hairline bg-transparent py-1.5 outline-none"
              />
            </WierszPola>
            <WierszPola etykieta="Telefon">
              <input
                value={addTelefon}
                onChange={(e) => setAddTelefon(e.target.value)}
                className="w-full rounded-lg border hairline bg-transparent py-1.5 outline-none"
              />
            </WierszPola>
            <WierszPola etykieta="Email">
              <input
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className="w-full rounded-lg border hairline bg-transparent py-1.5 outline-none"
              />
            </WierszPola>
            <WierszPola etykieta="Skąd przyszedł" title="Skąd go masz">
              {/* Ta sama filtrowana lista, co przy „Nowym leadzie": kategorie
                  ustawiane przez samą ścieżkę wejścia (formularz, Łowca, mapa,
                  mail) nie mają sensu przy ręcznym dodaniu. */}
              <span className="shrink-0 whitespace-nowrap">
                <PillPicker
                value={addKategoria}
                options={SOURCE_CATEGORIES.filter(
                  (s) =>
                    s !== "Formularz na stronie" &&
                    s !== "Automatyczne wyszukiwanie" &&
                    s !== "Wyszukiwanie na mapie" &&
                    s !== "Zapytanie mailem"
                )}
                onChange={setAddKategoria}
                  title="Skąd masz tego klienta"
                />
              </span>
              <input
                value={addSzczegoly}
                onChange={(e) => setAddSzczegoly(e.target.value)}
                placeholder="szczegóły (opcjonalnie)"
                className="w-full rounded-lg border hairline bg-transparent py-1.5 outline-none"
              />
            </WierszPola>
          </SekcjaProfilu>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setAddOpen(false)} className="rounded-full border hairline px-4 py-1.5 text-xs text-muted">
              Anuluj
            </button>
            <button type="submit" disabled={addBusy || !addNazwa.trim()} className="btn-primary rounded-full px-4 py-1.5 text-xs disabled:opacity-50">
              {addBusy ? "Dodaję…" : "Dodaj klienta"}
            </button>
          </div>
        </form>
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
