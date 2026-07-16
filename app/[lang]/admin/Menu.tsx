"use client";

import {
  useCallback,
  useEffect,
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

/** Generyczny popover — dowolna treść w portalu do <body>, z pozycjonowaniem
 * od triggera, zamknięciem po kliknięciu poza / Esc. Baza pod menu Filtry,
 * Widok, kontekstowe itd. Treść dostaje `close` do zamknięcia po akcji. */
export function Popover({
  trigger,
  children,
  align = "left",
  width = 240,
  triggerClassName = "inline-flex",
}: {
  trigger: (open: (e?: ReactMouseEvent) => void, isOpen: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  width?: number;
  /** Klasa wrappera triggera — domyślnie `inline-flex`. Nadpisz na np.
   * `flex h-full w-full`, gdy trigger musi wypełnić komórkę siatki (np.
   * dzień w kalendarzu). */
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerWrapRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const el = triggerWrapRef.current?.firstElementChild ?? triggerWrapRef.current;
    if (!el) return;
    const r = (el as HTMLElement).getBoundingClientRect();
    let left = align === "right" ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    // Domyślnie poniżej triggera; jeśli za blisko dołu ekranu — nad nim.
    const estH = (menuRef.current?.offsetHeight ?? 250) + 8;
    const below = r.bottom + 6;
    const top = below + estH > window.innerHeight - 8 ? Math.max(8, r.top - estH) : below;
    setPos({ top, left });
  }, [align, width]);

  const openMenu = useCallback((e?: ReactMouseEvent) => {
    e?.stopPropagation();
    place();
    setOpen(true);
  }, [place]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || triggerWrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
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
  }, [open, place]);

  return (
    <>
      <span ref={triggerWrapRef} className={triggerClassName}>
        {trigger(openMenu, open)}
      </span>
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
