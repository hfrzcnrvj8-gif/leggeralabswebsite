"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { ProjectIcon, formatPlDate, PROJECT_STATUS_HEX, DEFAULT_STATUS_HEX } from "./shared";
import { statusIconEl } from "./ProjectKanban";

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
  kolor: string | null;
  ikona: string | null;
  task_total?: number;
  task_done?: number;
  milestones: TimelineMilestone[];
};

const DAY_MS = 86400000;
const ROW_H = 92; // wysokość wiersza: nazwa nad paskiem + pasek + etykiety kamieni pod
const HEADER_H = 44;
const BAR_TOP = 34; // odległość paska od góry wiersza
const BAR_H = 24;
const LABEL_Y = 66; // pozycja etykiet kamieni (pod paskiem)

type Zoom = "quarter" | "month" | "week";
const MONTH_PX_BY_ZOOM: Record<Zoom, number> = { quarter: 80, month: 150, week: 300 };
const ZOOM_LABEL: Record<Zoom, string> = { quarter: "Kwartał", month: "Miesiąc", week: "Tydzień" };

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(`${s.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}
function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
/** Skrót miesiąca wielkimi literami, BEZ roku — jak w Linear (CZE, LIP, SIE…).
 * Rok dopisujemy tylko przy styczniu (granica roku) i na pierwszym miesiącu osi,
 * żeby było wiadomo, o który rok chodzi, bez zaśmiecania każdej etykiety. */
function fmtMonth(d: Date, showYear: boolean): string {
  const abbr = d.toLocaleDateString("pl-PL", { month: "short" }).replace(".", "").toUpperCase();
  return showYear || d.getMonth() === 0 ? `${abbr} ${d.getFullYear()}` : abbr;
}

function PrioritySignal({ priorytet }: { priorytet: string }) {
  if (priorytet === "Krytyczny") {
    return (
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] bg-orange-500 text-[9px] font-bold leading-none text-white" title="Priorytet: Krytyczny">
        !
      </span>
    );
  }
  const level = priorytet === "Niski" ? 1 : priorytet === "Normalny" ? 2 : priorytet === "Wysoki" ? 3 : 0;
  if (level === 0) return null;
  return (
    <span className="flex shrink-0 items-end gap-[1.5px]" title={`Priorytet: ${priorytet}`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`w-[3px] rounded-[1px] ${i <= level ? "bg-muted opacity-80" : "bg-[var(--hairline)]"}`} style={{ height: `${3 + i * 2}px` }} />
      ))}
    </span>
  );
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
 * Oś czasu 1:1 ze wzorca Linear "Roadmap": nazwa projektu STOI NAD paskiem
 * (przy dacie startu), kamienie milowe to diamenty WEWNĄTRZ paska, a ich nazwy
 * są etykietami POD paskiem. Pasek biegnie od startu do terminu; część po
 * ostatnim kamieniu do końca renderuje się jako jaśniejsza, kreskowana
 * "prognoza". Długość paska wynika z faktycznych dat. Paski i kamienie można
 * przeciągać, żeby zmienić daty (zapis do bazy). Zoom, linia "dziś", auto-scroll.
 */
export function ProjectTimeline({
  lang,
  onOpen,
  onChange,
  filter,
}: {
  lang: Locale;
  onOpen: (id: string) => void;
  onChange?: () => void;
  /** Filtry z paska Projektów — oś respektuje je tak jak roadmapa w Linear. */
  filter?: { status?: string; priority?: string; health?: string };
}) {
  const [projects, setProjects] = useState<TimelineProject[] | null>(null);
  const [deps, setDeps] = useState<{ project_id: string; depends_on_id: string }[]>([]);
  const [zoom, setZoom] = useState<Zoom>("month");
  const [groupBy, setGroupBy] = useState<"none" | "status" | "zdrowie">("none");
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const gridRef = useRef<HTMLDivElement>(null);
  const pxPerDayRef = useRef(1);
  const movedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollInfoRef = useRef({ todayPct: 0, chartPxWidth: 0, hasToday: false });
  const [containerW, setContainerW] = useState(0);

  // Mierzymy szerokość obszaru osi — gdy naturalna szerokość (miesiące×px) jest
  // mniejsza, rozciągamy wykres do pełnej szerokości karty (koniec pustego miejsca).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setContainerW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/projects/timeline");
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      const data = (await res.json()) as { projects: TimelineProject[]; dependencies?: { project_id: string; depends_on_id: string }[] };
      setProjects(data.projects);
      setDeps(data.dependencies ?? []);
    })();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    const info = scrollInfoRef.current;
    if (!el || !info.hasToday) return;
    const todayPx = (info.todayPct / 100) * info.chartPxWidth;
    el.scrollLeft = Math.max(0, todayPx - el.clientWidth / 2);
  }, [projects, zoom]);

  const fStatus = filter?.status ?? "";
  const fPriority = filter?.priority ?? "";
  const fHealth = filter?.health ?? "";
  const { dated, rangeStart, rangeEnd, totalDays, months } = useMemo(() => {
    const list = (projects ?? []).filter(
      (p) => (!fStatus || p.status === fStatus) && (!fPriority || p.priorytet === fPriority) && (!fHealth || p.zdrowie === fHealth)
    );
    const dated: { p: TimelineProject; start: Date; end: Date; estimated: boolean }[] = [];

    for (const p of list) {
      const s = parseDate(p.start);
      const t = parseDate(p.termin);
      const c = parseDate(p.created_at.slice(0, 10)) ?? new Date();
      const estimated = !s && !t;
      let start: Date;
      let end: Date;
      if (s && t) {
        start = s;
        end = t;
      } else if (t && !s) {
        // Tylko termin: pasek od utworzenia projektu do terminu (jeśli sensowne),
        // dzięki czemu długość ODZWIERCIEDLA rzeczywisty horyzont — a nie sztywne
        // 14 dni, przez które wszystkie paski wyglądały identycznie.
        start = c < t ? c : addDays(t, -14);
        end = t;
      } else if (s && !t) {
        // Tylko start: od startu do dziś (jeśli minął) albo +14 dni.
        const today = new Date();
        end = today > s ? today : addDays(s, 14);
        start = s;
      } else {
        start = c;
        end = addDays(c, 14);
      }
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
  }, [projects, fStatus, fPriority, fHealth]);

  const commitDrag = useCallback(
    async (deltaDays: number) => {
      const dg = dragRef.current;
      setDrag(null);
      if (!dg || !movedRef.current || deltaDays === 0) return;
      if (dg.kind === "milestone" && dg.origM && dg.milestoneId) {
        const iso = toLocalISO(addDays(dg.origM, deltaDays));
        setProjects((prev) =>
          prev?.map((p) =>
            p.id === dg.projectId ? { ...p, milestones: p.milestones.map((m) => (m.id === dg.milestoneId ? { ...m, termin: iso } : m)) } : p
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
        await fetch(`/api/projects/${dg.projectId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      onChange?.();
    },
    [onChange]
  );

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const dd = Math.round((e.clientX - drag.startX) / pxPerDayRef.current);
      if (dd !== 0) movedRef.current = true;
      setDrag((d) => (d ? { ...d, deltaDays: dd } : d));
    };
    const onUp = (e: PointerEvent) => commitDrag(Math.round((e.clientX - drag.startX) / pxPerDayRef.current));
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

  if (!projects) return <div className="h-64 animate-pulse rounded-2xl bg-[var(--hairline)]" />;
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
  // Rozciągnij wykres do pełnej szerokości karty, gdy naturalna szerokość jest mniejsza.
  const chartPxWidth = Math.max(months.length * MONTH_PX_BY_ZOOM[zoom], containerW || 480);
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

  // Układ wierszy z opcjonalnym grupowaniem (wg statusu/zdrowia) — nagłówek grupy
  // + projekty pod nim. Liczymy pozycję Y każdego projektu (do krzywych zależności).
  const GROUP_H = 30;
  type Row = { type: "group"; label: string; count: number } | { type: "project"; d: (typeof dated)[number]; y: number; alt: boolean };
  const layoutRows: Row[] = [];
  const posById = new Map<string, { start: Date; end: Date; yCenter: number }>();
  {
    let y = 0;
    let projIdx = 0;
    const addProject = (d: (typeof dated)[number]) => {
      posById.set(d.p.id, { start: d.start, end: d.end, yCenter: y + BAR_TOP + BAR_H / 2 });
      layoutRows.push({ type: "project", d, y, alt: projIdx % 2 === 1 });
      y += ROW_H;
      projIdx += 1;
    };
    if (groupBy === "none") {
      dated.forEach(addProject);
    } else {
      const groups = new Map<string, (typeof dated)[number][]>();
      const order: string[] = [];
      for (const d of dated) {
        const k = groupBy === "status" ? d.p.status : d.p.zdrowie;
        if (!groups.has(k)) {
          groups.set(k, []);
          order.push(k);
        }
        groups.get(k)!.push(d);
      }
      for (const k of order) {
        layoutRows.push({ type: "group", label: k, count: groups.get(k)!.length });
        y += GROUP_H;
        groups.get(k)!.forEach(addProject);
      }
    }
  }
  const bodyHeight = layoutRows.reduce((h, r) => h + (r.type === "group" ? GROUP_H : ROW_H), 0);

  // Krzywe zależności: od KOŃCA paska poprzednika (depends_on) do STARTU następnika.
  const curves = deps
    .map((dep, idx) => {
      const pred = posById.get(dep.depends_on_id);
      const succ = posById.get(dep.project_id);
      if (!pred || !succ) return null;
      const x1 = (pctOf(pred.end) / 100) * chartPxWidth;
      const y1 = pred.yCenter;
      const x2 = (pctOf(succ.start) / 100) * chartPxWidth;
      const y2 = succ.yCenter;
      const cx = Math.max(28, Math.abs(x2 - x1) / 2);
      return { idx, x2, y2, d: `M ${x1} ${y1} C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}` };
    })
    .filter((c): c is { idx: number; x2: number; y2: number; d: string } => c !== null);

  return (
    <div>
      {/* Pasek narzędzi: grupowanie + zoom */}
      <div className="mb-2 flex items-center justify-end gap-2">
        <div className="flex items-center rounded-lg border hairline p-0.5">
          {([
            ["none", "Bez grup"],
            ["status", "Status"],
            ["zdrowie", "Zdrowie"],
          ] as const).map(([g, label]) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`rounded-md px-2.5 py-1 text-[12px] transition-colors ${
                groupBy === g ? "bg-[var(--hairline)] text-[var(--fg)]" : "text-muted hover:text-[var(--fg)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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

      <div className={`card-paper overflow-x-auto rounded-2xl ${drag ? "select-none" : ""}`} ref={scrollRef}>
        <div className="relative" style={{ minWidth: `${chartPxWidth}px` }}>
          {/* Nagłówek osi — jak w Linear: wielkie skróty miesięcy (bez roku),
              pod spodem numerki początków tygodni; wszystko wyszarzone i lekkie. */}
          <div className="sticky top-0 z-30 border-b hairline bg-[var(--bg-soft)]" style={{ height: HEADER_H }}>
            <div className="relative" style={{ height: 26 }}>
              {months.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 whitespace-nowrap px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted"
                  style={{ left: `${pctOf(m)}%` }}
                >
                  {fmtMonth(m, i === 0)}
                </div>
              ))}
            </div>
            <div className="relative" style={{ height: 18 }}>
              {weekTicks.map((w, i) => (
                <span key={i} className="absolute top-0 -translate-x-1/2 text-[9.5px] tabular-nums text-muted opacity-55" style={{ left: `${w.leftPct}%` }}>
                  {w.date.getDate()}
                </span>
              ))}
            </div>
          </div>

          {/* Ciało */}
          <div className="relative" ref={gridRef}>
            {/* Kropkowane pionowe linie tygodni (subtelna siatka jak w Linear) */}
            <div className="pointer-events-none absolute inset-0 z-0">
              {weekTicks.map((w, i) => (
                <div
                  key={i}
                  className={`absolute inset-y-0 border-l border-dashed border-[var(--hairline)] ${monthLines.includes(w.leftPct) ? "opacity-90" : "opacity-45"}`}
                  style={{ left: `${w.leftPct}%` }}
                />
              ))}
            </div>

            {/* Krzywe zależności między projektami (jak w Linear) */}
            {curves.length > 0 && (
              <svg className="pointer-events-none absolute left-0 top-0 z-[1]" width={chartPxWidth} height={bodyHeight} style={{ overflow: "visible" }}>
                {curves.map((c) => (
                  <g key={c.idx}>
                    <path d={c.d} fill="none" stroke="var(--fg-muted)" strokeWidth={1.5} strokeOpacity={0.5} />
                    <circle cx={c.x2} cy={c.y2} r={2.5} fill="var(--fg-muted)" fillOpacity={0.7} />
                  </g>
                ))}
              </svg>
            )}

            {layoutRows.map((row, ri) => {
              if (row.type === "group") {
                return (
                  <div key={`g-${ri}`} className="relative flex items-center gap-2 border-y hairline bg-[var(--hairline)]/[0.18] px-3" style={{ height: GROUP_H }}>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{row.label}</span>
                    <span className="rounded-full bg-[var(--hairline)] px-1.5 text-[10px] text-muted">{row.count}</span>
                  </div>
                );
              }
              const { p, start, end, estimated } = row.d;
              const milestonesWithDates = p.milestones
                .map((m) => ({ id: m.id, nazwa: m.nazwa, date: parseDate(m.termin) }))
                .filter((m): m is { id: string; nazwa: string; date: Date } => m.date !== null);
              // Kolor paska = kolor STATUSU (każdy status ma własną barwę — z daleka
              // widać stan projektu). Obramowanie w kolorze statusu, wypełnienie to
              // delikatny gradient tego koloru. Prognoza czerwienieje po terminie.
              const statusHex = PROJECT_STATUS_HEX[p.status] ?? DEFAULT_STATUS_HEX;
              const barFill = `linear-gradient(180deg, ${statusHex}45 0%, ${statusHex}12 100%)`;
              const tDate = parseDate(p.termin);
              const overdue = !estimated && p.status !== "Wdrożone" && !!tDate && tDate < today;
              const trailBorder = overdue ? "#ef4444" : statusHex;

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
              const startPct = pctOf(dispStart);
              const endPct = pctOf(dispEnd);
              // „Solidna" część do ostatniego kamienia, potem jaśniejsza prognoza.
              let solidEndDate = dispEnd;
              if (milestonesWithDates.length > 0) {
                const last = milestonesWithDates.reduce((mx, m) => (m.date > mx ? m.date : mx), milestonesWithDates[0].date);
                const clamped = last < dispStart ? dispStart : last > dispEnd ? dispEnd : last;
                if (clamped < dispEnd) solidEndDate = clamped;
              }
              const solidEndPct = pctOf(solidEndDate);
              const hasTrail = !estimated && solidEndPct < endPct - 0.2;

              return (
                <div key={p.id} className={`group relative ${row.alt ? "bg-[var(--hairline)]/[0.06]" : ""}`} style={{ height: ROW_H }}>
                  {/* NAZWA NAD PASKIEM — przy dacie startu */}
                  <button
                    onClick={() => {
                      if (!movedRef.current) onOpen(p.id);
                    }}
                    className="absolute z-20 flex items-center gap-1.5 whitespace-nowrap px-1 text-left text-[13px] hover:underline"
                    style={{ left: `${startPct}%`, top: 4 }}
                    title={p.tytul}
                  >
                    <ProjectIcon kolor={p.kolor} ikona={p.ikona} size={16} />
                    <span className="font-medium text-[var(--fg)]">{p.tytul}</span>
                    {/* Ikona statusu — zmienia się przy zmianie statusu (Pomysł/W trakcie/…) */}
                    <span className="shrink-0" title={`Status: ${p.status}`}>{statusIconEl(p.status, 14)}</span>
                    <PrioritySignal priorytet={p.priorytet} />
                  </button>

                  {/* PASEK (solidna część) — ciało przeciąga, krawędzie zmieniają start/termin */}
                  <div
                    className={`absolute rounded-md border ${estimated ? "border-dashed opacity-80" : ""} ${
                      dg ? "ring-1 ring-[#4ea7fc]/60" : ""
                    }`}
                    style={{ left: `${startPct}%`, width: `${Math.max((hasTrail ? solidEndPct : endPct) - startPct, 0.4)}%`, top: BAR_TOP, height: BAR_H, minWidth: 10, background: barFill, borderColor: statusHex }}
                    title={
                      estimated
                        ? `${p.tytul} · daty orientacyjne — przeciągnij, aby ustawić`
                        : `${p.tytul} · ${formatPlDate(toLocalISO(dispStart))} – ${formatPlDate(toLocalISO(dispEnd))}`
                    }
                  >
                    {/* Wypełnienie postępu (ukończone zadania) — jak w Linear */}
                    {(p.task_total ?? 0) > 0 && (
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 rounded-md"
                        style={{ width: `${((p.task_done ?? 0) / (p.task_total ?? 1)) * 100}%`, backgroundColor: statusHex, opacity: 0.4 }}
                        title={`${p.task_done}/${p.task_total} zadań`}
                      />
                    )}
                    <button onPointerDown={(e) => beginDrag(e, "move", p.id, start, end)} onClick={() => { if (!movedRef.current) onOpen(p.id); }} className="absolute inset-0 cursor-grab rounded-md active:cursor-grabbing" aria-label={`Przesuń ${p.tytul}`} />
                    <div onPointerDown={(e) => beginDrag(e, "start", p.id, start, end)} className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize rounded-l-md hover:bg-white/25" title="Zmień start" />
                    {!hasTrail && <div onPointerDown={(e) => beginDrag(e, "end", p.id, start, end)} className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize rounded-r-md hover:bg-white/25" title="Zmień termin" />}
                  </div>

                  {/* PROGNOZA (po ostatnim kamieniu do terminu) — jaśniejsza, kreskowana */}
                  {hasTrail && (
                    <div
                      className="absolute rounded-r-md border border-l-0 border-dashed bg-white/[0.03]"
                      style={{ left: `${solidEndPct}%`, width: `${Math.max(endPct - solidEndPct, 0.4)}%`, top: BAR_TOP, height: BAR_H, borderColor: `${trailBorder}80` }}
                      title={`${p.tytul} · prognoza do ${formatPlDate(toLocalISO(dispEnd))}`}
                    >
                      <div onPointerDown={(e) => beginDrag(e, "end", p.id, start, end)} className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize rounded-r-md hover:bg-white/25" title="Zmień termin" />
                    </div>
                  )}

                  {/* KAMIENIE MILOWE — diamenty WEWNĄTRZ paska + etykiety POD paskiem */}
                  {milestonesWithDates.map((m) => {
                    const mDate = dg && dg.kind === "milestone" && dg.milestoneId === m.id ? addDays(m.date, dg.deltaDays) : m.date;
                    const mp = pctOf(mDate);
                    return (
                      <div key={m.id}>
                        <div
                          onPointerDown={(e) => beginDrag(e, "milestone", p.id, start, end, { milestoneId: m.id, origM: m.date })}
                          className="absolute z-30 flex h-5 w-5 -translate-x-1/2 cursor-grab items-center justify-center active:cursor-grabbing"
                          style={{ left: `${mp}%`, top: BAR_TOP + BAR_H / 2 - 10 }}
                          title={`${m.nazwa} — ${formatPlDate(toLocalISO(mDate))} (przeciągnij)`}
                        >
                          <div className="h-3 w-3 rotate-45 border-2 bg-[var(--bg-soft)]" style={{ borderColor: statusHex }} />
                        </div>
                        {zoom !== "quarter" && (
                          <span
                            className="pointer-events-none absolute z-20 max-w-[130px] -translate-x-1/2 truncate text-[10px] leading-none text-muted"
                            style={{ left: `${mp}%`, top: LABEL_Y }}
                          >
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

          {/* Linia „dziś" — przez cały obszar */}
          {todayPct !== null && (
            <div className="pointer-events-none absolute inset-y-0 z-40 w-px -translate-x-1/2 bg-[#4ea7fc]" style={{ left: `${todayPct}%` }}>
              <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-md bg-[#4ea7fc] px-1.5 py-0.5 text-[9px] font-semibold text-white shadow">dziś</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
