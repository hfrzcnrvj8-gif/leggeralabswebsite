"use client";

import { useEffect, useMemo, useState } from "react";
import { IconFolder } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { PROJECT_STATUS_DOT, formatPlDate } from "./shared";

type TimelineMilestone = { id: string; nazwa: string; termin: string | null };
type TimelineProject = {
  id: string;
  tytul: string;
  status: string;
  zdrowie: string;
  priorytet: string;
  start: string | null;
  termin: string | null;
  created_at: string;
  milestones: TimelineMilestone[];
};

const DAY_MS = 86400000;
const LEFT_W = 224; // szerokość lewej kolumny z nazwami projektów
const ROW_H = 52; // wysokość wiersza — gęsto, jak w Linear/GitHub Roadmap
const HEADER_H = 44; // nagłówek: pasek miesięcy (28) + pasek numerków tygodni (16)
const MONTH_PX = 128; // minimalna szerokość miesiąca w prawym (przewijalnym) obszarze

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/** YYYY-MM-DD z lokalnej daty — nie przez toISOString(), bo to konwertuje
 * na UTC i przy dodatnich strefach (Polska) potrafi zjechać o dzień wstecz. */
function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString("pl-PL", { month: "short", year: "numeric" });
}

/** Malutki wskaźnik priorytetu — "słupki sygnału" jak w Linear (im więcej
 * wypełnionych, tym wyższy), a dla "Krytyczny" płaska pomarańczowa plakietka. */
function PrioritySignal({ priorytet }: { priorytet: string }) {
  if (priorytet === "Krytyczny") {
    return (
      <span
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] bg-orange-500 text-[9px] font-bold leading-none text-white"
        title="Priorytet: Krytyczny"
      >
        !
      </span>
    );
  }
  const level = priorytet === "Niski" ? 1 : priorytet === "Normalny" ? 2 : priorytet === "Wysoki" ? 3 : 0;
  if (level === 0) return null;
  return (
    <span className="flex shrink-0 items-end gap-[1.5px]" title={`Priorytet: ${priorytet}`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`w-[3px] rounded-[1px] ${i <= level ? "bg-muted opacity-80" : "bg-[var(--hairline)]"}`}
          style={{ height: `${3 + i * 2}px` }}
        />
      ))}
    </span>
  );
}

/** Kolory paska/diamentu wg "zdrowia" projektu (Na dobrej drodze/Zagrożony/
 * Zerwany) — wyraźne, nie wyblakłe, ale nadal spójne z ciemną paletą panelu. */
function healthColors(zdrowie: string): { bar: string; diamond: string } {
  if (zdrowie === "Zerwany") return { bar: "bg-red-500/25 border-red-500/70", diamond: "border-red-400" };
  if (zdrowie === "Zagrożony") return { bar: "bg-orange-500/25 border-orange-500/70", diamond: "border-orange-400" };
  return { bar: "bg-[#4ea7fc]/25 border-[#4ea7fc]/70", diamond: "border-[#4ea7fc]" };
}

/**
 * Oś czasu (Gantt-lite w stylu Linear Roadmap / GitHub Projects / Notion):
 * stała lewa kolumna z nazwami projektów (ikona statusu, tytuł, priorytet) i
 * prawy, przewijalny w poziomie obszar z paskami. Pasek biegnie od startu do
 * terminu; kamienie milowe to diamenty na pasku; projekty bez ustawionych dat
 * dostają orientacyjny, przerywany pasek. Pionowa linia „dziś" nie koliduje z
 * niczym, bo tytuły są w lewej kolumnie, nie nad paskami.
 */
export function ProjectTimeline({ lang, onOpen }: { lang: Locale; onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<TimelineProject[] | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/projects/timeline");
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      const data = (await res.json()) as { projects: TimelineProject[] };
      setProjects(data.projects);
    })();
  }, []);

  const { dated, rangeStart, rangeEnd, totalDays, months } = useMemo(() => {
    const list = projects ?? [];
    const dated: { p: TimelineProject; start: Date; end: Date; estimated: boolean }[] = [];

    for (const p of list) {
      const s = parseDate(p.start);
      const t = parseDate(p.termin);
      const c = parseDate(p.created_at.slice(0, 10)) ?? new Date();
      const estimated = !s && !t;
      const start = s ?? (t ? addDays(t, -14) : c);
      const end = t ?? (s ? addDays(s, 14) : addDays(c, 14));
      dated.push({ p, start: start <= end ? start : end, end: start <= end ? end : start, estimated });
    }

    if (dated.length === 0) {
      return { dated, rangeStart: new Date(), rangeEnd: new Date(), totalDays: 1, months: [] as Date[] };
    }

    let minD = dated[0].start;
    let maxD = dated[0].end;
    for (const { start, end } of dated) {
      if (start < minD) minD = start;
      if (end > maxD) maxD = end;
    }
    const rangeStart = startOfMonth(addDays(minD, -7));
    const rangeEndRaw = addDays(maxD, 14);
    const rangeEnd = new Date(rangeEndRaw.getFullYear(), rangeEndRaw.getMonth() + 1, 1);
    const totalDays = Math.max(daysBetween(rangeStart, rangeEnd), 1);

    const months: Date[] = [];
    let cursor = rangeStart;
    while (cursor < rangeEnd) {
      months.push(cursor);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    return { dated, rangeStart, rangeEnd, totalDays, months };
  }, [projects]);

  if (!projects) {
    return <div className="h-64 animate-pulse rounded-2xl bg-[var(--hairline)]" />;
  }

  if (dated.length === 0) {
    return (
      <div className="card-paper rounded-2xl p-8 text-center text-sm text-muted">
        Brak projektów do pokazania — dodaj pierwszy projekt, żeby zobaczyć oś czasu.
      </div>
    );
  }

  const today = new Date();
  const todayPct = today >= rangeStart && today <= rangeEnd ? (daysBetween(rangeStart, today) / totalDays) * 100 : null;
  const pctOf = (d: Date) => Math.max(0, Math.min((daysBetween(rangeStart, d) / totalDays) * 100, 100));
  const chartPxWidth = Math.max(months.length * MONTH_PX, 360);

  // Numerki dni na początku każdego tygodnia (5, 12, 19…) jako punkty odniesienia.
  const weekTicks: { date: Date; leftPct: number }[] = [];
  {
    let cursor = rangeStart;
    while (cursor < rangeEnd) {
      weekTicks.push({ date: cursor, leftPct: pctOf(cursor) });
      cursor = addDays(cursor, 7);
    }
  }

  // Linie siatki na granicach miesięcy (bez pierwszej — to lewa krawędź obszaru).
  const monthLines = months.map((m) => pctOf(m)).filter((pct) => pct > 0.01);

  return (
    <div className="card-paper flex overflow-hidden rounded-2xl">
      {/* LEWA KOLUMNA — nazwy projektów (stała, nie przewija się w poziomie) */}
      <div className="shrink-0 border-r hairline bg-[var(--bg-soft)]" style={{ width: LEFT_W }}>
        <div className="border-b hairline" style={{ height: HEADER_H }} />
        {dated.map(({ p }, i) => (
          <button
            key={p.id}
            onClick={() => onOpen(p.id)}
            className={`flex w-full items-center gap-2 border-b hairline px-3 text-left transition-colors hover:bg-[var(--hairline)]/50 ${
              i % 2 === 1 ? "bg-[var(--hairline)]/10" : ""
            }`}
            style={{ height: ROW_H }}
            title={p.tytul}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] text-white ${
                PROJECT_STATUS_DOT[p.status] ?? "bg-[var(--fg-muted)]"
              }`}
            >
              <IconFolder size={11} stroke={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-[var(--fg)]">{p.tytul}</span>
              <span className="block truncate text-[11px] text-muted">{p.status}</span>
            </span>
            <PrioritySignal priorytet={p.priorytet} />
          </button>
        ))}
      </div>

      {/* PRAWY OBSZAR — przewijalna siatka z paskami */}
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="relative" style={{ minWidth: `${chartPxWidth}px` }}>
          {/* Nagłówek: miesiące + numerki tygodni */}
          <div className="border-b hairline" style={{ height: HEADER_H }}>
            <div className="flex" style={{ height: 28 }}>
              {months.map((m, i) => (
                <div
                  key={i}
                  className={`shrink-0 px-2 py-1.5 text-[11px] font-semibold capitalize text-[var(--fg)] ${
                    i > 0 ? "border-l hairline" : ""
                  }`}
                  style={{ width: `${(1 / months.length) * 100}%` }}
                >
                  {fmtMonth(m)}
                </div>
              ))}
            </div>
            <div className="relative" style={{ height: 16 }}>
              {weekTicks.map((w, i) => (
                <span
                  key={i}
                  className="absolute top-0 -translate-x-1/2 text-[9px] text-muted opacity-60"
                  style={{ left: `${w.leftPct}%` }}
                >
                  {w.date.getDate()}
                </span>
              ))}
            </div>
          </div>

          {/* Ciało: linie siatki miesięcy + wiersze z paskami */}
          <div className="relative">
            {/* Pionowe linie siatki na granicach miesięcy */}
            <div className="pointer-events-none absolute inset-0 z-0">
              {monthLines.map((pct, i) => (
                <div key={i} className="absolute inset-y-0 w-px bg-[var(--hairline)]" style={{ left: `${pct}%` }} />
              ))}
            </div>

            {dated.map(({ p, start, end, estimated }, rowIdx) => {
              const milestonesWithDates = p.milestones
                .map((m) => ({ id: m.id, nazwa: m.nazwa, date: parseDate(m.termin) }))
                .filter((m): m is { id: string; nazwa: string; date: Date } => m.date !== null);
              const { bar, diamond } = healthColors(p.zdrowie);
              const barLeft = pctOf(start);
              const barWidth = Math.max(pctOf(end) - barLeft, 0.5);

              return (
                <div
                  key={p.id}
                  className={`group relative border-b hairline ${rowIdx % 2 === 1 ? "bg-[var(--hairline)]/10" : ""}`}
                  style={{ height: ROW_H }}
                >
                  {/* Pasek projektu (start → termin) */}
                  <button
                    onClick={() => onOpen(p.id)}
                    className={`absolute top-1/2 z-10 h-6 -translate-y-1/2 rounded-md border transition-colors hover:brightness-125 ${bar} ${
                      estimated ? "border-dashed opacity-80" : ""
                    }`}
                    style={{ left: `${barLeft}%`, width: `${barWidth}%`, minWidth: "10px" }}
                    title={
                      estimated
                        ? `${p.tytul} · daty orientacyjne (brak ustawionych)`
                        : `${p.tytul} · ${formatPlDate(toLocalISO(start))} – ${formatPlDate(toLocalISO(end))}`
                    }
                  />

                  {/* Kamienie milowe — diamenty na pasku */}
                  {milestonesWithDates.map((m) => (
                    <div
                      key={m.id}
                      className={`pointer-events-none absolute top-1/2 z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 bg-[var(--bg-soft)] ${diamond}`}
                      style={{ left: `${pctOf(m.date)}%` }}
                      title={`${m.nazwa} — ${formatPlDate(toLocalISO(m.date))}`}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Pionowa linia „dziś" — przez cały prawy obszar (nagłówek + wiersze) */}
          {todayPct !== null && (
            <div className="pointer-events-none absolute inset-y-0 z-30 w-px -translate-x-1/2 bg-[#4ea7fc]" style={{ left: `${todayPct}%` }}>
              <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-md bg-[#4ea7fc] px-1.5 py-0.5 text-[9px] font-semibold text-white shadow">
                dziś
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
