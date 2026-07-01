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
    <svg width={size} height={(size * 90) / 100} viewBox="0 0 100 90" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="100" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#E0A93B" />
        </linearGradient>
      </defs>
      <text x="18" y="70" fontFamily="var(--font-inter)" fontWeight="700" fontSize="70" fill={`url(#${gradientId})`}>
        L
      </text>
      <g transform="translate(82,70) scale(-1,1)">
        <text x="0" y="0" fontFamily="var(--font-inter)" fontWeight="700" fontSize="70" fill={`url(#${gradientId})`}>
          L
        </text>
      </g>
    </svg>
  );
}

/**
 * The two "L"s in LEGGERA and LABS are real motion.span elements with
 * `layout` enabled. Collapsing just removes their sibling text (AnimatePresence)
 * and mirrors + overlaps the second L — framer-motion's layout engine animates
 * the resulting reflow, so the letters visibly slide together into an
 * RR-style overlap instead of crossfading to a separate icon.
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
            animate={{ scaleX: collapsed ? -1 : 1, y: collapsed ? 3 : 0 }}
            transition={{ duration: 0.45, ease }}
            style={{
              display: "inline-block",
              marginLeft: collapsed ? "-0.32em" : "0px",
              transition: "margin-left 0.45s",
            }}
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
