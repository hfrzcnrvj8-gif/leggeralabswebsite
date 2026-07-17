"use client";

/**
 * Dymek podpowiedzi (Moduł 34) — zamiennik natywnego `title=`.
 *
 * Po co: panel miał 222 natywne `title=` w 41 plikach. Natywny dymek pojawia
 * się po ~1 s, wygląda jak prostokąt systemowy (inny na macOS i Windowsie —
 * dokładnie ten sam problem, co emoji w Module 33) i nie da się go stylować.
 * Przy ikonie bez podpisu to znaczy „nie wiadomo, co ten przycisk robi".
 *
 * Wzorowane na Apple/Linear:
 * - **opóźnienie** OPEN_DELAY, żeby dymki nie migały przy przejeżdżaniu myszą;
 * - **wspólna kolejka**: gdy jeden dymek już był widoczny, kolejny w ciągu
 *   SKIP_DELAY_WINDOW pojawia się NATYCHMIAST (przesuwasz się po pasku ikon i
 *   opisy „lecą za kursorem", zamiast kazać czekać przy każdej ikonie);
 * - fade + lekkie uniesienie, krzywa `[0.16, 1, 0.3, 1]` — ta sama co
 *   `Popover`/modal (patrz pamięć rundy lekkości 2026-07-16: JEDNA krzywa
 *   w całym panelu).
 *
 * Wzorzec renderowania skopiowany z `Menu.tsx` (nie wymyślaj trzeciego):
 * - `createPortal` do `<body>` — inaczej dymek obcinałby `overflow-auto`
 *   tabeli/Kanbanu, a to najczęstsze miejsce jego użycia;
 * - `AnimatePresence` **wewnątrz** `createPortal(...)`, nie dookoła — poza
 *   portalem nie wykrywa zmiany obecności (udokumentowane w `Menu.tsx`);
 * - klasa `admin-linear` na portalu — renderuje się w `<body>`, poza scope'em
 *   `AppShell`, więc bez niej `var(--fg)` spada do jasnych tokenów strony
 *   publicznej (ciemny tekst na ciemnym tle = nieczytelne);
 * - `.glass` — dymek to chrome, więc to jedyne miejsce, gdzie szkło jest
 *   zgodne z zasadą z CLAUDE.md („.glass zarezerwowane dla chrome, NIE na
 *   zwykłych kartach").
 *
 * Wrapper ma `display: contents` — NIE tworzy własnego pudełka, więc wstawienie
 * go wokół przycisku nie rusza layoutu (flex/grid liczą dziecko tak samo jak
 * przedtem). Pozycję mierzymy z `firstElementChild`, bo sam wrapper nie ma
 * geometrii.
 */

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

/** Ile trzymać kursor, zanim dymek wejdzie. 400 ms = próg Apple: dłużej niż
 * przypadkowe przejechanie, krócej niż świadome „co to jest?". */
const OPEN_DELAY = 400;
/** Okno, w którym kolejny dymek pojawia się bez opóźnienia. */
const SKIP_DELAY_WINDOW = 300;
/** Odstęp dymka od elementu. */
const GAP = 8;

/** Wspólny stan kolejki — celowo modułowy, nie w kontekście: to czysto
 * wizualny detal, a kontekst zmuszałby każdy dashboard do owijania się
 * providerem (i tak by ktoś zapomniał). */
let lastClosedAt = 0;

type Placement = "top" | "bottom";

export function Tooltip({
  label,
  children,
  placement = "top",
  disabled = false,
}: {
  /** Treść dymka. Pusty/undefined = dymek się nie pokazuje (wygodne przy
   * warunkowych opisach, np. `disabled ? "Powód" : ""`). */
  label?: ReactNode;
  children: ReactNode;
  placement?: Placement;
  disabled?: boolean;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; place: Placement }>({
    top: 0,
    left: 0,
    place: placement,
  });
  const id = useId();

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const measure = useCallback(() => {
    const el = wrapRef.current?.firstElementChild as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    // Zmieści się nad elementem? Jeśli nie — przerzuć pod (typowe przy pasku
    // narzędzi przyklejonym do góry ekranu).
    const wantTop = placement === "top";
    const fitsAbove = r.top > 44;
    const place: Placement = wantTop && fitsAbove ? "top" : wantTop ? "bottom" : "bottom";
    return {
      top: place === "top" ? r.top - GAP : r.bottom + GAP,
      left: r.left + r.width / 2,
      place,
    };
  }, [placement]);

  const show = useCallback(() => {
    if (disabled || !label) return;
    const next = measure();
    if (!next) return;
    setPos(next);
    setOpen(true);
  }, [disabled, label, measure]);

  const scheduleShow = useCallback(() => {
    if (disabled || !label) return;
    clearTimer();
    const instant = Date.now() - lastClosedAt < SKIP_DELAY_WINDOW;
    if (instant) {
      show();
      return;
    }
    timerRef.current = window.setTimeout(show, OPEN_DELAY);
  }, [clearTimer, disabled, label, show]);

  const hide = useCallback(() => {
    clearTimer();
    setOpen((wasOpen) => {
      if (wasOpen) lastClosedAt = Date.now();
      return false;
    });
  }, [clearTimer]);

  // Scroll/resize: dymek jest pozycjonowany `fixed` wg migawki geometrii, więc
  // po przewinięciu wisiałby w złym miejscu. Chowamy zamiast przeliczać —
  // przewijanie i tak znaczy, że użytkownik przestał czytać ten dymek.
  useEffect(() => {
    if (!open) return;
    const onAway = () => hide();
    window.addEventListener("scroll", onAway, true);
    window.addEventListener("resize", onAway);
    return () => {
      window.removeEventListener("scroll", onAway, true);
      window.removeEventListener("resize", onAway);
    };
  }, [open, hide]);

  useEffect(() => clearTimer, [clearTimer]);

  return (
    <>
      <span
        ref={wrapRef}
        style={{ display: "contents" }}
        onPointerEnter={(e) => {
          // Dotyk: dymek po „najechaniu" nie ma sensu i blokowałby tapnięcie.
          if (e.pointerType === "touch") return;
          scheduleShow();
        }}
        onPointerLeave={hide}
        // Klik = użytkownik już wie, czego chce; dymek tylko zasłania efekt.
        onPointerDown={hide}
        // Klawiatura: fokus pokazuje opis od razu (bez opóźnienia — tab-owanie
        // jest świadome), Escape chowa.
        onFocusCapture={show}
        onBlurCapture={hide}
        onKeyDown={(e) => {
          if (e.key === "Escape") hide();
        }}
      >
        {children}
      </span>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && label && (
              // DWA elementy, nie jeden: framer-motion animuje `y` przez
              // własny `transform`, więc gdyby ten sam element miał w `style`
              // ręczne `translate(-50%,-100%)` do wyśrodkowania, framer by je
              // nadpisał i dymek odjechałby w bok. Zewnętrzny robi ruch,
              // wewnętrzny — pozycjonowanie względem elementu.
              <motion.div
                key={id}
                initial={{ opacity: 0, y: pos.place === "top" ? 4 : -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: pos.place === "top" ? 2 : -2 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-none fixed z-[300]"
                style={{ top: pos.top, left: pos.left }}
              >
                <div
                  role="tooltip"
                  className="admin-linear glass max-w-[260px] rounded-lg px-2 py-1 text-center text-[11.5px] leading-snug text-[var(--fg)]"
                  style={{ transform: `translate(-50%, ${pos.place === "top" ? "-100%" : "0"})` }}
                >
                  {label}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
