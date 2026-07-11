"use client";

/** Prawdziwe logo Leggera Labs (dwa nachodzące na siebie "L", jak w
 * app/icon.svg i components/Logo.tsx) — tu jako sam kontur w gradiencie
 * marki, bez wypełnienia, na wniosek właściciela. Współdzielone między
 * wydrukiem faktury i oferty (InvoicePrint.tsx / OfferPrint.tsx) — było
 * zduplikowane 1:1 w obu plikach, różniło się tylko id gradientu (SVG
 * wymaga unikalnego id, gdy oba dokumenty renderują się na tej samej
 * stronie, np. w podglądzie korekty obok oryginału). */
export function DocLogoMark({ gradientId }: { gradientId: string }) {
  return (
    <svg viewBox="0 0 90 90" width="42" height="42" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#E0A93B" />
        </linearGradient>
      </defs>
      <text x="22" y="61" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="62" fill="none" stroke={`url(#${gradientId})`} strokeWidth="2.5">
        L
      </text>
      <text x="34" y="73" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="62" fill="none" stroke={`url(#${gradientId})`} strokeWidth="2.5">
        L
      </text>
    </svg>
  );
}
