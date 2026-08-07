"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconInbox, IconPlus, IconSparkles, IconMailForward, IconDownload, IconFilter, IconX, IconTag, IconFileExport, IconCheck } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import {
  type Lead,
  STATUSES,
  SEED,
  isOverdue,
  overdueReason,
  leadSourceLabel,
  SOURCE_CATEGORIES,
  guessSourceCategory,
  findSimilarLead,
  CONTACT_CHANNELS,
  CONTACT_CHANNEL_LABEL,
} from "./shared";
import { KanbanBoard } from "./KanbanBoard";
import { TableView } from "./TableView";
import { DiscoverPanel } from "./DiscoverPanel";
import { LeadDetailPanel } from "./LeadDetailPanel";
import { CandidatesView, type DaneLowcy, type Polowanie, type WpisCzarnejListy } from "./CandidatesView";
import { SavedViews, PillPicker } from "../components";
import { SekcjaProfilu, WierszPola, WierszUwaga } from "../ProfileSection";
import { Modal } from "../Modal";
import { ViewTabs, ViewSwitch } from "../ViewTabs";
import { Popover, MenuRow, MenuLabel, MenuDivider, ContextMenu, ContextMenuItem, useContextMenu } from "../Menu";
import { Tooltip } from "../Tooltip";
import { ExpandingIconButton } from "../ExpandingIconButton";
import { useUI, useRegisterActions, isTypingTarget } from "../ui";
import { StanListy, StanBledu } from "../StanPusty";
import { useSkrotyListy } from "../klawiatura";
import { PoleSzukania } from "../PoleSzukania";
import { Propozycje } from "../Propozycje";
import { useNowyRekord } from "../nowyRekord";
import { nowaSeria } from "../Potwierdzenie";
import { pobierzJSON, komunikatBledu } from "../dane";
import { todayLocalISO } from "@/lib/dates";
import { addDaysISO } from "@/lib/invoices";

// Trzecia zakładka to NIE trzeci widok tych samych danych — to inny zbiór.
// „Kandydaci" pokazują skrzynkę Łowcy leadów (Moduł 52), czyli firmy, które
// jeszcze NIE są leadami i mogą nimi nigdy nie zostać. Rozdział jest celowy:
// automat nigdy nie dopisuje wiersza do `leads`, bo przy Module 51 jedna
// wartość wpisana „na sztywno" przy tworzeniu leada cicho wykrzywiła dwa
// wskaźniki lejka — automat sypiący 200 zimnych rekordów zepsułby wszystkie.
type ViewMode = "kanban" | "table" | "kandydaci";

/** Ile zaległych leadów pokazuje baner, zanim schowa resztę pod „Pokaż
 * wszystkie". Pięć mieści się nad treścią, nie spychając jej z ekranu. */
const OVERDUE_SKROT = 5;

export function LeadsDashboard({ lang }: { lang: Locale }) {
  const { toast, confirm, zadanie } = useUI();
  // Świeżo dodany rekord — przewinięcie i podświetlenie (znalezisko D2).
  const nowy = useNowyRekord();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  // Trzeci wariant pustego stanu (paczka E): dopóki tego pola nie było, zerwane
  // połączenie kończyło się listą „Brak leadów pasujących do filtrów" — czyli
  // panel twierdził, że baza jest pusta, nie wiedząc o niej nic.
  const [blad, setBlad] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  // Moduł 34 — filtr po ostatnim kanale kontaktu. Ustawiany klikiem w odznakę
  // kanału na liście: ikona przestała być ozdobą, a stała się wejściem w
  // "pokaż wszystkich, z którymi gadałem tak samo".
  const [filterKanal, setFilterKanal] = useState("");
  const [filterZrodlo, setFilterZrodlo] = useState("");
  const [filterMiasto, setFilterMiasto] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("kanban");
  // Skrzynka Łowcy leadów (Moduł 52). Wczytywana od razu, nie leniwie przy
  // wejściu w zakładkę — licznik „Kandydaci (N)" jest jej głównym sensem:
  // ma powiedzieć, że coś czeka, ZANIM właściciel tam zajrzy.
  const [lowca, setLowca] = useState<DaneLowcy | null>(null);
  const [polowania, setPolowania] = useState<Polowanie[]>([]);
  const [czarnaLista, setCzarnaLista] = useState<WpisCzarnejListy[]>([]);
  const [overdueRozwiniete, setOverdueRozwiniete] = useState(false);
  // Licznikowe „sygnały" zamiast flag boolean: paleta poleceń może odpalić tę
  // samą akcję dwa razy pod rząd, a `true → true` nie jest zmianą i efekt
  // w dziecku by się nie uruchomił.
  const [polujSygnal, setPolujSygnal] = useState(0);
  const [nowePolowanieSygnal, setNowePolowanieSygnal] = useState(0);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [sendingReport, setSendingReport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [tidyingSources, setTidyingSources] = useState(false);
  // Okno „nowy lead" (Moduł 51) — nazwa + kategoria źródła + szczegóły.
  const [addOpen, setAddOpen] = useState(false);
  const [addFirma, setAddFirma] = useState("");
  const [addKategoria, setAddKategoria] = useState<string>("Ręcznie dodane");
  const [addSzczegoly, setAddSzczegoly] = useState("");
  /* Faza 1 planu zaplecza (luka B4): formularz miał DWA pola — firmę i źródło.
     Po telefonie od klienta nie było gdzie wpisać osoby, telefonu, maila ani
     miasta, więc rekord powstawał pusty, a resztę dopisywało się w profilu,
     którego najpierw trzeba było poszukać. Trasa POST /api/leads przyjmowała
     te pola od zawsze — brakowało wyłącznie miejsca, żeby je podać. */
  const [addOsoba, setAddOsoba] = useState("");
  const [addTelefon, setAddTelefon] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addMiasto, setAddMiasto] = useState("");
  const [addBranza, setAddBranza] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  // Menu pod prawym przyciskiem przy ikonie eksportu (Moduł 34). Do tej pory
  // klik zawsze brał CAŁY rejestr — nawet przy włączonych filtrach albo
  // zaznaczonych wierszach — i nic tego nie mówiło.
  const exportCtl = useContextMenu<null>();

  const load = useCallback(async () => {
    try {
      const data = await pobierzJSON<{ leads: Lead[] }>("/api/leads");
      setLeads(data.leads);
      setBlad(null);
    } catch (e) {
      setBlad(komunikatBledu(e));
    }
  }, []);

  /** Skrzynka łowcy + definicje polowań. Dwa żądania, bo to dwa różne zbiory
   * i dwie różne trasy — a `neon()` i tak płaci osobno za każde zapytanie. */
  const loadLowca = useCallback(async () => {
    const [kand, hunts, czarna] = await Promise.all([
      fetch("/api/leads/candidates").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/leads/hunts").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/leads/blacklist").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    if (kand) setLowca(kand as DaneLowcy);
    if (hunts) setPolowania((hunts as { hunts: Polowanie[] }).hunts ?? []);
    if (czarna) setCzarnaLista((czarna as { blacklist: WpisCzarnejListy[] }).blacklist ?? []);
  }, []);

  useEffect(() => {
    load();
    loadLowca();
    // Wejście z powiadomienia „Łowca dołożył N kandydatów" — dzwonek prowadzi
    // do `?widok=kandydaci`, więc adres ma pierwszeństwo przed zapamiętanym
    // wyborem. Bez tego kliknięcie w powiadomienie lądowało na Tablicy.
    if (new URLSearchParams(window.location.search).get("widok") === "kandydaci") {
      setView("kandydaci");
      return;
    }
    const saved = window.localStorage.getItem("leggera_leads_view");
    if (saved === "table" || saved === "kanban" || saved === "kandydaci") {
      setView(saved);
      return;
    }
    // Moduł 5 (mobilny) — bez zapisanego wyboru na wąskim ekranie startujemy od
    // Tabeli (na telefonie renderowanej jako lista kart). Kanban wymaga
    // poziomego przeciągania kolumn i na 375 px jest nieczytelny. To TYLKO
    // domyślka — świadomy wybór właściciela (localStorage) ma pierwszeństwo,
    // a przełącznik Tablica/Tabela zostaje dostępny również na telefonie.
    if (window.matchMedia("(max-width: 767px)").matches) setView("table");
  }, [load, loadLowca]);

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

  // „+ Dodaj leada" pyta o nazwę ORAZ o kategorię źródła (Moduł 51). Do tej
  // pory był to `prompt()` o samą nazwę, a kategoria leciała na sztywno jako
  // „Ręcznie dodane" — czyli lead z polecenia zdobyty w terenie nigdy nie
  // trafiał do kategorii „Polecenie". A to po niej liczą się DWA wskaźniki:
  // „% leadów z polecenia" na Pulpicie (api/hub/today) i „konwersja per
  // źródło" w Statystykach (api/stats). Oba pokazywały zero poleceń nie
  // dlatego, że ich nie było, ale dlatego, że nie było jak ich oznaczyć.
  const addLead = useCallback(() => {
    setAddOpen(true);
  }, []);

  const submitNewLead = useCallback(async () => {
    const firma = addFirma.trim();
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

    setAddBusy(true);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firma,
        osoba_kontaktowa: addOsoba.trim(),
        telefon: addTelefon.trim(),
        email: addEmail.trim(),
        miasto: addMiasto.trim(),
        branza: addBranza.trim(),
        zrodlo_kategoria: addKategoria,
        zrodlo: addSzczegoly.trim(),
        status: "Do kontaktu",
      }),
    });
    setAddBusy(false);
    if (res.ok) {
      // ZNALEZISKO D2 — sam toast nie wystarczy. Nowy lead nie ma „ostatniego
      // kontaktu", więc sortowanie wypycha go na koniec listy, poza ekran.
      // Trasa oddaje `{ ok: true, id }` — po tym id lista się do niego
      // przewija i podświetla go na chwilę. Sortowanie zostaje bez zmian
      // (decyzja właściciela). Patrz `../nowyRekord.tsx`.
      const dane = (await res.json().catch(() => null)) as { id?: string } | null;
      nowy.pokaz(dane?.id);
      toast("Dodano leada.");
      setAddOpen(false);
      setAddFirma("");
      setAddSzczegoly("");
      setAddKategoria("Ręcznie dodane");
      setAddOsoba("");
      setAddTelefon("");
      setAddEmail("");
      setAddMiasto("");
      setAddBranza("");
      load();
    } else {
      toast("Nie udało się dodać leada.", "error");
    }
  }, [addFirma, addKategoria, addSzczegoly, addOsoba, addTelefon, addEmail, addMiasto, addBranza, toast, load, leads, confirm]);

  // Pytanie zadaje TRASA (Faza 4) — stąd brak `confirm()` przed żądaniem.
  // Dwa okna pod rząd o to samo uczyłyby klikać „tak" bez czytania.
  const deleteLead = useCallback(async (id: string) => {
    const w = await zadanie(`/api/leads/${id}`, { method: "DELETE" });
    if (w.anulowane) return;
    if (!w.ok) {
      toast(w.dane.error || "Nie udało się usunąć leada.", "error");
      return;
    }
    setLeads((prev) => prev?.filter((l) => l.id !== id) ?? prev);
    toast("Lead usunięty.");
  }, [zadanie, toast]);

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
    let odmowy = 0;
    for (const s of toAdd) {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      if (!res.ok) odmowy += 1;
    }
    // Etap 3: komunikat mówił „Dodano N firm" niezależnie od tego, ile
    // naprawdę weszło.
    if (odmowy > 0) toast(`Dodano ${toAdd.length - odmowy} z ${toAdd.length} firm — reszty nie udało się zapisać.`, "error");
    else toast(`Dodano ${toAdd.length} firm.`);
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
    // Jedna zgoda na całą serię: z punktu widzenia właściciela to JEDNO
    // działanie, więc trasa pyta przy pierwszym rekordzie, a `seria` niesie
    // tę zgodę do pozostałych. Pytanie przy każdym z kilkunastu leadów
    // zamieniłoby barierę w klikanie na ślepo.
    const seria = nowaSeria();
    setBulkBusy(true);
    const udane = new Set<string>();
    for (const id of ids) {
      const w = await zadanie(`/api/leads/${id}`, { method: "DELETE", seria });
      if (w.anulowane) break;
      if (w.ok) udane.add(id);
    }
    setBulkBusy(false);
    if (udane.size === 0) return;
    // Z listy znikają tylko te, które NAPRAWDĘ zniknęły z bazy — inaczej
    // nieudane usunięcie wyglądałoby na udane aż do przeładowania.
    setLeads((prev) => prev?.filter((l) => !udane.has(l.id)) ?? prev);
    toast(`Usunięto ${udane.size} ${udane.size === 1 ? "leada" : "leadów"}.`);
    clearSelection();
  }, [selectedIds, zadanie, toast, clearSelection]);

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

  // „/", j/k i Enter — wspólny hook (Moduł 59, paczka C). Kursor dostaje pustą
  // listę poza widokiem tabeli: w Kanbanie i u Kandydatów nie ma wierszy, po
  // których miałby chodzić. „/" działa mimo to we wszystkich widokach —
  // szukanie zawęża także tablicę.
  const { kursorWidoczny, setKursor: setSelectedIndex } = useSkrotyListy({
    elementy: view === "table" ? filtered : [],
    otworz: (l) => setOpenLeadId(l.id),
    szukajRef: searchRef,
    wyczyscSzukanie: () => setSearch(""),
    aktywne: !openLeadId,
  });

  useEffect(() => {
    setSelectedIndex(0);
    clearSelection();
  }, [filterStatus, filterZrodlo, filterMiasto, filterKanal, search, view, clearSelection, setSelectedIndex]);

  const wyczyscFiltry = useCallback(() => {
    setFilterStatus("");
    setFilterZrodlo("");
    setFilterMiasto("");
    setFilterKanal("");
    setSearch("");
  }, []);

  /** Trzy warianty pustego ekranu (paczka E). Składane TU, bo tylko dashboard
   * wie, czy `filtered` jest puste przez filtr, przez zerową bazę, czy przez
   * to, że wczytanie w ogóle się nie udało. */
  const stanPusty = (
    <StanListy
      blad={blad}
      onPonow={load}
      filtrAktywny={activeFilterCount > 0 || search.length > 0}
      onWyczyscFiltr={wyczyscFiltry}
      filtrTytul="Żaden lead nie pasuje"
      filtrOpis="Leady w rejestrze są, ale ten zestaw filtrów odsiał wszystkie."
      ikona={IconInbox}
      tytul="Rejestr leadów jest pusty"
      opis="Nie ma kogo pilnować ani do kogo wracać — lejek sprzedaży zaczyna się właśnie tu. Dodaj pierwszy lead albo puść Łowcę na kandydatów."
      akcja={
        <button onClick={() => setAddOpen(true)} className="rounded-lg border hairline px-3 py-1.5 text-[12.5px] hover:bg-[var(--hairline)]">
          + Dodaj lead
        </button>
      }
    />
  );

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

      if (/^[1-9]$/.test(e.key)) {
        // Kursor MUSI być widoczny — inaczej cyfra zmieniałaby status
        // pierwszego wiersza, którego nikt nie wskazał (paczka C).
        const targetId = openLeadId ?? (view === "table" && kursorWidoczny !== null ? filtered[kursorWidoczny]?.id : undefined);
        const status = STATUSES[Number(e.key) - 1];
        if (targetId && status) {
          e.preventDefault();
          updateLead(targetId, "status", status);
        }
        return;
      }
      // 1/2/3 — przeskok między widokami bez sięgania po mysz. Cyfry, nie
      // litery: litery są już zajęte przez nawigację po liście (j/k) i przez
      // globalne „n"/„g", a cyfra odpowiada pozycji zakładki, więc nie trzeba
      // jej pamiętać.
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        e.preventDefault();
        switchView(e.key === "1" ? "kanban" : e.key === "2" ? "table" : "kandydaci");
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openLeadId, view, filtered, kursorWidoczny, updateLead, switchView]);

  // Akcje zgłoszone do globalnej palety poleceń (Cmd+K) w AppShell.
  useRegisterActions(
    [
      { id: "add", label: "+ Dodaj leada", hint: "N", run: addLead },
      { id: "kanban", label: "Widok: Tablica", run: () => switchView("kanban") },
      { id: "table", label: "Widok: Tabela", run: () => switchView("table") },
      { id: "kandydaci", label: "Widok: Kandydaci (Łowca leadów)", run: () => switchView("kandydaci") },
      { id: "discover", label: "Znajdź nowe leady", run: () => setDiscoverOpen(true) },
      { id: "report", label: "Wyślij dzienny raport teraz", run: sendReportNow },
      { id: "tidy-sources", label: "Uporządkuj źródła (auto-kategoryzacja)", run: tidySources },
      // Łowca leadów (Moduł 52) — jego akcje żyły wyłącznie w zakładce
      // „Kandydaci". Paleta jest jedynym miejscem, w którym da się do nich
      // dojść z klawiatury z dowolnego widoku modułu.
      { id: "hunt-now", label: "Łowca: poluj teraz", run: () => { switchView("kandydaci"); setPolujSygnal((n) => n + 1); } },
      { id: "hunt-new", label: "Łowca: nowe polowanie", run: () => { switchView("kandydaci"); setNowePolowanieSygnal((n) => n + 1); } },
    ],
    [addLead, switchView, sendReportNow, tidySources, seedInitial]
  );

  if (!leads) {
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
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 w-28 animate-pulse rounded-2xl bg-[var(--hairline)]" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--hairline)]" />
      </div>
    );
  }

  // Najdłużej milczące na górze — przy skróconym banerze to decyduje o tym,
  // czy pięć pokazanych pozycji to te właściwe.
  const overdue = leads
    .filter(isOverdue)
    .sort((a, b) => (a.ostatni_kontakt ?? a.created_at).localeCompare(b.ostatni_kontakt ?? b.created_at));
  const selectedId = view === "table" && kursorWidoczny !== null ? filtered[kursorWidoczny]?.id ?? null : null;
  // Zakładka „Kandydaci" ma swój własny zbiór, więc filtry, zaznaczanie i
  // akcje rejestru leadów są tam bez sensu — chowamy je zamiast zostawiać
  // martwe kontrolki, które niczego nie robią.
  const rejestr = view !== "kandydaci";
  const nowychKandydatow = (lowca?.candidates ?? []).filter((k) => k.stan === "nowy").length;

  return (
    // `flex flex-1 flex-col md:min-h-0` (Moduł 35) — przekazanie wysokości okna
    // do Tablicy/Tabeli, żeby kończyły się na krawędzi ekranu, nie na treści.
    <div className="-mx-4 flex flex-1 flex-col sm:-mx-6 md:min-h-0">
      {/* Kompaktowy pasek — zakładki widoku + filtry + akcje jako małe ikony,
          bez dużego nagłówka strony i bez kolorowych kart statystyk. */}
      {/* `overflow-x-auto` (Moduł 5, Paczka 5) — na iOS metryki czcionek są
          szersze niż w podglądzie desktopowym i pasek potrafił nie zmieścić się
          w 375 px. Bez tego wystawał, robiąc CAŁY dokument szerszym od ekranu
          (patrz `overflow-x: clip` w globals.css) i psując pozycję wszystkiego
          innego. Teraz nadmiar przewija się w obrębie samego paska. */}
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
            // Licznik w etykiecie, nie odznaka obok — to jedyna zakładka,
            // w której coś CZEKA na decyzję właściciela, i ma się to widzieć
            // bez wchodzenia w nią.
            { id: "kandydaci", label: nowychKandydatow > 0 ? `Kandydaci (${nowychKandydatow})` : "Kandydaci" },
          ]}
        />
        {/* Zakładka „Kandydaci" ma własny zbiór i własne szukanie — pole
            rejestru leadów niczego by tam nie zawężało (martwa afordancja,
            kategoria 2 listy kontrolnej). Do paczki C stało tam widoczne. */}
        {rejestr ? (
          <PoleSzukania
            ref={searchRef}
            value={search}
            onChange={setSearch}
            podpowiedz="Szuka po firmie, osobie kontaktowej, branży, mieście i notatce"
          />
        ) : (
          <span className="flex-1" />
        )}
        {rejestr && (
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
                <span className="ml-0.5 rounded-full bg-zaznaczenie/20 px-1.5 text-[10px] font-medium text-[var(--zaznaczenie)]">
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
        )}
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
        <span className={`${rejestr ? "hidden sm:flex" : "hidden"} shrink-0 items-center gap-1`}>
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
      {/* ── Baner „wymaga działania dziś" ──
          Do 2026-07-26 wypisywał WSZYSTKIE zaległe leady, jeden pod drugim.
          Przy trzech to była lista; po wprowadzeniu reguły ciszy (14 dni)
          cały zaległy rejestr zapalił się naraz i baner urósł na trzy ekrany,
          spychając Tablicę i Tabelę poza widok — zgłoszone przez właściciela
          zrzutem. Alarm, który zasłania to, do czego się przyszło, przestaje
          być alarmem.
          Teraz: nagłówek z liczbą, pięć najpilniejszych i reszta pod
          rozwinięciem. Sortowanie od najdłużej milczących — bez tego pięć
          pokazanych byłoby przypadkowe. */}
      {rejestr && overdue.length > 0 && (
        <div className="mb-4 rounded-lg border border-orange-500/25 bg-orange-500/[0.04] p-3">
          <button
            onClick={() => setOverdueRozwiniete((v) => !v)}
            className="mb-1.5 flex w-full items-center gap-1.5 text-left text-[12.5px] font-medium text-orange-400"
            disabled={overdue.length <= OVERDUE_SKROT}
          >
            Wymaga działania dziś
            <span className="rounded-full bg-orange-500/15 px-1.5 text-[11px]">{overdue.length}</span>
            {overdue.length > OVERDUE_SKROT && (
              <span className="ml-auto text-[12px] font-normal opacity-80">
                {overdueRozwiniete ? "Zwiń" : `Pokaż wszystkie (${overdue.length})`}
              </span>
            )}
          </button>
          {(overdueRozwiniete ? overdue : overdue.slice(0, OVERDUE_SKROT)).map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between gap-3 border-b border-orange-500/10 py-1 text-[13px] last:border-0"
            >
              <span className="min-w-0 truncate">
                <b>{l.firma}</b> <span className="text-muted">— {overdueReason(l)}</span>
              </span>
              {/* Lead, do którego NIGDY się nie odezwaliśmy, nie da się
                  „oznaczyć jako obsłużony": ustawienie statusu „Przypomnienie
                  wysłane" i dzisiejszej daty kontaktu byłoby wpisaniem do
                  rejestru zdarzenia, które nie zaszło. Tam odkładamy termin. */}
              {l.ostatni_kontakt ? (
                <button
                  onClick={async () => {
                    await updateLead(l.id, "status", "Przypomnienie wysłane");
                    await updateLead(l.id, "ostatni_kontakt", todayLocalISO());
                  }}
                  className="inline-flex min-h-6 shrink-0 items-center rounded-md px-2 py-0.5 text-[12px] text-orange-400 hover:bg-orange-500/10"
                >
                  Oznacz jako obsłużone
                </button>
              ) : (
                <button
                  onClick={() => updateLead(l.id, "next_followup", addDaysISO(todayLocalISO(), 7))}
                  className="inline-flex min-h-6 shrink-0 items-center rounded-md px-2 py-0.5 text-[12px] text-orange-400 hover:bg-orange-500/10"
                >
                  Odłóż o tydzień
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Propozycje dotyczące leadów (Faza 3) — pod pasem „Wymaga działania
          dziś", bo to nie zaległość, tylko pytanie („lead wygrany — zdjąć
          przypomnienie?"). Tylko w widoku rejestru, jak reszta pasków. */}
      {rejestr && (
        <div className="mb-4 empty:hidden">
          <Propozycje lang={lang} modul="leads" onZmiana={load} />
        </div>
      )}

      {rejestr && (
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
      )}

      {rejestr && selectedIds.size > 0 && (
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

      {/* `fill` (rozciągnij i przewijaj w środku) dotyczy Tablicy i Tabeli.
          Skrzynka kandydatów to zwykła, płynąca lista kart — z `fill` jej
          własne przewijanie biłoby się z przewijaniem strony. */}
      <ViewSwitch viewKey={view} fill={rejestr}>
      {view === "kandydaci" ? (
        <CandidatesView
          dane={lowca}
          polowania={polowania}
          czarnaLista={czarnaLista}
          search={search}
          onOdswiez={loadLowca}
          onOdswiezLeady={load}
          polujSygnal={polujSygnal}
          nowePolowanieSygnal={nowePolowanieSygnal}
        />
      ) : view === "kanban" && filtered.length === 0 ? (
        // Tablica z pustymi kolumnami sama w sobie niczego nie tłumaczy —
        // przy awarii wczytania wygląda identycznie jak przy zerowej bazie.
        // Dlatego oba te przypadki przejmuje `stanPusty` (paczka E).
        <div className="card-paper rounded-2xl">{stanPusty}</div>
      ) : view === "kanban" ? (
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
          nowy={nowy}
        />
      ) : (
        <TableView
          leads={filtered}
          lang={lang}
          podKursorem={selectedId}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={(checked) => toggleSelectAll(checked, filtered.map((l) => l.id))}
          stanPusty={stanPusty}
          onUpdate={updateLead}
          onDelete={deleteLead}
          onOpen={setOpenLeadId}
          activeChannel={filterKanal}
          onFilterChannel={(k) => setFilterKanal((prev) => (prev === k ? "" : k))}
          nowy={nowy}
        />
      )}
      </ViewSwitch>
      </div>

      {/* Wyśrodkowany, szeroki modal szczegółów leada (wzorem edytora
          faktury/oferty) — zastąpił dawny wąski panel wysuwany z prawej,
          który był zbyt ciasny na gęstą treść profilu (dane + adres +
          źródło + log aktywności + mapa procesu). */}
      {/* Nowy lead — węższe okno (jak edytory faktur/ofert), bo to trzy pola,
          nie profil. Kategoria źródła jest tu OBOWIĄZKOWA w tym sensie, że ma
          domyślkę i widać ją od razu — patrz komentarz przy `submitNewLead`. */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} card="card-paper my-auto max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border hairline p-6">
        <h2 className="text-lg font-semibold">Nowy lead</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitNewLead();
          }}
          className="mt-4 space-y-4"
        >
          {/* Moduł 59, paczka F+ — formularz „nowy" ma ten sam wiersz, co profil
              rekordu (decyzja właściciela 2026-07-29: „ma być spójne").
              „Skąd go masz" jest tym samym `PillPicker`, co pole „Skąd przyszedł"
              w profilu leada — wcześniej były to dwie różne kontrolki na to samo
              pole: tu rozsypane pigułki, tam menu. */}
          <SekcjaProfilu tytul="Dane">
            <WierszPola etykieta="Firma">
              <input
                autoFocus
                value={addFirma}
                onChange={(e) => setAddFirma(e.target.value)}
                placeholder="np. Kancelaria Kowalski"
                className="w-full rounded-lg border hairline bg-transparent py-1.5 outline-none"
              />
            </WierszPola>
            <WierszPola etykieta="Skąd przyszedł" title="Skąd go masz">
              {/* Bez „Formularz na stronie" i „Automatyczne wyszukiwanie" —
                  te dwie ustawia sama ścieżka, którą lead wchodzi (formularz
                  publiczny, auto-wyszukiwanie OSM), a pierwsza dodatkowo
                  steruje powiadomieniem. Lead wpisywany ręcznie nigdy nie jest
                  żadną z nich. Apka filtruje je tak samo
                  (`KategoriaZrodla.doWyboru`). W profilu leada zostaje pełna
                  lista — tam się je POPRAWIA, nie tworzy. */}
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
                  title="Skąd masz tego leada"
                />
              </span>
              <input
                value={addSzczegoly}
                onChange={(e) => setAddSzczegoly(e.target.value)}
                placeholder="szczegóły (opcjonalnie)"
                className="w-full rounded-lg border hairline bg-transparent py-1.5 outline-none"
              />
            </WierszPola>
            <WierszUwaga>
              Szczegóły źródła to jedno zdanie dla Ciebie — np. „polecił Kowalski", „spotkanie w izbie gospodarczej".
            </WierszUwaga>
          </SekcjaProfilu>

          {/* Faza 1 planu zaplecza (luka B4). Wszystko poniżej jest
              OPCJONALNE — lead zakładany „na szybko" dalej wymaga samej firmy.
              Ale gdy lead powstaje zaraz po telefonie, te dane są w głowie
              TERAZ, a nie za pół godziny, gdy trzeba będzie odszukać rekord
              na liście. Trasa przyjmowała je od zawsze; brakowało pól.
              Te same dane przechodzą potem na kartę klienta i na dokumenty
              (patrz lib/przepisanie.ts), więc wpisane raz nie wracają. */}
          <SekcjaProfilu tytul="Kontakt">
            <WierszPola etykieta="Osoba">
              <input
                value={addOsoba}
                onChange={(e) => setAddOsoba(e.target.value)}
                placeholder="np. Marta Zielińska"
                className="w-full rounded-lg border hairline bg-transparent py-1.5 outline-none"
              />
            </WierszPola>
            <WierszPola etykieta="Telefon">
              <input
                type="tel"
                value={addTelefon}
                onChange={(e) => setAddTelefon(e.target.value)}
                placeholder="601 220 330"
                className="w-full rounded-lg border hairline bg-transparent py-1.5 outline-none"
              />
            </WierszPola>
            <WierszPola etykieta="E-mail">
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="kontakt@firma.pl"
                className="w-full rounded-lg border hairline bg-transparent py-1.5 outline-none"
              />
            </WierszPola>
            <WierszPola etykieta="Miasto">
              <input
                value={addMiasto}
                onChange={(e) => setAddMiasto(e.target.value)}
                placeholder="Kraków"
                className="w-full rounded-lg border hairline bg-transparent py-1.5 outline-none"
              />
            </WierszPola>
            <WierszPola etykieta="Branża">
              <input
                value={addBranza}
                onChange={(e) => setAddBranza(e.target.value)}
                placeholder="Poligrafia"
                className="w-full rounded-lg border hairline bg-transparent py-1.5 outline-none"
              />
            </WierszPola>
            <WierszUwaga>
              Reszta adresu, strona i notatki czekają w profilu leada — tu jest tylko to, co pada w pierwszej rozmowie.
            </WierszUwaga>
          </SekcjaProfilu>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded-full border hairline px-4 py-1.5 text-xs text-muted"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={addBusy || !addFirma.trim()}
              className="btn-primary rounded-full px-4 py-1.5 text-xs disabled:opacity-50"
            >
              {addBusy ? "Dodaję…" : "Dodaj leada"}
            </button>
          </div>
        </form>
      </Modal>

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
