"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Logo } from "./Logo";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

export function Header({
  lang,
  nav,
  footer,
}: {
  lang: Locale;
  nav: Dictionary["nav"];
  footer: Dictionary["footer"];
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  const collapseProgress = useTransform(scrollY, [0, 160], [0, 1]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#vision", label: nav.vision },
    { href: "#services", label: nav.services },
    { href: "#showcase", label: nav.work },
  ];

  const pages = [
    { href: `/${lang}/privacy`, label: footer.privacy },
    { href: `/${lang}/impressum`, label: footer.impressum },
  ];

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <div className="w-full max-w-6xl">
        <nav
          className={`flex w-full items-center justify-between rounded-full px-5 py-2.5 transition-all duration-500 ${
            scrolled || menuOpen ? "glass shadow-xl" : "border border-transparent"
          }`}
        >
          <Logo lang={lang} progress={collapseProgress} />

          <div className="relative flex items-center gap-2">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              className="grid h-10 w-10 place-items-center rounded-full transition-transform hover:scale-105 sm:glass"
            >
              <span className="relative block h-4 w-[18px]">
                <motion.span
                  animate={{
                    rotate: menuOpen ? 45 : 0,
                    y: menuOpen ? 7 : 0,
                  }}
                  transition={{ duration: 0.25, ease }}
                  className="absolute inset-x-0 top-0 h-[2px] rounded-full"
                  style={{ background: "var(--fg)" }}
                />
                <motion.span
                  animate={{ opacity: menuOpen ? 0 : 1 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-x-0 top-1/2 -mt-px h-[2px] rounded-full"
                  style={{ background: "var(--fg)" }}
                />
                <motion.span
                  animate={{
                    rotate: menuOpen ? -45 : 0,
                    y: menuOpen ? -7 : 0,
                  }}
                  transition={{ duration: 0.25, ease }}
                  className="absolute inset-x-0 bottom-0 h-[2px] rounded-full"
                  style={{ background: "var(--fg)" }}
                />
              </span>
            </button>

            <a
              href="#contact"
              className="btn-primary hidden rounded-full px-5 py-2 text-sm font-semibold sm:inline-block"
            >
              {nav.contact}
            </a>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.2, ease }}
                  className="glass absolute right-0 top-[calc(100%+0.5rem)] w-64 overflow-hidden rounded-3xl p-2 shadow-2xl"
                >
                  <ul className="flex flex-col">
                    {links.map((l) => (
                      <li key={l.href}>
                        <a
                          href={l.href}
                          onClick={() => setMenuOpen(false)}
                          className="block rounded-2xl px-4 py-3 text-base font-medium transition-colors hover:bg-[var(--hairline)]"
                        >
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <div className="mx-3 my-1 border-t hairline" />
                  <ul className="flex flex-col">
                    {pages.map((p) => (
                      <li key={p.href}>
                        <Link
                          href={p.href}
                          onClick={() => setMenuOpen(false)}
                          className="block rounded-2xl px-4 py-2.5 text-sm text-muted transition-colors hover:bg-[var(--hairline)]"
                        >
                          {p.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#contact"
                    onClick={() => setMenuOpen(false)}
                    className="btn-primary mt-2 block rounded-2xl px-4 py-3 text-center text-sm font-semibold sm:hidden"
                  >
                    {nav.contact}
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>
      </div>
    </motion.header>
  );
}
