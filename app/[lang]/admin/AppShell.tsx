"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { Locale } from "@/i18n/config";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminUIProvider, useUI, type Action } from "./ui";
import { CommandPalette } from "./CommandPalette";
import type { Lead } from "@/lib/leads";
import type { Project } from "@/lib/projects";
import type { Note } from "@/lib/notes";
import type { HubEvent } from "@/lib/events";

const NAV: { href: string; label: string; icon: string }[] = [
  { href: "", label: "Pulpit", icon: "🏠" },
  { href: "/projects", label: "Projekty", icon: "🗂️" },
  { href: "/notes", label: "Notatnik", icon: "📝" },
  { href: "/calendar", label: "Kalendarz", icon: "📅" },
  { href: "/leads", label: "Leady", icon: "🎯" },
];

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** Wspólna rama dla całego panelu /admin — lewy sidebar (styl Linear),
 * globalna paleta poleceń (Cmd+K) z wyszukiwaniem po wszystkich modułach,
 * i płynne przejście między stronami. */
export function AppShell({ lang, children }: { lang: Locale; children: React.ReactNode }) {
  return (
    <AdminUIProvider>
      <ShellBody lang={lang}>{children}</ShellBody>
    </AdminUIProvider>
  );
}

function ShellBody({ lang, children }: { lang: Locale; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { contextActions } = useUI();
  const base = `/${lang}/admin`;

  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    leads: Lead[];
    projects: Project[];
    notes: Note[];
    events: HubEvent[];
  } | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("leggera_admin_sidebar_collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      window.localStorage.setItem("leggera_admin_sidebar_collapsed", !prev ? "1" : "0");
      return !prev;
    });
  };

  // Debounced globalne wyszukiwanie napędzające paletę poleceń.
  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) setSearchResults(await res.json());
      setSearching(false);
    }, 220);
    return () => window.clearTimeout(t);
  }, [query]);

  const navActions: Action[] = useMemo(
    () =>
      NAV.map((item) => ({
        id: `nav:${item.href}`,
        label: `Idź do: ${item.label}`,
        hint: "→",
        run: () => router.push(`${base}${item.href}`),
      })),
    [router, base]
  );

  const searchActions: Action[] = useMemo(() => {
    if (!searchResults) return [];
    const out: Action[] = [];
    searchResults.leads.forEach((l) =>
      out.push({ id: `lead:${l.id}`, label: l.firma, hint: "Lead", run: () => router.push(`${base}/leads/${l.id}`) })
    );
    searchResults.projects.forEach((p) =>
      out.push({ id: `project:${p.id}`, label: p.tytul, hint: "Projekt", run: () => router.push(`${base}/projects/${p.id}`) })
    );
    searchResults.notes.forEach((n) =>
      out.push({ id: `note:${n.id}`, label: n.tytul || "Notatka bez tytułu", hint: "Notatka", run: () => router.push(`${base}/notes`) })
    );
    searchResults.events.forEach((e) =>
      out.push({ id: `event:${e.id}`, label: `${e.tytul} (${e.data})`, hint: "Wydarzenie", run: () => router.push(`${base}/calendar`) })
    );
    return out;
  }, [searchResults, router, base]);

  const allActions: Action[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length >= 2) {
      const staticMatches = [...contextActions, ...navActions].filter((a) => a.label.toLowerCase().includes(q));
      return [...staticMatches, ...searchActions];
    }
    return [...contextActions, ...navActions];
  }, [query, contextActions, navActions, searchActions]);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    setQuery("");
    setSearchResults(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (paletteOpen) return;
      if (isTypingTarget(e.target)) return;
      if (e.key.toLowerCase() === "n") {
        const addAction = contextActions.find((a) => a.id === "add");
        if (addAction) {
          e.preventDefault();
          addAction.run();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paletteOpen, contextActions]);

  return (
    <div className="relative flex min-h-screen flex-col md:flex-row">
      <div
        className="orb pointer-events-none fixed -top-40 left-1/2 -z-10 h-[40vw] w-[40vw] max-h-[500px] max-w-[500px] -translate-x-1/2 rounded-full opacity-20"
        aria-hidden
      />

      {/* Sidebar — pozioma lista na mobile, pionowy panel od md w górę. */}
      <aside
        className={`shrink-0 border-b hairline md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r ${
          collapsed ? "md:w-16" : "md:w-56"
        } transition-[width] duration-200`}
      >
        <div className="flex h-full flex-col p-3">
          <div className="mb-4 flex items-center justify-between px-1">
            {!collapsed && <Logo lang={lang} />}
            <button
              onClick={toggleCollapsed}
              className="hidden shrink-0 rounded-full border hairline px-2 py-1 text-xs text-muted hover:text-[var(--fg)] md:block"
              title={collapsed ? "Rozwiń" : "Zwiń"}
            >
              {collapsed ? "»" : "«"}
            </button>
          </div>

          <button
            onClick={() => setPaletteOpen(true)}
            className={`mb-3 flex items-center gap-2 rounded-xl border hairline px-3 py-2 text-xs text-muted hover:text-[var(--fg)] ${
              collapsed ? "justify-center" : ""
            }`}
            title="Szukaj / akcje (⌘K)"
          >
            <span>🔍</span>
            {!collapsed && (
              <>
                <span>Szukaj / akcje</span>
                <span className="ml-auto rounded border hairline px-1 text-[10px] opacity-70">⌘K</span>
              </>
            )}
          </button>

          <nav className="flex flex-1 flex-row gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {NAV.map((item) => {
              const href = `${base}${item.href}`;
              const active = item.href === "" ? pathname === base || pathname === `${base}/` : pathname.startsWith(href);
              return (
                <Link
                  key={item.href}
                  href={href}
                  className={`relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
                    active ? "text-[var(--bg)]" : "text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)]"
                  } ${collapsed ? "justify-center" : ""}`}
                  title={item.label}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active-pill"
                      className="absolute inset-0 rounded-xl bg-[var(--fg)]"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative">{item.icon}</span>
                  {!collapsed && <span className="relative font-medium">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className={`mt-3 flex items-center gap-2 ${collapsed ? "flex-col" : ""}`}>
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            <button
              onClick={async () => {
                await fetch("/api/admin/logout", { method: "POST" });
                window.location.reload();
              }}
              className={`rounded-full border hairline px-2.5 py-1.5 text-xs text-muted hover:text-[var(--fg)] ${
                collapsed ? "" : "ml-auto"
              }`}
              title="Wyloguj"
            >
              {collapsed ? "⏻" : "Wyloguj"}
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-end gap-2 px-4 pt-4 sm:px-6 md:hidden">
          <ThemeToggle />
        </header>
        <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 sm:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        query={query}
        onQueryChange={setQuery}
        actions={allActions}
        loading={searching}
      />
    </div>
  );
}
