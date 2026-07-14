"use client";

import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { HubEvent } from "@/lib/events";
import { expandEventDays, parseQuickAdd, layoutTimedEvents, timeToMinutes, minutesToTime } from "@/lib/events";
import type { Lead } from "@/lib/leads";
import type { Project } from "@/lib/projects";
import type { Client } from "@/lib/clients";
import type { Deadline, DeadlineKind } from "@/app/api/events/deadlines/route";
import { todayLocalISO as todayISO, addDaysToISO } from "@/lib/dates";
import { useUI, useRegisterActions } from "../ui";
import { Popover } from "../Menu";

type KindStyle = { border: string; bg: string; text: string; dot: string; label: string };

/** Styl "kalendarza" per rodzaj wpisu — lewy kolorowy pasek + podbarwione tło
 * (wzorem Notion Calendar), zamiast cienkich plakietek. Paleta marki tam,
 * gdzie ma to sens (klient/projekt), reszta zachowuje rozróżnialne kolory
 * pomocnicze (lead/nieodebrane/email). */
const DEADLINE_STYLE: Record<DeadlineKind, KindStyle> = {
  invoice: { border: "border-brand-gold", bg: "bg-brand-gold/10", text: "text-brand-gold", dot: "bg-brand-gold", label: "Płatność" },
  project: { border: "border-brand-purple", bg: "bg-brand-purple/10", text: "text-brand-purple", dot: "bg-brand-purple", label: "Projekt" },
  milestone: { border: "border-brand-pink", bg: "bg-brand-pink/10", text: "text-brand-pink", dot: "bg-brand-pink", label: "Kamień" },
  lead: { border: "border-orange-500", bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-500", label: "Lead" },
  client: { border: "border-brand-cyan", bg: "bg-brand-cyan/10", text: "text-brand-cyan", dot: "bg-brand-cyan", label: "Klient" },
  call: { border: "border-brand-cyan", bg: "bg-brand-cyan/10", text: "text-brand-cyan", dot: "bg-brand-cyan", label: "Połączenie" },
  "call-missed": { border: "border-red-500", bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-500", label: "Nieodebrane" },
  email: { border: "border-indigo-500", bg: "bg-indigo-500/10", text: "text-indigo-400", dot: "bg-indigo-500", label: "Email" },
};

const EVENT_DEFAULT_STYLE: KindStyle = { border: "border-[#4ea7fc]", bg: "bg-[#4ea7fc]/10", text: "text-[#4ea7fc]", dot: "bg-[#4ea7fc]", label: "Wydarzenie" };

/** Kolor ręcznego wydarzenia wyliczony z powiązania — sam kolor komunikuje,
 * z którym modułem wydarzenie jest związane (klient → cyan, lead → gold,
 * projekt → purple), zamiast jednego płaskiego koloru dla wszystkiego. */
function eventStyle(e: HubEvent): KindStyle {
  if (e.client_id) return DEADLINE_STYLE.client;
  if (e.lead_id) return DEADLINE_STYLE.lead;
  if (e.project_id) return DEADLINE_STYLE.project;
  return EVENT_DEFAULT_STYLE;
}

const SIDEBAR_KINDS: { key: string; dot: string; label: string }[] = [
  { key: "event", dot: EVENT_DEFAULT_STYLE.dot, label: "Wydarzenia" },
  ...(Object.keys(DEADLINE_STYLE) as DeadlineKind[]).map((k) => ({ key: k, dot: DEADLINE_STYLE[k].dot, label: DEADLINE_STYLE[k].label })),
];

const WEEKDAYS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"];
const WEEKDAYS_FULL = ["poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela"];
const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

type ViewMode = "month" | "week" | "day";
const HOUR_PX = 48;
const DEFAULT_RANGE = { startHour: 7, endHour: 21 };
const PEEK_WIDTH = 380;
const WEEK_HEADER_H = 24;
const WEEK_AGENDA_H = 96;

/** Liczba dni w miesiącu + offset dnia tygodnia (poniedziałek = 0), żeby
 * ułożyć siatkę kalendarza bez zewnętrznej biblioteki. */
function monthGrid(year: number, monthIdx: number): (string | null)[] {
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const firstWeekday = (new Date(year, monthIdx, 1).getDay() + 6) % 7; // pon=0
  const cells: (string | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return cells;
}

/** Poniedziałek tygodnia, w którym leży `day`. */
function weekStart(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // pon=0
  return addDaysToISO(day, -weekday);
}

function formatDayLabel(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1]}`;
}

function weekdayIdx(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

function weekdayShort(day: string): string {
  return WEEKDAYS[weekdayIdx(day)];
}

/** "wtorek, 14 lipca" — wzorem etykiety dnia w Apple Calendar. */
function formatFullDayLabel(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${WEEKDAYS_FULL[weekdayIdx(day)]}, ${d} ${MONTH_NAMES[m - 1].toLowerCase()}`;
}

/** "10:00–11:00" (z czasem trwania) albo samo "10:00" — do wiersza czasu w
 * liście dnia, wzorem Notion Event panel (zakres, nie tylko start). */
function formatTimeRange(e: HubEvent): string {
  if (!e.godzina) return "";
  if (!e.czas_trwania_min) return e.godzina;
  const endMin = timeToMinutes(e.godzina) + e.czas_trwania_min;
  return `${e.godzina}–${minutesToTime(endMin % 1440)}`;
}

/** Ile dni trwa wydarzenie (1 = jednodniowe) — do zachowania długości
 * zakresu przy przeciąganiu na inny dzień początkowy. */
function eventSpanDays(e: HubEvent): number {
  return expandEventDays(e).length;
}

/** Zakres godzin do narysowania siatki — domyślnie 7–21, rozszerzony, gdy
 * jakieś wydarzenie wystaje poza ten zakres (np. wieczorny call o 22:00). */
function timelineRange(events: HubEvent[]): { startHour: number; endHour: number } {
  const timed = events.filter((e) => e.godzina);
  if (timed.length === 0) return DEFAULT_RANGE;
  let startHour = DEFAULT_RANGE.startHour;
  let endHour = DEFAULT_RANGE.endHour;
  timed.forEach((e) => {
    const startMin = timeToMinutes(e.godzina as string);
    const endMin = startMin + (e.czas_trwania_min ?? 60);
    startHour = Math.min(startHour, Math.floor(startMin / 60));
    endHour = Math.max(endHour, Math.ceil(endMin / 60));
  });
  return { startHour, endHour };
}

type AddEventFn = (
  day: string,
  title: string,
  time: string,
  leadId: string,
  projectId: string,
  clientId: string,
  dayEnd: string,
  durationMin: number | null
) => Promise<boolean>;

export function CalendarView({ lang }: { lang: string }) {
  const { toast, confirm } = useUI();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [events, setEvents] = useState<HubEvent[] | null>(null);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>(todayISO());
  const [dayPrefillTime, setDayPrefillTime] = useState("");
  const [filterClientId, setFilterClientId] = useState("");
  const [filterLeadId, setFilterLeadId] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set());
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [clients, setClients] = useState<Client[] | null>(null);
  const [icsInfo, setIcsInfo] = useState<{ configured: boolean; token: string | null } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const newTitleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/leads").then((r) => (r.ok ? r.json() : null)).then((d) => d && setLeads(d.leads));
    fetch("/api/projects").then((r) => (r.ok ? r.json() : null)).then((d) => d && setProjects(d.projects));
    fetch("/api/clients").then((r) => (r.ok ? r.json() : null)).then((d) => d && setClients(d.clients));
    fetch("/api/calendar/ics-info").then((r) => (r.ok ? r.json() : null)).then((d) => d && setIcsInfo(d));
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      rootRef.current?.requestFullscreen().catch(() => toast("Nie udało się przełączyć pełnego ekranu.", "error"));
    }
  };

  const toggleKind = (key: string) => {
    setHiddenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const monthKey = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;

  const load = useCallback(async () => {
    const res = await fetch(`/api/events?month=${monthKey}`);
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    const data = (await res.json()) as { events: HubEvent[] };
    setEvents(data.events);
  }, [monthKey]);

  // Wyliczone terminy z innych modułów (płatności, projekty, kamienie,
  // przypomnienia) — tylko do odczytu, ładowane osobno od ręcznych wydarzeń.
  useEffect(() => {
    let alive = true;
    fetch(`/api/events/deadlines?month=${monthKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setDeadlines(d.deadlines as Deadline[]));
    return () => {
      alive = false;
    };
  }, [monthKey]);

  useEffect(() => {
    load();
  }, [load]);

  // Widok tygodnia/dnia może wystawać poza aktualnie wczytany miesiąc (np.
  // ostatni tydzień grudnia sięga w styczeń) — dociągnij sąsiedni miesiąc,
  // jeśli trzeba, zamiast ograniczać nawigację do granic miesiąca.
  const visibleMonthKeys = useMemo(() => {
    if (viewMode === "month") return [monthKey];
    const days = viewMode === "day" ? [selectedDay] : Array.from({ length: 7 }, (_, i) => addDaysToISO(weekStart(selectedDay), i));
    return Array.from(new Set(days.map((d) => d.slice(0, 7))));
  }, [viewMode, monthKey, selectedDay]);

  const [extraEvents, setExtraEvents] = useState<Record<string, HubEvent[]>>({});
  const [extraDeadlines, setExtraDeadlines] = useState<Record<string, Deadline[]>>({});

  useEffect(() => {
    const missing = visibleMonthKeys.filter((k) => k !== monthKey && !extraEvents[k]);
    if (missing.length === 0) return;
    let alive = true;
    missing.forEach((k) => {
      Promise.all([
        fetch(`/api/events?month=${k}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/events/deadlines?month=${k}`).then((r) => (r.ok ? r.json() : null)),
      ]).then(([ev, dl]) => {
        if (!alive) return;
        if (ev) setExtraEvents((prev) => ({ ...prev, [k]: ev.events }));
        if (dl) setExtraDeadlines((prev) => ({ ...prev, [k]: dl.deadlines }));
      });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMonthKeys, monthKey]);

  const allEvents = useMemo(() => {
    const extra = visibleMonthKeys.filter((k) => k !== monthKey).flatMap((k) => extraEvents[k] ?? []);
    // Wydarzenia wielodniowe mogą się powtórzyć w kilku miesiącach naraz —
    // dedup po id, żeby nie duplikować wpisu w widoku tygodnia na przełomie.
    const byId = new Map<string, HubEvent>();
    [...(events ?? []), ...extra].forEach((e) => byId.set(e.id, e));
    return Array.from(byId.values());
  }, [events, extraEvents, visibleMonthKeys, monthKey]);

  const allDeadlines = useMemo(() => {
    const extra = visibleMonthKeys.filter((k) => k !== monthKey).flatMap((k) => extraDeadlines[k] ?? []);
    return [...deadlines, ...extra];
  }, [deadlines, extraDeadlines, visibleMonthKeys, monthKey]);

  /** Najbliższe wydarzenie/termin — wzorem "Upcoming" w Notion Calendar.
   * Liczone tylko z aktualnie wczytanych miesięcy (bieżący + sąsiednie przy
   * widoku Tydzień/Dzień), więc jest w pełni trafne dopóki "dziś" mieści się
   * w wczytanym zakresie — typowy przypadek, panel startuje na bieżącym
   * miesiącu. */
  const upcomingItem = useMemo(() => {
    const nowStr = todayISO();
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    type Upcoming = { id: string; data: string; minutes: number; title: string; kind: "event" | DeadlineKind; href?: string };
    const items: Upcoming[] = [];
    allEvents.forEach((e) => {
      const isFuture = e.data > nowStr || (e.data === nowStr && (!e.godzina || timeToMinutes(e.godzina) >= nowMin));
      if (isFuture) items.push({ id: e.id, data: e.data, minutes: e.godzina ? timeToMinutes(e.godzina) : 0, title: e.tytul, kind: "event" });
    });
    allDeadlines.forEach((d) => {
      if (d.data >= nowStr) items.push({ id: d.id, data: d.data, minutes: 0, title: d.tytul, kind: d.kind, href: d.href });
    });
    items.sort((a, b) => (a.data === b.data ? a.minutes - b.minutes : a.data < b.data ? -1 : 1));
    return items[0] ?? null;
  }, [allEvents, allDeadlines]);

  // Łączone filtry (klient + lead + projekt) — AND: pozycja musi pasować do
  // KAŻDEGO ustawionego filtra. Plus widoczność "kalendarzy" z sidebara —
  // wyłączenie typu w sidebarze ukrywa go niezależnie od filtrów.
  const filteredEvents = useMemo(
    () =>
      allEvents.filter(
        (e) =>
          !hiddenKinds.has("event") &&
          (!filterClientId || e.client_id === filterClientId) &&
          (!filterLeadId || e.lead_id === filterLeadId) &&
          (!filterProjectId || e.project_id === filterProjectId)
      ),
    [allEvents, filterClientId, filterLeadId, filterProjectId, hiddenKinds]
  );
  const filteredDeadlines = useMemo(
    () =>
      allDeadlines.filter(
        (d) =>
          !hiddenKinds.has(d.kind) &&
          (!filterClientId || d.client_id === filterClientId) &&
          (!filterLeadId || d.lead_id === filterLeadId) &&
          (!filterProjectId || d.project_id === filterProjectId)
      ),
    [allDeadlines, filterClientId, filterLeadId, filterProjectId, hiddenKinds]
  );

  const cells = useMemo(() => monthGrid(year, monthIdx), [year, monthIdx]);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, HubEvent[]>();
    filteredEvents.forEach((e) => {
      expandEventDays(e).forEach((day) => {
        const list = map.get(day) ?? [];
        list.push(e);
        map.set(day, list);
      });
    });
    return map;
  }, [filteredEvents]);

  const deadlinesByDay = useMemo(() => {
    const map = new Map<string, Deadline[]>();
    filteredDeadlines.forEach((d) => {
      const list = map.get(d.data) ?? [];
      list.push(d);
      map.set(d.data, list);
    });
    return map;
  }, [filteredDeadlines]);

  const changeMonth = (delta: number) => {
    let m = monthIdx + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonthIdx(m);
    setYear(y);
  };

  const changePeriod = (delta: number) => {
    if (viewMode === "month") {
      changeMonth(delta);
      return;
    }
    const step = viewMode === "week" ? delta * 7 : delta;
    const next = addDaysToISO(selectedDay, step);
    setSelectedDay(next);
    const [y, m] = next.split("-").map(Number);
    setYear(y);
    setMonthIdx(m - 1);
  };

  const goToday = () => {
    const t = todayISO();
    setSelectedDay(t);
    setYear(now.getFullYear());
    setMonthIdx(now.getMonth());
  };

  const pickDay = (day: string) => {
    setSelectedDay(day);
    const [y, m] = day.split("-").map(Number);
    setYear(y);
    setMonthIdx(m - 1);
  };

  const addEvent: AddEventFn = async (day, title, time, leadId, projectId, clientId, dayEnd, durationMin) => {
    if (!title.trim()) return false;
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tytul: title.trim(),
        data: day,
        godzina: time || null,
        lead_id: leadId || null,
        project_id: projectId || null,
        client_id: clientId || null,
        data_koniec: dayEnd && dayEnd > day ? dayEnd : null,
        czas_trwania_min: time ? durationMin ?? 60 : null,
      }),
    });
    if (res.ok) {
      load();
      setExtraEvents({});
      toast("Dodano wydarzenie.");
      return true;
    }
    toast("Nie udało się dodać wydarzenia.", "error");
    return false;
  };

  const deleteEvent = async (id: string) => {
    const ok = await confirm("Usunąć to wydarzenie?", { danger: true });
    if (!ok) return;
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć.", "error");
      return;
    }
    setEvents((prev) => prev?.filter((e) => e.id !== id) ?? prev);
    setExtraEvents((prev) => {
      const next: Record<string, HubEvent[]> = {};
      Object.entries(prev).forEach(([k, v]) => { next[k] = v.filter((e) => e.id !== id); });
      return next;
    });
  };

  const patchEvent = async (id: string, fields: Record<string, unknown>, successMsg: string) => {
    const res = await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (res.ok) {
      load();
      setExtraEvents({});
      toast(successMsg);
    } else {
      toast("Nie udało się zaktualizować wydarzenia.", "error");
    }
  };

  /** Przeciągnięcie chipu wydarzenia na inny dzień (miesiąc/tydzień/pasek
   * "cały dzień") — zachowuje długość zakresu dla wydarzeń wielodniowych. */
  const moveEvent = async (id: string, newStart: string) => {
    const event = allEvents.find((e) => e.id === id);
    if (!event || event.data === newStart) return;
    const span = eventSpanDays(event);
    const fields: Record<string, unknown> = { data: newStart };
    if (event.data_koniec) fields.data_koniec = addDaysToISO(newStart, span - 1);
    await patchEvent(id, fields, "Przeniesiono wydarzenie.");
  };

  /** Przeciągnięcie w siatce godzinowej — zmienia dzień I godzinę na
   * podstawie pozycji upuszczenia (zaokrąglone do 15 minut), jak w Google
   * Calendar/Notion Calendar. */
  const moveEventToTime = async (id: string, newDay: string, newTime: string) => {
    const event = allEvents.find((e) => e.id === id);
    if (!event) return;
    const span = eventSpanDays(event);
    const fields: Record<string, unknown> = { data: newDay, godzina: newTime };
    if (event.data_koniec) fields.data_koniec = addDaysToISO(newDay, span - 1);
    await patchEvent(id, fields, "Przeniesiono wydarzenie.");
  };

  useRegisterActions(
    [
      { id: "add", label: "+ Nowe wydarzenie", hint: "N", run: () => newTitleRef.current?.focus() },
      { id: "today", label: "Dziś", hint: "T", run: () => goToday() },
      { id: "view-month", label: "Widok: Miesiąc", run: () => setViewMode("month") },
      { id: "view-week", label: "Widok: Tydzień", run: () => setViewMode("week") },
      { id: "view-day", label: "Widok: Dzień", run: () => setViewMode("day") },
    ],
    []
  );

  const today = todayISO();
  const leadName = (id: string | null) => (id ? leads?.find((l) => l.id === id)?.firma : null);
  const projectName = (id: string | null) => (id ? projects?.find((p) => p.id === id)?.tytul : null);
  const clientName = (id: string | null) => (id ? clients?.find((c) => c.id === id)?.nazwa : null);

  const periodLabel =
    viewMode === "month"
      ? `${MONTH_NAMES[monthIdx]} ${year}`
      : viewMode === "day"
      ? formatDayLabel(selectedDay)
      : `${formatDayLabel(weekStart(selectedDay))} – ${formatDayLabel(addDaysToISO(weekStart(selectedDay), 6))}`;

  return (
    <div
      ref={rootRef}
      className={`flex ${isFullscreen ? "h-screen overflow-hidden bg-[var(--bg)] p-4" : "-mx-4 min-h-[calc(100vh-140px)] sm:-mx-6"}`}
    >
      <Sidebar
        year={year}
        monthIdx={monthIdx}
        selectedDay={selectedDay}
        today={today}
        onPickDay={pickDay}
        onChangeMonth={changeMonth}
        hiddenKinds={hiddenKinds}
        onToggleKind={toggleKind}
        upcoming={upcomingItem}
        onPickUpcoming={(day) => { pickDay(day); setViewMode("day"); }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b hairline px-4 py-2 sm:px-6">
          <ViewDropdown viewMode={viewMode} onChange={setViewMode} />
          <button
            onClick={goToday}
            className="rounded-lg border hairline px-2 py-1 text-[11.5px] text-muted hover:text-[var(--fg)]"
          >
            Dziś
          </button>
          <select
            value={filterClientId}
            onChange={(e) => setFilterClientId(e.target.value)}
            className="rounded-lg border hairline bg-transparent px-2 py-1 text-[11.5px] text-muted"
            title="Pokaż tylko pozycje powiązane z jednym klientem"
          >
            <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">Wszyscy klienci</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id} className="bg-[var(--bg-soft)] text-[var(--fg)]">{c.nazwa}</option>
            ))}
          </select>
          <select
            value={filterLeadId}
            onChange={(e) => setFilterLeadId(e.target.value)}
            className="rounded-lg border hairline bg-transparent px-2 py-1 text-[11.5px] text-muted"
            title="Pokaż tylko pozycje powiązane z jednym leadem"
          >
            <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">Wszystkie leady</option>
            {(leads ?? []).map((l) => (
              <option key={l.id} value={l.id} className="bg-[var(--bg-soft)] text-[var(--fg)]">{l.firma}</option>
            ))}
          </select>
          <select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            className="rounded-lg border hairline bg-transparent px-2 py-1 text-[11.5px] text-muted"
            title="Pokaż tylko pozycje powiązane z jednym projektem"
          >
            <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">Wszystkie projekty</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id} className="bg-[var(--bg-soft)] text-[var(--fg)]">{p.tytul}</option>
            ))}
          </select>
          {icsInfo?.configured && icsInfo.token && <IcsSubscribeButton token={icsInfo.token} />}
          <button
            onClick={toggleFullscreen}
            className="rounded-lg border hairline px-2 py-1 text-[11.5px] text-muted hover:text-[var(--fg)]"
            title={isFullscreen ? "Wyjdź z pełnego ekranu" : "Pełny ekran"}
          >
            {isFullscreen ? "⤡" : "⛶"}
          </button>
          <span className="flex-1" />
          <button onClick={() => changePeriod(-1)} className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-[var(--hairline)]">←</button>
          <span className="min-w-[140px] text-center text-[13px] font-medium">{periodLabel}</span>
          <button onClick={() => changePeriod(1)} className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-[var(--hairline)]">→</button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6">
          {viewMode === "month" && (
            <div className="flex min-h-0 flex-1 flex-col card-paper rounded-2xl p-3">
              <div className="grid shrink-0 grid-cols-7 gap-1 text-center text-[11px] text-muted">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-1">{w}</div>
                ))}
              </div>
              <div className="grid flex-1 grid-cols-7 gap-1" style={{ gridAutoRows: "1fr" }}>
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const dayEvents = eventsByDay.get(day) ?? [];
                  const dayDeadlines = deadlinesByDay.get(day) ?? [];
                  const isToday = day === today;
                  // Wspólny limit dla podglądu w komórce siatki — pełna lista
                  // dnia zawsze dostępna w podglądzie po kliknięciu (bez limitu).
                  const shownEvents = dayEvents.slice(0, 3);
                  const remainingSlots = Math.max(0, 3 - shownEvents.length);
                  const shownDeadlines = dayDeadlines.slice(0, remainingSlots);
                  const overflow = dayEvents.length + dayDeadlines.length - shownEvents.length - shownDeadlines.length;
                  return (
                    <Popover
                      key={day}
                      width={PEEK_WIDTH}
                      triggerClassName="flex h-full w-full"
                      trigger={(open) => (
                        <button
                          onClick={open}
                          onDragOver={(ev) => ev.preventDefault()}
                          onDrop={(ev) => {
                            ev.preventDefault();
                            const id = ev.dataTransfer.getData("text/plain");
                            if (id) moveEvent(id, day);
                          }}
                          className="flex h-full w-full flex-col items-start gap-1 rounded-lg p-1.5 text-left text-xs transition-colors hover:bg-[var(--hairline)]"
                        >
                          <span className={`text-[11px] ${isToday ? "flex h-5 w-5 items-center justify-center rounded-full bg-[var(--fg)] text-[var(--bg)]" : "text-muted"}`}>
                            {Number(day.slice(-2))}
                          </span>
                          {shownEvents.map((e) => {
                            const style = eventStyle(e);
                            return (
                              <span
                                key={e.id}
                                draggable
                                onDragStart={(ev) => {
                                  ev.stopPropagation();
                                  ev.dataTransfer.setData("text/plain", e.id);
                                }}
                                className={`w-full cursor-grab truncate rounded border-l-2 ${style.border} ${style.bg} px-1 text-[10px] ${style.text}`}
                                title="Przeciągnij, by zmienić dzień"
                              >
                                {e.godzina && `${e.godzina} `}{e.tytul}
                              </span>
                            );
                          })}
                          {shownDeadlines.map((d) => (
                            <span key={d.id} className={`w-full truncate rounded border-l-2 ${DEADLINE_STYLE[d.kind].border} ${DEADLINE_STYLE[d.kind].bg} px-1 text-[10px] ${DEADLINE_STYLE[d.kind].text}`}>
                              {d.tytul}
                            </span>
                          ))}
                          {overflow > 0 && <span className="text-[10px] text-muted">+{overflow} więcej</span>}
                          <span className="flex-1" />
                        </button>
                      )}
                    >
                      {(close) => (
                        <DayPeekContent
                          day={day}
                          lang={lang}
                          eventsByDay={eventsByDay}
                          deadlinesByDay={deadlinesByDay}
                          leadName={leadName}
                          projectName={projectName}
                          clientName={clientName}
                          onDelete={deleteEvent}
                          onAdd={addEvent}
                          leads={leads}
                          projects={projects}
                          clients={clients}
                          close={close}
                        />
                      )}
                    </Popover>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "week" && (
            <WeekTimeline
              days={Array.from({ length: 7 }, (_, i) => addDaysToISO(weekStart(selectedDay), i))}
              today={today}
              eventsByDay={eventsByDay}
              deadlinesByDay={deadlinesByDay}
              lang={lang}
              leadName={leadName}
              projectName={projectName}
              clientName={clientName}
              onDelete={deleteEvent}
              onAdd={addEvent}
              leads={leads}
              projects={projects}
              clients={clients}
              onMoveDay={moveEvent}
              onMoveToTime={moveEventToTime}
            />
          )}

          {viewMode === "day" && (
            <div className="card-paper rounded-2xl p-4">
              <h2 className="mb-3 text-[13px] font-medium capitalize">{formatFullDayLabel(selectedDay)}</h2>
              <DayTimeline
                day={selectedDay}
                today={today}
                events={eventsByDay.get(selectedDay) ?? []}
                dls={deadlinesByDay.get(selectedDay) ?? []}
                lang={lang}
                leadName={leadName}
                projectName={projectName}
                clientName={clientName}
                onDelete={deleteEvent}
                onMoveToTime={moveEventToTime}
                onSlotClick={(time) => {
                  setDayPrefillTime(time);
                  newTitleRef.current?.focus();
                }}
              />
              <AddEventForm
                day={selectedDay}
                leads={leads}
                projects={projects}
                clients={clients}
                titleRef={newTitleRef}
                onAdd={addEvent}
                prefillTime={dayPrefillTime}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Dropdown przełącznika widoku ("Miesiąc ▾") — wzorem Notion Calendar,
 * zamiast segmentowanych przycisków. */
function ViewDropdown({ viewMode, onChange }: { viewMode: ViewMode; onChange: (v: ViewMode) => void }) {
  const labels: Record<ViewMode, string> = { month: "Miesiąc", week: "Tydzień", day: "Dzień" };
  return (
    <Popover
      width={140}
      trigger={(open) => (
        <button
          onClick={open}
          className="flex items-center gap-1.5 rounded-lg border hairline px-2.5 py-1 text-[12px] font-medium text-[var(--fg)] hover:bg-[var(--hairline)]"
        >
          {labels[viewMode]} <span className="text-muted">▾</span>
        </button>
      )}
    >
      {(close) => (
        <div className="p-1">
          {(["month", "week", "day"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => { onChange(v); close(); }}
              className={`block w-full rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-[var(--hairline)] ${
                viewMode === v ? "text-[var(--fg)]" : "text-muted"
              }`}
            >
              {labels[v]}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

/** Panel boczny wzorem Notion Calendar: mini-kalendarz miesiąca do szybkiej
 * nawigacji + lista "kalendarzy" (rodzajów wpisów) z możliwością ukrycia
 * każdego niezależnie — zastępuje dawną statyczną legendę na dole siatki. */
type UpcomingItem = { id: string; data: string; minutes: number; title: string; kind: "event" | DeadlineKind; href?: string };

/** "Dziś 14:00" / "Jutro" / "14 lipca" — zwięzła etykieta daty do widgetu
 * "Najbliżej", wzorem "Upcoming in 45 min" w Notion Calendar. */
function formatUpcomingWhen(item: UpcomingItem, today: string): string {
  const time = item.minutes > 0 ? ` ${minutesToTime(item.minutes)}` : "";
  if (item.data === today) return `Dziś${time}`;
  if (item.data === addDaysToISO(today, 1)) return `Jutro${time}`;
  return `${formatDayLabel(item.data)}${time}`;
}

function Sidebar({
  year,
  monthIdx,
  selectedDay,
  today,
  onPickDay,
  onChangeMonth,
  hiddenKinds,
  onToggleKind,
  upcoming,
  onPickUpcoming,
}: {
  year: number;
  monthIdx: number;
  selectedDay: string;
  today: string;
  onPickDay: (day: string) => void;
  onChangeMonth: (delta: number) => void;
  hiddenKinds: Set<string>;
  onToggleKind: (key: string) => void;
  upcoming: UpcomingItem | null;
  onPickUpcoming: (day: string) => void;
}) {
  return (
    <div className="flex w-[200px] shrink-0 flex-col gap-5 overflow-y-auto border-r hairline px-3 py-4">
      <MiniMonthCalendar
        year={year}
        monthIdx={monthIdx}
        selectedDay={selectedDay}
        today={today}
        onPickDay={onPickDay}
        onChangeMonth={onChangeMonth}
      />
      {upcoming && (
        <div>
          <div className="mb-1.5 px-1.5 text-[11px] font-medium text-muted">Najbliżej</div>
          <button
            onClick={() => onPickUpcoming(upcoming.data)}
            className={`w-full rounded-lg border-l-[3px] ${
              upcoming.kind === "event" ? EVENT_DEFAULT_STYLE.border : DEADLINE_STYLE[upcoming.kind as DeadlineKind].border
            } bg-[var(--bg-soft)] px-2.5 py-1.5 text-left hover:bg-[var(--hairline)]`}
          >
            <div className="truncate text-[12px] font-medium">{upcoming.title}</div>
            <div className="text-[11px] text-muted">{formatUpcomingWhen(upcoming, today)}</div>
          </button>
        </div>
      )}
      <div>
        <div className="mb-1.5 px-1.5 text-[11px] font-medium text-muted">Kalendarze</div>
        <div className="space-y-0.5">
          {SIDEBAR_KINDS.map((k) => {
            const hidden = hiddenKinds.has(k.key);
            return (
              <button
                key={k.key}
                onClick={() => onToggleKind(k.key)}
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12px] hover:bg-[var(--hairline)]"
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${k.dot} ${hidden ? "opacity-25" : ""}`} />
                <span className={`truncate ${hidden ? "text-muted opacity-60" : ""}`}>{k.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Mały, klikalny kalendarz miesiąca w sidebarze — szybki skok do
 * dowolnego dnia niezależnie od aktywnego widoku, wzorem Notion Calendar. */
function MiniMonthCalendar({
  year,
  monthIdx,
  selectedDay,
  today,
  onPickDay,
  onChangeMonth,
}: {
  year: number;
  monthIdx: number;
  selectedDay: string;
  today: string;
  onPickDay: (day: string) => void;
  onChangeMonth: (delta: number) => void;
}) {
  const cells = useMemo(() => monthGrid(year, monthIdx), [year, monthIdx]);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[12px] font-medium">{MONTH_NAMES[monthIdx]} {year}</span>
        <div className="flex gap-0.5">
          <button onClick={() => onChangeMonth(-1)} className="flex h-5 w-5 items-center justify-center rounded text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]" aria-label="Poprzedni miesiąc">‹</button>
          <button onClick={() => onChangeMonth(1)} className="flex h-5 w-5 items-center justify-center rounded text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]" aria-label="Następny miesiąc">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[9px] text-muted">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w[0]}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => (
          <button
            key={i}
            disabled={!day}
            onClick={() => day && onPickDay(day)}
            className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
              !day
                ? ""
                : day === today
                ? "bg-red-500 font-medium text-white"
                : day === selectedDay
                ? "bg-[var(--hairline)] font-medium text-[var(--fg)]"
                : "text-muted hover:bg-[var(--hairline)]"
            }`}
          >
            {day ? Number(day.slice(-2)) : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Pełna, przewijalna lista wydarzeń + wyliczonych terminów jednego dnia —
 * kolorowy lewy pasek per "kalendarz" (rodzaj), zakres godzin z czasem
 * trwania, klikalne odnośniki do powiązanego klienta/leada/projektu (wzorem
 * Notion Event panel). Używana w podglądzie dnia i jako pasek "cały dzień"
 * nad siatką godzinową w Dniu/Tygodniu. */
function DayAgendaList({
  lang,
  events,
  dls,
  leadName,
  projectName,
  clientName,
  onDelete,
  compact = false,
}: {
  lang: string;
  events: HubEvent[];
  dls: Deadline[];
  leadName: (id: string | null) => string | null | undefined;
  projectName: (id: string | null) => string | null | undefined;
  clientName: (id: string | null) => string | null | undefined;
  onDelete: (id: string) => void;
  compact?: boolean;
}) {
  if (events.length === 0 && dls.length === 0) {
    return <p className={`text-sm text-muted opacity-60 ${compact ? "text-[12px]" : "mb-3"}`}>🗓️ Brak wydarzeń tego dnia.</p>;
  }
  return (
    <ul className={`space-y-1.5 ${compact ? "" : "mb-3"}`}>
      {dls.map((d) => {
        const style = DEADLINE_STYLE[d.kind];
        return (
          <li key={d.id} className={`rounded-lg border-l-[3px] ${style.border} ${style.bg} px-2.5 py-1.5 text-sm`}>
            <Link href={`/${lang}${d.href}`} className="block truncate hover:underline" title={d.tytul}>
              {d.tytul}
            </Link>
          </li>
        );
      })}
      {events.map((e) => {
        const style = eventStyle(e);
        const hasLinks = e.client_id || e.lead_id || e.project_id;
        return (
          <li
            key={e.id}
            draggable
            onDragStart={(ev) => ev.dataTransfer.setData("text/plain", e.id)}
            className={`cursor-grab rounded-lg border-l-[3px] ${style.border} bg-[var(--bg-soft)] px-2.5 py-1.5 text-sm`}
            title="Przeciągnij, by zmienić dzień"
          >
            <div className="flex items-center justify-between">
              <span className="truncate">
                {e.godzina && <span className={`mr-1.5 font-medium ${style.text}`}>{formatTimeRange(e)}</span>}
                {e.tytul}
                {e.data_koniec && e.data_koniec > e.data && (
                  <span className="ml-1.5 text-[11px] text-muted">({e.data} → {e.data_koniec})</span>
                )}
              </span>
              <button onClick={() => onDelete(e.id)} className="shrink-0 text-muted hover:text-red-400" aria-label="Usuń" title="Usuń">✕</button>
            </div>
            {hasLinks && (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                {e.client_id && (
                  <Link href={`/${lang}/admin/clients/${e.client_id}`} className="text-brand-cyan hover:underline">
                    👤 {clientName(e.client_id)}
                  </Link>
                )}
                {e.lead_id && (
                  <Link href={`/${lang}/admin/leads/${e.lead_id}`} className="text-orange-400 hover:underline">
                    🎯 {leadName(e.lead_id)}
                  </Link>
                )}
                {e.project_id && (
                  <Link href={`/${lang}/admin/projects/${e.project_id}`} className="text-brand-purple hover:underline">
                    📁 {projectName(e.project_id)}
                  </Link>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Lekki, zakotwiczony podgląd dnia (wzorem Apple/Notion Calendar) —
 * otwierany z komórki miesiąca/kolumny tygodnia jako `Popover`, nie
 * pełnoekranowy modal. Strzałki ‹/› przełączają dzień BEZ zamykania —
 * popover zostaje w miejscu, zmienia się tylko treść. */
function DayPeekContent({
  day: initialDay,
  lang,
  eventsByDay,
  deadlinesByDay,
  leadName,
  projectName,
  clientName,
  onDelete,
  onAdd,
  leads,
  projects,
  clients,
  close,
  initialTime,
}: {
  day: string;
  lang: string;
  eventsByDay: Map<string, HubEvent[]>;
  deadlinesByDay: Map<string, Deadline[]>;
  leadName: (id: string | null) => string | null | undefined;
  projectName: (id: string | null) => string | null | undefined;
  clientName: (id: string | null) => string | null | undefined;
  onDelete: (id: string) => void;
  onAdd: AddEventFn;
  leads: Lead[] | null;
  projects: Project[] | null;
  clients: Client[] | null;
  close: () => void;
  initialTime?: string;
}) {
  const [day, setDay] = useState(initialDay);
  const events = eventsByDay.get(day) ?? [];
  const dls = deadlinesByDay.get(day) ?? [];

  return (
    <div style={{ width: PEEK_WIDTH }} className="max-h-[70vh] overflow-y-auto p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDay((d) => addDaysToISO(d, -1))}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-[var(--hairline)]"
            aria-label="Poprzedni dzień"
          >
            ‹
          </button>
          <h3 className="text-[13px] font-medium capitalize">{formatFullDayLabel(day)}</h3>
          <button
            onClick={() => setDay((d) => addDaysToISO(d, 1))}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-[var(--hairline)]"
            aria-label="Następny dzień"
          >
            ›
          </button>
        </div>
        <button onClick={close} className="text-muted hover:text-[var(--fg)]" aria-label="Zamknij">✕</button>
      </div>
      <DayAgendaList
        lang={lang}
        events={events}
        dls={dls}
        leadName={leadName}
        projectName={projectName}
        clientName={clientName}
        onDelete={onDelete}
      />
      <AddEventForm
        day={day}
        leads={leads}
        projects={projects}
        clients={clients}
        onAdd={onAdd}
        prefillTime={day === initialDay ? initialTime : undefined}
      />
    </div>
  );
}

/** Godzinowa siatka jednego dnia — wydarzenia z ustawioną godziną jako
 * bloki o wysokości = czas trwania (jak Google/Notion Calendar), nakładające
 * się wydarzenia dostają równe kolumny obok siebie. Klik w puste miejsce
 * siatki wypełnia godzinę w formularzu poniżej (`onSlotClick`); przeciąganie
 * w pionie zmienia godzinę (zaokrąglone do 15 min). Wydarzenia bez godziny +
 * wyliczone terminy renderują się osobno, w pasku "cały dzień" nad siatką. */
function DayTimeline({
  day,
  today,
  events,
  dls,
  lang,
  leadName,
  projectName,
  clientName,
  onDelete,
  onMoveToTime,
  onSlotClick,
}: {
  day: string;
  today: string;
  events: HubEvent[];
  dls: Deadline[];
  lang: string;
  leadName: (id: string | null) => string | null | undefined;
  projectName: (id: string | null) => string | null | undefined;
  clientName: (id: string | null) => string | null | undefined;
  onDelete: (id: string) => void;
  onMoveToTime: (id: string, day: string, time: string) => void;
  onSlotClick?: (time: string) => void;
}) {
  const untimed = events.filter((e) => !e.godzina);
  const timed = events.filter((e) => e.godzina);
  const range = timelineRange(timed);

  return (
    <div>
      <DayAgendaList
        lang={lang}
        events={untimed}
        dls={dls}
        leadName={leadName}
        projectName={projectName}
        clientName={clientName}
        onDelete={onDelete}
      />
      <div className="grid gap-2" style={{ gridTemplateColumns: "48px 1fr" }}>
        <HourLabels range={range} />
        <TimelineGridRow
          day={day}
          today={today}
          events={timed}
          range={range}
          onDelete={onDelete}
          onMoveToTime={onMoveToTime}
          onSlotClick={onSlotClick}
        />
      </div>
    </div>
  );
}

/** Widok tygodnia z 7 kolumnami dzielącymi WSPÓLNĄ oś godzin (żeby rzędy
 * godzin były równo wyrównane między dniami, jak w Google/Notion Calendar).
 * Cała kolumna dnia (nagłówek + pasek "cały dzień" + siatka) jest triggerem
 * lekkiego podglądu dnia (`DayPeekContent`) — klik w "+" albo w puste
 * miejsce siatki (z góry wypełnioną godziną) otwiera ten sam podgląd. */
function WeekTimeline({
  days,
  today,
  eventsByDay,
  deadlinesByDay,
  lang,
  leadName,
  projectName,
  clientName,
  onDelete,
  onAdd,
  leads,
  projects,
  clients,
  onMoveDay,
  onMoveToTime,
}: {
  days: string[];
  today: string;
  eventsByDay: Map<string, HubEvent[]>;
  deadlinesByDay: Map<string, Deadline[]>;
  lang: string;
  leadName: (id: string | null) => string | null | undefined;
  projectName: (id: string | null) => string | null | undefined;
  clientName: (id: string | null) => string | null | undefined;
  onDelete: (id: string) => void;
  onAdd: AddEventFn;
  leads: Lead[] | null;
  projects: Project[] | null;
  clients: Client[] | null;
  onMoveDay: (id: string, day: string) => void;
  onMoveToTime: (id: string, day: string, time: string) => void;
}) {
  const allTimed = days.flatMap((d) => (eventsByDay.get(d) ?? []).filter((e) => e.godzina));
  const range = timelineRange(allTimed);
  const [prefillTime, setPrefillTime] = useState("");

  return (
    <div className="flex min-h-0 flex-1 flex-col card-paper rounded-2xl p-3">
      <div className="flex min-h-0 flex-1 gap-2">
        <div className="flex w-12 shrink-0 flex-col">
          <div style={{ height: WEEK_HEADER_H }} />
          <div style={{ height: WEEK_AGENDA_H }} />
          <div className="flex-1 overflow-y-auto">
            <HourLabels range={range} />
          </div>
        </div>
        {days.map((day) => (
          <Popover
            key={day}
            width={PEEK_WIDTH}
            triggerClassName="flex flex-1 min-w-0 flex-col"
            trigger={(open) => (
              <div className="flex flex-1 flex-col">
                <div style={{ height: WEEK_HEADER_H }} className="flex items-center justify-between px-1">
                  <span className={`flex items-center gap-1 text-[12px] font-medium ${day === today ? "text-[var(--fg)]" : "text-muted"}`}>
                    {weekdayShort(day)}
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${day === today ? "bg-red-500 text-white" : ""}`}>
                      {Number(day.slice(-2))}
                    </span>
                  </span>
                  <button
                    onClick={(e) => { setPrefillTime(""); open(e); }}
                    className="text-[11px] text-muted hover:text-[var(--fg)]"
                    title="Dodaj wydarzenie"
                  >
                    +
                  </button>
                </div>
                <div style={{ height: WEEK_AGENDA_H }} className="overflow-y-auto">
                  <DayAgendaList
                    lang={lang}
                    events={(eventsByDay.get(day) ?? []).filter((e) => !e.godzina)}
                    dls={deadlinesByDay.get(day) ?? []}
                    leadName={leadName}
                    projectName={projectName}
                    clientName={clientName}
                    onDelete={onDelete}
                    compact
                  />
                </div>
                <div className="flex-1 overflow-y-auto">
                  <TimelineGridRow
                    day={day}
                    today={today}
                    events={(eventsByDay.get(day) ?? []).filter((e) => e.godzina)}
                    range={range}
                    onDelete={onDelete}
                    onMoveToTime={onMoveToTime}
                    onDropDay={onMoveDay}
                    onSlotClick={(time, e) => { setPrefillTime(time); open(e); }}
                  />
                </div>
              </div>
            )}
          >
            {(close) => (
              <DayPeekContent
                day={day}
                lang={lang}
                eventsByDay={eventsByDay}
                deadlinesByDay={deadlinesByDay}
                leadName={leadName}
                projectName={projectName}
                clientName={clientName}
                onDelete={onDelete}
                onAdd={onAdd}
                leads={leads}
                projects={projects}
                clients={clients}
                close={close}
                initialTime={prefillTime}
              />
            )}
          </Popover>
        ))}
      </div>
    </div>
  );
}

function HourLabels({ range }: { range: { startHour: number; endHour: number } }) {
  const hours = Array.from({ length: range.endHour - range.startHour }, (_, i) => range.startHour + i);
  return (
    <div className="relative" style={{ height: hours.length * HOUR_PX }}>
      {hours.map((h) => (
        <div key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-muted" style={{ top: (h - range.startHour) * HOUR_PX }}>
          {String(h).padStart(2, "0")}:00
        </div>
      ))}
    </div>
  );
}

/** Jedna kolumna siatki godzinowej dla jednego dnia — dzielona wysokość
 * według `range`, bloki wydarzeń pozycjonowane absolutnie (top = godzina
 * startu, height = czas trwania, kolor z `eventStyle`), nakładające się
 * dostają kolumny obok siebie (`layoutTimedEvents`). Klik w puste miejsce
 * wywołuje `onSlotClick` z wyliczoną godziną; przeciąganie (drop) zmienia
 * godzinę zaokrągloną do 15 min. */
function TimelineGridRow({
  day,
  today,
  events,
  range,
  onDelete,
  onMoveToTime,
  onDropDay,
  onSlotClick,
}: {
  day: string;
  today: string;
  events: HubEvent[];
  range: { startHour: number; endHour: number };
  onDelete: (id: string) => void;
  onMoveToTime: (id: string, day: string, time: string) => void;
  onDropDay?: (id: string, day: string) => void;
  onSlotClick?: (time: string, e: React.MouseEvent) => void;
}) {
  const totalMin = (range.endHour - range.startHour) * 60;
  const layout = layoutTimedEvents(events);
  const now = new Date();
  const isToday = day === today;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNowLine = isToday && nowMin >= range.startHour * 60 && nowMin <= range.endHour * 60;

  const timeFromClientY = (clientY: number, rect: DOMRect): string => {
    const relY = clientY - rect.top;
    const minutesFromStart = Math.max(0, Math.min(totalMin, (relY / rect.height) * totalMin));
    const rounded = Math.round(minutesFromStart / 15) * 15;
    return minutesToTime(range.startHour * 60 + rounded);
  };

  return (
    <div
      className="relative rounded-lg"
      style={{
        height: (range.endHour - range.startHour) * HOUR_PX,
        backgroundImage: `repeating-linear-gradient(to bottom, var(--hairline) 0, var(--hairline) 1px, transparent 1px, transparent ${HOUR_PX}px)`,
      }}
      onClick={(ev) => {
        if (!onSlotClick) return;
        onSlotClick(timeFromClientY(ev.clientY, ev.currentTarget.getBoundingClientRect()), ev);
      }}
      onDragOver={(ev) => ev.preventDefault()}
      onDrop={(ev) => {
        ev.preventDefault();
        const id = ev.dataTransfer.getData("text/plain");
        if (!id) return;
        onMoveToTime(id, day, timeFromClientY(ev.clientY, ev.currentTarget.getBoundingClientRect()));
        onDropDay?.(id, day);
      }}
    >
      {showNowLine && (
        <div
          className="absolute left-0 right-0 h-px bg-red-500"
          style={{ top: ((nowMin - range.startHour * 60) / totalMin) * 100 + "%" }}
        />
      )}
      {events.map((e) => {
        const l = layout.get(e.id);
        if (!l) return null;
        const style = eventStyle(e);
        const top = ((l.startMin - range.startHour * 60) / totalMin) * 100;
        const height = Math.max(4, ((l.endMin - l.startMin) / totalMin) * 100);
        const width = 100 / l.cols;
        const left = l.col * width;
        return (
          <div
            key={e.id}
            draggable
            onClick={(ev) => ev.stopPropagation()}
            onDragStart={(ev) => ev.dataTransfer.setData("text/plain", e.id)}
            className={`absolute cursor-grab overflow-hidden rounded border-l-2 ${style.border} ${style.bg} p-1 text-[10px] ${style.text}`}
            style={{ top: `${top}%`, height: `${height}%`, left: `${left}%`, width: `calc(${width}% - 2px)` }}
            title={`${e.godzina} ${e.tytul} — przeciągnij, by zmienić czas`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="truncate">{e.godzina} {e.tytul}</span>
              <button
                onClick={(ev) => { ev.stopPropagation(); onDelete(e.id); }}
                className={`shrink-0 ${style.text} opacity-70 hover:text-red-400 hover:opacity-100`}
                aria-label="Usuń"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const MINUTE_STEPS = ["00", "15", "30", "45"];

/** Własny picker godziny (dwa selecty: godzina/minuta) zamiast natywnego
 * `<input type="time">` — natywny render różni się drastycznie między
 * przeglądarkami i systemami (kółko z minutami itp.), co odstawało od
 * spójnego, custom-stylowanego UI reszty panelu. Krok 15 min — pasuje do
 * granulacji przeciągania w siatce godzinowej. */
function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value ? value.split(":") : ["", ""];
  return (
    <div className="flex items-center gap-1">
      <select
        value={h}
        onChange={(e) => {
          const nh = e.target.value;
          onChange(nh ? `${nh}:${m || "00"}` : "");
        }}
        className="rounded-lg border hairline bg-transparent px-2 py-1.5 text-xs text-[var(--fg)]"
      >
        <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">Godzina</option>
        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((hh) => (
          <option key={hh} value={hh} className="bg-[var(--bg-soft)] text-[var(--fg)]">{hh}</option>
        ))}
      </select>
      <span className="text-muted">:</span>
      <select
        value={m || "00"}
        disabled={!h}
        onChange={(e) => h && onChange(`${h}:${e.target.value}`)}
        className="rounded-lg border hairline bg-transparent px-2 py-1.5 text-xs text-[var(--fg)] disabled:opacity-40"
      >
        {MINUTE_STEPS.map((mm) => (
          <option key={mm} value={mm} className="bg-[var(--bg-soft)] text-[var(--fg)]">{mm}</option>
        ))}
      </select>
      {value && (
        <button
          onClick={() => onChange("")}
          className="text-muted hover:text-red-400"
          title="Wyczyść godzinę"
          aria-label="Wyczyść godzinę"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** Formularz dodawania ręcznego wydarzenia dla konkretnego dnia — współdzielony
 * przez podgląd dnia (miesiąc/tydzień) i widok dnia. Pole tytułu rozpoznaje
 * deterministycznie (bez AI) wiodące/wplecione frazy daty i godziny — patrz
 * `parseQuickAdd`. `prefillTime` wypełnia godzinę po kliknięciu pustego
 * miejsca w siatce godzinowej. */
function AddEventForm({
  day,
  leads,
  projects,
  clients,
  titleRef,
  onAdd,
  prefillTime,
}: {
  day: string;
  leads: Lead[] | null;
  projects: Project[] | null;
  clients: Client[] | null;
  titleRef?: React.RefObject<HTMLInputElement | null>;
  onAdd: AddEventFn;
  prefillTime?: string;
}) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState(prefillTime ?? "");
  const [duration, setDuration] = useState(60);
  const [dayEnd, setDayEnd] = useState("");
  const [leadId, setLeadId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const [showRange, setShowRange] = useState(false);

  useEffect(() => {
    if (prefillTime) setTime(prefillTime);
  }, [prefillTime]);

  const submit = async () => {
    const parsed = parseQuickAdd(title, day);
    const finalTime = time || parsed.time || "";
    const ok = await onAdd(
      parsed.date ?? day,
      parsed.title,
      finalTime,
      leadId,
      projectId,
      clientId,
      dayEnd,
      finalTime ? duration : null
    );
    if (ok) {
      setTitle("");
      setTime("");
      setDuration(60);
      setDayEnd("");
      setLeadId("");
      setProjectId("");
      setClientId("");
      setShowRange(false);
    }
  };

  return (
    <div className="space-y-2 border-t hairline pt-3">
      <input
        ref={titleRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Nowe wydarzenie… np. „jutro 14:00 call z klientem” (Cmd+Enter)"
        className="w-full rounded-lg border hairline bg-transparent px-2 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
      />
      <div className="flex flex-wrap items-center gap-2">
        <TimeSelect value={time} onChange={setTime} />
        {time && (
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="rounded-lg border hairline bg-transparent px-2 py-1.5 text-[11px] text-muted"
            title="Czas trwania"
          >
            {[15, 30, 45, 60, 90, 120, 180].map((mVal) => (
              <option key={mVal} value={mVal} className="bg-[var(--bg-soft)] text-[var(--fg)]">
                {mVal < 60 ? `${mVal} min` : `${mVal / 60} godz.`}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => setShowRange((v) => !v)}
          className={`rounded-md border hairline px-2 py-1 text-[11px] ${showRange ? "text-[var(--fg)]" : "text-muted"}`}
          title="Wydarzenie wielodniowe (np. urlop, wyjazd)"
        >
          Wielodniowe
        </button>
        <button
          onClick={submit}
          disabled={!title.trim()}
          className="ml-auto rounded-md border hairline px-3 py-1.5 text-[12.5px] font-medium text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Dodaj
        </button>
      </div>
      {showRange && (
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span>Do dnia (włącznie):</span>
          <input
            type="date"
            value={dayEnd}
            min={day}
            onChange={(e) => setDayEnd(e.target.value)}
            className="rounded-lg border hairline bg-transparent px-2 py-1 text-[11px] text-[var(--fg)]"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="rounded-lg border hairline bg-transparent px-2 py-1 text-[11px] text-muted"
        >
          <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">Powiąż z klientem (opcjonalnie)</option>
          {(clients ?? []).map((c) => (
            <option key={c.id} value={c.id} className="bg-[var(--bg-soft)] text-[var(--fg)]">{c.nazwa}</option>
          ))}
        </select>
        <select
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
          className="rounded-lg border hairline bg-transparent px-2 py-1 text-[11px] text-muted"
        >
          <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">Powiąż z leadem (opcjonalnie)</option>
          {(leads ?? []).map((l) => (
            <option key={l.id} value={l.id} className="bg-[var(--bg-soft)] text-[var(--fg)]">{l.firma}</option>
          ))}
        </select>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="rounded-lg border hairline bg-transparent px-2 py-1 text-[11px] text-muted"
        >
          <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">Powiąż z projektem (opcjonalnie)</option>
          {(projects ?? []).map((p) => (
            <option key={p.id} value={p.id} className="bg-[var(--bg-soft)] text-[var(--fg)]">{p.tytul}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Przycisk "Subskrybuj" — pokazuje gotowy do skopiowania link do feedu ICS
 * (`/api/calendar/ics?token=...`), żeby wpiąć ten kalendarz jako subskrypcję
 * w Apple/Google Calendar na telefonie. Renderowany tylko, gdy
 * `CALENDAR_ICS_SECRET` jest ustawiony w env (patrz `/api/calendar/ics-info`). */
function IcsSubscribeButton({ token }: { token: string }) {
  const { toast } = useUI();
  const [url, setUrl] = useState("");

  return (
    <Popover
      width={340}
      trigger={(open) => (
        <button
          onClick={(e) => {
            setUrl(`${window.location.origin}/api/calendar/ics?token=${token}`);
            open(e);
          }}
          className="flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-[11px] text-muted hover:text-[var(--fg)]"
          title="Subskrybuj ten kalendarz w Apple/Google Calendar"
        >
          📅 Subskrybuj
        </button>
      )}
    >
      {(close) => (
        <div className="p-3">
          <p className="mb-2 text-[12px] text-muted">
            Wklej ten link jako subskrypcję kalendarza (Apple Calendar: „Dodaj kalendarz → Subskrybuj”; Google Calendar: „Z adresu URL”):
          </p>
          <input
            readOnly
            value={url}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="w-full rounded-md border hairline bg-transparent px-2 py-1 text-[11px] text-[var(--fg)]"
          />
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              toast("Skopiowano link.");
              close();
            }}
            className="mt-2 w-full rounded-md border hairline px-2 py-1 text-[12px] text-[var(--fg)] hover:bg-[var(--hairline)]"
          >
            Kopiuj link
          </button>
        </div>
      )}
    </Popover>
  );
}
