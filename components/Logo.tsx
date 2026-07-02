"use client";

import Link from "next/link";
import { useId } from "react";
import { motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import type { Locale } from "@/i18n/config";

// A faint dark rim keeps light letters (the gradient ends near-white)
// readable when they land on a light/cream background — most visibly the
// "S" in "LABS" against the footer's inverted-light surface.
const textStroke = { WebkitTextStroke: "0.4px rgba(20, 18, 15, 0.35)" };

// The wordmark used to share ONE linear-gradient across the whole
// phrase via background-clip:text. Two attempts at that (a straight
// ramp, then a "plateaued" version with flat color stretches joined by
// short transitions) both had problems: a straight ramp put "EGGERA" in
// the purple/gold transition zone, where direct RGB interpolation
// between two near-complementary hues desaturates into a muddy tan
// (measured ~rgb(202,157,134)) right next to the L's pure flat colors —
// read as "the L's are way stronger for no reason," when really the
// rest of the word was muddy. The plateaued version fixed that in this
// (Chromium-based) testing setup, but broke into a wrong color entirely
// on an iOS WebKit browser that couldn't be tested directly here.
// Simplest fix that removes the risk instead of chasing it further: no
// engine-dependent gradient interpolation at all. Each letter group
// gets a flat color matching its neighboring "L" directly — "EGGERA"
// the same purple as the first L, "ABS" the same gold as the second.
const purpleStyle = { color: "#A78BFA", ...textStroke };
const goldStyle = { color: "#E0A93B", ...textStroke };

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
 * "EGGERA" and "ABS" are flat-colored (`purpleStyle`/`goldStyle`, see
 * above) rather than sharing a gradient with the two L's — see the note
 * on `purpleStyle` for why. The second "L"'s offset uses `marginLeft` +
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
    (m) => `color-mix(in srgb, #A78BFA ${m}%, #14120f)`
  );
  const secondMarginLeft = useTransform(p, [0, 1], [0, -9]);
  const secondVerticalAlign = useTransform(p, [0, 1], [0, -3]);
  const restOpacity = useTransform(p, [0, 0.6], [1, 0]);
  const restWidth = useTransform(p, [0, 0.6], [190, 0]);
  const dotWidth = useTransform(p, [0, 0.6], [16, 0]);

  return (
    <Link href={`/${lang}`} className={`flex items-center ${className}`}>
      <span className="flex items-baseline font-sans text-lg font-bold uppercase tracking-[0.15em]">
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
            ...purpleStyle,
          }}
        >
          EGGERA&nbsp;
        </motion.span>
        <motion.span
          style={{
            display: "inline-block",
            marginLeft: secondMarginLeft,
            verticalAlign: secondVerticalAlign,
            ...goldStyle,
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
            ...goldStyle,
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
