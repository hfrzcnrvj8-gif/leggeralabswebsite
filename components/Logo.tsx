"use client";

import Link from "next/link";
import { useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Locale } from "@/i18n/config";

const wordmarkGradient = {
  backgroundImage: "linear-gradient(100deg, #7C3AED 0%, #E0A93B 100%)",
  WebkitBackgroundClip: "text" as const,
  backgroundClip: "text" as const,
  color: "transparent",
};

const fadeTransition = { duration: 0.3 };

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
 * Every text segment carries its OWN background-clip:text gradient rather
 * than inheriting one from a shared parent. A shared parent gradient +
 * a `transform` on one descendant (needed for the offset "echo" letter)
 * made that descendant render invisible in production — background-clip
 * text and a transformed child don't compose reliably. Self-contained
 * gradients per span side-steps that entirely.
 */
export function Logo({
  lang,
  collapsed = false,
  className = "",
}: {
  lang: Locale;
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <Link href={`/${lang}`} className={`flex items-center ${className}`}>
      <span
        style={{
          display: "flex",
          transform: collapsed ? "scale(1.8)" : "scale(1)",
          transformOrigin: "left center",
          transition: "transform 0.45s cubic-bezier(0.22,1,0.36,1)",
        }}
        className="items-baseline font-sans text-lg font-bold uppercase tracking-[0.15em]"
      >
        <span
          style={{
            ...wordmarkGradient,
            display: "inline-block",
            opacity: collapsed ? 0.35 : 1,
            transition: "opacity 0.45s ease",
          }}
        >
          L
        </span>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              key="eggera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fadeTransition}
              style={{ ...wordmarkGradient, display: "inline-block" }}
            >
              EGGERA
            </motion.span>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              key="space"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fadeTransition}
              style={{ display: "inline-block" }}
            >
              &nbsp;
            </motion.span>
          )}
        </AnimatePresence>
        <span
          style={{
            ...wordmarkGradient,
            display: "inline-block",
            transform: collapsed ? "translate(-0.55em, 0.15em)" : "translate(0em, 0em)",
            transition: "transform 0.45s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          L
        </span>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              key="abs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fadeTransition}
              style={{ ...wordmarkGradient, display: "inline-block" }}
            >
              ABS
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            key="dot"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
            className="text-brand-cyan text-lg font-bold"
            style={{ display: "inline-block" }}
          >
            .
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
