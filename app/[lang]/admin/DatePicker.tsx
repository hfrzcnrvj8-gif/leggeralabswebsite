"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Popover } from "./Menu";

/**
 * Date picker w stylu Apple (iOS) — trzy „obrotowe" kolumny dzień/miesiąc/rok
 * z efektem bębna (rotateX + zanikanie względem środka), paskiem zaznaczenia
 * na środku i przyciąganiem (scroll-snap). Otwiera się po kliknięciu w datę i
 * zmienia ją od razu. Renderowany w Popoverze (portal do body).
 */

const MONTHS_PL = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
const ITEM_H = 34;
const VISIBLE = 5; // nieparzyste — środek = zaznaczenie
const YEAR_MIN = 2020;
const YEAR_MAX = 2040;

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function parse(value: string): { y: number; m: number; d: number } {
  const today = new Date();
  const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (mm) return { y: Number(mm[1]), m: Number(mm[2]) - 1, d: Number(mm[3]) };
  return { y: today.getFullYear(), m: today.getMonth(), d: today.getDate() };
}

function WheelColumn({
  items,
  index,
  onIndex,
  width,
}: {
  items: string[];
  index: number;
  onIndex: (i: number) => void;
  width: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settleRef = useRef<number | null>(null);

  const applyTransforms = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const center = el.scrollTop / ITEM_H;
    el.querySelectorAll<HTMLElement>("[data-item]").forEach((c) => {
      const i = Number(c.dataset.item);
      const dist = i - center;
      const ad = Math.abs(dist);
      const rot = Math.max(-70, Math.min(70, dist * 24));
      c.style.transform = `rotateX(${rot}deg) scale(${Math.max(0.7, 1 - ad * 0.06)})`;
      c.style.opacity = String(Math.max(0.12, 1 - ad * 0.32));
    });
  }, []);

  // Ustaw pozycję na aktualny indeks przy montażu i gdy indeks zmieni się
  // z zewnątrz (np. przycięcie dnia przy zmianie miesiąca).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = index * ITEM_H;
    requestAnimationFrame(applyTransforms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, items.length]);

  const onScroll = () => {
    applyTransforms();
    if (settleRef.current) window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.max(0, Math.min(Math.round(el.scrollTop / ITEM_H), items.length - 1));
      if (Math.abs(el.scrollTop - i * ITEM_H) > 1) el.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
      if (i !== index) onIndex(i);
    }, 100);
  };

  const pad = ((VISIBLE - 1) / 2) * ITEM_H;
  return (
    <div style={{ width, height: VISIBLE * ITEM_H, perspective: 700 }}>
      <div
        ref={ref}
        onScroll={onScroll}
        className="h-full overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "y mandatory" }}
      >
        <div style={{ height: pad }} />
        {items.map((it, i) => (
          <div
            key={i}
            data-item={i}
            onClick={() => {
              ref.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
              onIndex(i);
            }}
            className="flex cursor-pointer items-center justify-center text-[15px] font-medium text-[#e9e9ea]"
            style={{ height: ITEM_H, scrollSnapAlign: "center", willChange: "transform, opacity" }}
          >
            {it}
          </div>
        ))}
        <div style={{ height: pad }} />
      </div>
    </div>
  );
}

function Wheel({ value, onChange, close }: { value: string; onChange: (v: string) => void; close: () => void }) {
  const { y, m, d } = parse(value);
  const years: string[] = [];
  for (let yr = YEAR_MIN; yr <= YEAR_MAX; yr++) years.push(String(yr));
  const yIndex = Math.max(0, Math.min(y - YEAR_MIN, years.length - 1));
  const dim = daysInMonth(y, m);
  const dayItems = Array.from({ length: dim }, (_, i) => pad2(i + 1));

  const emit = (ny: number, nm: number, nd: number) => {
    const maxD = daysInMonth(ny, nm);
    const cd = Math.min(nd, maxD);
    onChange(`${ny}-${pad2(nm + 1)}-${pad2(cd)}`);
  };

  return (
    <div className="p-2">
      <div className="relative flex items-stretch justify-center gap-1">
        {/* Pasek zaznaczenia na środku */}
        <div
          className="pointer-events-none absolute inset-x-1 rounded-md border-y border-[#2a2b2f] bg-[#232327]/40"
          style={{ height: ITEM_H, top: ((VISIBLE - 1) / 2) * ITEM_H }}
        />
        <WheelColumn width={52} items={dayItems} index={d - 1} onIndex={(i) => emit(y, m, i + 1)} />
        <WheelColumn width={58} items={MONTHS_PL} index={m} onIndex={(i) => emit(y, i, d)} />
        <WheelColumn width={64} items={years} index={yIndex} onIndex={(i) => emit(YEAR_MIN + i, m, d)} />
      </div>
      <div className="mt-2 flex items-center gap-2 border-t border-[#2a2b2f] pt-2">
        <button
          onClick={() => {
            const t = new Date();
            emit(t.getFullYear(), t.getMonth(), t.getDate());
          }}
          className="rounded-md px-2 py-1 text-[12px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
        >
          Dziś
        </button>
        <button
          onClick={() => {
            onChange("");
            close();
          }}
          className="rounded-md px-2 py-1 text-[12px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
        >
          Wyczyść
        </button>
        <span className="flex-1" />
        <button
          onClick={close}
          className="rounded-md bg-gradient-to-r from-[#7C3AED] to-[#E0A93B] px-3 py-1 text-[12px] font-medium text-black"
        >
          Gotowe
        </button>
      </div>
    </div>
  );
}

/** Pojedyncze pole daty: klikalny trigger (sformatowana data lub placeholder)
 * otwierający koło wyboru. */
export function DateField({
  value,
  onChange,
  placeholder = "Ustaw datę",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const label = value ? formatDisplay(value) : placeholder;
  return (
    <Popover
      align="left"
      width={200}
      trigger={(open, isOpen) => (
        <button
          onClick={open}
          className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] ${
            value ? "text-[var(--fg)]" : "text-muted"
          } ${isOpen ? "bg-[var(--hairline)]" : "hover:bg-[var(--hairline)]"}`}
        >
          {label}
        </button>
      )}
    >
      {(close) => <Wheel value={value} onChange={onChange} close={close} />}
    </Popover>
  );
}

function formatDisplay(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v;
  return `${m[3]}.${m[2]}.${m[1]}`;
}
