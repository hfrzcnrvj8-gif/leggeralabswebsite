"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="glass relative grid h-10 w-10 place-items-center rounded-full transition-transform hover:scale-105 active:scale-95"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={mounted ? (isDark ? "moon" : "sun") : "placeholder"}
          initial={{ opacity: 0, rotate: -40, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 40, scale: 0.5 }}
          transition={{ duration: 0.25 }}
          className="text-base"
        >
          {!mounted ? "" : isDark ? "☾" : "☀"}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
