"use client";

import Link from "next/link";
import { useId } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import type { Locale } from "@/i18n/config";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

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
 * The two "L"s in LEGGERA and LABS are real motion.span elements with
 * `layout` enabled. Collapsing removes the sibling text (AnimatePresence)
 * and turns the first "L" into a faded echo behind the second, offset
 * down-right — the PayPal double-letter formula, not a mirrored overlap.
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
      <LayoutGroup>
        <motion.span
          layout
          animate={{ scale: collapsed ? 1.8 : 1 }}
          transition={{ duration: 0.45, ease }}
          style={{ ...wordmarkGradient, transformOrigin: "left center" }}
          className="flex items-baseline font-sans text-lg font-bold uppercase tracking-[0.15em]"
        >
          <motion.span
            layout
            animate={{ opacity: collapsed ? 0.35 : 1 }}
            transition={{ duration: 0.45, ease }}
            style={{ display: "inline-block" }}
          >
            L
          </motion.span>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                key="eggera"
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease }}
                style={{ display: "inline-block" }}
              >
                EGGERA
              </motion.span>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                key="space"
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease }}
                style={{ display: "inline-block" }}
              >
                &nbsp;
              </motion.span>
            )}
          </AnimatePresence>
          <motion.span
            layout
            animate={{
              x: collapsed ? "-0.55em" : "0em",
              y: collapsed ? "0.15em" : "0em",
            }}
            transition={{ duration: 0.45, ease }}
            style={{ display: "inline-block" }}
          >
            L
          </motion.span>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                key="abs"
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease }}
                style={{ display: "inline-block" }}
              >
                ABS
              </motion.span>
            )}
          </AnimatePresence>
        </motion.span>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              key="dot"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease }}
              className="text-brand-cyan text-lg font-bold"
              style={{ display: "inline-block" }}
            >
              .
            </motion.span>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </Link>
  );
}
