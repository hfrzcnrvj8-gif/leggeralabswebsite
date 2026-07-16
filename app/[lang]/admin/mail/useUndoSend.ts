"use client";

// Etap 1 Modułu 4b — "Cofnij wysyłkę". Świadomie po stronie KLIENTA (decyzja
// właściciela 2026-07-15): panel na Vercelu nie utrzymuje kolejki między
// zimnymi startami funkcji serverless, więc jedyny "tani" sposób na odroczoną
// wysyłkę to odliczanie w przeglądarce — dokładnie tak, jak sugeruje brief
// (`docs/plany-modulow/04b-poczta-pelny-klient.md`, "Cofnij wysyłkę").
// Dotyczy WSZYSTKICH ścieżek wysyłki (Odpisz/Wszystkim/Przekaż/Nowa) — jedna
// implementacja, spójne zachowanie w całym module.
import { useCallback, useEffect, useRef, useState } from "react";

export const UNDO_SEND_DELAY_MS = 10_000;

export function useUndoSend(delayMs: number = UNDO_SEND_DELAY_MS) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
    if (intervalRef.current != null) window.clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
  }, []);

  /** Rozpoczyna odliczanie; `action` wykonuje się dopiero po jego końcu,
   * chyba że w międzyczasie ktoś wywoła cancel(). */
  const start = useCallback(
    (action: () => void | Promise<void>) => {
      clear();
      setCountdown(Math.ceil(delayMs / 1000));
      intervalRef.current = window.setInterval(() => {
        setCountdown((c) => (c !== null && c > 1 ? c - 1 : c));
      }, 1000);
      timeoutRef.current = window.setTimeout(() => {
        clear();
        setCountdown(null);
        void action();
      }, delayMs);
    },
    [clear, delayMs]
  );

  const cancel = useCallback(() => {
    clear();
    setCountdown(null);
  }, [clear]);

  // Nawigacja w trakcie odliczania (zamknięcie modala) nie ma wysłać maila
  // po cichu w tle.
  useEffect(() => clear, [clear]);

  return { countdown, start, cancel, sending: countdown !== null };
}
