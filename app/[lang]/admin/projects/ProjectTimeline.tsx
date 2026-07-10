"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";
import { PROJECT_STATUS_DOT } from "./shared";

type TimelineMilestone = { id: string; nazwa: string; termin: string | null };
type TimelineProject = {
  id: string;
  tytul: string;
  status: string;
  zdrowie: string;
  priorytet: string;
  start: string | null;
  termin: string | null;
  milestones: TimelineMilestone[];
};

const DAY_MS = 86400000;

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

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString("pl-PL", { month: "short", year: "numeric" });
}

/** Widok osi czasu (Gantt-lite) — projekty jako paski od startu do terminu,
 * kamienie milowe jako romby na osi. Odpowiednik widoku "Roadmap" w Linear,
 * dopasowany do skali solo-przedsiębiorcy (miesięczna siatka, bez zależności). */
export function ProjectTimeline({ lang }: { lang: Locale }) {
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

  const { dated, undated, rangeStart, totalDays, months } = useMemo(() => {
    const list = projects ?? [];
    const dated: { p: TimelineProject; start: Date; end: Date }[] = [];
    const undated: TimelineProject[] = [];

    for (const p of list) {
      const s = parseDate(p.start);
      const t = parseDate(p.termin);
      if (!s && !t) {
        undated.push(p);
        continue;
      }
      const start = s ?? addDays(t as Date, -14);
      const end = t ?? addDays(s as Date, 14);
      dated.push({ p, start: start <= end ? start : end, end: start <= end ? end : start });
    }

    if (dated.length === 0) {
      return { dated, undated, rangeStart: new Date(), totalDays: 1, months: [] as Date[] };
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

    return { dated, undated, rangeStart, totalDays, months };
  }, [projects]);

  if (!projects) {
    return <div className="h-64 animate-pulse rounded-2xl bg-[var(--hairline)]" />;
  }

  if (dated.length === 0) {
    return (
      <div className="card-paper rounded-2xl p-8 text-center text-sm text-muted">
        Brak projektów z datą startu lub terminem — dodaj daty w panelu szczegółów, żeby zobaczyć oś czasu.
      </div>
    );
  }

  const today = new Date();
  const todayPct = today >= rangeStart ? Math.min((daysBetween(rangeStart, today) / totalDays) * 100, 100) : null;

  const pctOf = (d: Date) => Math.max(0, Math.min((daysBetween(rangeStart, d) / totalDays) * 100, 100));

  return (
    <div className="card-paper overflow-x-auto rounded-2xl p-3 sm:p-4">
      <div style={{ minWidth: `${Math.max(months.length * 96, 480)}px` }}>
        {/* Nagłówek miesięcy */}
        <div className="mb-2 flex border-b hairline pb-2">
          <div className="w-40 shrink-0 sm:w-52" />
          <div className="relative flex-1">
            <div className="flex">
              {months.map((m, i) => (
                <div
                  key={i}
                  className="shrink-0 border-l hairline px-2 text-[11px] font-medium text-muted first:border-l-0"
                  style={{ width: `${(1 / months.length) * 100}%` }}
                >
                  {fmtMonth(m)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Wiersze projektów */}
        <div className="space-y-1.5">
          {dated.map(({ p, start, end }) => {
            const left = pctOf(start);
            const width = Math.max(pctOf(end) - left, 1.5);
            return (
              <div key={p.id} className="flex items-center">
                <a
                  href={`/${lang}/admin/projects/${p.id}`}
                  className="flex w-40 shrink-0 items-center gap-1.5 truncate pr-2 text-xs hover:underline sm:w-52"
                  title={p.tytul}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PROJECT_STATUS_DOT[p.status] ?? "bg-[var(--fg-muted)]"}`} />
                  <span className="truncate">{p.tytul}</span>
                </a>
                <div className="relative h-6 flex-1">
                  {todayPct !== null && (
                    <div className="absolute inset-y-0 z-10 w-px bg-brand-cyan/50" style={{ left: `${todayPct}%` }} />
                  )}
                  <div
                    className={`absolute inset-y-1 rounded-full ${
                      p.zdrowie === "Zerwany"
                        ? "bg-red-500/60"
                        : p.zdrowie === "Zagrożony"
                        ? "bg-orange-500/60"
                        : "bg-brand-cyan/50"
                    }`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${p.tytul}${p.start ? ` · start ${p.start}` : ""}${p.termin ? ` · termin ${p.termin}` : ""}`}
                  />
                  {p.milestones
                    .filter((m) => m.termin)
                    .map((m) => {
                      const md = parseDate(m.termin);
                      if (!md) return null;
                      return (
                        <div
                          key={m.id}
                          className="absolute top-1/2 z-20 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-[var(--bg)] bg-brand-gold"
                          style={{ left: `${pctOf(md)}%` }}
                          title={`${m.nazwa}${m.termin ? ` — ${m.termin}` : ""}`}
                        />
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {undated.length > 0 && (
        <p className="mt-4 border-t hairline pt-3 text-[11px] text-muted opacity-70">
          Bez dat: {undated.map((p) => p.tytul).join(", ")}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t hairline pt-3 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rotate-45 border border-[var(--bg)] bg-brand-gold" /> kamień milowy
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-4 rounded-full bg-brand-cyan/50" /> na dobrej drodze
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-4 rounded-full bg-orange-500/60" /> zagrożony
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-4 rounded-full bg-red-500/60" /> zerwany
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-px bg-brand-cyan/50" /> dziś
        </span>
      </div>
    </div>
  );
}
