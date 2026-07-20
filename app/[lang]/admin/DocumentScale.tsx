"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Szerokość dokumentu na ekranie — 794px ≈ A4 (210mm) przy 96dpi, ta sama
 * stała, na której stoi cały layout InvoicePrint/OfferPrint/ContractPrint. */
const SZEROKOSC_NATURALNA = 794;

/** Pomniejsza dokument A4 (zaprojektowany na sztywne 794px) do szerokości
 * ekranu telefonu, zamiast pozwolić mu uciec poza widoczny obszar.
 *
 * Zgłoszenie właściciela (2026-07-20): „na telefonie podgląd faktur się źle
 * generuje" — publiczny link z maila (`/pl/faktura/<token>`) otwiera się na
 * telefonie, ale tabela pozycji jest szersza niż ekran i wystaje bez
 * możliwości sensownego doczytania. Przyczyna: `InvoicePrint`/`OfferPrint`
 * mają sztywne `max-w-[794px]` — świadomie, żeby podgląd na ekranie 1:1
 * odzwierciedlał wydruk A4 — ale nikt nie przewidział otwarcia tej samej
 * strony w mobilnej przeglądarce.
 *
 * Rozwiązanie **to samo, co już raz zadziałało dla podglądu maila w apce**
 * (`WidokHTML` w `WiadomoscView.swift`): naturalna szerokość + pomniejszenie
 * całości transformem, NIE przebudowa układu ani zerowanie szerokości —
 * tamta droga (próbowana wcześniej dla maili) rozjeżdżała różne dokumenty
 * na różne sposoby.
 *
 * Na wydruku (`@media print`) skala wraca do naturalnej — `@page` w
 * dokumencie nadrzędnym już definiuje obszar strony, a transform popsułby
 * podział na strony wydruku.
 */
export function DokumentResponsywny({ children }: { children: React.ReactNode }) {
  const odnosnik = useRef<HTMLDivElement>(null);
  const [skala, setSkala] = useState(1);
  const [wysokosc, setWysokosc] = useState<number | null>(null);

  // `useLayoutEffect` — mierzymy PRZED pierwszym malowaniem, żeby dokument
  // nie mignął przez ułamek sekundy w pełnej, nieprzeskalowanej szerokości.
  useLayoutEffect(() => {
    function przelicz() {
      if (!odnosnik.current) return;
      setWysokosc(odnosnik.current.scrollHeight);
      // `document.documentElement.clientWidth`, NIE `window.innerWidth` —
      // to drugie w niektórych silnikach potrafi zgłosić poszerzony layout
      // viewport, kiedy strona ma (jeszcze) przelewającą się zawartość,
      // zamiast prawdziwej szerokości ekranu. Zmierzone wprost: różnica
      // 794px vs 375px na tej samej stronie w tym samym oknie.
      setSkala(Math.min(1, document.documentElement.clientWidth / SZEROKOSC_NATURALNA));
    }
    przelicz();
    window.addEventListener("resize", przelicz);
    // Zawartość dociąga się asynchronicznie (ustawienia firmy, kod QR z
    // KSeF) — sam `resize` okna tego nie złapie, więc obserwujemy realną
    // wysokość zmierzonego węzła.
    const obserwator = new ResizeObserver(przelicz);
    obserwator.observe(odnosnik.current!);
    return () => {
      window.removeEventListener("resize", przelicz);
      obserwator.disconnect();
    };
  }, []);

  // Transform NIE zmienia miejsca, jakie element zajmuje w układzie strony —
  // bez jawnego przeliczenia szerokości/wysokości kontenera na wartość PO
  // skali, pomniejszony dokument zostawiłby po sobie pustą przestrzeń
  // (wysoką na całą naturalną wysokość) i nie byłby wyśrodkowany.
  const szerokoscPoSkali = SZEROKOSC_NATURALNA * skala;
  const wysokoscPoSkali = wysokosc ? wysokosc * skala : undefined;

  return (
    <div
      className="skalowany-kontener"
      style={{ width: szerokoscPoSkali, height: wysokoscPoSkali }}
    >
      <style>{`
        .skalowany-kontener { margin: 0 auto; overflow: hidden; }
        .skalowany-tresc { width: ${SZEROKOSC_NATURALNA}px; transform: scale(${skala}); transform-origin: top left; }
        @media print {
          .skalowany-kontener { width: auto !important; height: auto !important; overflow: visible !important; }
          .skalowany-tresc { width: auto !important; transform: none !important; }
        }
      `}</style>
      <div ref={odnosnik} className="skalowany-tresc">
        {children}
      </div>
    </div>
  );
}
