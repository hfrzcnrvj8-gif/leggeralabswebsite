"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ToastItem = { id: string; message: string; type: "success" | "error" };
type ConfirmState = { message: string; danger?: boolean; resolve: (v: boolean) => void } | null;
type PromptState = { message: string; placeholder?: string; resolve: (v: string | null) => void } | null;

export type Action = { id: string; label: string; hint?: string; run: () => void };

type UIContextType = {
  toast: (message: string, type?: "success" | "error") => void;
  confirm: (message: string, opts?: { danger?: boolean }) => Promise<boolean>;
  prompt: (message: string, opts?: { placeholder?: string }) => Promise<string | null>;
  contextActions: Action[];
  setContextActions: (actions: Action[]) => void;
};

const UIContext = createContext<UIContextType | null>(null);

/** Zamiast native window.confirm/alert/prompt — spójne z resztą UI, nie
 * blokuje wątku przeglądarki i da się to sensownie ostylować. Współdzielone
 * przez cały panel /admin (leady, projekty, notatnik, kalendarz, pulpit). */
export function useUI(): UIContextType {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI() musi być użyte wewnątrz <AdminUIProvider>");
  return ctx;
}

/**
 * Pozwala danej stronie "zgłosić" swoje szybkie akcje (np. "Dodaj leada") do
 * globalnej palety poleceń (Cmd+K) w AppShell — bez tego paleta znałaby
 * tylko nawigację, nie akcje właściwe dla aktualnie otwartego modułu.
 * Konwencja: akcja o id "add" jest też uruchamiana skrótem "n".
 */
export function useRegisterActions(actions: Action[], deps: unknown[]): void {
  const { setContextActions } = useUI();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setContextActions(actions);
    return () => setContextActions([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function AdminUIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [promptState, setPromptState] = useState<PromptState>(null);
  const [promptValue, setPromptValue] = useState("");
  const [contextActions, setContextActions] = useState<Action[]>([]);
  const promptInputRef = useRef<HTMLInputElement>(null);

  const toast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  const confirm = useCallback((message: string, opts?: { danger?: boolean }) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ message, danger: opts?.danger, resolve });
    });
  }, []);

  const prompt = useCallback((message: string, opts?: { placeholder?: string }) => {
    setPromptValue("");
    return new Promise<string | null>((resolve) => {
      setPromptState({ message, placeholder: opts?.placeholder, resolve });
    });
  }, []);

  useEffect(() => {
    if (promptState) {
      const t = window.setTimeout(() => promptInputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [promptState]);

  const closeConfirm = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };
  const closePrompt = (value: string | null) => {
    promptState?.resolve(value);
    setPromptState(null);
  };

  return (
    <UIContext.Provider value={{ toast, confirm, prompt, contextActions, setContextActions }}>
      {children}

      {/* Toasty */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-xs flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={`card-paper pointer-events-auto rounded-xl px-4 py-2.5 text-sm shadow-lg ${
                t.type === "error" ? "border-red-500/40 text-red-400" : ""
              }`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Confirm modal — zastępuje window.confirm */}
      <AnimatePresence>
        {confirmState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
            onClick={() => closeConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeConfirm(false);
                if (e.key === "Enter") closeConfirm(true);
              }}
              className="card-paper w-full max-w-sm rounded-2xl p-5"
              role="alertdialog"
              aria-modal="true"
            >
              <p className="text-sm leading-relaxed">{confirmState.message}</p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  autoFocus
                  onClick={() => closeConfirm(false)}
                  className="rounded-full border hairline px-3 py-1.5 text-xs"
                >
                  Anuluj
                </button>
                <button
                  onClick={() => closeConfirm(true)}
                  className={
                    confirmState.danger
                      ? "rounded-full bg-red-500/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                      : "btn-primary rounded-full px-3 py-1.5 text-xs font-semibold"
                  }
                >
                  Potwierdź
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt modal — zastępuje window.prompt */}
      <AnimatePresence>
        {promptState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
            onClick={() => closePrompt(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="card-paper w-full max-w-sm rounded-2xl p-5"
              role="dialog"
              aria-modal="true"
            >
              <p className="mb-3 text-sm leading-relaxed">{promptState.message}</p>
              <input
                ref={promptInputRef}
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={promptState.placeholder}
                onKeyDown={(e) => {
                  if (e.key === "Escape") closePrompt(null);
                  if (e.key === "Enter") closePrompt(promptValue.trim() || null);
                }}
                className="w-full rounded-lg border hairline bg-transparent px-3 py-2 text-sm text-[var(--fg)] placeholder:text-muted focus:border-brand-cyan/60 focus:outline-none"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => closePrompt(null)}
                  className="rounded-full border hairline px-3 py-1.5 text-xs"
                >
                  Anuluj
                </button>
                <button
                  onClick={() => closePrompt(promptValue.trim() || null)}
                  className="btn-primary rounded-full px-3 py-1.5 text-xs font-semibold"
                >
                  Dodaj
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </UIContext.Provider>
  );
}
