"use client";

import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { Popover } from "./Menu";

/**
 * Date picker w stylu Apple (iOS) — trzy „obrotowe" kolumny dzień/miesiąc/rok.
 *
 * Koło NIE korzysta z natywnego scrolla (to psuło feel: scroll-snap walczył z
 * bezwładnością). Zamiast tego własna fizyka na pointer events: przeciąganie
 * palcem/myszą, bezwładność (momentum) z tarciem, miękkie „dociąganie" (snap)
 * do najbliższej pozycji i haptyczny „klik" przy każdym przeskoku środka.
 * Każdy element dostaje transform bębna (rotateX + skala + zanikanie względem
 * środka). Renderowany w Popoverze (portal do body).
 */

const MONTHS_PL = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
const ITEM_H = 40;
const VISIBLE = 5; // nieparzyste — środek = zaznaczenie
const YEAR_MIN = 2020;
const YEAR_MAX = 2040;
const FRICTION = 0.94; // tłumienie bezwładności na klatkę
const SNAP_EASE = 0.2; // siła dociągania do najbliższego elementu

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

/**
 * Jedna kolumna koła. Stan pozycji trzymany w ref (nie w state) — animacja
 * bezwładności działa na 60 fps przez requestAnimationFrame i maluje bezpośrednio
 * transformy w DOM, bez re-renderów Reacta. Do rodzica raportujemy indeks dopiero
 * gdy koło się zatrzyma na konkretnym elemencie.
 */
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
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(index); // ułamkowy indeks na środku
  const velRef = useRef(0); // prędkość w jednostkach indeksu / klatkę
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startPosRef = useRef(index);
  const lastYRef = useRef(0);
  const lastTRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const wheelToRef = useRef<number | null>(null);
  const idxRef = useRef(index); // ostatnio zaraportowany indeks
  const lastTickRef = useRef(index);
  const len = items.length;

  const clamp = useCallback((p: number) => Math.max(0, Math.min(len - 1, p)), [len]);

  const paint = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const pos = posRef.current;
    track.style.transform = `translate3d(0, ${-pos * ITEM_H}px, 0)`;
    track.querySelectorAll<HTMLElement>("[data-item]").forEach((c) => {
      const i = Number(c.dataset.item);
      const dist = i - pos;
      const ad = Math.abs(dist);
      // Krzywa bębna — im dalej od środka, tym większy obrót, mniejsza skala,
      // słabsza jasność. Środek zostaje ostry, duży i biały (feel premium).
      const rot = Math.max(-72, Math.min(72, dist * 24));
      const scale = Math.max(0.56, 1 - ad * 0.12);
      c.style.transform = `rotateX(${rot}deg) scale(${scale})`;
      c.style.opacity = String(Math.max(0.14, 1 - ad * 0.38));
      c.style.color = ad < 0.5 ? "#ffffff" : "#e6e7ea";
      c.style.fontWeight = ad < 0.5 ? "600" : "400";
    });
    const cur = Math.round(pos);
    if (cur !== lastTickRef.current) {
      lastTickRef.current = cur;
      tick();
    }
  }, []);

  // Raportuj wybór do rodzica. BEZ strażnika „i !== idxRef" — ten potrafił
  // po cichu połknąć zmianę w wyścigu z re-renderem. onIndex→setDraft jest
  // idempotentne (ta sama wartość = no-op), więc powtórne wywołanie nie szkodzi.
  const report = useCallback(
    (i: number) => {
      idxRef.current = i;
      onIndex(i);
    },
    [onIndex]
  );

  // Pętla bezwładności + dociągania: leci z prędkością i tarciem, a gdy zwolni —
  // miękko dociąga (ease) do najbliższego całego indeksu i raportuje wybór.
  // Napędzana setInterval-em (~60 fps), NIE requestAnimationFrame — w tle/gdy
  // podgląd nie maluje klatek, rAF bywa wstrzymany i zapis nigdy by nie nastąpił.
  // setTimeout odpala niezależnie od malowania, więc wybór zawsze się zatwierdza.
  const tick16 = (fn: () => void) => window.setTimeout(fn, 16);

  const animate = useCallback(() => {
    const v = velRef.current;
    let pos = posRef.current;
    if (Math.abs(v) > 0.008) {
      pos = clamp(pos + v);
      posRef.current = pos;
      velRef.current = v * FRICTION;
      if (pos <= 0 || pos >= len - 1) velRef.current = 0; // wygaś na krańcu
      paint();
      rafRef.current = tick16(animate);
    } else {
      const target = clamp(Math.round(pos));
      const diff = target - pos;
      if (Math.abs(diff) > 0.02) {
        posRef.current = pos + diff * SNAP_EASE;
        paint();
        rafRef.current = tick16(animate);
      } else {
        posRef.current = target;
        paint();
        rafRef.current = null;
        report(target);
      }
    }
  }, [clamp, len, paint, report]);

  const stopAnim = useCallback(() => {
    if (rafRef.current != null) {
      window.clearTimeout(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startAnim = useCallback(() => {
    if (rafRef.current == null) rafRef.current = tick16(animate);
  }, [animate]);

  // Deterministyczne zatwierdzenie dla scrolla myszą: dociągnij do najbliższego
  // elementu i zaraportuj OD RAZU (bez pętli animacji), żeby zapis był pewny.
  const snapNow = useCallback(() => {
    stopAnim();
    const target = clamp(Math.round(posRef.current));
    posRef.current = target;
    paint();
    report(target);
  }, [clamp, paint, report, stopAnim]);

  // Płynny „tween" do konkretnego elementu (klik w element listy).
  const tweenTo = useCallback(
    (target: number) => {
      stopAnim();
      velRef.current = 0;
      const step = () => {
        const pos = posRef.current;
        const diff = target - pos;
        if (Math.abs(diff) < 0.02) {
          posRef.current = target;
          paint();
          rafRef.current = null;
          report(target);
          return;
        }
        posRef.current = pos + diff * SNAP_EASE;
        paint();
        rafRef.current = tick16(step);
      };
      rafRef.current = tick16(step);
    },
    [paint, report, stopAnim]
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    startYRef.current = e.clientY;
    startPosRef.current = posRef.current;
    lastYRef.current = e.clientY;
    lastTRef.current = performance.now();
    velRef.current = 0;
    stopAnim();
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dy = e.clientY - startYRef.current;
    posRef.current = clamp(startPosRef.current - dy / ITEM_H);
    const now = performance.now();
    const dt = Math.max(1, now - lastTRef.current);
    const dyi = e.clientY - lastYRef.current;
    velRef.current = ((-dyi / ITEM_H) / dt) * 16; // znormalizowane do ~60 fps
    lastYRef.current = e.clientY;
    lastTRef.current = now;
    paint();
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    startAnim();
  };

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    stopAnim();
    posRef.current = clamp(posRef.current + e.deltaY / (ITEM_H * 1.5));
    velRef.current = 0;
    paint();
    if (wheelToRef.current) window.clearTimeout(wheelToRef.current);
    wheelToRef.current = window.setTimeout(snapNow, 90);
  };

  // Ustaw pozycję gdy indeks przyjdzie z zewnątrz (np. zmiana miesiąca skróciła
  // liczbę dni). Bez animacji — natychmiast.
  useLayoutEffect(() => {
    posRef.current = index;
    idxRef.current = index;
    lastTickRef.current = index;
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, len]);

  useLayoutEffect(() => () => stopAnim(), [stopAnim]);

  const pad = ((VISIBLE - 1) / 2) * ITEM_H;
  const justify = align === "left" ? "justify-start pl-1" : align === "right" ? "justify-end pr-1" : "justify-center";
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      className="relative cursor-grab overflow-hidden select-none active:cursor-grabbing"
      style={{
        width,
        height: VISIBLE * ITEM_H,
        perspective: 1000,
        touchAction: "none",
        // Miękkie wygaszanie góry/dołu — elementy „wtapiają się" w krawędzie.
        WebkitMaskImage: "linear-gradient(180deg, transparent, #000 22%, #000 78%, transparent)",
        maskImage: "linear-gradient(180deg, transparent, #000 22%, #000 78%, transparent)",
      }}
    >
      <div ref={trackRef} style={{ paddingTop: pad, paddingBottom: pad, willChange: "transform" }}>
        {items.map((it, i) => (
          <div
            key={i}
            data-item={i}
            onClick={() => tweenTo(i)}
            className={`flex items-center ${justify} text-[17px]`}
            style={{ height: ITEM_H, willChange: "transform, opacity", backfaceVisibility: "hidden" }}
          >
            {it}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Zawartość koła. Trzyma roboczą datę (draft) w state — kręcenie kołem zmienia
 * TYLKO draft, do bazy nic nie leci. Zapis następuje dopiero po kliknięciu
 * „Zapisz"; zamknięcie bez zapisu (klik poza / Esc / X) porzuca zmiany. Dzięki
 * temu przycisk „Zapisz" ma realne znaczenie i nie ma serii zapisów przy kręceniu.
 */
function WheelPicker({ value, onCommit, onClear }: { value: string; onCommit: (v: string) => void; onClear: () => void }) {
  const [draft, setDraft] = useState(value);
  const { y, m, d } = parse(draft || value);
  const years: string[] = [];
  for (let yr = YEAR_MIN; yr <= YEAR_MAX; yr++) years.push(String(yr));
  const yIndex = Math.max(0, Math.min(y - YEAR_MIN, years.length - 1));
  const dim = daysInMonth(y, m);
  const dayItems = Array.from({ length: dim }, (_, i) => pad2(i + 1));

  const set = (ny: number, nm: number, nd: number) => {
    const maxD = daysInMonth(ny, nm);
    const cd = Math.min(nd, maxD);
    setDraft(`${ny}-${pad2(nm + 1)}-${pad2(cd)}`);
  };

  return (
    <div
      className="p-3"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(draft || `${y}-${pad2(m + 1)}-${pad2(d)}`);
        }
      }}
    >
      <div className="relative flex items-stretch justify-center gap-1.5">
        {/* Pasek zaznaczenia na środku */}
        <div
          className="pointer-events-none absolute inset-x-0 rounded-lg border-y border-white/10 bg-white/[0.05]"
          style={{ height: ITEM_H, top: ((VISIBLE - 1) / 2) * ITEM_H }}
        />
        <WheelColumn width={62} items={dayItems} index={d - 1} onIndex={(i) => set(y, m, i + 1)} align="right" />
        <WheelColumn width={74} items={MONTHS_PL} index={m} onIndex={(i) => set(y, i, d)} align="center" />
        <WheelColumn width={80} items={years} index={yIndex} onIndex={(i) => set(YEAR_MIN + i, m, d)} align="left" />
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-[#2a2b2f] pt-3">
        <button
          onClick={() => {
            const t = new Date();
            set(t.getFullYear(), t.getMonth(), t.getDate());
          }}
          className="rounded-md px-2.5 py-1.5 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
        >
          Dziś
        </button>
        <button
          onClick={onClear}
          className="rounded-md px-2.5 py-1.5 text-[12.5px] text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
        >
          Wyczyść
        </button>
        <span className="flex-1" />
        <button
          onClick={() => onCommit(draft || `${y}-${pad2(m + 1)}-${pad2(d)}`)}
          className="admin-grad-border rounded-md px-5 py-1.5 text-[12.5px] font-semibold text-[var(--fg)]"
        >
          Zapisz
        </button>
      </div>
    </div>
  );
}

/** Pojedyncze pole daty: klikalny trigger (sformatowana data lub placeholder)
 * otwierający koło wyboru. Koło otwiera się dosunięte prawą krawędzią do pola
 * (align="right"), żeby nie uciekało poza krawędź panelu przy prawej kolumnie. */
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
      align="right"
      width={256}
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
      {(close) => (
        <WheelPicker
          value={value}
          onCommit={(v) => {
            onChange(v);
            close();
          }}
          onClear={() => {
            onChange("");
            close();
          }}
        />
      )}
    </Popover>
  );
}

/** Odporne na ISO z częścią czasową → "DD.MM.YYYY". */
function formatDisplay(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((v || "").slice(0, 10));
  if (!m) return v;
  return `${m[3]}.${m[2]}.${m[1]}`;
}
