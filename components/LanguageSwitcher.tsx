"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { i18n, localeNames, type Locale } from "@/i18n/config";

export function LanguageSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const gradientId = `lang-switch-grad-${useId()}`;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const redirectedPath = (locale: Locale) => {
    if (!pathname) return `/${locale}`;
    const segments = pathname.split("/");
    segments[1] = locale;
    return segments.join("/") || `/${locale}`;
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-1 rounded-full px-3 transition-transform hover:scale-105"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={current.toUpperCase()}
      >
        <svg width="0" height="0" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="30" y2="16" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#E0A93B" />
            </linearGradient>
          </defs>
        </svg>
        <svg width="30" height="16" viewBox="0 0 30 16" className="block" aria-hidden>
          <text
            x="0"
            y="12"
            fontSize="13"
            fontWeight="700"
            letterSpacing="0.5"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="0.7"
          >
            {current.toUpperCase()}
          </text>
        </svg>
        <svg
          width="8"
          height="6"
          viewBox="0 0 8 6"
          className="block"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M1 1.5 4 4.5 7 1.5" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="glass absolute right-0 top-12 w-40 overflow-hidden rounded-2xl p-1.5 shadow-2xl"
            style={{ color: "var(--fg)" }}
            role="listbox"
          >
            {i18n.locales.map((locale) => (
              <li key={locale}>
                <Link
                  href={redirectedPath(locale)}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors hover:bg-white/10 ${
                    locale === current ? "text-liquid font-semibold" : ""
                  }`}
                >
                  <span>{localeNames[locale]}</span>
                  <span className="text-xs uppercase opacity-50">
                    {locale}
                  </span>
                </Link>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
