"use client";

// Prosty wykres liniowy jednej serii — miesięczny trend jednego wskaźnika.
// Wzorowany na SpendTrendChart.tsx (Moduł 9), ale uproszczony: jedna seria =
// zero legendy (tytuł karty już ją nazywa, patrz dataviz skill), więc kolor
// niesie tożsamość marki (brand.purple), nie rozróżnienie kategorii. Punkty
// bez danych (`value: null`) świadomie przerywają linię zamiast rysować
// zero — cichy 0 przy metryce typu "średni czas" myliłby bardziej niż dziura.

import { useState } from "react";
import { statsMonthLabel, type StatsTrendPoint } from "@/lib/stats";

const LINE_LIGHT = "#7C3AED";
const LINE_DARK = "#9085e9"; // ta sama para co --s5 w SpendTrendChart.tsx (Moduł 9), zwalidowana dataviz skill

export function TrendChart({
  points,
  formatValue,
  emptyLabel = "Brak danych w tym okresie.",
}: {
  points: StatsTrendPoint[];
  formatValue: (v: number) => string;
  emptyLabel?: string;
}) {
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);

  const hasAny = points.some((p) => p.value != null);
  const W = 560;
  const H = 96;
  const padTop = 10;
  const padBottom = 18;
  const padSide = 6;
  const chartH = H - padTop - padBottom;
  const n = points.length;
  const slot = (W - padSide * 2) / Math.max(1, n - 1);

  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  const maxV = values.length ? Math.max(...values) : 1;
  const minV = values.length ? Math.min(0, ...values) : 0;
  const range = Math.max(1e-6, maxV - minV);

  const coords = points.map((p, i) => ({
    x: padSide + i * slot,
    y: p.value == null ? null : padTop + chartH - ((p.value - minV) / range) * chartH,
    value: p.value,
  }));

  // Segmenty linii tylko między sąsiadującymi miesiącami, które OBA mają dane.
  const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    if (a.y != null && b.y != null) segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }

  if (!hasAny) {
    return <p className="py-6 text-center text-[11px] text-muted opacity-60">{emptyLabel}</p>;
  }

  return (
    <div className="trend-chart relative">
      <style>{`
        .trend-chart { --line: ${LINE_LIGHT}; }
        .dark .trend-chart { --line: ${LINE_DARK}; }
      `}</style>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Wykres trendu miesięcznego">
        <line x1={padSide} y1={H - padBottom} x2={W - padSide} y2={H - padBottom} stroke="var(--hairline)" strokeWidth={1} />
        {segments.map((s, i) => (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="var(--line)" strokeWidth={2} strokeLinecap="round" />
        ))}
        {coords.map(
          (c, i) =>
            c.y != null && (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={hover?.idx === i ? 4 : 3}
                fill="var(--line)"
                stroke="var(--bg)"
                strokeWidth={1.5}
                onMouseEnter={() => setHover({ idx: i, x: c.x, y: c.y! })}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              />
            )
        )}
        {points.map((p, i) => {
          const showLabel = n <= 6 || i % 2 === (n % 2);
          if (!showLabel) return null;
          return (
            <text key={p.month} x={padSide + i * slot} y={H - padBottom + 12} textAnchor="middle" fontSize={7.5} fill="var(--fg-muted)">
              {statsMonthLabel(p.month).split(" ")[0]}
            </text>
          );
        })}
      </svg>
      {hover && coords[hover.idx].value != null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border hairline bg-[var(--bg-soft)] px-2 py-1 text-[10.5px] text-[var(--fg)] shadow-lg"
          style={{ left: `${(hover.x / W) * 100}%`, top: 0 }}
        >
          <div className="font-medium">{statsMonthLabel(points[hover.idx].month)}</div>
          <div className="text-muted">{formatValue(coords[hover.idx].value!)}</div>
        </div>
      )}
    </div>
  );
}
