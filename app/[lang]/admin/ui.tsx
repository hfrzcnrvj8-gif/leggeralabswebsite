"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SPRING, TWEEN_EXIT } from "@/lib/motion";
import {
  OknoPotwierdzenia,
  wykonajZadanie,
  type OpcjeZadania,
  type StanPotwierdzenia,
  type WynikZadania,
} from "./Potwierdzenie";

type ToastItem = { id: string; message: string; type: "success" | "error" };
type ConfirmState = { message: string; danger?: boolean; resolve: (v: boolean) => void } | null;
type PromptState = { message: string; placeholder?: string; resolve: (v: string | null) => void } | null;

/** Opcja pytania z WIĘCEJ niż dwoma wyjściami (`choose()`). Potrzebne, odkąd
 * wydarzenia i przypomnienia mogą być serią: „Usunąć?" ma wtedy trzy
 * odpowiedzi — tę okazję, całą serię, albo wcale — a `confirm()` z natury
 * unosi tylko dwie. */
export type ChoiceOption = { value: string; label: string; danger?: boolean };
type ChooseState = { message: string; options: ChoiceOption[]; resolve: (v: string | null) => void } | null;

export type Action = { id: string; label: string; hint?: string; run: () => void };

/** Czy zdarzenie klawiatury przyszło z pola tekstowego — używane przez
 * globalne skróty klawiszowe (paleta poleceń, "g o", "n" itd.), żeby nie
 * przechwytywały liter wpisywanych przez użytkownika w formularzu. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

type UIContextType = {
  toast: (message: string, type?: "success" | "error") => void;
  confirm: (message: string, opts?: { danger?: boolean }) => Promise<boolean>;
  prompt: (message: string, opts?: { placeholder?: string }) => Promise<string | null>;
  /** Pytanie z kilkoma wyjściami; `null` = użytkownik anulował. */
  choose: (message: string, options: ChoiceOption[]) => Promise<string | null>;
  /**
   * Żądanie do API, które samo obsługuje barierę „to jest nieodwracalne"
   * (Faza 4). Używaj go WSZĘDZIE, gdzie panel kasuje rekord, wysyła dokument,
   * wystawia fakturę albo unieważnia link — okno i jego treść przychodzą
   * z trasy, więc tutaj nie ma czego konfigurować ani o czym zapomnieć.
   *
   * Nie owijaj tego dodatkowym `confirm()` — byłyby dwa pytania pod rząd
   * o to samo, a to najkrótsza droga do klikania „tak" bez czytania.
   */
  zadanie: (url: string, opcje?: OpcjeZadania) => Promise<WynikZadania>;
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
 * Kopiowanie do schowka z potwierdzeniem toastem. Pusta/brakująca wartość nie
 * kopiuje niczego (kopiowanie "" wyglądałoby jak sukces, a czyściłoby schowek).
 * Używane głównie przez menu kontekstowe („kopiuj e-mail", „kopiuj NIP").
 */
export function useCopy(): (value: string | null | undefined, label: string) => Promise<void> {
  const { toast } = useUI();
  return useCallback(
    async (value: string | null | undefined, label: string) => {
      const text = (value ?? "").trim();
      if (!text) {
        toast(`Brak: ${label.toLowerCase()}`, "error");
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        toast(`Skopiowano: ${label.toLowerCase()}`);
      } catch {
        toast("Nie udało się skopiować", "error");
      }
    },
    [toast]
  );
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
  const [chooseState, setChooseState] = useState<ChooseState>(null);
  const [potwierdzenieState, setPotwierdzenieState] = useState<StanPotwierdzenia | null>(null);
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

  const choose = useCallback((message: string, options: ChoiceOption[]) => {
    return new Promise<string | null>((resolve) => {
      setChooseState({ message, options, resolve });
    });
  }, []);

  const zadanie = useCallback(
    (url: string, opcje?: OpcjeZadania) =>
      wykonajZadanie(url, opcje, (opis, doPrzepisania) =>
        new Promise<string | null | false>((resolve) => {
          setPotwierdzenieState({
            opis,
            doPrzepisania,
            resolve: (v) => {
              setPotwierdzenieState(null);
              resolve(v);
            },
          });
        })
      ),
    []
  );

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
  const closeChoose = (value: string | null) => {
    chooseState?.resolve(value);
    setChooseState(null);
  };

  /**
   * ZNALEZISKO D3 — „modal nie blokuje tego, co pod nim".
   *
   * Overlay `fixed inset-0` blokował MYSZ (sprawdzone `elementsFromPoint`:
   * na wierzchu stoi overlay), ale nie blokował KLAWIATURY: przy otwartym
   * oknie „Nazwa kamienia milowego" tabulatorem dawało się dojść do 44
   * elementów tła i wcisnąć je Enterem. Dwie warstwy interakcji naraz — tyle
   * że drugą drogą, niż się wydawało z opisu.
   *
   * `inert` wyłącza CAŁE poddrzewo z trafień myszy, fokusu i czytników
   * ekranu — niezależnie od tego, jaki kto ma z-index. To ważne, bo menu
   * i popovery panelu żyją na `z-[200]`, czyli wyżej niż overlay tych okien
   * (`z-[110]`); samo podbijanie z-indeksów byłoby wyścigiem bez końca.
   *
   * Opakowanie ma `display: contents`, więc nie tworzy pudełka i nie rusza
   * układu — sprawdzone w przeglądarce: fokus jest blokowany, a bez `inert`
   * wraca.
   */
  const cosOtwarte = !!(confirmState || promptState || chooseState || potwierdzenieState);

  return (
    <UIContext.Provider value={{ toast, confirm, prompt, choose, zadanie, contextActions, setContextActions }}>
      <div style={{ display: "contents" }} inert={cosOtwarte}>
        {children}
      </div>

      {/*
        ZNALEZISKO E2 — „okna potwierdzeń są jasne w ciemnym panelu".

        `AdminUIProvider` opakowuje `ShellBody`, a klasa `.admin-linear` (ciemna
        paleta panelu) siedzi DOPIERO w środku `ShellBody`. Wszystko, co ten
        provider renderuje obok `children` — toasty i cztery okna — leży więc
        POZA `.admin-linear` i dziedziczy jasną paletę strony publicznej.
        Zmierzone: `.card-paper` poza panelem ma tło `rgb(255,255,255)` i tekst
        `rgb(26,24,21)`, w panelu `rgb(13,14,16)` / `rgb(247,248,248)`.

        Dlatego KAŻDY z tych pięciu kontenerów nosi `admin-linear` jawnie — ten
        sam wzorzec, którym `Menu.tsx` i `Tooltip.tsx` ratują swoje portale
        renderowane w `<body>`. Klasa niesie same zmienne CSS, nie rusza układu.

        `text-[var(--fg)]` jest tu DRUGĄ POŁOWĄ poprawki, nie ozdobą: klasa
        `.admin-linear` niesie same ZMIENNE, a kolor tekstu panelu ustawia
        dopiero `text-[var(--fg)]` na jego kontenerze (`AppShell.tsx`). Po
        dołożeniu samej `admin-linear` karta zrobiła się ciemna, a tekst został
        czarny — zmierzone `rgb(13,14,16)` tła przy `rgb(26,24,21)` tekstu,
        czyli kontrast ~1:1. Gorzej niż przed poprawką.

        Dokładając tu szósty kontener: dopisz mu OBIE klasy. Bez nich nie będzie
        żadnego objawu w kodzie — tylko biała karta na ciemnym tle w panelu.
      */}
      <div className="admin-linear pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-xs flex-col gap-2 text-[var(--fg)]">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96, transition: TWEEN_EXIT }}
              transition={SPRING}
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
            className="admin-linear fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4 text-[var(--fg)] backdrop-blur-sm"
            onClick={() => closeConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={SPRING}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeConfirm(false);
                if (e.key === "Enter") closeConfirm(true);
              }}
              className="card-paper w-full max-w-sm rounded-2xl p-5"
              role="alertdialog"
              aria-modal="true"
            >
              {/* whitespace-pre-line — komunikat bywa wielolinijkowy (np.
                  pytanie o alias adresu w Poczcie rozbija na osobne linie, co
                  robi "Potwierdź", a co "Anuluj"). Jednolinijkowe komunikaty
                  wyglądają tak samo jak dotąd. */}
              <p className="whitespace-pre-line text-sm leading-relaxed">{confirmState.message}</p>
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
                      ? "rounded-full bg-red-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                      : "rounded-md bg-[var(--fg)] px-3 py-1.5 text-xs font-medium text-[var(--bg)] hover:opacity-90"
                  }
                >
                  Potwierdź
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Choose modal — pytanie z więcej niż dwoma wyjściami (np. „ta okazja
          czy cała seria?"). Opcje idą w KOLUMNIE, nie w rzędzie jak przy
          confirmie: przy trzech wyjściach rząd zmusza do czytania przycisków
          bokiem, a to jest dokładnie ten moment, w którym nie wolno się
          pomylić. Brak Entera jako skrótu — przy kilku równorzędnych
          odpowiedziach nie ma „tej domyślnej". */}
      <AnimatePresence>
        {chooseState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="admin-linear fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4 text-[var(--fg)] backdrop-blur-sm"
            onClick={() => closeChoose(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={SPRING}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeChoose(null);
              }}
              className="card-paper w-full max-w-sm rounded-2xl p-5"
              role="alertdialog"
              aria-modal="true"
            >
              <p className="whitespace-pre-line text-sm leading-relaxed">{chooseState.message}</p>
              <div className="mt-4 flex flex-col gap-2">
                {chooseState.options.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => closeChoose(o.value)}
                    className={
                      o.danger
                        ? "rounded-full bg-red-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                        : "rounded-full border hairline px-3 py-1.5 text-xs hover:bg-[var(--bg-soft)]"
                    }
                  >
                    {o.label}
                  </button>
                ))}
                <button
                  autoFocus
                  onClick={() => closeChoose(null)}
                  className="mt-1 rounded-full px-3 py-1.5 text-xs text-muted hover:text-[var(--fg)]"
                >
                  Anuluj
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Potwierdzenie działania nieodwracalnego (Faza 4). Treść okna
          przychodzi z TRASY (odpowiedź 428), nie jest tu zapisana — patrz
          nagłówek `Potwierdzenie.tsx`. Renderowane raz, na cały panel, tak
          samo jak confirm/prompt: dzięki temu żaden z kilkunastu ekranów,
          które kasują rekordy, nie musi o nim pamiętać. */}
      <AnimatePresence>
        {potwierdzenieState && <OknoPotwierdzenia key="potwierdzenie" stan={potwierdzenieState} />}
      </AnimatePresence>

      {/* Prompt modal — zastępuje window.prompt */}
      <AnimatePresence>
        {promptState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="admin-linear fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4 text-[var(--fg)] backdrop-blur-sm"
            onClick={() => closePrompt(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={SPRING}
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
                className="w-full rounded-lg border hairline bg-transparent px-3 py-2 text-sm text-[var(--fg)] placeholder:text-muted focus:border-zaznaczenie/60 focus:outline-none"
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
                  className="rounded-md bg-[var(--fg)] px-3 py-1.5 text-xs font-medium text-[var(--bg)] hover:opacity-90"
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
