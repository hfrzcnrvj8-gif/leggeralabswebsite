"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
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

export function PropertyMenu<T extends string>({
  value,
  options,
  onChange,
  children,
  align = "left",
  title,
}: {
  value?: T;
  options: MenuOption<T>[];
  onChange: (v: T) => void;
  /** Element-wyzwalacz (np. ikona statusu). Klik otwiera menu. */
  children: ReactNode;
  align?: "left" | "right";
  title?: string;
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

  const openMenu = (e: React.MouseEvent) => {
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
        className="inline-flex items-center"
      >
        {children}
      </button>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.97, y: -2 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.1, ease: "easeOut" }}
                onClick={(e) => e.stopPropagation()}
                role="menu"
                className="fixed z-[200] overflow-hidden rounded-lg border border-[#2a2b2f] bg-[#141518] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                style={{ top: pos.top, left: pos.left, minWidth: MENU_MIN_W }}
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
