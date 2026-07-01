"use client";

import Link from "next/link";
import { useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Locale } from "@/i18n/config";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

export function LogoMark({ size = 32 }: { size?: number }) {
  const gradientId = `ll-gradient-${useId()}`;

  return (
    <svg width={size} height={(size * 90) / 100} viewBox="0 0 100 90" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="100" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="35%" stopColor="#e85d9e" />
          <stop offset="70%" stopColor="#f5c563" />
          <stop offset="100%" stopColor="#fff7e8" />
        </linearGradient>
      </defs>
      {/* Back "L" — same orientation as the front one, offset up-left,
          like the rear R in the Rolls-Royce badge */}
      <motion.text
        x="14"
        y="50"
        fontFamily="var(--font-serif)"
        fontWeight="700"
        fontSize="60"
        fill={`url(#${gradientId})`}
        opacity={0.55}
        initial={{ opacity: 0, y: 44 }}
        animate={{ opacity: 0.55, y: 50 }}
        transition={{ duration: 0.7, ease }}
      >
        L
      </motion.text>
      {/* Front "L" — offset down-right, overlapping the back one */}
      <motion.text
        x="38"
        y="74"
        fontFamily="var(--font-serif)"
        fontWeight="700"
        fontSize="60"
        fill={`url(#${gradientId})`}
        initial={{ opacity: 0, y: 68 }}
        animate={{ opacity: 1, y: 74 }}
        transition={{ duration: 0.7, delay: 0.12, ease }}
      >
        L
      </motion.text>
      {/* Liquid-glass sheen */}
      <ellipse cx="34" cy="18" rx="32" ry="14" fill="#fff" opacity="0.18" />
    </svg>
  );
}

export function Logo({
  lang,
  showWordmark = true,
  size = 32,
  className = "",
}: {
  lang: Locale;
  showWordmark?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <Link
      href={`/${lang}`}
      className={`flex items-center gap-2.5 ${className}`}
    >
      <LogoMark size={size} />
      <AnimatePresence initial={false}>
        {showWordmark && (
          <motion.span
            key="wordmark"
            initial={{ opacity: 0, scaleY: 0.2 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.2 }}
            transition={{ duration: 0.35, ease }}
            style={{ transformOrigin: "center" }}
            className="text-liquid whitespace-nowrap font-sans text-lg font-bold uppercase tracking-[0.15em]"
          >
            Leggera Labs
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
