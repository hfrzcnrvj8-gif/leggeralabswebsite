"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { HubEvent } from "@/lib/events";
import type { Lead } from "@/lib/leads";
import type { Project } from "@/lib/projects";
import type { Deadline, DeadlineKind } from "@/app/api/events/deadlines/route";
import { todayLocalISO as todayISO } from "@/lib/dates";
import { useUI, useRegisterActions } from "../ui";

/** Kolory wyliczonych terminów — celowo inne niż niebieski ręcznych wydarzeń,
 * żeby na pierwszy rzut oka odróżnić „to wpisałem sam" od „to wyliczył panel". */
const DEADLINE_STYLE: Record<DeadlineKind, { dot: string; pill: string; label: string }> = {
  invoice: { dot: "bg-brand-gold", pill: "bg-brand-gold/15 text-brand-gold", label: "Płatność" },
  project: { dot: "bg-brand-purple", pill: "bg-brand-purple/15 text-brand-purple", label: "Projekt" },
  milestone: { dot: "bg-brand-pink", pill: "bg-brand-pink/15 text-brand-pink", label: "Kamień" },
  lead: { dot: "bg-orange-500", pill: "bg-orange-500/15 text-orange-400", label: "Lead" },
  client: { dot: "bg-brand-cyan", pill: "bg-brand-cyan/15 text-brand-cyan", label: "Klient" },
};

const WEEKDAYS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"];
const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

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

export function CalendarView({ lang }: { lang: string }) {
  const { toast, confirm } = useUI();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [events, setEvents] = useState<HubEvent[] | null>(null);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>(todayISO());
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newLeadId, setNewLeadId] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const newTitleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/leads").then((r) => (r.ok ? r.json() : null)).then((d) => d && setLeads(d.leads));
    fetch("/api/projects").then((r) => (r.ok ? r.json() : null)).then((d) => d && setProjects(d.projects));
  }, []);

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

  const cells = useMemo(() => monthGrid(year, monthIdx), [year, monthIdx]);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, HubEvent[]>();
    (events ?? []).forEach((e) => {
      const list = map.get(e.data) ?? [];
      list.push(e);
      map.set(e.data, list);
    });
    return map;
  }, [events]);

  const deadlinesByDay = useMemo(() => {
    const map = new Map<string, Deadline[]>();
    deadlines.forEach((d) => {
      const list = map.get(d.data) ?? [];
      list.push(d);
      map.set(d.data, list);
    });
    return map;
  }, [deadlines]);

  const changeMonth = (delta: number) => {
    let m = monthIdx + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonthIdx(m);
    setYear(y);
  };

  const addEvent = async () => {
    if (!newTitle.trim()) return;
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tytul: newTitle.trim(),
        data: selectedDay,
        godzina: newTime || null,
        lead_id: newLeadId || null,
        project_id: newProjectId || null,
      }),
    });
    if (res.ok) {
      setNewTitle("");
      setNewTime("");
      setNewLeadId("");
      setNewProjectId("");
      load();
      toast("Dodano wydarzenie.");
    } else {
      toast("Nie udało się dodać wydarzenia.", "error");
    }
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
  };

  useRegisterActions(
    [{ id: "add", label: "+ Nowe wydarzenie", hint: "N", run: () => newTitleRef.current?.focus() }],
    []
  );

  const today = todayISO();
  const selectedEvents = eventsByDay.get(selectedDay) ?? [];
  const selectedDeadlines = deadlinesByDay.get(selectedDay) ?? [];
  const leadName = (id: string | null) => (id ? leads?.find((l) => l.id === id)?.firma : null);
  const projectName = (id: string | null) => (id ? projects?.find((p) => p.id === id)?.tytul : null);

  return (
    <div className="-mx-4 sm:-mx-6">
      <div className="flex items-center gap-2 border-b hairline px-4 sm:px-6" style={{ height: "44px" }}>
        <span className="text-[13px] text-muted">Kalendarz</span>
        <span className="flex-1" />
        <button onClick={() => changeMonth(-1)} className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-[var(--hairline)]">←</button>
        <span className="min-w-[120px] text-center text-[13px] font-medium">{MONTH_NAMES[monthIdx]} {year}</span>
        <button onClick={() => changeMonth(1)} className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-[var(--hairline)]">→</button>
      </div>

      <div className="grid gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[1fr_320px]">
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
              const isSelected = day === selectedDay;
              // Wspólny limit dla ręcznych wydarzeń i wyliczonych terminów,
              // żeby komórka nie puchła — reszta jako „+N więcej".
              const shownEvents = dayEvents.slice(0, 2);
              const remainingSlots = Math.max(0, 2 - shownEvents.length);
              const shownDeadlines = dayDeadlines.slice(0, remainingSlots);
              const overflow = dayEvents.length + dayDeadlines.length - shownEvents.length - shownDeadlines.length;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`flex min-h-[64px] flex-col items-start gap-1 rounded-lg p-1.5 text-left text-xs transition-colors ${
                    isSelected ? "bg-[#4ea7fc]/[0.12] ring-1 ring-[#4ea7fc]/40" : "hover:bg-[var(--hairline)]"
                  }`}
                >
                  <span className={`text-[11px] ${isToday ? "flex h-5 w-5 items-center justify-center rounded-full bg-[var(--fg)] text-[var(--bg)]" : "text-muted"}`}>
                    {Number(day.slice(-2))}
                  </span>
                  {shownEvents.map((e) => (
                    <span key={e.id} className="w-full truncate rounded bg-[#4ea7fc]/15 px-1 text-[10px] text-[#4ea7fc]">
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
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t hairline pt-3 text-[10px] text-muted">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#4ea7fc]" /> Wydarzenie</span>
            {(Object.keys(DEADLINE_STYLE) as DeadlineKind[]).map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${DEADLINE_STYLE[k].dot}`} /> {DEADLINE_STYLE[k].label}
              </span>
            ))}
          </div>
        </div>

        <div className="card-paper rounded-2xl p-4">
          <h2 className="mb-3 text-[13px] font-medium">{selectedDay}</h2>

          {selectedDeadlines.length > 0 && (
            <ul className="mb-3 space-y-1.5">
              {selectedDeadlines.map((d) => (
                <li key={d.id} className="flex items-center gap-2 rounded-lg border hairline px-2.5 py-1.5 text-sm">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${DEADLINE_STYLE[d.kind].dot}`} />
                  <Link href={`/${lang}${d.href}`} className="truncate hover:underline" title={d.tytul}>
                    {d.tytul}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {selectedEvents.length === 0 ? (
            <p className="mb-3 text-sm text-muted opacity-60">
              {selectedDeadlines.length === 0 ? "🗓️ Brak wydarzeń tego dnia." : "Brak dodatkowych wydarzeń tego dnia."}
            </p>
          ) : (
            <ul className="mb-3 space-y-1.5">
              {selectedEvents.map((e) => (
                <li key={e.id} className="rounded-lg border hairline px-2.5 py-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span>
                      {e.godzina && <span className="mr-1.5 text-muted">{e.godzina}</span>}
                      {e.tytul}
                    </span>
                    <button onClick={() => deleteEvent(e.id)} className="text-muted hover:text-red-400" aria-label="Usuń" title="Usuń">✕</button>
                  </div>
                  {(leadName(e.lead_id) || projectName(e.project_id)) && (
                    <div className="mt-0.5 text-[11px] text-muted">
                      {leadName(e.lead_id) && <>Lead: {leadName(e.lead_id)} </>}
                      {projectName(e.project_id) && <>Projekt: {projectName(e.project_id)}</>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2 border-t hairline pt-3">
            <input
              ref={newTitleRef}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  addEvent();
                }
              }}
              placeholder="Nowe wydarzenie… (Cmd+Enter, by dodać)"
              className="w-full rounded-lg border hairline bg-transparent px-2 py-1.5 text-sm text-[var(--fg)] placeholder:text-muted"
            />
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="rounded-lg border hairline bg-transparent px-2 py-1.5 text-xs text-[var(--fg)]"
              />
              <button
                onClick={addEvent}
                disabled={!newTitle.trim()}
                className="ml-auto rounded-md border hairline px-3 py-1.5 text-[12.5px] font-medium text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Dodaj
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={newLeadId}
                onChange={(e) => setNewLeadId(e.target.value)}
                className="rounded-lg border hairline bg-transparent px-2 py-1 text-[11px] text-muted"
              >
                <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">Powiąż z leadem (opcjonalnie)</option>
                {(leads ?? []).map((l) => (
                  <option key={l.id} value={l.id} className="bg-[var(--bg-soft)] text-[var(--fg)]">{l.firma}</option>
                ))}
              </select>
              <select
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                className="rounded-lg border hairline bg-transparent px-2 py-1 text-[11px] text-muted"
              >
                <option value="" className="bg-[var(--bg-soft)] text-[var(--fg)]">Powiąż z projektem (opcjonalnie)</option>
                {(projects ?? []).map((p) => (
                  <option key={p.id} value={p.id} className="bg-[var(--bg-soft)] text-[var(--fg)]">{p.tytul}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
