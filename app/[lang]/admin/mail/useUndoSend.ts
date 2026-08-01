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

/**
 * @param onPorzucone Wołane, gdy odliczanie przerwało WYJŚCIE (zamknięcie okna
 *   pisania, przejście na inny ekran), a nie świadome „Cofnij". Wiadomość
 *   wtedy NIE leci — i właśnie o tym trzeba powiedzieć.
 *
 *   **Dlaczego to jest osobna sprawa od `cancel()`** (pomiar Modułu 65,
 *   decyzja właściciela 2026-08-01): zachowanie „zamknięcie karty w 5. sekundzie
 *   = mail przepada" jest do obrony i zostaje, bo alternatywa — wysyłka w tle
 *   po ruchu, który wygląda jak rezygnacja — jest gorsza. Nie do obrony było
 *   to, że działo się w CISZY: ekran do ostatniej chwili pisał „Wysyłam za 5s…",
 *   więc właściciel miał pełne prawo sądzić, że mail poszedł.
 */
export function useUndoSend(delayMs: number = UNDO_SEND_DELAY_MS, onPorzucone?: () => void) {
  const [countdown, setCountdown] = useState<number | null>(null);
  // Faktyczna wysyłka w toku — od końca odliczania do rozstrzygnięcia się
  // action() (sukces LUB błąd). Odrębne od `sending` (=odliczanie), bo bez
  // tego UI wracał do stanu bezczynności w chwili końca odliczania, mimo że
  // prawdziwy fetch (SMTP+IMAP, kilka sekund) wciąż trwał — wyglądało to jak
  // zawieszenie, zgłoszone przez właściciela.
  const [submitting, setSubmitting] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  /** Czy odliczanie trwa — w REFIE, nie w stanie: sprzątanie przy odmontowaniu
   * czyta wartość z chwili odmontowania, a domknięcie po stanie miałoby tam
   * wartość z ostatniego renderu. */
  const odliczaRef = useRef(false);
  /** Callback w refie, żeby efekt sprzątający nie przeładowywał się przy każdej
   * nowej instancji funkcji od wołającego (a tym samym nie gubił odliczania). */
  const onPorzuconeRef = useRef(onPorzucone);
  useEffect(() => {
    onPorzuconeRef.current = onPorzucone;
  });
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
      odliczaRef.current = true;
      setCountdown(Math.ceil(delayMs / 1000));
      intervalRef.current = window.setInterval(() => {
        setCountdown((c) => (c !== null && c > 1 ? c - 1 : c));
      }, 1000);
      timeoutRef.current = window.setTimeout(() => {
        clear();
        // Odliczanie się SKOŃCZYŁO — od tej chwili wysyłka leci i odmontowanie
        // nie jest już „porzuceniem" (fetch dokończy się bez komponentu).
        odliczaRef.current = false;
        setCountdown(null);
        setSubmitting(true);
        Promise.resolve()
          .then(action)
          .finally(() => {
            if (mountedRef.current) setSubmitting(false);
          });
      }, delayMs);
    },
    [clear, delayMs]
  );

  const cancel = useCallback(() => {
    // Cancel ma sens TYLKO w trakcie odliczania — po starcie prawdziwej
    // wysyłki fetch już leci, nie ma czego anulować.
    odliczaRef.current = false;
    clear();
    setCountdown(null);
  }, [clear]);

  // Ostrzeżenie przeglądarki przy zamknięciu karty/przeładowaniu w trakcie
  // odliczania. Systemowe okno „opuścić stronę?" jest jedynym sposobem, jaki
  // strona ma na zatrzymanie tego ruchu — własnego dialogu przeglądarka tu nie
  // pokaże. Wieszamy je TYLKO na czas odliczania, żeby zwykłe zamknięcie
  // panelu niczego nie pytało.
  useEffect(() => {
    if (countdown === null) return;
    const ostrzez = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", ostrzez);
    return () => window.removeEventListener("beforeunload", ostrzez);
  }, [countdown]);

  // Nawigacja w trakcie odliczania (zamknięcie modala) nie ma wysłać maila
  // po cichu w tle — ale też nie ma go po cichu zgubić: `onPorzucone` mówi
  // wprost, że wiadomość nie poleciała.
  useEffect(
    () => () => {
      if (odliczaRef.current) {
        odliczaRef.current = false;
        onPorzuconeRef.current?.();
      }
      clear();
    },
    [clear]
  );

  return { countdown, start, cancel, sending: countdown !== null, submitting };
}
