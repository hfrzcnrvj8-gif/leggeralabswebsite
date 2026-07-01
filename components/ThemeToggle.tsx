"use client";

import { useEffect, useId, useState } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const gradientId = `theme-toggle-grad-${useId()}`;

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="grid h-10 w-10 place-items-center rounded-full transition-transform hover:scale-105 active:scale-95"
    >
      {/* absolute: a 0x0 sibling would otherwise become its own implicit
          grid row (place-items-center centers the *content*, not the
          container, so an empty second row shifts the visible icon's
          centering by a few px) */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#E0A93B" />
          </linearGradient>
        </defs>
      </svg>
      <AnimatePresence mode="wait" initial={false}>
        <motion.svg
          key={mounted ? (isDark ? "moon" : "sun") : "placeholder"}
          initial={{ opacity: 0, rotate: -40, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 40, scale: 0.5 }}
          transition={{ duration: 0.25 }}
          width="20"
          height="20"
          viewBox="0 0 20 20"
          className="block"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {!mounted ? null : isDark ? (
            <path d="M17 11.2A7 7 0 0 1 8.8 3 6.5 6.5 0 1 0 17 11.2Z" />
          ) : (
            <>
              <circle cx="10" cy="10" r="3.4" />
              <path d="M10 2.2v2M10 15.8v2M17.8 10h-2M4.2 10h-2M15.5 4.5l-1.4 1.4M5.9 14.1l-1.4 1.4M15.5 15.5l-1.4-1.4M5.9 5.9 4.5 4.5" />
            </>
          )}
        </motion.svg>
      </AnimatePresence>
    </button>
  );
}
