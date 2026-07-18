"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { EASE_LIQUID, SPRING } from "@/lib/motion";
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
  IconLayoutGrid,
  IconX,
  IconPencilPlus,
  type Icon as TablerIcon,
} from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import { AdminUIProvider, useUI, isTypingTarget, type Action } from "./ui";
import { CommandPalette } from "./CommandPalette";
import { NotificationBell } from "./NotificationBell";
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

// Kolejność wg realnej ścieżki pracy (lib/process.ts, 15 kroków), nie
// alfabetu/daty dodania: Pulpit (start dnia) → Leady → Klienci → Oferty →
// Umowy → Projekty → Faktury → Koszty (cały lejek
// sprzedaż→realizacja→rozliczenie) → Poczta/Kalendarz/Notatnik (narzędzia
// pomocnicze, nie przypięte do etapu — poczta przecina wszystkie etapy
// naraz, więc nie ma swojego miejsca w lejku).
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

// Ekrany osiągalne WYŁĄCZNIE z palety poleceń (Cmd/Ctrl+K), świadomie poza
// sidebarem — menu odwzorowuje lejek sprzedaży, a to są narzędzia, nie etapy
// drogi klienta. Decyzja właściciela 2026-07-17 (Moduł 32): quick-log działał,
// ale nie był podlinkowany znikąd — trzeba było znać adres na pamięć.
const PALETTE_ONLY: { href: string; label: string }[] = [
  { href: "/quick-log", label: "Szybka notatka (zaloguj rozmowę)" },
];

// Moduł 5 (mobilny) — dolna belka nawigacji dla kciuka. Cztery moduły
// najczęściej używane na telefonie (rdzeń: Pulpit + Leady/Klienci + Poczta)
// mieszkają w belce; przycisk „Więcej" otwiera arkusz z KOMPLETEM modułów.
// Reszta nie mieści się w zasięgu kciuka — nie chowamy jej, tylko przenosimy
// o jeden dotyk dalej. Kolejność wynika z NAV (filtr ją zachowuje).
const MOBILE_PRIMARY_HREFS = ["", "/leads", "/clients", "/mail"];

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
  // Moduł 5 — arkusz „Więcej" (mobilna nawigacja). Tylko na telefonie.
  const [moreOpen, setMoreOpen] = useState(false);
  // Przeciąganie arkusza startuje WYŁĄCZNIE z uchwytu (patrz Modal.tsx) —
  // inaczej gest konkurowałby z przewijaniem siatki modułów w środku.
  const moreDragControls = useDragControls();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    leads: Lead[];
    clients: Client[];
    projects: Project[];
    notes: Note[];
    events: HubEvent[];
    // Moduł 31 — dokumenty w palecie. Kształt wąski, taki jak zwraca
    // api/search (patrz SearchOffer/SearchInvoice/SearchContract tam).
    offers: { id: string; tytul: string; status: string; klient_nazwa: string }[];
    invoices: { id: string; numer: string | null; status: string; klient_nazwa: string }[];
    contracts: { id: string; typ: "umowa" | "nda"; status: string; klient_nazwa: string }[];
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

  // Zmiana strony zamyka arkusz „Więcej" (mobilny).
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Wspólne rozpoznanie „aktywnego" modułu — używane i przez sidebar (desktop),
  // i przez dolną belkę (mobile).
  const isNavActive = useCallback(
    (href: string) =>
      href === "" ? pathname === base || pathname === `${base}/` : pathname.startsWith(`${base}${href}`),
    [pathname, base]
  );

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
      [...NAV, ...PALETTE_ONLY].map((item) => ({
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
    // Moduł 31 — dokumenty. Etykieta niesie nazwę klienta, bo po niej się
    // realnie szuka ("gdzie jest ta umowa Kowalskiego"), a sam tytuł oferty
    // bywa pusty na szkicu.
    searchResults.offers?.forEach((o) =>
      out.push({
        id: `offer:${o.id}`,
        label: `${o.tytul || "(bez tytułu)"}${o.klient_nazwa ? ` — ${o.klient_nazwa}` : ""}`,
        hint: "Oferta",
        run: () => router.push(`${base}/offers/${o.id}`),
      })
    );
    searchResults.invoices?.forEach((i) =>
      out.push({
        id: `invoice:${i.id}`,
        label: `${i.numer || "(szkic)"}${i.klient_nazwa ? ` — ${i.klient_nazwa}` : ""}`,
        hint: "Faktura",
        run: () => router.push(`${base}/invoices/${i.id}`),
      })
    );
    searchResults.contracts?.forEach((c) =>
      out.push({
        id: `contract:${c.id}`,
        label: `${c.klient_nazwa || "(bez nazwy)"} — ${c.status}`,
        hint: c.typ === "nda" ? "NDA" : "Umowa",
        run: () => router.push(`${base}/contracts/${c.id}`),
      })
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
    // `md:h-screen md:overflow-hidden` (Moduł 35) — okno panelu ma STAŁĄ
    // wysokość, a przewija się to, co w środku (Kanban, tabela, podgląd maila),
    // nie cała strona. Bez definitywnej wysokości `overflow-auto` w środku nie
    // ma się do czego odnieść i `flex-1` nie ma czego wypełnić — stąd dotąd
    // kolumny kończyły się na treści, a pod nimi zostawało martwe pole.
    // Tylko od `md` w górę: na mobile sidebar jest poziomym paskiem u góry,
    // więc strona ma normalnie się przewijać.
    <div className="admin-linear relative flex min-h-screen flex-col bg-[var(--bg)] font-sans text-[var(--fg)] md:h-screen md:flex-row md:overflow-hidden">
      {/* Górny pasek — TYLKO na telefonie (md:hidden). Kompaktowe chrome:
          wordmark + Szukaj + dzwonek. Reszta modułów żyje w dolnej belce i
          arkuszu „Więcej", nie tutaj. Sticky + safe-area-inset-top pod notch. */}
      <header
        // `.glass .glass-ios` (Moduł 5, Paczka 3) — prawdziwy materiał zamiast
        // wcześniejszego `bg/90 + blur-md`, który wyglądał jak ciemny
        // prostokąt. Treść pod paskiem realnie prześwituje i rozmywa się przy
        // przewijaniu. Ramki boczne/górna z `.glass` wyłączone utility'sami —
        // pasek ma mieć tylko dolną krawędź.
        // `min-h-12`, NIE `h-12` (Moduł 5, Paczka 5 — błąd znaleziony dopiero na
        // realnym iPhonie): przy `box-sizing: border-box` sztywna wysokość 48 px
        // NIE rośnie o `padding-top`, a bezpieczny margines pod notch to ~59 px.
        // Treść była więc wypychana poza pasek i dociskana do zegarka. Pasek
        // musi mieć wysokość 48 px PLUS wcięcie, nie 48 px razem z nim.
        className="glass glass-ios sticky top-0 z-30 flex min-h-12 items-center gap-2 border-x-0 border-t-0 border-b border-b-[var(--glass-border)] px-3 md:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <Link href={base} prefetch={false} className="flex min-w-0 items-center gap-1.5">
          <LogoMark size={18} />
          <span style={HUB_WORDMARK_STYLE} className="truncate text-[13px] font-bold uppercase tracking-[0.12em]">
            Leggera Hub
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Szukaj / akcje"
            className="rounded-md p-2 text-muted hover:bg-[var(--hairline)]"
          >
            <IconSearch size={19} />
          </button>
          {/* Dzwonek: w wersji „collapsed" to sam ikonka + kropka — pasuje do
              paska. Popover i tak przycina się do viewportu (Menu.place). */}
          <div className="flex w-9 justify-center">
            <NotificationBell base={base} collapsed />
          </div>
        </div>
      </header>

      {/* Sidebar — pionowy panel Linear, TYLKO od md w górę. Na telefonie
          zastępuje go górny pasek + dolna belka nawigacji. */}
      <aside
        className={`hidden shrink-0 bg-[var(--bg-soft)] hairline md:sticky md:top-0 md:flex md:h-screen md:border-r ${
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

          <NotificationBell base={base} collapsed={collapsed} />

          <nav className="flex flex-1 flex-row gap-0.5 overflow-x-auto md:flex-col md:overflow-visible">
            {NAV.map((item) => {
              const href = `${base}${item.href}`;
              const active = isNavActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={href}
                  // Sidebar pokazuje WSZYSTKIE 12 pozycji naraz, na KAŻDEJ
                  // stronie panelu — domyślne prefetch={true} Next.jsa
                  // odpala (przez IntersectionObserver, bo linki są od razu
                  // w viewporcie) request do KAŻDEJ z tych stron przy
                  // KAŻDYM wejściu do panelu, mimo że właściciel patrzy
                  // tylko na jedną. Zmierzone 2026-07-16 (docs/HUB_SETUP.md
                  // → "Poczta — Etap 2, trzecia runda"): 12 równoległych
                  // GET-ów, czasem zdublowane, tuż po każdym wejściu na
                  // /admin/mail — realny koszt dla wszystkich stron
                  // panelu, nie tylko poczty. prefetch={false} wyłącza to
                  // wstępne pobieranie; klik nadal działa normalnie, tylko
                  // bez podgrzania z wyprzedzeniem.
                  prefetch={false}
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

      <div className="flex min-w-0 flex-1 flex-col md:min-h-0">
        {/* Poczta ma świadomie odrębny kształt treści od reszty panelu —
            gęsty trójkolumnowy dashboard (foldery + lista + podgląd), gdzie
            globalny limit `max-w-[1800px]` marnował widoczną przestrzeń na
            szerokich monitorach (zgłoszone przez właściciela, Moduł 4e runda
            2). Inne moduły (Faktury/Projekty, formularze) zostają przy
            dotychczasowym limicie — nie ujednolicaj bez potrzeby.

            `md:overflow-y-auto` (Moduł 35): to JEST pasek przewijania panelu.
            Ekrany, które umieją wypełnić wysokość (Kanban, Poczta), robią to
            przez `flex-1` i przewijają się w środku; długie strony bez własnego
            scrolla (Pulpit, Statystyki, formularze) po prostu przewijają ten
            kontener — dzięki temu zmiana jest bezpieczna dla WSZYSTKICH modułów,
            a nie tylko dla tych przerobionych. */}
        <div
          // `pb-[…]` na mobile = miejsce na fixed dolną belkę nawigacji
          // (wysokość belki + safe-area). Od md belki nie ma → zwykłe pb-5.
          className={`mx-auto flex w-full flex-1 flex-col px-4 pt-5 pb-[calc(1.25rem+4.5rem+env(safe-area-inset-bottom))] sm:px-6 md:min-h-0 md:overflow-y-auto md:pb-5 ${
            pathname.startsWith(`${base}/mail`) ? "max-w-none" : "max-w-[1800px]"
          }`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: EASE_LIQUID }}
              // `flex flex-1 flex-col` — bez tego dziecko (dashboard) nie ma po
              // czym dziedziczyć wysokości i `flex-1` w nim nic nie robi.
              className="flex flex-1 flex-col md:min-h-0"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Dolna belka nawigacji — TYLKO na telefonie. Kciukiem, fixed na dole,
          safe-area-inset-bottom pod pasek gestów iPhone'a. Cztery moduły
          rdzenia + „Więcej". */}
      <nav
        // Materiał jak w górnym pasku — lista przewijana pod belką rozmywa się
        // pod nią, zamiast chować się za nieprzezroczystym prostokątem.
        className="glass glass-ios fixed inset-x-0 bottom-0 z-30 flex items-stretch border-x-0 border-b-0 border-t border-t-[var(--glass-border)] md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV.filter((item) => MOBILE_PRIMARY_HREFS.includes(item.href)).map((item) => {
          const active = isNavActive(item.href);
          return (
            // `whileTap` (Moduł 5, Paczka 3): każdy cel dotykowy ma się
            // wciskać pod palcem — to jedna z trzech rzeczy, po których apka
            // „czuje się natywnie". Spring, nie tween, żeby dało się przerwać
            // w połowie gestu.
            // `min-w-0` + `truncate` na etykiecie (Moduł 5, Paczka 5): bez tego
            // pozycja `flex-1` ma domyślne `min-width: auto`, więc NIE zwęża się
            // poniżej szerokości swojego tekstu — na wąskim ekranie belka
            // rozpychała się szerzej niż ekran zamiast ścisnąć etykiety.
            <motion.div key={item.href} whileTap={{ scale: 0.9 }} transition={SPRING} className="flex min-w-0 flex-1">
              <Link
                href={`${base}${item.href}`}
                prefetch={false}
                className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px]"
              >
                {active && (
                  // `layoutId` — podkreślenie PRZEJEŻDŻA między zakładkami
                  // zamiast znikać i pojawiać się w nowym miejscu (ten sam
                  // wzorzec co ViewTabs).
                  <motion.span
                    layoutId="mobile-nav-active"
                    transition={SPRING}
                    className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-brand-purple"
                  />
                )}
                <item.icon size={22} className={`shrink-0 ${active ? "text-[var(--fg)]" : "text-muted"}`} />
                <span className={`max-w-full truncate ${active ? "text-[var(--fg)]" : "text-muted"}`}>{item.label}</span>
              </Link>
            </motion.div>
          );
        })}
        <motion.button
          whileTap={{ scale: 0.9 }}
          transition={SPRING}
          onClick={() => setMoreOpen(true)}
          className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] text-muted"
          aria-label="Więcej modułów"
        >
          <IconLayoutGrid size={22} className="shrink-0" />
          <span className="max-w-full truncate">Więcej</span>
        </motion.button>
      </nav>

      {/* Arkusz „Więcej" — komplet modułów + szybka notatka + wyloguj. Wysuwa
          się od dołu (SPRING, jak reszta panelu). Tylko telefon. */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            className="fixed inset-0 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE_LIQUID }}
          >
            <div className="absolute inset-0 bg-black/55" onClick={() => setMoreOpen(false)} />
            <motion.div
              className="absolute inset-x-0 bottom-0"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={SPRING}
              drag="y"
              dragControls={moreDragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_e, info) => {
                if (info.offset.y > 110 || info.velocity.y > 600) setMoreOpen(false);
              }}
            >
              {/* Uchwyt — ten sam wzorzec co w Modal.tsx (arkusz zamyka się
                  ściągnięciem palcem, nie tylko przyciskiem). */}
              <div
                onPointerDown={(e) => moreDragControls.start(e)}
                className="flex touch-none cursor-grab justify-center pb-2 pt-1 active:cursor-grabbing"
                aria-hidden
              >
                <span className="h-1 w-9 rounded-full bg-white/30" />
              </div>
              <div
                className="glass glass-sheet max-h-[82vh] overflow-y-auto rounded-t-2xl border-x-0 border-b-0 border-t border-t-[var(--glass-border)] p-4"
                style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
              >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12px] font-medium uppercase tracking-wide text-[#62666d]">Wszystkie moduły</span>
                <button
                  onClick={() => setMoreOpen(false)}
                  aria-label="Zamknij"
                  className="rounded-md p-1.5 text-muted hover:bg-[var(--hairline)]"
                >
                  <IconX size={18} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {NAV.map((item) => {
                  const active = isNavActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={`${base}${item.href}`}
                      prefetch={false}
                      onClick={() => setMoreOpen(false)}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center text-[11px] ${
                        active
                          ? "admin-nav-active border-transparent text-[var(--fg)]"
                          : "hairline text-[#c7c9cd] hover:bg-[var(--hairline)]"
                      }`}
                    >
                      <item.icon size={22} className={active ? "text-[var(--fg)]" : "text-muted"} />
                      <span className="leading-tight">{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Szybka notatka — na telefonie inaczej nieosiągalna (Cmd+K trudne
                  na dotyku), a to główny mobilny scenariusz: zalogować rozmowę
                  zaraz po telefonie. */}
              <Link
                href={`${base}/quick-log`}
                prefetch={false}
                onClick={() => setMoreOpen(false)}
                className="mt-3 flex items-center gap-2.5 rounded-xl border hairline px-3 py-3 text-[13px] text-[#c7c9cd] hover:bg-[var(--hairline)]"
              >
                <IconPencilPlus size={19} className="text-muted" />
                <span>Szybka notatka (zaloguj rozmowę)</span>
              </Link>

              {activeTimer && !activeTimer.ended_at && (
                <Link
                  href={`${base}/projects/${activeTimer.project_id}`}
                  prefetch={false}
                  onClick={() => setMoreOpen(false)}
                  className="mt-1.5 flex items-center gap-2 rounded-xl border hairline px-3 py-3 text-[12.5px] text-emerald-400 hover:bg-[var(--hairline)]"
                >
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
                  <span className="min-w-0 flex-1 truncate">
                    Stoper działa
                    {activeTimer.project_tytul ? ` · ${activeTimer.project_tytul}` : ""}
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      stopGlobalTimer();
                    }}
                    className="shrink-0 text-emerald-400 hover:text-[var(--fg)]"
                    aria-label="Zatrzymaj stoper"
                  >
                    <IconPlayerStop size={15} />
                  </button>
                </Link>
              )}

              <button
                onClick={async () => {
                  await fetch("/api/admin/logout", { method: "POST" });
                  window.location.reload();
                }}
                className="mt-1.5 flex w-full items-center gap-2.5 rounded-xl border hairline px-3 py-3 text-[13px] text-muted hover:bg-[var(--hairline)]"
              >
                <IconLogout size={19} />
                <span>Wyloguj</span>
              </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
