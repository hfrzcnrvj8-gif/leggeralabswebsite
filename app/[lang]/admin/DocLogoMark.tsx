"use client";

import { DOC_GRAD_OD, DOC_GRAD_DO_PASEK, DOC_GRAD_DO_TEKST } from "./DocGradient";

/** Prawdziwe logo Leggera Labs (dwa nachodzące na siebie "L") — sam kontur
 * w gradiencie marki, bez wypełnienia. Współdzielone między wydrukiem faktury
 * i oferty (InvoicePrint.tsx / OfferPrint.tsx) — było zduplikowane 1:1 w obu
 * plikach, różniło się tylko id gradientu (SVG wymaga unikalnego id, gdy oba
 * dokumenty renderują się na tej samej stronie, np. w podglądzie korekty
 * obok oryginału).
 *
 * Od 2026-07-21 blokowa „L" jako polygon (nie glif Ariala) — 1:1 z ikoną
 * aplikacji, faviconem (`app/icon.svg`), znakiem na stronie (`components/
 * Logo.tsx`) i znakiem w apce iOS. Właściciel chciał JEDEN spójny znak
 * wszędzie; glif czcionki wychodził inaczej niż blokowy znak reszty.
 *
 * **Gradient przystosowany do DRUKU (2026-07-27, zgłoszenie „logo się nie
 * drukuje").** Znak miał wcześniej stopnie `#A78BFA → #E0A93B → #FFF7E8`,
 * czyli jasny fiolet przechodzący w KREMOWĄ BIEL — na ekranie efektowne,
 * na białej kartce znikające. Zmierzone na wydruku: najciemniejszy piksel
 * całego znaku dawał kontrast 2,75:1 wobec bieli, a dolna prawa część
 * (końcówka gradientu) była praktycznie biała; tylna „L" przy 50% krycia
 * nie istniała. Na drukarce czarno-białej zostawał ledwie widoczny zarys.
 *
 * Teraz ten sam UKŁAD stopni co w oryginale (fiolet → złoto marki → cieplejsza
 * końcówka), tylko biel zamieniona na ciemniejszy bursztyn z `DocGradient.tsx`,
 * a tylna „L" podniesiona z 0,5 na 0,6. Dwustopniowy gradient fiolet→bursztyn
 * był po drodze odrzucony: bez złota w środku blend robił się brudnobrązowy.
 * Znak zachowuje geometrię i rodzinę koloru, ale wychodzi na papier —
 * także monochromatyczny. Ten komponent jest używany WYŁĄCZNIE na czterech
 * stronach wydruku, więc zmiana nie dotyka znaku na stronie ani w apce. */
export function DocLogoMark({ gradientId }: { gradientId: string }) {
  return (
    <svg viewBox="0 0 90 90" width="42" height="42" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={gradientId} x1="13.52" y1="1.96" x2="76.48" y2="88.04" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={DOC_GRAD_OD} />
          <stop offset="60%" stopColor={DOC_GRAD_DO_PASEK} />
          <stop offset="100%" stopColor={DOC_GRAD_DO_TEKST} />
        </linearGradient>
      </defs>
      <path
        d="M 13.52,1.96 L 29.84,1.96 L 29.84,56.63 L 58.40,56.63 L 58.40,69.96 L 13.52,69.96 Z"
        fill="none" stroke={`url(#${gradientId})`} strokeWidth="3.74" opacity="0.6"
      />
      <path
        d="M 31.60,20.04 L 47.92,20.04 L 47.92,74.72 L 76.48,74.72 L 76.48,88.04 L 31.60,88.04 Z"
        fill="none" stroke={`url(#${gradientId})`} strokeWidth="3.74"
      />
    </svg>
  );
}
