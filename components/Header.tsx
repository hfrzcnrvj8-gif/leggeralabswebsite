"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";

export function Header({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary["nav"];
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#vision", label: dict.vision },
    { href: "#services", label: dict.services },
    { href: "#showcase", label: dict.work },
  ];

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <nav
        className={`flex w-full max-w-6xl items-center justify-between rounded-full px-5 py-2.5 transition-all duration-500 ${
          scrolled ? "glass shadow-xl" : "border border-transparent"
        }`}
      >
        <Link
          href={`/${lang}`}
          className="font-serif text-lg font-semibold tracking-tight"
        >
          poltechnickx<span className="text-liquid">.</span>
        </Link>

        <ul className="hidden items-center gap-8 text-sm text-muted md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="transition-colors hover:text-[var(--fg)]"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <LanguageSwitcher current={lang} />
          <ThemeToggle />
          <a
            href="#contact"
            className="btn-primary hidden rounded-full px-5 py-2 text-sm font-semibold sm:inline-block"
          >
            {dict.contact}
          </a>
        </div>
      </nav>
    </motion.header>
  );
}
