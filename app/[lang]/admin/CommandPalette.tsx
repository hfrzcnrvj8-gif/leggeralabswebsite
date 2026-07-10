"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Action } from "./ui";

/** Globalna paleta poleceń (Cmd+K), działa na każdej stronie panelu.
 * Prezentacyjna — logikę łączenia nawigacji + akcji kontekstowych strony +
 * wyników wyszukiwania globalnego trzyma AppShell, tu tylko renderujemy. */
export function CommandPalette({
  open,
  onClose,
  query,
  onQueryChange,
  actions,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  actions: Action[];
  loading?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setIndex(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => setIndex(0), [actions]);

  const runAndClose = (action: Action) => {
    action.run();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            className="card-paper w-full max-w-lg overflow-hidden rounded-2xl"
            role="dialog"
            aria-modal="true"
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Szukaj wszędzie — leady, projekty, notatki, wydarzenia, akcje…"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onClose();
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setIndex((i) => Math.min(i + 1, actions.length - 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setIndex((i) => Math.max(i - 1, 0));
                }
                if (e.key === "Enter" && actions[index]) {
                  e.preventDefault();
                  runAndClose(actions[index]);
                }
              }}
              className="w-full border-b hairline bg-transparent px-4 py-3 text-sm text-[var(--fg)] placeholder:text-muted focus:outline-none"
            />
            <div className="max-h-[50vh] overflow-y-auto p-1.5">
              {actions.length === 0 ? (
                <p className="p-3 text-sm text-muted opacity-60">{loading ? "Szukam…" : "🔍 Brak wyników."}</p>
              ) : (
                actions.map((a, i) => (
                  <motion.button
                    key={a.id}
                    onClick={() => runAndClose(a)}
                    onMouseEnter={() => setIndex(i)}
                    whileTap={{ scale: 0.98 }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                      i === index ? "bg-[var(--hairline)]" : ""
                    }`}
                  >
                    <span className="truncate">{a.label}</span>
                    {a.hint && <span className="ml-3 shrink-0 text-[10px] text-muted">{a.hint}</span>}
                  </motion.button>
                ))
              )}
            </div>
            <div className="border-t hairline px-4 py-2 text-[10px] text-muted opacity-70">
              ↑↓ nawiguj · Enter wybierz · Esc zamknij · poza paletą: g + h/p/n/c/l — szybkie przejście
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
