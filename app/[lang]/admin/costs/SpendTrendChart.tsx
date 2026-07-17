"use client";

// Analityka wydatków (Moduł 9) — kompaktowy, czysto orientacyjny widget w
// rzędzie obok kart KPI (nie hero element strony — lista kosztów niżej jest
// tu główną treścią). Wykres zostaje mały i stały rozmiarowo; dodatkowa
// szerokość karty idzie na rozłożenie legendy obok niego, nie na
// powiększanie samego wykresu. Prosty słupkowy wykres skumulowany: jeden
// słupek na miesiąc,
// segmenty = kategorie. Paleta i reguły wg dataviz skill: 7 kategorii = 7
// pierwszych slotów zwalidowanej domyślnej palety kategorycznej (stała
// kolejność, nigdy nie cyklowana); relief przy WARN kontrastu/CVD w obu
// trybach (zweryfikowane scripts/validate_palette.js) przez legendę z
// liczbami i tooltip przy hover — nigdy sam kolor. Zero AI — czysta
// agregacja SUM/GROUP BY po stronie API.

import { useEffect, useMemo, useState } from "react";
import { COST_CATEGORIES, formatMoney } from "./shared";

const SERIES_LIGHT = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4"];
const SERIES_DARK = ["#3987e5", "#199e70", "#c98500", "#008300", "#9085e9", "#e66767", "#d55181"];

const MONTH_LABEL = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_LABEL[m - 1]} ${String(y).slice(2)}`;
}

type Analytics = { months: string[]; categories: string[]; byCategory: Record<string, number[]> };

export function SpendTrendChart() {
  const [data, setData] = useState<Analytics | null>(null);
  const [monthsCount, setMonthsCount] = useState(6);
  const [hover, setHover] = useState<{ monthIdx: number; catIdx: number; x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/costs/analytics?months=${monthsCount}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setData(d));
    return () => {
      cancelled = true;
    };
  }, [monthsCount]);

  const totalsByCategory = useMemo(() => {
    if (!data) return [];
    return COST_CATEGORIES.map((k, i) => ({ kategoria: k, slot: i, total: (data.byCategory[k] ?? []).reduce((a, b) => a + b, 0) }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const monthTotals = useMemo(() => {
    if (!data) return [];
    return data.months.map((_, i) => COST_CATEGORIES.reduce((sum, k) => sum + (data.byCategory[k]?.[i] ?? 0), 0));
  }, [data]);

  const maxTotal = Math.max(1, ...monthTotals);

  // Ciasny, boczny format — nie hero-wykres. Szerokość dopasowuje się do
  // kontenera (aside ~240px), wysokość świadomie niska.
  const W = 232;
  const H = 108;
  const padTop = 6;
  const padBottom = 16;
  const padSide = 4;
  const chartH = H - padTop - padBottom;

  if (!data) {
    return <div className="h-40 animate-pulse rounded-xl bg-[var(--hairline)]" />;
  }

  const n = data.months.length;
  const barSlot = (W - padSide * 2) / n;
  const barW = Math.min(18, barSlot * 0.6);

  return (
    <div className="cost-trend-chart">
      <style>{`
        .cost-trend-chart { --s1:${SERIES_LIGHT[0]}; --s2:${SERIES_LIGHT[1]}; --s3:${SERIES_LIGHT[2]}; --s4:${SERIES_LIGHT[3]}; --s5:${SERIES_LIGHT[4]}; --s6:${SERIES_LIGHT[5]}; --s7:${SERIES_LIGHT[6]}; }
        .dark .cost-trend-chart { --s1:${SERIES_DARK[0]}; --s2:${SERIES_DARK[1]}; --s3:${SERIES_DARK[2]}; --s4:${SERIES_DARK[3]}; --s5:${SERIES_DARK[4]}; --s6:${SERIES_DARK[5]}; --s7:${SERIES_DARK[6]}; }
      `}</style>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full shrink-0 sm:w-[220px]">
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">Trend wydatków</h3>
            <div className="flex items-center gap-0.5 text-[10px]">
              {[6, 12].map((m) => (
                <button
                  key={m}
                  onClick={() => setMonthsCount(m)}
                  className={`rounded-full px-1.5 py-0.5 ${monthsCount === m ? "bg-brand-purple/15 text-brand-purple" : "text-muted hover:text-[var(--fg)]"}`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Wydatki miesięczne per kategoria">
              <line x1={padSide} y1={H - padBottom} x2={W - padSide} y2={H - padBottom} stroke="var(--hairline)" strokeWidth={1} />
              {data.months.map((mKey, i) => {
                const x = padSide + i * barSlot + (barSlot - barW) / 2;
                const total = monthTotals[i];
                let yCursor = H - padBottom;
                const segs = COST_CATEGORIES.map((k, ci) => {
                  const v = data.byCategory[k]?.[i] ?? 0;
                  const segH = total > 0 ? (v / maxTotal) * chartH : 0;
                  const y = yCursor - segH;
                  yCursor -= segH > 0 ? segH + (segH > 2 ? 1 : 0) : 0;
                  return { k, ci, v, y, segH };
                });
                // Co drugi miesiąc podpisany przy 12-mies. widoku — inaczej etykiety się zlewają w wąskiej kolumnie.
                const showLabel = n <= 6 || i % 2 === (n % 2);
                return (
                  <g key={mKey}>
                    {segs.map(
                      (s) =>
                        s.segH > 0.5 && (
                          <rect
                            key={s.k}
                            x={x}
                            y={s.y}
                            width={barW}
                            height={Math.max(0, s.segH - 0.5)}
                            rx={s.ci === segs.length - 1 || segs.slice(s.ci + 1).every((o) => o.segH <= 0.5) ? 2 : 0}
                            fill={`var(--s${s.ci + 1})`}
                            opacity={hover && hover.monthIdx === i && hover.catIdx !== s.ci ? 0.35 : 1}
                            onMouseEnter={(e) => {
                              const rect = (e.target as SVGElement).ownerSVGElement?.getBoundingClientRect();
                              setHover({ monthIdx: i, catIdx: s.ci, x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
                            }}
                            onMouseMove={(e) => {
                              const rect = (e.target as SVGElement).ownerSVGElement?.getBoundingClientRect();
                              setHover({ monthIdx: i, catIdx: s.ci, x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
                            }}
                            onMouseLeave={() => setHover(null)}
                          />
                        )
                    )}
                    {showLabel && (
                      <text x={x + barW / 2} y={H - padBottom + 11} textAnchor="middle" fontSize={7.5} fill="var(--fg-muted)">
                        {monthLabel(mKey).split(" ")[0]}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            {hover && (
              <div
                className="pointer-events-none absolute z-10 rounded-md border hairline bg-[var(--bg-soft)] px-2 py-1 text-[10.5px] text-[var(--fg)] shadow-lg"
                style={{ left: Math.min(hover.x + 6, W - 120), top: Math.max(hover.y - 34, 0) }}
              >
                <div className="font-medium">{COST_CATEGORIES[hover.catIdx]}</div>
                <div className="text-muted">
                  {monthLabel(data.months[hover.monthIdx])}: {formatMoney(data.byCategory[COST_CATEGORIES[hover.catIdx]]?.[hover.monthIdx] ?? 0)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="hidden h-16 w-px shrink-0 bg-[var(--hairline)] sm:block" />

        {totalsByCategory.length === 0 ? (
          <p className="text-[10.5px] text-muted opacity-60">Brak wydatków w tym okresie.</p>
        ) : (
          /* Moduł 27: było `grid ... sm:grid-cols-3` — kolumny siatki dzieliły
             CAŁĄ szerokość karty (~950 px na oknie 1800), więc przy dwóch
             kategoriach nazwa lądowała przy lewej krawędzi, a kwota pół ekranu
             dalej. Teraz wpis ma stałą szerokość i wpisy pakują się od lewej:
             nazwa i kwota zostają obok siebie niezależnie od tego, ile jest
             kategorii. Wykres świadomie zostaje mały (decyzja z Modułu 9,
             patrz nagłówek pliku) — naprawiamy legendę, nie rozmiar wykresu. */
          <div className="flex min-w-0 flex-1 flex-wrap content-center gap-x-6 gap-y-1.5">
            {totalsByCategory.map((c) => (
              <div key={c.kategoria} className="flex w-[190px] items-center gap-1.5 text-[11px]">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: `var(--s${c.slot + 1})` }} />
                <span className="min-w-0 flex-1 truncate text-muted">{c.kategoria}</span>
                <span className="shrink-0 font-medium text-[var(--fg)]">{formatMoney(c.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
