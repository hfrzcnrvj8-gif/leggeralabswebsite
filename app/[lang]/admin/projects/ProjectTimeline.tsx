"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type Zoom = "quarter" | "month" | "week";
// Szerokość miesiąca w px wg poziomu zoomu — kwartał (przegląd), miesiąc
// (domyślny), tydzień (szczegół dzienny). Więcej px = bardziej rozciągnięta oś.
const MONTH_PX_BY_ZOOM: Record<Zoom, number> = { quarter: 72, month: 128, week: 264 };
const ZOOM_LABEL: Record<Zoom, string> = { quarter: "Kwartał", month: "Miesiąc", week: "Tydzień" };

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

/** Kolory paska/diamentu wg "zdrowia" projektu — wyraźne, nie wyblakłe. */
function healthColors(zdrowie: string): { bar: string; diamond: string } {
  if (zdrowie === "Zerwany") return { bar: "bg-red-500/25 border-red-500/70", diamond: "border-red-400" };
  if (zdrowie === "Zagrożony") return { bar: "bg-orange-500/25 border-orange-500/70", diamond: "border-orange-400" };
  return { bar: "bg-[#4ea7fc]/25 border-[#4ea7fc]/70", diamond: "border-[#4ea7fc]" };
}

type DragState = {
  kind: "move" | "start" | "end" | "milestone";
  projectId: string;
  milestoneId?: string;
  startX: number;
  origStart: Date;
  origEnd: Date;
  origM?: Date;
  deltaDays: number;
};

/**
 * Oś czasu (Gantt-lite w stylu Linear Roadmap / GitHub Projects / Notion):
 * stała lewa kolumna z nazwami projektów i prawy, przewijalny obszar z paskami.
 * Paski i kamienie milowe można PRZECIĄGAĆ, żeby zmienić daty: ciało paska
 * przesuwa cały projekt, lewa/prawa krawędź zmienia start/termin, a diament —
 * termin danego kamienia. Zmiana zapisuje się do bazy po puszczeniu.
 */
export function ProjectTimeline({
  lang,
  onOpen,
  onChange,
}: {
  lang: Locale;
  onOpen: (id: string) => void;
  onChange?: () => void;
}) {
  const [projects, setProjects] = useState<TimelineProject[] | null>(null);
  const [zoom, setZoom] = useState<Zoom>("month");
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const gridRef = useRef<HTMLDivElement>(null);
  const pxPerDayRef = useRef(1);
  const movedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollInfoRef = useRef({ todayPct: 0, chartPxWidth: 0, hasToday: false });

  // Auto-przewinięcie prawego obszaru tak, by „dziś" było na środku — przy
  // pierwszym załadowaniu i po zmianie zoomu. Bez tego oś startuje od lewej
  // krawędzi (przeszłość), a najważniejsze jest to, co dzieje się teraz.
  useEffect(() => {
    const el = scrollRef.current;
    const info = scrollInfoRef.current;
    if (!el || !info.hasToday) return;
    const todayPx = (info.todayPct / 100) * info.chartPxWidth;
    el.scrollLeft = Math.max(0, todayPx - el.clientWidth / 2);
  }, [projects, zoom]);

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

  // Zapis po puszczeniu przeciąganego paska/diamentu (optymistycznie w stanie
  // lokalnym + PATCH do bazy). Bez ruchu (klik) nic nie zapisujemy.
  const commitDrag = useCallback(
    async (deltaDays: number) => {
      const dg = dragRef.current;
      setDrag(null);
      if (!dg || !movedRef.current || deltaDays === 0) return;

      if (dg.kind === "milestone" && dg.origM && dg.milestoneId) {
        const iso = toLocalISO(addDays(dg.origM, deltaDays));
        setProjects((prev) =>
          prev?.map((p) =>
            p.id === dg.projectId
              ? { ...p, milestones: p.milestones.map((m) => (m.id === dg.milestoneId ? { ...m, termin: iso } : m)) }
              : p
          ) ?? prev
        );
        await fetch(`/api/projects/${dg.projectId}/milestones/${dg.milestoneId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ termin: iso }),
        });
      } else {
        let ns = dg.origStart;
        let ne = dg.origEnd;
        if (dg.kind === "move") {
          ns = addDays(dg.origStart, deltaDays);
          ne = addDays(dg.origEnd, deltaDays);
        } else if (dg.kind === "start") {
          ns = addDays(dg.origStart, deltaDays);
          if (ns > ne) ns = ne;
        } else if (dg.kind === "end") {
          ne = addDays(dg.origEnd, deltaDays);
          if (ne < ns) ne = ns;
        }
        const sIso = toLocalISO(ns);
        const tIso = toLocalISO(ne);
        setProjects((prev) => prev?.map((p) => (p.id === dg.projectId ? { ...p, start: sIso, termin: tIso } : p)) ?? prev);
        const body: Record<string, string> = {};
        if (dg.kind === "move" || dg.kind === "start") body.start = sIso;
        if (dg.kind === "move" || dg.kind === "end") body.termin = tIso;
        await fetch(`/api/projects/${dg.projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      onChange?.();
    },
    [onChange]
  );

  // Globalne nasłuchy na czas przeciągania (klawisz myszy trzymany poza paskiem).
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const dd = Math.round((e.clientX - drag.startX) / pxPerDayRef.current);
      if (dd !== 0) movedRef.current = true;
      setDrag((d) => (d ? { ...d, deltaDays: dd } : d));
    };
    const onUp = (e: PointerEvent) => {
      const dd = Math.round((e.clientX - drag.startX) / pxPerDayRef.current);
      commitDrag(dd);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.projectId, drag?.kind, drag?.milestoneId, drag?.startX, commitDrag]);

  const beginDrag = (
    e: React.PointerEvent,
    kind: DragState["kind"],
    projectId: string,
    origStart: Date,
    origEnd: Date,
    extra?: { milestoneId: string; origM: Date }
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const w = gridRef.current?.getBoundingClientRect().width ?? 1;
    pxPerDayRef.current = w / totalDays;
    movedRef.current = false;
    setDrag({ kind, projectId, startX: e.clientX, origStart, origEnd, deltaDays: 0, ...(extra ?? {}) });
  };

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
  const chartPxWidth = Math.max(months.length * MONTH_PX_BY_ZOOM[zoom], 360);
  // Zapamiętaj dane potrzebne do auto-przewinięcia (odczytywane w efekcie po renderze).
  scrollInfoRef.current = { todayPct: todayPct ?? 0, chartPxWidth, hasToday: todayPct !== null };

  const weekTicks: { date: Date; leftPct: number }[] = [];
  {
    let cursor = rangeStart;
    while (cursor < rangeEnd) {
      weekTicks.push({ date: cursor, leftPct: pctOf(cursor) });
      cursor = addDays(cursor, 7);
    }
  }

  const monthLines = months.map((m) => pctOf(m)).filter((pct) => pct > 0.01);

  return (
    <div>
      {/* Pasek narzędzi osi: przełącznik zoomu (Kwartał / Miesiąc / Tydzień) */}
      <div className="mb-2 flex items-center justify-end gap-2">
        <div className="flex items-center rounded-lg border hairline p-0.5">
          {(["quarter", "month", "week"] as Zoom[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`rounded-md px-2.5 py-1 text-[12px] transition-colors ${
                zoom === z ? "bg-[var(--hairline)] text-[var(--fg)]" : "text-muted hover:text-[var(--fg)]"
              }`}
            >
              {ZOOM_LABEL[z]}
            </button>
          ))}
        </div>
      </div>

      <div className={`card-paper flex overflow-hidden rounded-2xl ${drag ? "select-none" : ""}`}>
      {/* LEWA KOLUMNA — nazwy projektów (stała) */}
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
      <div className="min-w-0 flex-1 overflow-x-auto" ref={scrollRef}>
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

          {/* Ciało: siatka miesięcy + wiersze z paskami (ref do pomiaru szerokości w px) */}
          <div className="relative" ref={gridRef}>
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

              // Pozycja z uwzględnieniem trwającego przeciągania tego projektu.
              const dg = drag && drag.projectId === p.id ? drag : null;
              let dispStart = start;
              let dispEnd = end;
              if (dg) {
                if (dg.kind === "move") {
                  dispStart = addDays(start, dg.deltaDays);
                  dispEnd = addDays(end, dg.deltaDays);
                } else if (dg.kind === "start") {
                  dispStart = addDays(start, dg.deltaDays);
                  if (dispStart > dispEnd) dispStart = dispEnd;
                } else if (dg.kind === "end") {
                  dispEnd = addDays(end, dg.deltaDays);
                  if (dispEnd < dispStart) dispEnd = dispStart;
                }
              }
              const barLeft = pctOf(dispStart);
              const barWidth = Math.max(pctOf(dispEnd) - barLeft, 0.5);
              const dragging = !!dg;

              return (
                <div
                  key={p.id}
                  className={`group relative border-b hairline ${rowIdx % 2 === 1 ? "bg-[var(--hairline)]/10" : ""}`}
                  style={{ height: ROW_H }}
                >
                  {/* Pasek projektu — ciało przesuwa, krawędzie zmieniają start/termin */}
                  <div
                    className={`absolute top-1/2 z-10 h-6 -translate-y-1/2 rounded-md border ${bar} ${
                      estimated ? "border-dashed opacity-80" : ""
                    } ${dragging ? "brightness-125 ring-1 ring-[#4ea7fc]/60" : ""}`}
                    style={{ left: `${barLeft}%`, width: `${barWidth}%`, minWidth: "10px" }}
                    title={
                      estimated
                        ? `${p.tytul} · daty orientacyjne — przeciągnij, aby ustawić`
                        : `${p.tytul} · ${formatPlDate(toLocalISO(dispStart))} – ${formatPlDate(toLocalISO(dispEnd))}`
                    }
                  >
                    {/* Ciało paska (przeciąganie = przesunięcie całości; klik = otwórz) */}
                    <button
                      onPointerDown={(e) => beginDrag(e, "move", p.id, start, end)}
                      onClick={() => {
                        if (!movedRef.current) onOpen(p.id);
                      }}
                      className="absolute inset-0 cursor-grab rounded-md active:cursor-grabbing"
                      aria-label={`Przesuń ${p.tytul}`}
                    />
                    {/* Uchwyt lewej krawędzi — zmiana startu */}
                    <div
                      onPointerDown={(e) => beginDrag(e, "start", p.id, start, end)}
                      className="absolute inset-y-0 left-0 z-20 w-2 cursor-ew-resize rounded-l-md hover:bg-white/25"
                      title="Przeciągnij, aby zmienić start"
                    />
                    {/* Uchwyt prawej krawędzi — zmiana terminu */}
                    <div
                      onPointerDown={(e) => beginDrag(e, "end", p.id, start, end)}
                      className="absolute inset-y-0 right-0 z-20 w-2 cursor-ew-resize rounded-r-md hover:bg-white/25"
                      title="Przeciągnij, aby zmienić termin"
                    />
                  </div>

                  {/* Kamienie milowe — diamenty na pasku (przeciągalne) */}
                  {milestonesWithDates.map((m) => {
                    const mDate =
                      dg && dg.kind === "milestone" && dg.milestoneId === m.id ? addDays(m.date, dg.deltaDays) : m.date;
                    return (
                      <div
                        key={m.id}
                        onPointerDown={(e) => beginDrag(e, "milestone", p.id, start, end, { milestoneId: m.id, origM: m.date })}
                        className={`absolute top-1/2 z-30 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center active:cursor-grabbing`}
                        style={{ left: `${pctOf(mDate)}%` }}
                        title={`${m.nazwa} — ${formatPlDate(toLocalISO(mDate))} (przeciągnij, aby zmienić)`}
                      >
                        <div className={`h-3 w-3 rotate-45 border-2 bg-[var(--bg-soft)] ${diamond}`} />
                        {zoom !== "quarter" && (
                          <span className="pointer-events-none absolute left-1/2 top-full mt-px max-w-[130px] -translate-x-1/2 truncate text-[9px] leading-none text-muted">
                            {m.nazwa}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Pionowa linia „dziś" — przez cały prawy obszar */}
          {todayPct !== null && (
            <div className="pointer-events-none absolute inset-y-0 z-40 w-px -translate-x-1/2 bg-[#4ea7fc]" style={{ left: `${todayPct}%` }}>
              <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-md bg-[#4ea7fc] px-1.5 py-0.5 text-[9px] font-semibold text-white shadow">
                dziś
              </span>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
