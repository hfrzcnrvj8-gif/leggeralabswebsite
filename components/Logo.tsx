"use client";

import Link from "next/link";
import { useId } from "react";
import { motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
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
  return (
    <svg width={size} height={size} viewBox="0 0 90 90" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="60%" stopColor="#E0A93B" />
          <stop offset="100%" stopColor="#FFF7E8" />
        </linearGradient>
      </defs>
      <text x="18" y="55" fontFamily="var(--font-inter)" fontWeight="800" fontSize="62" fill={`url(#${gradientId})`} opacity={0.5}>
        L
      </text>
      <text x="30" y="67" fontFamily="var(--font-inter)" fontWeight="800" fontSize="62" fill={`url(#${gradientId})`}>
        L
      </text>
    </svg>
  );
}

/**
 * `progress` is a 0→1 scroll-linked MotionValue (see Header.tsx), the same
 * pattern as the Hero orb parallax and the Showcase window's width grow —
 * NOT a boolean toggle. The wordmark shrinks in place continuously as you
 * scroll: "EGGERA"/" "/"ABS"/"." collapse their own width+opacity together,
 * while the second "L" slides into a tight offset behind the first,
 * forming the same mark as LogoMark.
 *
 * "EGGERA" and "ABS" inherit the shared `wordmarkGradient` from the
 * outer span (see above for why the two L's don't). The second "L" is
 * a flat color (`goldFlat`); its offset uses `marginLeft` +
 * `verticalAlign` only (plain layout, safe).
 *
 * The first "L" (the faded echo) can NOT fade via `opacity`: any
 * descendant of a background-clip:text element that gets `opacity < 1`
 * is promoted to its own compositing layer, and since that descendant has
 * no background-image of its own, the isolated layer paints empty — the
 * letter silently disappears even though every computed style looks
 * correct. Confirmed by isolating it in an overlay: two plain sibling
 * spans both render, but the moment either one gets `opacity`, that one
 * (and only that one) vanishes. Fix: fade it with a flat `color-mix()`
 * result on the plain `color` property instead — no gradient, no
 * background-clip, so there's nothing for an isolated layer to lose.
 * Blended toward a fixed dark neutral rather than `var(--bg)`: mixing
 * purple with the light theme's warm cream shifts the perceived hue
 * toward pale pink, while blending toward a constant dark tone reads as
 * purple in both themes.
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

  const firstMixPercent = useTransform(p, [0, 1], [100, 80]);
  const firstColor = useTransform(
    firstMixPercent,
    (m) => `color-mix(in srgb, #7C3AED ${m}%, #14120f)`
  );
  const secondMarginLeft = useTransform(p, [0, 1], [0, -9]);
  const secondVerticalAlign = useTransform(p, [0, 1], [0, -3]);
  const restOpacity = useTransform(p, [0, 0.6], [1, 0]);
  const restWidth = useTransform(p, [0, 0.6], [190, 0]);
  const dotWidth = useTransform(p, [0, 0.6], [16, 0]);

  return (
    <Link href={`/${lang}`} className={`flex items-center ${className}`}>
      <span
        style={wordmarkGradient}
        className="flex items-baseline font-sans text-lg font-bold uppercase tracking-[0.15em]"
      >
        <motion.span
          style={{
            color: firstColor,
            display: "inline-block",
            ...textStroke,
          }}
        >
          L
        </motion.span>
        <motion.span
          style={{
            maxWidth: restWidth,
            overflow: "hidden",
            display: "inline-block",
            whiteSpace: "nowrap",
          }}
        >
          EGGERA&nbsp;
        </motion.span>
        <motion.span
          style={{
            display: "inline-block",
            marginLeft: secondMarginLeft,
            verticalAlign: secondVerticalAlign,
            ...goldFlat,
          }}
        >
          L
        </motion.span>
        <motion.span
          style={{
            maxWidth: restWidth,
            overflow: "hidden",
            display: "inline-block",
            whiteSpace: "nowrap",
          }}
        >
          ABS
        </motion.span>
      </span>
      <motion.span
        style={{
          maxWidth: dotWidth,
          opacity: restOpacity,
          overflow: "hidden",
          display: "inline-block",
        }}
        className="text-brand-cyan text-lg font-bold"
      >
        .
      </motion.span>
    </Link>
  );
}
