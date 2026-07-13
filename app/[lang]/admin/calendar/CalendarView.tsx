"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { HubEvent } from "@/lib/events";
import { expandEventDays, parseQuickAdd, layoutTimedEvents, timeToMinutes, minutesToTime } from "@/lib/events";
import type { Lead } from "@/lib/leads";
import type { Project } from "@/lib/projects";
import type { Client } from "@/lib/clients";
import type { Deadline, DeadlineKind } from "@/app/api/events/deadlines/route";
import { todayLocalISO as todayISO, addDaysToISO } from "@/lib/dates";
import { useUI, useRegisterActions } from "../ui";
import { Popover } from "../Menu";

/** Kolory wyliczonych terminów — celowo inne niż niebieski ręcznych wydarzeń,
 * żeby na pierwszy rzut oka odróżnić „to wpisałem sam" od „to wyliczył panel". */
const DEADLINE_STYLE: Record<DeadlineKind, { dot: string; pill: string; label: string }> = {
  invoice: { dot: "bg-brand-gold", pill: "bg-brand-gold/15 text-brand-gold", label: "Płatność" },
  project: { dot: "bg-brand-purple", pill: "bg-brand-purple/15 text-brand-purple", label: "Projekt" },
  milestone: { dot: "bg-brand-pink", pill: "bg-brand-pink/15 text-brand-pink", label: "Kamień" },
  lead: { dot: "bg-orange-500", pill: "bg-orange-500/15 text-orange-400", label: "Lead" },
  client: { dot: "bg-brand-cyan", pill: "bg-brand-cyan/15 text-brand-cyan", label: "Klient" },
  call: { dot: "bg-brand-cyan", pill: "bg-brand-cyan/15 text-brand-cyan", label: "Połączenie" },
  "call-missed": { dot: "bg-red-500", pill: "bg-red-500/15 text-red-400", label: "Nieodebrane" },
  email: { dot: "bg-indigo-500", pill: "bg-indigo-500/15 text-indigo-400", label: "Email" },
};

const WEEKDAYS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"];
const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

type ViewMode = "month" | "week" | "day";
const HOUR_PX = 48;
const DEFAULT_RANGE = { startHour: 7, endHour: 21 };

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

function weekdayShort(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return WEEKDAYS[(new Date(y, m - 1, d).getDay() + 6) % 7];
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

export function CalendarView({ lang }: { lang: string }) {
  const { toast, confirm } = useUI();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [events, setEvents] = useState<HubEvent[] | null>(null);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>(todayISO());
  const [modalDay, setModalDay] = useState<string | null>(null);
  const [filterClientId, setFilterClientId] = useState("");
  const [filterLeadId, setFilterLeadId] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");
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

  // Łączone filtry (klient + lead + projekt) — AND: pozycja musi pasować do
  // KAŻDEGO ustawionego filtra, żeby np. "klient X" + "projekt Y" zawęziło
  // widok do rzeczy wspólnych obu, nie sumy.
  const filteredEvents = useMemo(
    () =>
      allEvents.filter(
        (e) =>
          (!filterClientId || e.client_id === filterClientId) &&
          (!filterLeadId || e.lead_id === filterLeadId) &&
          (!filterProjectId || e.project_id === filterProjectId)
      ),
    [allEvents, filterClientId, filterLeadId, filterProjectId]
  );
  const filteredDeadlines = useMemo(
    () =>
      allDeadlines.filter(
        (d) =>
          (!filterClientId || d.client_id === filterClientId) &&
          (!filterLeadId || d.lead_id === filterLeadId) &&
          (!filterProjectId || d.project_id === filterProjectId)
      ),
    [allDeadlines, filterClientId, filterLeadId, filterProjectId]
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

  const addEvent = async (
    day: string,
    title: string,
    time: string,
    leadId: string,
    projectId: string,
    clientId: string,
    dayEnd: string,
    durationMin: number | null
  ) => {
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
    [{ id: "add", label: "+ Nowe wydarzenie", hint: "N", run: () => newTitleRef.current?.focus() }],
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
    <div ref={rootRef} className={isFullscreen ? "h-screen overflow-y-auto bg-[var(--bg)] p-4" : "-mx-4 sm:-mx-6"}>
      <div className="flex flex-wrap items-center gap-2 border-b hairline px-4 py-2 sm:px-6">
        <span className="text-[13px] text-muted">Kalendarz</span>
        <div className="ml-2 flex items-center rounded-lg border hairline p-0.5 text-[11.5px]">
          {(["month", "week", "day"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`rounded-md px-2 py-1 transition-colors ${
                viewMode === v ? "bg-[var(--fg)] text-[var(--bg)]" : "text-muted hover:bg-[var(--hairline)]"
              }`}
            >
              {v === "month" ? "Miesiąc" : v === "week" ? "Tydzień" : "Dzień"}
            </button>
          ))}
        </div>
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

      <div className="px-4 py-4 sm:px-6">
        {viewMode === "month" && (
          <div className="card-paper rounded-2xl p-3">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1">{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const dayEvents = eventsByDay.get(day) ?? [];
                const dayDeadlines = deadlinesByDay.get(day) ?? [];
                const isToday = day === today;
                // Wspólny limit dla podglądu w komórce siatki — pełna lista
                // dnia zawsze dostępna w modalu po kliknięciu (bez limitu).
                const shownEvents = dayEvents.slice(0, 2);
                const remainingSlots = Math.max(0, 2 - shownEvents.length);
                const shownDeadlines = dayDeadlines.slice(0, remainingSlots);
                const overflow = dayEvents.length + dayDeadlines.length - shownEvents.length - shownDeadlines.length;
                return (
                  <button
                    key={day}
                    onClick={() => {
                      setSelectedDay(day);
                      setModalDay(day);
                    }}
                    onDragOver={(ev) => ev.preventDefault()}
                    onDrop={(ev) => {
                      ev.preventDefault();
                      const id = ev.dataTransfer.getData("text/plain");
                      if (id) moveEvent(id, day);
                    }}
                    className="flex min-h-[64px] flex-col items-start gap-1 rounded-lg p-1.5 text-left text-xs transition-colors hover:bg-[var(--hairline)]"
                  >
                    <span className={`text-[11px] ${isToday ? "flex h-5 w-5 items-center justify-center rounded-full bg-[var(--fg)] text-[var(--bg)]" : "text-muted"}`}>
                      {Number(day.slice(-2))}
                    </span>
                    {shownEvents.map((e) => (
                      <span
                        key={e.id}
                        draggable
                        onDragStart={(ev) => {
                          ev.stopPropagation();
                          ev.dataTransfer.setData("text/plain", e.id);
                        }}
                        className="w-full cursor-grab truncate rounded bg-[#4ea7fc]/15 px-1 text-[10px] text-[#4ea7fc]"
                        title="Przeciągnij, by zmienić dzień"
                      >
                        {e.tytul}
                      </span>
                    ))}
                    {shownDeadlines.map((d) => (
                      <span key={d.id} className={`w-full truncate rounded px-1 text-[10px] ${DEADLINE_STYLE[d.kind].pill}`}>
                        {d.tytul}
                      </span>
                    ))}
                    {overflow > 0 && <span className="text-[10px] text-muted">+{overflow} więcej</span>}
                  </button>
                );
              })}
            </div>
            <Legend />
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
            onAddClick={(day) => { setSelectedDay(day); setModalDay(day); }}
            onMoveDay={moveEvent}
            onMoveToTime={moveEventToTime}
          />
        )}

        {viewMode === "day" && (
          <div className="card-paper rounded-2xl p-4">
            <h2 className="mb-3 text-[13px] font-medium">{selectedDay}</h2>
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
            />
            <AddEventForm
              day={selectedDay}
              leads={leads}
              projects={projects}
              clients={clients}
              titleRef={newTitleRef}
              onAdd={addEvent}
            />
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalDay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px] sm:p-8"
            onClick={() => setModalDay(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="card-paper my-auto max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[14px] font-medium">{modalDay}</h2>
                <button onClick={() => setModalDay(null)} className="text-muted hover:text-[var(--fg)]" aria-label="Zamknij">✕</button>
              </div>
              <DayAgendaList
                day={modalDay}
                lang={lang}
                events={eventsByDay.get(modalDay) ?? []}
                dls={deadlinesByDay.get(modalDay) ?? []}
                leadName={leadName}
                projectName={projectName}
                clientName={clientName}
                onDelete={deleteEvent}
              />
              <AddEventForm
                day={modalDay}
                leads={leads}
                projects={projects}
                clients={clients}
                titleRef={viewMode === "month" ? newTitleRef : undefined}
                onAdd={addEvent}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t hairline pt-3 text-[10px] text-muted">
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#4ea7fc]" /> Wydarzenie</span>
      {(Object.keys(DEADLINE_STYLE) as DeadlineKind[]).map((k) => (
        <span key={k} className="flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${DEADLINE_STYLE[k].dot}`} /> {DEADLINE_STYLE[k].label}
        </span>
      ))}
    </div>
  );
}

/** Pełna, przewijalna lista wydarzeń + wyliczonych terminów jednego dnia —
 * bez limitu 2+"więcej" (ten limit dotyczy tylko podglądu w komórce siatki
 * miesiąca). Używana w modalu dnia (miesiąc) i jako pasek "cały dzień" nad
 * siatką godzinową w Dniu/Tygodniu. */
function DayAgendaList({
  day,
  lang,
  events,
  dls,
  leadName,
  projectName,
  clientName,
  onDelete,
  compact = false,
}: {
  day: string;
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
      {dls.map((d) => (
        <li key={d.id} className="flex items-center gap-2 rounded-lg border hairline px-2.5 py-1.5 text-sm">
          <span className={`h-2 w-2 shrink-0 rounded-full ${DEADLINE_STYLE[d.kind].dot}`} />
          <Link href={`/${lang}${d.href}`} className="truncate hover:underline" title={d.tytul}>
            {d.tytul}
          </Link>
        </li>
      ))}
      {events.map((e) => (
        <li
          key={e.id}
          draggable
          onDragStart={(ev) => ev.dataTransfer.setData("text/plain", e.id)}
          className="cursor-grab rounded-lg border hairline px-2.5 py-1.5 text-sm"
          title="Przeciągnij, by zmienić dzień"
        >
          <div className="flex items-center justify-between">
            <span className="truncate">
              {e.godzina && <span className="mr-1.5 text-muted">{e.godzina}</span>}
              {e.tytul}
              {e.data_koniec && e.data_koniec > e.data && (
                <span className="ml-1.5 text-[11px] text-muted">({e.data} → {e.data_koniec})</span>
              )}
            </span>
            <button onClick={() => onDelete(e.id)} className="shrink-0 text-muted hover:text-red-400" aria-label="Usuń" title="Usuń">✕</button>
          </div>
          {(leadName(e.lead_id) || projectName(e.project_id) || clientName(e.client_id)) && (
            <div className="mt-0.5 truncate text-[11px] text-muted">
              {clientName(e.client_id) && <>Klient: {clientName(e.client_id)} </>}
              {leadName(e.lead_id) && <>Lead: {leadName(e.lead_id)} </>}
              {projectName(e.project_id) && <>Projekt: {projectName(e.project_id)}</>}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Godzinowa siatka jednego dnia — wydarzenia z ustawioną godziną jako
 * bloki o wysokości = czas trwania (jak Google/Notion Calendar), nakładające
 * się wydarzenia dostają równe kolumny obok siebie. Przeciąganie w pionie
 * zmienia godzinę (zaokrąglone do 15 min). Wydarzenia bez godziny + wyliczone
 * terminy renderują się osobno, w pasku "cały dzień" nad siatką. */
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
}) {
  const untimed = events.filter((e) => !e.godzina);
  const timed = events.filter((e) => e.godzina);
  const range = timelineRange(timed);

  return (
    <div>
      <DayAgendaList
        day={day}
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
        />
      </div>
    </div>
  );
}

/** Widok tygodnia z 7 kolumnami dzielącymi WSPÓLNĄ oś godzin (żeby rzędy
 * godzin były równo wyrównane między dniami, jak w Google Calendar). Nad
 * siatką — rząd "cały dzień" per kolumna dla wydarzeń bez godziny i
 * wyliczonych terminów. */
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
  onAddClick,
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
  onAddClick: (day: string) => void;
  onMoveDay: (id: string, day: string) => void;
  onMoveToTime: (id: string, day: string, time: string) => void;
}) {
  const allTimed = days.flatMap((d) => (eventsByDay.get(d) ?? []).filter((e) => e.godzina));
  const range = timelineRange(allTimed);

  return (
    <div className="card-paper rounded-2xl p-3">
      <div className="grid gap-2" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
        <div />
        {days.map((day) => (
          <div key={day} className="flex items-center justify-between px-1">
            <span className={`text-[12px] font-medium ${day === today ? "text-[var(--fg)]" : "text-muted"}`}>
              {weekdayShort(day)} {formatDayLabel(day)}
            </span>
            <button onClick={() => onAddClick(day)} className="text-[11px] text-muted hover:text-[var(--fg)]" title="Dodaj wydarzenie">+</button>
          </div>
        ))}

        <div />
        {days.map((day) => (
          <div key={day} className="max-h-24 overflow-y-auto">
            <DayAgendaList
              day={day}
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
        ))}

        <HourLabels range={range} />
        {days.map((day) => (
          <TimelineGridRow
            key={day}
            day={day}
            today={today}
            events={(eventsByDay.get(day) ?? []).filter((e) => e.godzina)}
            range={range}
            onDelete={onDelete}
            onMoveToTime={onMoveToTime}
            onDropDay={onMoveDay}
          />
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
 * startu, height = czas trwania), nakładające się dostają kolumny obok
 * siebie (`layoutTimedEvents`). Upuszczenie ustawia nową godzinę na
 * podstawie pozycji Y (zaokrąglone do 15 min). */
function TimelineGridRow({
  day,
  today,
  events,
  range,
  onDelete,
  onMoveToTime,
  onDropDay,
}: {
  day: string;
  today: string;
  events: HubEvent[];
  range: { startHour: number; endHour: number };
  onDelete: (id: string) => void;
  onMoveToTime: (id: string, day: string, time: string) => void;
  onDropDay?: (id: string, day: string) => void;
}) {
  const totalMin = (range.endHour - range.startHour) * 60;
  const layout = layoutTimedEvents(events);
  const now = new Date();
  const isToday = day === today;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNowLine = isToday && nowMin >= range.startHour * 60 && nowMin <= range.endHour * 60;

  return (
    <div
      className="relative rounded-lg"
      style={{
        height: (range.endHour - range.startHour) * HOUR_PX,
        backgroundImage: `repeating-linear-gradient(to bottom, var(--hairline) 0, var(--hairline) 1px, transparent 1px, transparent ${HOUR_PX}px)`,
      }}
      onDragOver={(ev) => ev.preventDefault()}
      onDrop={(ev) => {
        ev.preventDefault();
        const id = ev.dataTransfer.getData("text/plain");
        if (!id) return;
        const rect = ev.currentTarget.getBoundingClientRect();
        const relY = ev.clientY - rect.top;
        const minutesFromStart = Math.max(0, Math.min(totalMin, (relY / rect.height) * totalMin));
        const rounded = Math.round(minutesFromStart / 15) * 15;
        onMoveToTime(id, day, minutesToTime(range.startHour * 60 + rounded));
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
        const top = ((l.startMin - range.startHour * 60) / totalMin) * 100;
        const height = Math.max(4, ((l.endMin - l.startMin) / totalMin) * 100);
        const width = 100 / l.cols;
        const left = l.col * width;
        return (
          <div
            key={e.id}
            draggable
            onDragStart={(ev) => ev.dataTransfer.setData("text/plain", e.id)}
            className="absolute cursor-grab overflow-hidden rounded border border-[#4ea7fc]/40 bg-[#4ea7fc]/15 p-1 text-[10px] text-[#4ea7fc]"
            style={{ top: `${top}%`, height: `${height}%`, left: `${left}%`, width: `calc(${width}% - 2px)` }}
            title={`${e.godzina} ${e.tytul} — przeciągnij, by zmienić czas`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="truncate">{e.godzina} {e.tytul}</span>
              <button
                onClick={(ev) => { ev.stopPropagation(); onDelete(e.id); }}
                className="shrink-0 text-[#4ea7fc]/70 hover:text-red-400"
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

/** Formularz dodawania ręcznego wydarzenia dla konkretnego dnia — współdzielony
 * przez modal dnia i widok dnia. Pole tytułu rozpoznaje deterministycznie
 * (bez AI) wiodące/wplecione frazy daty i godziny — patrz `parseQuickAdd`. */
function AddEventForm({
  day,
  leads,
  projects,
  clients,
  titleRef,
  onAdd,
}: {
  day: string;
  leads: Lead[] | null;
  projects: Project[] | null;
  clients: Client[] | null;
  titleRef?: React.RefObject<HTMLInputElement | null>;
  onAdd: (
    day: string,
    title: string,
    time: string,
    leadId: string,
    projectId: string,
    clientId: string,
    dayEnd: string,
    durationMin: number | null
  ) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [dayEnd, setDayEnd] = useState("");
  const [leadId, setLeadId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const [showRange, setShowRange] = useState(false);

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
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-lg border hairline bg-transparent px-2 py-1.5 text-xs text-[var(--fg)]"
        />
        {time && (
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="rounded-lg border hairline bg-transparent px-2 py-1.5 text-[11px] text-muted"
            title="Czas trwania"
          >
            {[15, 30, 45, 60, 90, 120, 180].map((m) => (
              <option key={m} value={m} className="bg-[var(--bg-soft)] text-[var(--fg)]">
                {m < 60 ? `${m} min` : `${m / 60} godz.`}
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
