"use client";

import Link from "next/link";
import { useId } from "react";
import { motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import type { Locale } from "@/i18n/config";

// A faint dark rim keeps light letters (the gradient ends near-white)
// readable when they land on a light/cream background — most visibly the
// "S" in "LABS" against the footer's inverted-light surface.
const textStroke = { WebkitTextStroke: "0.4px rgba(20, 18, 15, 0.35)" };

const wordmarkGradient = {
  backgroundImage: "linear-gradient(100deg, #7C3AED 0%, #E0A93B 60%, #FFF7E8 100%)",
  WebkitBackgroundClip: "text" as const,
  backgroundClip: "text" as const,
  color: "transparent",
  ...textStroke,
};

// The second "L" (the solid foreground letter, and literally the "L" of
// "LABS" when the wordmark is fully expanded) always reads gold — fixed
// and independent of the outer shared gradient, so it stays reliably
// distinct from the purple echo behind it once the two overlap into the
// collapsed mark, instead of depending on how wide the surrounding box
// happens to be at that moment.
const secondLGradient = {
  backgroundImage: "linear-gradient(100deg, #E0A93B 0%, #FFF7E8 100%)",
  WebkitBackgroundClip: "text" as const,
  backgroundClip: "text" as const,
  color: "transparent",
  ...textStroke,
};

/** Static mark for contexts that can't run React/framer-motion (favicon, OG image). */
export function LogoMark({ size = 32 }: { size?: number }) {
  const gradientId = `ll-gradient-${useId()}`;
  return (
    <svg width={size} height={size} viewBox="0 0 90 90" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7C3AED" />
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
 * "EGGERA"/"ABS"/"." share ONE gradient/background-clip:text on the outer
 * span so the color reads as a single continuous sweep. The second "L"
 * gets its own fixed gold gradient instead (see `secondLGradient`) so it
 * stays reliably distinct from the purple echo once collapsed — it sits
 * at the gold end of the shared sweep anyway, so this doesn't create a
 * visible seam in the expanded phrase. Its offset uses `marginLeft` +
 * `verticalAlign` only (plain layout, safe).
 *
 * The first "L" (the faded echo) can NOT fade via `opacity`: any
 * descendant of a background-clip:text element that gets `opacity < 1`
 * is promoted to its own compositing layer, and since that descendant has
 * no background-image of its own, the isolated layer paints empty — the
 * letter silently disappears even though every computed style looks
 * correct. Confirmed by isolating it in an overlay: two plain sibling
 * spans both render, but the moment either one gets `opacity`, that one
 * (and only that one) vanishes. Fix: give the echo letter its own
 * gradient, blended toward a fixed dark neutral via `color-mix()` instead
 * of faded with `opacity`. Blending toward `var(--bg)` (tried first) reads
 * fine in dark mode but washes out to a pale pink in light mode, since
 * mixing purple with a light warm cream shifts the perceived hue —
 * blending toward a constant dark tone keeps the result recognizably
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
  const firstGradient = useTransform(firstMixPercent, (m) =>
    `linear-gradient(100deg, color-mix(in srgb, #7C3AED ${m}%, #14120f) 0%, color-mix(in srgb, #E0A93B ${m}%, #14120f) 60%, color-mix(in srgb, #FFF7E8 ${m}%, #14120f) 100%)`
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
            backgroundImage: firstGradient,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
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
            ...secondLGradient,
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
