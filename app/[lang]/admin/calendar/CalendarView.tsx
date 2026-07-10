"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { HubEvent } from "@/lib/events";
import { useUI } from "../ui";

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
      body: JSON.stringify({ tytul: newTitle.trim(), data: selectedDay, godzina: newTime || null }),
    });
    if (res.ok) {
      setNewTitle("");
      setNewTime("");
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

  const today = todayISO();
  const selectedEvents = eventsByDay.get(selectedDay) ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
          Kalendarz <span className="text-liquid">i terminy</span>
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => changeMonth(-1)} className="rounded-full border hairline px-2.5 py-1 text-xs">←</button>
          <span className="min-w-[140px] text-center text-sm font-medium">{MONTH_NAMES[monthIdx]} {year}</span>
          <button onClick={() => changeMonth(1)} className="rounded-full border hairline px-2.5 py-1 text-xs">→</button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
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
                    isSelected ? "bg-brand-cyan/[0.12] ring-1 ring-brand-cyan/40" : "hover:bg-[var(--hairline)]"
                  }`}
                >
                  <span className={`text-[11px] ${isToday ? "flex h-5 w-5 items-center justify-center rounded-full bg-[var(--fg)] text-[var(--bg)]" : "text-muted"}`}>
                    {Number(day.slice(-2))}
                  </span>
                  {dayEvents.slice(0, 2).map((e) => (
                    <span key={e.id} className="w-full truncate rounded bg-brand-cyan/15 px-1 text-[10px] text-brand-cyan">
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
          <h2 className="mb-3 font-serif text-sm font-semibold">{selectedDay}</h2>
          {selectedEvents.length === 0 ? (
            <p className="mb-3 text-sm text-muted opacity-60">Brak wydarzeń tego dnia.</p>
          ) : (
            <ul className="mb-3 space-y-1.5">
              {selectedEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded-lg border hairline px-2.5 py-1.5 text-sm">
                  <span>
                    {e.godzina && <span className="mr-1.5 text-muted">{e.godzina}</span>}
                    {e.tytul}
                  </span>
                  <button onClick={() => deleteEvent(e.id)} className="text-muted hover:text-red-400" aria-label="Usuń" title="Usuń">✕</button>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2 border-t hairline pt-3">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Nowe wydarzenie…"
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
                className="btn-primary ml-auto rounded-full px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Dodaj
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
