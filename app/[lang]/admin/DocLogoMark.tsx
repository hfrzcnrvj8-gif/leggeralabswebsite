"use client";

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
 * wszędzie; glif czcionki wychodził inaczej niż blokowy znak reszty. */
export function DocLogoMark({ gradientId }: { gradientId: string }) {
  return (
    <svg viewBox="0 0 90 90" width="42" height="42" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={gradientId} x1="13.52" y1="1.96" x2="76.48" y2="88.04" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="60%" stopColor="#E0A93B" />
          <stop offset="100%" stopColor="#FFF7E8" />
        </linearGradient>
      </defs>
      <path
        d="M 13.52,1.96 L 29.84,1.96 L 29.84,56.63 L 58.40,56.63 L 58.40,69.96 L 13.52,69.96 Z"
        fill="none" stroke={`url(#${gradientId})`} strokeWidth="3.74" opacity="0.5"
      />
      <path
        d="M 31.60,20.04 L 47.92,20.04 L 47.92,74.72 L 76.48,74.72 L 76.48,88.04 L 31.60,88.04 Z"
        fill="none" stroke={`url(#${gradientId})`} strokeWidth="3.74"
      />
    </svg>
  );
}
