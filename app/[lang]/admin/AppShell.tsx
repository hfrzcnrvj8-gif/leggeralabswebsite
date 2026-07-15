"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  IconHome,
  IconFolder,
  IconNotes,
  IconCalendar,
  IconTarget,
  IconUsers,
  IconFileText,
  IconFileCheck,
  IconReceipt,
  IconReportMoney,
  IconMail,
  IconChartBar,
  IconSearch,
  IconChevronLeft,
  IconChevronRight,
  IconLogout,
  IconPlayerStop,
  type Icon as TablerIcon,
} from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { AdminUIProvider, useUI, isTypingTarget, type Action } from "./ui";
import { CommandPalette } from "./CommandPalette";
import { LogoMark } from "@/components/Logo";
import type { Lead } from "@/lib/leads";
import type { Client } from "@/lib/clients";
import type { Project } from "@/lib/projects";
import { formatPlDate } from "@/lib/projects";
import type { Note } from "@/lib/notes";
import type { HubEvent } from "@/lib/events";
import { type TimeEntry, formatDuration } from "@/lib/time-tracking";

// Zdarzenie DOM, którym `ProjectDetailPanel` informuje sidebar o
// starcie/zatrzymaniu stopera — bez tego globalny wskaźnik odświeżałby się
// dopiero przy zmianie strony. Świadomie zwykły `window` event zamiast
// kontekstu/SWR (moduł jest mały, panel jednoosobowy, jeden aktywny stoper).
export const TIMER_CHANGED_EVENT = "leggera:timer-changed";

// Sam wzór wordmarku "Leggera Labs" (components/Logo.tsx `wordmarkGradient`)
// — ten sam gradient/kąt/dark-stroke, żeby "LEGGERA HUB" wyglądało jak
// naturalne rozszerzenie marki, nie przybliżenie (`.text-liquid` ma inny
// kąt/stopnie gradientu, celowo dobrany do dużych nagłówków na stronie
// publicznej, nie do małego wordmarku w sidebarze).
const HUB_WORDMARK_STYLE = {
  backgroundImage: "linear-gradient(100deg, #7C3AED 0%, #E0A93B 65%, #FFF7E8 100%)",
  WebkitBackgroundClip: "text" as const,
  backgroundClip: "text" as const,
  color: "transparent" as const,
  WebkitTextStroke: "0.4px rgba(20, 18, 15, 0.35)",
};

// Kolejność wg realnej ścieżki pracy (lib/process.ts, 12 kroków), nie
// alfabetu/daty dodania: Pulpit (start dnia) → Leady → Klienci → Oferty →
// Projekty → Faktury → Koszty (cały lejek sprzedaż→realizacja→rozliczenie)
// → Poczta/Kalendarz/Notatnik (narzędzia pomocnicze, nie przypięte do etapu
// — poczta przecina wszystkie etapy naraz, więc nie ma swojego miejsca w
// lejku).
const NAV: { href: string; label: string; icon: TablerIcon }[] = [
  { href: "", label: "Pulpit", icon: IconHome },
  { href: "/leads", label: "Leady", icon: IconTarget },
  { href: "/clients", label: "Klienci", icon: IconUsers },
  { href: "/offers", label: "Oferty", icon: IconFileText },
  { href: "/contracts", label: "Umowy", icon: IconFileCheck },
  { href: "/projects", label: "Projekty", icon: IconFolder },
  { href: "/invoices", label: "Faktury", icon: IconReceipt },
  { href: "/costs", label: "Koszty", icon: IconReportMoney },
  { href: "/mail", label: "Poczta", icon: IconMail },
  { href: "/calendar", label: "Kalendarz", icon: IconCalendar },
  { href: "/notes", label: "Notatnik", icon: IconNotes },
  // Statystyki (Moduł 18) świadomie na końcu — to nie krok w codziennym
  // lejku pracy, tylko okresowy (raz w miesiącu/kwartale) przegląd, czy
  // cały wzorzec się trzyma (patrz docs/plany-modulow/18-pulpit-wskazniki.md).
  { href: "/stats", label: "Statystyki", icon: IconChartBar },
];

// Chordy nawigacyjne w stylu Linear: "g" a potem litera modułu. "h" (home)
// dla Pulpitu, bo "p" jest zajęte przez Projekty.
const GO_CHORDS: Record<string, string> = {
  h: "",
  p: "/projects",
  n: "/notes",
  c: "/calendar",
  l: "/leads",
  k: "/clients",
  o: "/offers",
  u: "/contracts",
  f: "/invoices",
  w: "/costs",
  m: "/mail",
  s: "/stats",
};

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
    clients: Client[];
    projects: Project[];
    notes: Note[];
    events: HubEvent[];
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const [activeTimer, setActiveTimer] = useState<(TimeEntry & { project_tytul?: string; task_text?: string | null }) | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const saved = window.localStorage.getItem("leggera_admin_sidebar_collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);

  const loadActiveTimer = useCallback(async () => {
    const res = await fetch("/api/time/active");
    if (res.ok) {
      const data = (await res.json()) as { active: (TimeEntry & { project_tytul?: string; task_text?: string | null }) | null };
      setActiveTimer(data.active);
    }
  }, []);

  useEffect(() => {
    loadActiveTimer();
  }, [loadActiveTimer, pathname]);

  useEffect(() => {
    window.addEventListener(TIMER_CHANGED_EVENT, loadActiveTimer);
    return () => window.removeEventListener(TIMER_CHANGED_EVENT, loadActiveTimer);
  }, [loadActiveTimer]);

  useEffect(() => {
    if (!activeTimer || activeTimer.ended_at) return;
    const t = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, [activeTimer]);

  const stopGlobalTimer = async () => {
    const res = await fetch("/api/time/stop", { method: "POST" });
    if (res.ok) setActiveTimer(null);
  };

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
    searchResults.clients.forEach((c) =>
      out.push({ id: `client:${c.id}`, label: c.nazwa, hint: "Klient", run: () => router.push(`${base}/clients/${c.id}`) })
    );
    searchResults.projects.forEach((p) =>
      out.push({ id: `project:${p.id}`, label: p.tytul, hint: "Projekt", run: () => router.push(`${base}/projects/${p.id}`) })
    );
    searchResults.notes.forEach((n) =>
      out.push({ id: `note:${n.id}`, label: n.tytul || "Notatka bez tytułu", hint: "Notatka", run: () => router.push(`${base}/notes`) })
    );
    searchResults.events.forEach((e) =>
      out.push({ id: `event:${e.id}`, label: `${e.tytul} (${formatPlDate(e.data)})`, hint: "Wydarzenie", run: () => router.push(`${base}/calendar`) })
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

  const goPendingRef = useRef(false);
  const goTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (paletteOpen) return;
      if (isTypingTarget(e.target)) return;

      const key = e.key.toLowerCase();

      if (goPendingRef.current) {
        goPendingRef.current = false;
        if (goTimeoutRef.current) window.clearTimeout(goTimeoutRef.current);
        if (key in GO_CHORDS) {
          e.preventDefault();
          router.push(`${base}${GO_CHORDS[key]}`);
        }
        return;
      }

      if (key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        goPendingRef.current = true;
        goTimeoutRef.current = window.setTimeout(() => {
          goPendingRef.current = false;
        }, 900);
        return;
      }

      if (key === "n") {
        const addAction = contextActions.find((a) => a.id === "add");
        if (addAction) {
          e.preventDefault();
          addAction.run();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (goTimeoutRef.current) window.clearTimeout(goTimeoutRef.current);
    };
  }, [paletteOpen, contextActions, router, base]);

  return (
    <div className="admin-linear relative flex min-h-screen flex-col bg-[var(--bg)] font-sans text-[var(--fg)] md:flex-row">
      {/* Sidebar — pozioma lista na mobile, pionowy panel od md w górę. */}
      <aside
        className={`shrink-0 border-b hairline bg-[var(--bg-soft)] md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r ${
          collapsed ? "md:w-16" : "md:w-56"
        } transition-[width] duration-200`}
      >
        <div className="flex h-full flex-col p-2.5">
          <div
            className={`mb-2.5 flex items-center px-1.5 py-1 ${
              collapsed ? "flex-col gap-1.5" : "justify-between"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <LogoMark size={18} />
              {!collapsed && (
                <span style={HUB_WORDMARK_STYLE} className="text-[13px] font-bold uppercase tracking-[0.12em]">
                  Leggera Hub
                </span>
              )}
            </span>
            <button
              onClick={toggleCollapsed}
              className="hidden shrink-0 rounded-md p-1 text-muted hover:bg-[var(--hairline)] hover:text-[var(--fg)] md:block"
              title={collapsed ? "Rozwiń" : "Zwiń"}
            >
              {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
            </button>
          </div>

          <button
            onClick={() => setPaletteOpen(true)}
            className={`mb-1.5 flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[12.5px] text-muted hover:bg-[var(--hairline)] ${
              collapsed ? "justify-center" : ""
            }`}
            title="Szukaj / akcje (⌘K)"
          >
            <IconSearch size={15} />
            {!collapsed && (
              <>
                <span>Szukaj</span>
                <span className="ml-auto rounded border hairline px-1 text-[10px] opacity-70">⌘K</span>
              </>
            )}
          </button>

          <nav className="flex flex-1 flex-row gap-0.5 overflow-x-auto md:flex-col md:overflow-visible">
            {NAV.map((item) => {
              const href = `${base}${item.href}`;
              const active = item.href === "" ? pathname === base || pathname === `${base}/` : pathname.startsWith(href);
              return (
                <Link
                  key={item.href}
                  href={href}
                  className={`relative flex shrink-0 items-center gap-2.5 rounded-md px-1.5 py-1.5 text-[13px] transition-colors ${
                    active
                      ? "admin-nav-active text-[var(--fg)]"
                      : "text-[#c7c9cd] hover:bg-[var(--hairline)]"
                  } ${collapsed ? "justify-center" : ""}`}
                  title={item.label}
                >
                  <item.icon size={16} className={active ? "text-[var(--fg)]" : "text-muted"} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {activeTimer && !activeTimer.ended_at && (
            <Link
              href={`${base}/projects/${activeTimer.project_id}`}
              className={`mb-1.5 flex items-center gap-1.5 rounded-md border hairline px-1.5 py-1.5 text-[11.5px] text-emerald-400 hover:bg-[var(--hairline)] ${
                collapsed ? "justify-center" : ""
              }`}
              title={activeTimer.project_tytul ? `Stoper działa — ${activeTimer.project_tytul}` : "Stoper działa"}
            >
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
              {!collapsed && (
                <span className="min-w-0 flex-1 truncate">
                  {formatDuration(Math.max(0, (Date.now() - new Date(activeTimer.started_at as string).getTime()) / 60000))}
                  {activeTimer.project_tytul ? ` · ${activeTimer.project_tytul}` : ""}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  stopGlobalTimer();
                }}
                className="shrink-0 text-emerald-400 hover:text-[var(--fg)]"
                aria-label="Zatrzymaj stoper"
                title="Zatrzymaj stoper"
              >
                <IconPlayerStop size={13} />
              </button>
            </Link>
          )}

          <div className={`mt-2 flex items-center ${collapsed ? "flex-col" : ""}`}>
            <button
              onClick={async () => {
                await fetch("/api/admin/logout", { method: "POST" });
                window.location.reload();
              }}
              className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[12.5px] text-muted hover:bg-[var(--hairline)]"
              title="Wyloguj"
            >
              <IconLogout size={15} />
              {!collapsed && <span>Wyloguj</span>}
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6">
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
