"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { i18n, localeNames, type Locale } from "@/i18n/config";

export function LanguageSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const redirectedPath = (locale: Locale) => {
    if (!pathname) return `/${locale}`;
    const segments = pathname.split("/");
    segments[1] = locale;
    return segments.join("/") || `/${locale}`;
  };

  return (
    <div
      className="relative"
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        className="glass flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium uppercase tracking-wide transition-transform hover:scale-105"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current}
        <span className="text-[10px] opacity-60">▾</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="glass absolute right-0 top-12 w-40 overflow-hidden rounded-2xl p-1.5 shadow-2xl"
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
