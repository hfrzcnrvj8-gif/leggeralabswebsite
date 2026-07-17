"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { IconCheck } from "@tabler/icons-react";

/**
 * Własne menu/popover w stylu Linear — zastępuje natywne <select>, które
 * renderują chrome systemu i psują „feel" panelu. Renderowane przez portal do
 * <body>, więc nie jest przycinane przez kontenery z overflow (np. board z
 * przewijaniem poziomym). Pozycja liczona z prostokąta triggera; menu ucieka
 * do góry, gdy blisko dołu ekranu. Zamyka się kliknięciem poza, Esc lub po
 * wyborze. stopPropagation na triggerze i menu, żeby klik nie „przeciekał" do
 * onClick karty/wiersza pod spodem.
 */

export type MenuOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

const MENU_MIN_W = 190;
const ITEM_H = 30;

/** useLayoutEffect na kliencie, useEffect na serwerze — panel jest SSR-owany,
 * a useLayoutEffect w renderze serwerowym sypie ostrzeżeniem Reacta. */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Generyczny popover — dowolna treść w portalu do <body>, z pozycjonowaniem
 * od triggera, zamknięciem po kliknięciu poza / Esc. Baza pod menu Filtry,
 * Widok, kontekstowe itd. Treść dostaje `close` do zamknięcia po akcji. */
export function Popover({
  trigger,
  children,
  align = "left",
  width = 240,
  triggerClassName = "inline-flex",
  anchor,
  open: openProp,
  onClose,
}: {
  /** Opcjonalny, gdy popover jest sterowany z zewnątrz (`open` + `anchor`) —
   * np. menu kontekstowe, które nie ma własnego przycisku. */
  trigger?: (open: (e?: ReactMouseEvent) => void, isOpen: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  width?: number;
  /** Klasa wrappera triggera — domyślnie `inline-flex`. Nadpisz na np.
   * `flex h-full w-full`, gdy trigger musi wypełnić komórkę siatki (np.
   * dzień w kalendarzu). */
  triggerClassName?: string;
  /** Gdy podany — pozycja liczona z punktu (kursora), nie z triggera.
   * Scroll zamyka menu zamiast je przestawiać: punkt na ekranie przestaje
   * odpowiadać treści, od której menu zostało otwarte. */
  anchor?: { x: number; y: number } | null;
  /** Stan kontrolowany. Gdy `undefined` — popover trzyma stan sam (domyślne,
   * niezmienione zachowanie dla dotychczasowych konsumentów). */
  open?: boolean;
  onClose?: () => void;
}) {
  const [openState, setOpenState] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerWrapRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const measuredRef = useRef(false);

  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const setOpen = useCallback(
    (v: boolean) => {
      if (!controlled) setOpenState(v);
      if (!v) closeRef.current?.();
    },
    [controlled]
  );

  const place = useCallback(() => {
    // Wysokość znana dopiero, gdy menu jest w DOM — przy pierwszym otwarciu
    // szacujemy (tak samo jak przed trybem `anchor`).
    const estH = (menuRef.current?.offsetHeight ?? 250) + 8;
    if (anchor) {
      const left = Math.max(8, Math.min(anchor.x, window.innerWidth - width - 8));
      const top =
        anchor.y + estH > window.innerHeight - 8 ? Math.max(8, anchor.y - estH) : anchor.y + 2;
      setPos({ top, left });
      return;
    }
    const el = triggerWrapRef.current?.firstElementChild ?? triggerWrapRef.current;
    if (!el) return;
    const r = (el as HTMLElement).getBoundingClientRect();
    let left = align === "right" ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    // Domyślnie poniżej triggera; jeśli za blisko dołu ekranu — nad nim.
    const below = r.bottom + 6;
    const top = below + estH > window.innerHeight - 8 ? Math.max(8, r.top - estH) : below;
    setPos({ top, left });
  }, [align, width, anchor]);

  const openMenu = useCallback((e?: ReactMouseEvent) => {
    e?.stopPropagation();
    place();
    setOpen(true);
  }, [place, setOpen]);

  // Tryb `anchor`: nikt nie woła openMenu, więc pozycję liczymy na zmianę
  // punktu (także gdy menu przeskakuje z wiersza na wiersz przy otwartym menu).
  useEffect(() => {
    if (anchor && open) {
      measuredRef.current = false;
      place();
    }
  }, [anchor, open, place]);

  // Pierwsze `place()` liczy się PRZED zamontowaniem menu, więc wysokość jest
  // tylko szacowana (250 px). Realne menu bywa dwa razy wyższe (menu
  // kontekstowe leada z listą statusów mierzy ~490 px) i uciekało poza dolną
  // krawędź ekranu. Po zamontowaniu mierzymy naprawdę i przestawiamy raz —
  // `measuredRef` pilnuje, żeby setPos nie zapętlił efektu.
  useIsoLayoutEffect(() => {
    if (!open) {
      measuredRef.current = false;
      return;
    }
    if (!pos || measuredRef.current) return;
    measuredRef.current = true;
    place();
  }, [open, pos, place]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || triggerWrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => {
      if (anchor) setOpen(false);
      else place();
    };
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, place, anchor, setOpen]);

  return (
    <>
      {trigger && (
        <span ref={triggerWrapRef} className={triggerClassName}>
          {trigger(openMenu, open)}
        </span>
      )}
      {typeof document !== "undefined" &&
        pos &&
        // AnimatePresence musi być WEWNĄTRZ portalu (opakowywać motion.div),
        // nie na zewnątrz wywołania createPortal — portal to obiekt
        // ReactPortal, nie zwykły element, więc AnimatePresence owinięte
        // dookoła createPortal(...) nie potrafi go poprawnie sklonować/
        // wykryć zmiany obecności (popover po prostu przestawał się otwierać).
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -2 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                role="menu"
                // Prawy przycisk WEWNĄTRZ naszego menu nie ma wywoływać
                // natywnego menu przeglądarki nad nim.
                onContextMenu={(e) => e.preventDefault()}
                // `admin-linear` — portal renderuje się w <body>, poza scope'em
                // AppShell, więc bez tej klasy var(--fg)/var(--fg-muted)/
                // var(--hairline) spadają do jasnych tokenów strony publicznej
                // (ciemny tekst na tym samym ciemnym tle popovera = nieczytelne).
                className="admin-linear glass fixed z-[200] overflow-hidden rounded-lg py-1 text-[var(--fg)]"
                style={{ top: pos.top, left: pos.left, width }}
              >
                {children(() => setOpen(false))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

/* ── Menu kontekstowe (prawy przycisk) ─────────────────────────────────────
 * Cienka warstwa nad `Popover` w trybie `anchor` — całe trudne pozycjonowanie
 * (clamp do krawędzi, ucieczka w górę przy dole ekranu, portal, animacja,
 * click-outside, Esc) jest już w Popoverze i NIE jest tu powtarzane.
 *
 * Wzorzec użycia w liście: JEDEN `useContextMenu<T>()` + JEDEN `<ContextMenu>`
 * na listę (nie na wiersz), a każdy wiersz dostaje `onContextMenu={ctl.openAt(e, item)}`.
 * Menu kontekstowe jest zawsze SKRÓTEM — widoczne przyciski zostają.
 */

export type ContextMenuCtl<T> = {
  state: { anchor: { x: number; y: number }; item: T } | null;
  /** Podepnij pod `onContextMenu` wiersza/karty. Robi preventDefault (inaczej
   * wyskoczy natywne menu przeglądarki) i stopPropagation (żeby menu wiersza
   * nie przegrało z menu kontenera pod spodem). */
  openAt: (e: ReactMouseEvent, item: T) => void;
  close: () => void;
};

export function useContextMenu<T>(): ContextMenuCtl<T> {
  const [state, setState] = useState<{ anchor: { x: number; y: number }; item: T } | null>(null);
  const openAt = useCallback((e: ReactMouseEvent, item: T) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ anchor: { x: e.clientX, y: e.clientY }, item });
  }, []);
  const close = useCallback(() => setState(null), []);
  return { state, openAt, close };
}

/** Nawigacja klawiaturą po pozycjach menu. Pozycje znajdujemy z DOM
 * (`[role="menuitem"]`), bo treść menu jest dowolna (render-prop) — nie ma
 * tablicy opcji jak w `PropertyMenu`. Enter/Spacja działają natywnie na
 * <button>, więc obsługujemy tylko strzałki + Home/End. */
function ContextMenuItems({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const items = () =>
      Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []);
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      const list = items();
      if (!list.length) return;
      const i = list.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        list[(i + 1) % list.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        list[(i - 1 + list.length) % list.length]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        list[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        list[list.length - 1]?.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);
  // `max-h` + scroll: menu kontekstowe bywa długie (akcje + kopiowanie +
  // pełna lista statusów). Ograniczenie wysokości sprawia, że odbicie w górę
  // przy dolnej krawędzi zawsze wystarcza — bez tego bardzo długie menu nie
  // mieści się na ekranie w żadnym wariancie.
  return (
    <div ref={ref} className="max-h-[70vh] overflow-y-auto">
      {children}
    </div>
  );
}

export function ContextMenu<T>({
  ctl,
  width = 210,
  children,
}: {
  ctl: ContextMenuCtl<T>;
  width?: number;
  /** Treść menu dla klikniętego elementu. `close` domyka po akcji. */
  children: (item: T, close: () => void) => ReactNode;
}) {
  return (
    <Popover
      anchor={ctl.state?.anchor ?? null}
      open={ctl.state !== null}
      onClose={ctl.close}
      width={width}
    >
      {(close) =>
        ctl.state ? <ContextMenuItems>{children(ctl.state.item, close)}</ContextMenuItems> : null
      }
    </Popover>
  );
}

/** Pozycja menu kontekstowego. `danger` = akcja niszcząca (czerwony tekst). */
export function ContextMenuItem({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] outline-none disabled:opacity-40 ${
        danger
          ? "text-red-400 hover:bg-[#232327] focus-visible:bg-[#232327]"
          : "text-[#e9e9ea] hover:bg-[#232327] focus-visible:bg-[#232327]"
      }`}
    >
      {icon !== undefined && <span className="flex w-4 shrink-0 justify-center">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}

/** Wiersz-opcja do użycia w Popoverze (sekcje filtrów/widoku). */
export function MenuRow({
  icon,
  label,
  selected,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] text-[#e9e9ea] hover:bg-[#232327]"
    >
      {icon !== undefined && <span className="flex w-4 shrink-0 justify-center">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {selected && <IconCheck size={14} className="shrink-0 text-[#8a8f98]" />}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-0.5 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-[#62666d]">{children}</div>;
}

export function MenuDivider() {
  return <div className="my-1 border-t border-[#2a2b2f]" />;
}

export function PropertyMenu<T extends string>({
  value,
  options,
  onChange,
  children,
  align = "left",
  title,
  full = false,
}: {
  value?: T;
  options: MenuOption<T>[];
  onChange: (v: T) => void;
  /** Element-wyzwalacz (np. ikona statusu). Klik otwiera menu. */
  children: ReactNode;
  align?: "left" | "right";
  title?: string;
  /** true = trigger na pełną szerokość (wiersz właściwości w panelu). */
  full?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = align === "right" ? r.right - MENU_MIN_W : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_MIN_W - 8));
    const estH = options.length * ITEM_H + 10;
    const below = r.bottom + 4;
    const top = below + estH > window.innerHeight - 8 ? Math.max(8, r.top - estH - 4) : below;
    setPos({ top, left });
  }, [align, options.length]);

  const openMenu = (e: ReactMouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    place();
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, options.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const opt = options[active];
        if (opt) {
          onChange(opt.value);
          setOpen(false);
        }
      }
    };
    const onScroll = () => place();
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, options, active, onChange, place]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openMenu}
        title={title}
        className={full ? "flex w-full items-center" : "inline-flex items-center"}
      >
        {children}
      </button>
      {typeof document !== "undefined" &&
        pos &&
        // Patrz komentarz w Popover — AnimatePresence musi być wewnątrz
        // portalu, nie na zewnątrz createPortal(...).
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -2 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                role="menu"
                className="admin-linear glass fixed z-[200] w-max min-w-[190px] max-w-[340px] overflow-hidden rounded-lg py-1 text-[var(--fg)]"
                style={{ top: pos.top, left: pos.left }}
              >
                {options.map((opt, i) => (
                      <button
                        key={opt.value}
                        role="menuitemradio"
                        aria-checked={opt.value === value}
                        onMouseEnter={() => setActive(i)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onChange(opt.value);
                          setOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] text-[#e9e9ea] ${
                          i === active ? "bg-[#232327]" : ""
                        }`}
                      >
                        {opt.icon && <span className="flex w-4 shrink-0 justify-center">{opt.icon}</span>}
                        <span className="flex-1 truncate">{opt.label}</span>
                        {opt.value === value && <IconCheck size={14} className="shrink-0 text-[#8a8f98]" />}
                      </button>
                    ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
