"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Lead } from "./shared";

type Action = { id: string; label: string; hint?: string; run: () => void };

/** Cmd+K / Ctrl+K — szybkie akcje i wyszukiwanie leada po nazwie, bez
 * sięgania po mysz. Styl znany z Linear/Raycast. */
export function CommandPalette({
  open,
  onClose,
  leads,
  onAddLead,
  onOpenLead,
  onSwitchView,
  onOpenDiscover,
  onSendReport,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  leads: Lead[];
  onAddLead: () => void;
  onOpenLead: (id: string) => void;
  onSwitchView: (v: "kanban" | "table") => void;
  onOpenDiscover: () => void;
  onSendReport: () => void;
  onLogout: () => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const staticActions: Action[] = useMemo(
    () => [
      { id: "add", label: "+ Dodaj leada", hint: "N", run: onAddLead },
      { id: "kanban", label: "Widok: Tablica", run: () => onSwitchView("kanban") },
      { id: "table", label: "Widok: Tabela", run: () => onSwitchView("table") },
      { id: "discover", label: "✨ Znajdź nowe leady", run: onOpenDiscover },
      { id: "report", label: "Wyślij dzienny raport teraz", run: onSendReport },
      { id: "logout", label: "Wyloguj", run: onLogout },
    ],
    [onAddLead, onSwitchView, onOpenDiscover, onSendReport, onLogout]
  );

  const leadActions: Action[] = useMemo(
    () =>
      leads.slice(0, 300).map((l) => ({
        id: `lead:${l.id}`,
        label: l.firma,
        hint: l.status,
        run: () => onOpenLead(l.id),
      })),
    [leads, onOpenLead]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...staticActions, ...leadActions.slice(0, 8)];
    return [...staticActions, ...leadActions].filter((a) => a.label.toLowerCase().includes(q)).slice(0, 40);
  }, [query, staticActions, leadActions]);

  useEffect(() => setIndex(0), [query]);

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
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj akcji lub leada…"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onClose();
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setIndex((i) => Math.min(i + 1, results.length - 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setIndex((i) => Math.max(i - 1, 0));
                }
                if (e.key === "Enter" && results[index]) {
                  e.preventDefault();
                  runAndClose(results[index]);
                }
              }}
              className="w-full border-b hairline bg-transparent px-4 py-3 text-sm text-[var(--fg)] placeholder:text-muted focus:outline-none"
            />
            <div className="max-h-[50vh] overflow-y-auto p-1.5">
              {results.length === 0 ? (
                <p className="p-3 text-sm text-muted opacity-60">Brak wyników.</p>
              ) : (
                results.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() => runAndClose(a)}
                    onMouseEnter={() => setIndex(i)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                      i === index ? "bg-[var(--hairline)]" : ""
                    }`}
                  >
                    <span className="truncate">{a.label}</span>
                    {a.hint && <span className="ml-3 shrink-0 text-[10px] text-muted">{a.hint}</span>}
                  </button>
                ))
              )}
            </div>
            <div className="border-t hairline px-4 py-2 text-[10px] text-muted opacity-70">
              ↑↓ nawiguj · Enter wybierz · Esc zamknij
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
