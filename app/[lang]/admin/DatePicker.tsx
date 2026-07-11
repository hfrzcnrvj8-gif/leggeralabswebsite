"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { Popover } from "./Menu";

/**
 * Date picker w stylu Apple (iOS) — trzy „obrotowe" kolumny dzień/miesiąc/rok
 * z efektem bębna (rotateX + skala + zanikanie względem środka), paskiem
 * zaznaczenia na środku, przyciąganiem (scroll-snap) i delikatnym „klikiem"
 * (haptic na mobile) przy każdym przeskoku. Otwiera się po kliknięciu w datę i
 * zmienia ją od razu. Renderowany w Popoverze (portal do body).
 */

const MONTHS_PL = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
const ITEM_H = 36;
const VISIBLE = 5; // nieparzyste — środek = zaznaczenie
const YEAR_MIN = 2020;
const YEAR_MAX = 2040;

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
/** Odporne na wartości z bazy z częścią czasową (np. "2026-07-11T00:00:00Z"). */
function parse(value: string): { y: number; m: number; d: number } {
  const today = new Date();
  const mm = /^(\d{4})-(\d{2})-(\d{2})/.exec((value || "").slice(0, 10));
  if (mm) return { y: Number(mm[1]), m: Number(mm[2]) - 1, d: Number(mm[3]) };
  return { y: today.getFullYear(), m: today.getMonth(), d: today.getDate() };
}
function tick() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(3);
    } catch {
      /* niektóre przeglądarki rzucają — ignoruj */
    }
  }
}

function WheelColumn({
  items,
  index,
  onIndex,
  width,
  align = "center",
}: {
  items: string[];
  index: number;
  onIndex: (i: number) => void;
  width: number;
  align?: "center" | "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settleRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastIdxRef = useRef(index);

  const applyTransforms = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const center = el.scrollTop / ITEM_H;
    el.querySelectorAll<HTMLElement>("[data-item]").forEach((c) => {
      const i = Number(c.dataset.item);
      const dist = i - center;
      const ad = Math.abs(dist);
      // Krzywa bębna — im dalej od środka, tym większy obrót, mniejsza skala,
      // słabsza jasność. Środek zostaje ostry, duży i biały (feel premium).
      const rot = Math.max(-80, Math.min(80, dist * 26));
      const scale = Math.max(0.62, 1 - ad * 0.13);
      c.style.transform = `translateZ(0) rotateX(${rot}deg) scale(${scale})`;
      c.style.opacity = String(Math.max(0.1, 1 - ad * 0.42));
      c.style.fontWeight = ad < 0.5 ? "600" : "400";
    });
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = index * ITEM_H;
    lastIdxRef.current = index;
    requestAnimationFrame(applyTransforms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, items.length]);

  const onScroll = () => {
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        applyTransforms();
        // „Klik" — haptic gdy środek przeskoczy na nowy element
        const el = ref.current;
        if (el) {
          const cur = Math.round(el.scrollTop / ITEM_H);
          if (cur !== lastIdxRef.current) {
            lastIdxRef.current = cur;
            tick();
          }
        }
      });
    }
    // Po zatrzymaniu — odczytaj wybór (native scroll-snap sam przyciąga).
    if (settleRef.current) window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.max(0, Math.min(Math.round(el.scrollTop / ITEM_H), items.length - 1));
      if (i !== index) onIndex(i);
    }, 120);
  };

  const pad = ((VISIBLE - 1) / 2) * ITEM_H;
  const justify = align === "left" ? "justify-start pl-1" : align === "right" ? "justify-end pr-1" : "justify-center";
  return (
    <div style={{ width, height: VISIBLE * ITEM_H, perspective: 900 }}>
      <div
        ref={ref}
        onScroll={onScroll}
        className="h-full overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "y mandatory", scrollBehavior: "auto" }}
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
            className={`flex cursor-pointer items-center ${justify} text-[16px] text-[#f4f4f5]`}
            style={{ height: ITEM_H, scrollSnapAlign: "center", willChange: "transform, opacity", backfaceVisibility: "hidden" }}
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
      <div className="relative flex items-stretch justify-center">
        {/* Pasek zaznaczenia na środku */}
        <div
          className="pointer-events-none absolute inset-x-1 rounded-lg border-y border-[#33343a] bg-white/[0.04]"
          style={{ height: ITEM_H, top: ((VISIBLE - 1) / 2) * ITEM_H }}
        />
        <WheelColumn width={44} items={dayItems} index={d - 1} onIndex={(i) => emit(y, m, i + 1)} align="right" />
        <WheelColumn width={56} items={MONTHS_PL} index={m} onIndex={(i) => emit(y, i, d)} align="center" />
        <WheelColumn width={56} items={years} index={yIndex} onIndex={(i) => emit(YEAR_MIN + i, m, d)} align="left" />
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
          className="admin-grad-border rounded-md px-3.5 py-1 text-[12px] font-medium text-[var(--fg)]"
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
      width={172}
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

/** Odporne na ISO z częścią czasową → "DD.MM.YYYY". */
function formatDisplay(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((v || "").slice(0, 10));
  if (!m) return v;
  return `${m[3]}.${m[2]}.${m[1]}`;
}
