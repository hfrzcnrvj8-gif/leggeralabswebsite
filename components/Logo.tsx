"use client";

import Link from "next/link";
import { useId, useState } from "react";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  AnimatePresence,
  type MotionValue,
} from "framer-motion";
import type { Locale } from "@/i18n/config";

// A faint dark rim keeps light letters (the gradient ends near-white)
// readable when they land on a light/cream background — most visibly the
// "S" in "LABS" against the footer's inverted-light surface.
const textStroke = { WebkitTextStroke: "0.4px rgba(20, 18, 15, 0.35)" };

// ONE continuous gradient across the whole phrase, applied to the outer
// wrapping span — "EGGERA" and "ABS" just inherit `color: transparent`
// from it and let the shared background-clip:text show through, so gold
// is already visibly creeping in by the end of "LEGGERA" rather than the
// word reading as purely purple until the second "L". The 65% stop sits
// right around where "EGGERA" ends / the second "L" begins, so the
// crossover itself mostly happens in the gap between words rather than
// smack in the middle of "EGGERA" — some blend is unavoidable (and
// wanted, per the brief: the whole point is that it "spills over" mid-
// word), it's just kept from dominating the word.
//
// The two L's are NOT part of this shared gradient — they're independent
// flat colors that happen to numerically match the gradient's own colors
// at their position (0% -> #7C3AED, ~65-70% -> ~#E0A93B), so at full
// expansion they're visually indistinguishable from "just inheriting the
// gradient," but they can independently animate to the muted-echo-purple
// / solid-gold pair needed once collapsed into the RR-style mark (see
// `firstColor` below). An element with opacity < 1 and no background of
// its own paints empty once promoted to its own compositing layer, which
// killed the very first version of the echo letter — flat `color`
// animated via `color-mix()` sidesteps that entirely.
const wordmarkGradient = {
  backgroundImage: "linear-gradient(100deg, #7C3AED 0%, #E0A93B 65%, #FFF7E8 100%)",
  WebkitBackgroundClip: "text" as const,
  backgroundClip: "text" as const,
  color: "transparent",
  ...textStroke,
};
const goldFlat = { color: "#E0A93B", ...textStroke };

/** Static mark for contexts that can't run React/framer-motion (favicon, OG image). */
export function LogoMark({ size = 32 }: { size?: number }) {
  const gradientId = `ll-gradient-${useId()}`;
  // Znak KONTUROWY (gradientowy obrys, bez wypełnienia) — spójny z ikoną
  // aplikacji, faviconem, znakiem w apce iOS i DocLogoMark na fakturze.
  // Blokowa „L" jako polygon (nie glif czcionki), żeby wyglądała identycznie
  // niezależnie od załadowanego fontu; proporcje 1:1 z `LogoMark` w apce.
  return (
    <svg width={size} height={size} viewBox="0 0 90 90" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="13.52" y1="1.96" x2="76.48" y2="88.04" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="60%" stopColor="#E0A93B" />
          <stop offset="100%" stopColor="#FFF7E8" />
        </linearGradient>
      </defs>
      <path
        d="M 13.52,1.96 L 29.84,1.96 L 29.84,56.63 L 58.40,56.63 L 58.40,69.96 L 13.52,69.96 Z"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={3.74}
        opacity={0.5}
      />
      <path
        d="M 31.60,20.04 L 47.92,20.04 L 47.92,74.72 L 76.48,74.72 L 76.48,88.04 L 31.60,88.04 Z"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={3.74}
      />
    </svg>
  );
}

/**
 * Logo ZAMIENNE (decyzja właściciela 2026-07-21):
 *  - pasek rozsunięty (progress ≈ 0, u góry strony) → PEŁEN napis
 *    „LEGGERA LABS." — dokładnie jak dotąd, bez zmian,
 *  - pasek zsunięty (progress > 0.5, po przewinięciu) → NOWY znak `LogoMark`
 *    (konturowe „LL"), ten sam co favicon / ikona apki / faktura.
 *
 * Wcześniej napis „zwijał się" w miejscu do dwóch WYPEŁNIONYCH liter L —
 * to był STARY znak, niespójny z nowym konturowym. Teraz zamiast zwijania
 * jest krótki crossfade między pełnym napisem a nowym znakiem.
 *
 * `progress` bywa `undefined` (stopka) — wtedy `p` stoi na 0 i widać sam
 * napis, na stałe.
 */
export function Logo({
  lang,
  progress,
  className = "",
}: {
  lang: Locale;
  progress?: MotionValue<number>;
  className?: string;
}) {
  const fallback = useMotionValue(0);
  const p = progress ?? fallback;
  const [zsuniete, setZsuniete] = useState(false);
  // Próg 0.5 z lekką histerezą, żeby na granicy przewinięcia znak nie
  // „mrugał" tam i z powrotem przy drobnym ruchu scrolla.
  useMotionValueEvent(p, "change", (v) => {
    setZsuniete((teraz) => (teraz ? v > 0.42 : v > 0.58));
  });

  return (
    <Link
      href={`/${lang}`}
      aria-label="Leggera Labs"
      className={`flex items-center ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {zsuniete ? (
          <motion.span
            key="mark"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex"
          >
            <LogoMark size={30} />
          </motion.span>
        ) : (
          <motion.span
            key="wordmark"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={wordmarkGradient}
            className="flex items-baseline whitespace-nowrap font-sans text-lg font-bold uppercase tracking-[0.15em]"
          >
            {/* Struktura napisu 1:1 z poprzednią wersją rozsuniętą — pierwsza
                „L" fiolet (flat, nie opacity — patrz historia buga niżej),
                „EGGERA"/„ABS" dziedziczą wspólny gradient, druga „L" złota,
                kropka cyan. */}
            <span style={{ color: "#7C3AED", ...textStroke }}>L</span>
            <span>EGGERA&nbsp;</span>
            <span style={goldFlat}>L</span>
            <span>ABS</span>
            <span className="text-brand-cyan">.</span>
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
