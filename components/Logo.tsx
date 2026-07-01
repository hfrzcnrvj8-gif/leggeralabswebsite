"use client";

import Link from "next/link";
import { useId } from "react";
import { motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import type { Locale } from "@/i18n/config";

const wordmarkGradient = {
  backgroundImage: "linear-gradient(100deg, #7C3AED 0%, #E0A93B 100%)",
  WebkitBackgroundClip: "text" as const,
  backgroundClip: "text" as const,
  color: "transparent",
};

/** Static mark for contexts that can't run React/framer-motion (favicon, OG image). */
export function LogoMark({ size = 32 }: { size?: number }) {
  const gradientId = `ll-gradient-${useId()}`;
  return (
    <svg width={size} height={size} viewBox="0 0 90 90" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#E0A93B" />
        </linearGradient>
      </defs>
      <text x="18" y="55" fontFamily="var(--font-inter)" fontWeight="800" fontSize="62" fill={`url(#${gradientId})`} opacity={0.35}>
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
 * forming the same mark as LogoMark. Reversing scroll reverses it exactly.
 * Every text-bearing span keeps its own self-contained gradient (see the
 * "disappearing L" fix) rather than inheriting one from a shared parent —
 * a `transform`/`x`/`y` on a child breaks an inherited background-clip:text.
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

  const firstOpacity = useTransform(p, [0, 1], [1, 0.35]);
  const secondX = useTransform(p, [0, 1], [0, -9]);
  const secondY = useTransform(p, [0, 1], [0, 3]);
  const restOpacity = useTransform(p, [0, 0.6], [1, 0]);
  const restWidth = useTransform(p, [0, 0.6], [190, 0]);
  const dotWidth = useTransform(p, [0, 0.6], [16, 0]);

  return (
    <Link href={`/${lang}`} className={`flex items-center ${className}`}>
      <span className="flex items-baseline font-sans text-lg font-bold uppercase tracking-[0.15em]">
        <motion.span
          style={{ ...wordmarkGradient, opacity: firstOpacity, display: "inline-block" }}
        >
          L
        </motion.span>
        <motion.span
          style={{
            maxWidth: restWidth,
            opacity: restOpacity,
            overflow: "hidden",
            display: "inline-block",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ ...wordmarkGradient, display: "inline-block" }}>EGGERA</span>
          <span style={{ display: "inline-block" }}>&nbsp;</span>
        </motion.span>
        <motion.span
          style={{ ...wordmarkGradient, display: "inline-block", x: secondX, y: secondY }}
        >
          L
        </motion.span>
        <motion.span
          style={{
            maxWidth: restWidth,
            opacity: restOpacity,
            overflow: "hidden",
            display: "inline-block",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ ...wordmarkGradient, display: "inline-block" }}>ABS</span>
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
