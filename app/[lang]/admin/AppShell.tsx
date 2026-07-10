"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminUIProvider } from "./ui";

const NAV: { href: string; label: string }[] = [
  { href: "", label: "Pulpit" },
  { href: "/projects", label: "Projekty" },
  { href: "/notes", label: "Notatnik" },
  { href: "/calendar", label: "Kalendarz" },
  { href: "/leads", label: "Leady" },
];

/** Wspólna rama dla całego panelu /admin — nagłówek, przełącznik motywu i
 * pasek nawigacji między modułami (Pulpit/Projekty/Notatnik/Kalendarz/Leady),
 * żeby wszystko trzymało się razem w jednym miejscu zamiast być rozproszonymi
 * osobnymi podstronami. */
export function AppShell({ lang, children }: { lang: Locale; children: React.ReactNode }) {
  const pathname = usePathname();
  const base = `/${lang}/admin`;

  return (
    <AdminUIProvider>
      <main className="relative min-h-screen">
        <div
          className="orb pointer-events-none fixed -top-40 left-1/2 -z-10 h-[40vw] w-[40vw] max-h-[500px] max-w-[500px] -translate-x-1/2 rounded-full opacity-20"
          aria-hidden
        />
        <header className="mx-auto flex max-w-[1800px] items-center justify-between px-4 pt-6 sm:px-6">
          <Logo lang={lang} />
          <ThemeToggle />
        </header>

        <nav className="mx-auto mt-5 flex max-w-[1800px] gap-1.5 overflow-x-auto px-4 sm:px-6">
          {NAV.map((item) => {
            const href = `${base}${item.href}`;
            const active = item.href === "" ? pathname === base || pathname === `${base}/` : pathname.startsWith(href);
            return (
              <Link
                key={item.href}
                href={href}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-[var(--fg)] text-[var(--bg)]"
                    : "border hairline text-muted hover:text-[var(--fg)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mx-auto max-w-[1800px] px-4 py-8 sm:px-6">{children}</div>
      </main>
    </AdminUIProvider>
  );
}
