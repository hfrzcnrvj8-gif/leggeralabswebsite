"use client";

import { useEffect, useMemo, useState } from "react";
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
const ROW_PX = 108;
const MONTH_PX = 128;

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
 * na UTC i przy dodatnich strefach (Polska) potrafi zjechać o dzień wstecz
 * dla dat parsowanych jako lokalna północ. */
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

/** Malutki wskaźnik priorytetu obok tytułu projektu — "słupki sygnału" jak
 * w Linear (im więcej wypełnionych, tym wyższy priorytet), a dla
 * "Krytyczny" płaska pomarańczowa plakietka z wykrzyknikiem zamiast słupków
 * (tak jak Linear pokazuje Urgent inaczej niż resztę skali). */
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

type Segment = { left: Date; right: Date; label: string | null; trailing: boolean; milestoneId: string | null };

/** Dzieli pasek projektu na odcinki wyznaczone kamieniami milowymi — każdy
 * odcinek kończy się datą kamienia i nosi jego nazwę jako etykietę (styl
 * Linear: "Core screens" / "Polish" pod paskiem, na stałe widoczne, nie
 * tylko po najechaniu). Odcinek po ostatnim kamieniu do końca paska nie ma
 * etykiety i renderuje się jako skośnie kreskowany "ogon" — praca
 * jeszcze nierozbita na kamienie milowe, więc z natury mniej pewna. */
function buildSegments(
  start: Date,
  end: Date,
  milestones: { id: string; nazwa: string; date: Date }[]
): Segment[] {
  const sorted = [...milestones].sort((a, b) => a.date.getTime() - b.date.getTime());
  const segments: Segment[] = [];
  let cursor = start;
  for (const m of sorted) {
    const md = m.date < start ? start : m.date > end ? end : m.date;
    if (md > cursor) {
      segments.push({ left: cursor, right: md, label: m.nazwa, trailing: false, milestoneId: m.id });
      cursor = md;
    }
  }
  if (cursor < end) {
    segments.push({ left: cursor, right: end, label: null, trailing: true, milestoneId: null });
  }
  if (segments.length === 0) {
    segments.push({ left: start, right: end, label: null, trailing: false, milestoneId: null });
  }
  return segments;
}

/** Widok osi czasu (Gantt-lite, 1:1 ze wzorca "Roadmap" z Linear) — pasek
 * projektu dzieli się na odcinki wyznaczone kamieniami milowymi, każdy z
 * etykietą na stałe widoczną pod spodem; odcinek po ostatnim kamieniu do
 * końca to kreskowana "prognoza". Paski są stonowane (obrys + delikatne
 * tło, nie jaskrawy gradient) i mają mały promień zaokrąglenia, nie pełną
 * pigułkę — tak jak w oryginale. Projekty bez ręcznie ustawionych dat
 * dostają orientacyjny, przerywany pasek liczony od daty utworzenia — oś
 * nigdy nie jest pusta. */
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
        🗺️ Brak projektów do pokazania — dodaj pierwszy projekt, żeby zobaczyć oś czasu.
      </div>
    );
  }

  const today = new Date();
  const todayPct = today >= rangeStart && today <= rangeEnd ? (daysBetween(rangeStart, today) / totalDays) * 100 : null;
  const pctOf = (d: Date) => Math.max(0, Math.min((daysBetween(rangeStart, d) / totalDays) * 100, 100));

  const chartPxWidth = Math.max(months.length * MONTH_PX, 420);

  // Numerki dni na początku każdego tygodnia (5, 12, 19…) — konkretne punkty
  // odniesienia na osi, bez rysowania pełnowysokościowych linii siatki.
  const weekTicks: { date: Date; leftPct: number }[] = [];
  {
    let cursor = rangeStart;
    while (cursor < rangeEnd) {
      weekTicks.push({ date: cursor, leftPct: pctOf(cursor) });
      cursor = addDays(cursor, 7);
    }
  }

  return (
    <div className="card-paper overflow-x-auto rounded-2xl p-3 sm:p-4">
      <div style={{ minWidth: `${chartPxWidth}px` }}>
        {/* Nagłówek: miesiące + numerki tygodni + cykle — pełna szerokość,
            bez lewej kolumny na tytuły (te stoją nad paskami, jak w Linear). */}
        <div>
          <div className="relative border-b hairline">
            <div className="flex">
              {months.map((m, i) => (
                <div
                  key={i}
                  className="shrink-0 border-l hairline px-2 py-1.5 text-[11px] font-semibold capitalize text-[var(--fg)]"
                  style={{ width: `${(1 / months.length) * 100}%` }}
                >
                  {fmtMonth(m)}
                </div>
              ))}
            </div>
          </div>
          <div className="relative h-4 border-b hairline">
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

        {/* Wiersze projektów — tytuł stoi nad paskiem, na tej samej pozycji
            osi co data startu (nie w stałej kolumnie po lewej). */}
        <div className="relative mt-2">
          <div className="relative z-10">
            {dated.map(({ p, start, end, estimated }, rowIdx) => {
              const milestonesWithDates = p.milestones
                .map((m) => ({ id: m.id, nazwa: m.nazwa, date: parseDate(m.termin) }))
                .filter((m): m is { id: string; nazwa: string; date: Date } => m.date !== null);
              const segments = estimated ? [] : buildSegments(start, end, milestonesWithDates);
              // Stonowany wypełnienie + obrys, nie jaskrawy gradient — tak jak
              // paski w Linear (delikatny kolor, nie krzyczący).
              const healthClass =
                p.zdrowie === "Zerwany"
                  ? "bg-red-500/20 border-red-500/60"
                  : p.zdrowie === "Zagrożony"
                  ? "bg-orange-500/20 border-orange-500/60"
                  : "bg-[var(--fg)]/15 border-[var(--fg)]/40";
              const diamondBorderClass =
                p.zdrowie === "Zerwany" ? "border-red-500" : p.zdrowie === "Zagrożony" ? "border-orange-500" : "border-[var(--fg)]/50";
              const startPct = pctOf(start);

              return (
                <div
                  key={p.id}
                  className={`group relative rounded-lg transition-colors hover:bg-[var(--hairline)]/40 ${
                    rowIdx % 2 === 1 ? "bg-[var(--hairline)]/10" : ""
                  }`}
                  style={{ height: `${ROW_PX}px` }}
                >
                  <button
                    onClick={() => onOpen(p.id)}
                    className="absolute top-0 z-20 flex items-center gap-1.5 whitespace-nowrap px-1 text-left text-xs hover:underline"
                    style={{ left: `${startPct}%` }}
                    title={p.tytul}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] text-[9px] ${PROJECT_STATUS_DOT[p.status] ?? "bg-[var(--fg-muted)]"}`}
                    >
                      🗂️
                    </span>
                    <span className="font-medium">{p.tytul}</span>
                    <PrioritySignal priorytet={p.priorytet} />
                  </button>

                  {estimated ? (
                    <button
                      onClick={() => onOpen(p.id)}
                      className={`absolute top-6 h-5 overflow-hidden rounded-[4px] border border-dashed px-2 text-left transition-colors hover:bg-[var(--fg)]/20 ${healthClass}`}
                      style={{ left: `${pctOf(start)}%`, width: `${Math.max(pctOf(end) - pctOf(start), 1.5)}%`, minWidth: "10px" }}
                      title={`${p.tytul} · daty orientacyjne (brak ustawionych)`}
                    />
                  ) : (
                    segments.map((seg, i) => {
                      const segLeft = pctOf(seg.left);
                      const segWidth = Math.max(pctOf(seg.right) - segLeft, 0.4);
                      const isFirst = i === 0;
                      const isLast = i === segments.length - 1;
                      return (
                        <div key={i}>
                          <button
                            onClick={() => onOpen(p.id)}
                            className={`absolute top-6 h-5 overflow-hidden border-y border-r transition-colors hover:bg-[var(--fg)]/10 ${
                              isFirst ? "rounded-l-[4px] border-l" : ""
                            } ${isLast ? "rounded-r-[4px]" : ""} ${seg.trailing ? "border-dashed opacity-70" : ""} ${healthClass}`}
                            style={{
                              left: `${segLeft}%`,
                              width: `${segWidth}%`,
                              minWidth: "6px",
                            }}
                            title={`${p.tytul}${seg.label ? ` · ${seg.label}` : ""} · ${formatPlDate(
                              toLocalISO(seg.left)
                            )} – ${formatPlDate(toLocalISO(seg.right))}`}
                          />
                          {seg.label && segWidth > 5 && (
                            <span
                              className="pointer-events-none absolute top-12 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted"
                              style={{ left: `${segLeft + segWidth / 2}%` }}
                            >
                              {seg.label}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                  {milestonesWithDates.map((m) => {
                    const mp = pctOf(m.date);
                    return (
                      <div
                        key={m.id}
                        className="pointer-events-none absolute top-6 z-20 h-5 -translate-x-1/2"
                        style={{ left: `${mp}%` }}
                        title={`${m.nazwa} — ${formatPlDate(toLocalISO(m.date))}`}
                      >
                        <div className={`mt-[5px] h-2.5 w-2.5 rotate-45 border-[1.5px] bg-[var(--bg)] ${diamondBorderClass}`} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {todayPct !== null && (
            <div className="pointer-events-none absolute inset-0 z-30">
              <div
                className="absolute inset-y-0 flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${todayPct}%` }}
              >
                <span className="rounded-full bg-[#4ea7fc] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--bg)] shadow">
                  dziś
                </span>
                <div className="w-px flex-1 bg-[#4ea7fc]/50" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
