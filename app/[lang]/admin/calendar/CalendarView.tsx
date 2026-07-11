"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HubEvent } from "@/lib/events";
import type { Lead } from "@/lib/leads";
import type { Project } from "@/lib/projects";
import { useUI, useRegisterActions } from "../ui";

const WEEKDAYS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"];
const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

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

export function CalendarView() {
  const { toast, confirm } = useUI();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [events, setEvents] = useState<HubEvent[] | null>(null);
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
              const isToday = day === today;
              const isSelected = day === selectedDay;
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
                  {dayEvents.slice(0, 2).map((e) => (
                    <span key={e.id} className="w-full truncate rounded bg-[#4ea7fc]/15 px-1 text-[10px] text-[#4ea7fc]">
                      {e.tytul}
                    </span>
                  ))}
                  {dayEvents.length > 2 && (
                    <span className="text-[10px] text-muted">+{dayEvents.length - 2} więcej</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card-paper rounded-2xl p-4">
          <h2 className="mb-3 text-[13px] font-medium">{selectedDay}</h2>
          {selectedEvents.length === 0 ? (
            <p className="mb-3 text-sm text-muted opacity-60">🗓️ Brak wydarzeń tego dnia.</p>
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
