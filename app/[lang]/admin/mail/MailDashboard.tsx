"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { useUI, useRegisterActions, isTypingTarget } from "../ui";
import {
  MailStatusTag,
  MailCategoryTag,
  MAIL_CATEGORY_LABEL,
  MAIL_FOLDERS,
  MAIL_FOLDER_LABEL,
  MAIL_FOLDER_ICON,
  type MailMessageWithLinks,
  type MailStatus,
  type MailFolder,
} from "./shared";
import { MailDetailPanel } from "./MailDetailPanel";
import { MailComposeForm } from "./MailComposeForm";

// Filtry to dwie NIEZALEŻNE osie, jak status vs zdrowie projektu: co wymaga
// mojej reakcji (góra) i czego dotyczy (dół, kategorie). Mieszanie ich w jedną
// listę zmuszałoby do wyboru "albo do odpowiedzi, albo rachunki". Sensowne
// TYLKO w Odebranych (Etap 2 Modułu 4b) — Wysłane/Kosz/Archiwum nie mają
// pojęcia "do odpowiedzi" ani klasyfikacji treści.
type Filter = "nowy" | "unassigned" | "all";
type CatFilter = "wszystkie" | "oferta" | "rachunek" | "urzedowe" | "inne" | "reklama";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "nowy", label: "Do odpowiedzi" },
  { id: "unassigned", label: "Nieprzypisane" },
  { id: "all", label: "Wszystkie" },
];

const CAT_FILTERS: { id: CatFilter; label: string }[] = [
  { id: "wszystkie", label: "Wszystkie" },
  { id: "oferta", label: `${MAIL_CATEGORY_LABEL.oferta}` },
  { id: "rachunek", label: `${MAIL_CATEGORY_LABEL.rachunek}` },
  { id: "urzedowe", label: `${MAIL_CATEGORY_LABEL.urzedowe}` },
  { id: "inne", label: `${MAIL_CATEGORY_LABEL.inne}` },
  { id: "reklama", label: `${MAIL_CATEGORY_LABEL.reklama}` },
];

type Counts = { nowe: number; nieprzypisane: number } & Record<string, number>;

/** Data wiadomości w skali "dziś/wczoraj/dawniej" — przy poczcie liczy się
 * godzina (czy to sprzed chwili), a nie sama data, więc świadomie NIE
 * używamy tu formatPlDate() z lib/projects.ts (ten formatuje dzień). */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "wczoraj";
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

export function MailDashboard({ lang }: { lang: Locale }) {
  const { toast, confirm } = useUI();
  const [messages, setMessages] = useState<MailMessageWithLinks[] | null>(null);
  const [counts, setCounts] = useState<Counts>({ nowe: 0, nieprzypisane: 0 });
  const [configured, setConfigured] = useState(true);
  const [activeFolder, setActiveFolder] = useState<MailFolder>("inbox");
  const [filter, setFilter] = useState<Filter>("nowy");
  const [catFilter, setCatFilter] = useState<CatFilter>("wszystkie");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [statusMenuFor, setStatusMenuFor] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  // Nawigacja klawiaturą (Etap 2 Modułu 4b) — pozycja "kursora" na liście,
  // niezależna od `openId` (fokus klawiaturowy vs otwarty podgląd mogą być
  // różnymi wierszami, tak jak w Gmailu/Superhuman).
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // Inkrementowany nonce — skrót "r" wywołuje efekt w MailDetailPanel, który
  // otwiera pole odpowiedzi (patrz replyShortcut tam).
  const [replyShortcutNonce, setReplyShortcutNonce] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  // Numer kolejny każdego load() — chroni przed wyścigiem, gdy odpowiedzi z
  // serwera wrócą w innej kolejności niż zostały wysłane (patrz load() niżej).
  const loadSeqRef = useRef(0);

  const load = useCallback(async () => {
    // Szukanie idzie do serwera, a nie filtruje wczytanej listy — lista ma
    // limit 200, więc filtrowanie po stronie przeglądarki gubiłoby starsze
    // trafienia i "nie znajdowałoby" maili, które są w skrzynce. `folder`
    // zawsze jest wysyłane — serwer domyślnie zwraca 'inbox' bez parametru,
    // ale wysyłamy jawnie, żeby nie polegać na tym domyślnym zachowaniu.
    const seq = ++loadSeqRef.current;
    const params = new URLSearchParams({ folder: activeFolder });
    if (query.trim()) params.set("q", query.trim());
    const res = await fetch(`/api/mail?${params.toString()}`);
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    if (!res.ok) {
      toast("Nie udało się wczytać poczty.", "error");
      return;
    }
    const data = await res.json();
    // Ochrona przed wyścigiem: przy szybkim przełączaniu folderów starsze
    // żądanie mogło odpowiedzieć PÓŹNIEJ niż nowsze (kolejność w sieci nie
    // jest gwarantowana) — bez tej kontroli nadpisywało wynik nowszego kliku
    // danymi z zupełnie innego folderu (zgłoszone przez właściciela
    // 2026-07-16: "Wysłane" pokazywało treść, która wyglądała jak inny
    // folder). Odrzucamy odpowiedź, jeśli w międzyczasie poleciał już
    // kolejny load().
    if (seq !== loadSeqRef.current) return;
    setMessages(data.messages);
    setCounts(data.counts ?? { nowe: 0, nieprzypisane: 0 });
    setConfigured(data.configured);
  }, [activeFolder, query, toast]);

  const sync = useCallback(
    async (silent: boolean) => {
      setSyncing(true);
      try {
        const res = await fetch("/api/mail/sync", { method: "POST" });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          // Cicho przy automatycznym syncu po wejściu — czerwony toast na
          // dzień dobry przy każdym otwarciu zakładki byłby udręką. Przy
          // kliknięciu "Pobierz nowe" właściciel czeka na odpowiedź, więc
          // błąd musi być widoczny.
          if (!silent) toast(data?.error || "Nie udało się pobrać poczty.", "error");
          return;
        }
        if (data?.configured === false) {
          setConfigured(false);
          if (!silent) toast("Skrzynka nie jest jeszcze skonfigurowana.", "error");
          return;
        }
        await load();
        if (!silent) {
          toast(data.saved > 0 ? `Pobrano ${data.saved} now${data.saved === 1 ? "ą wiadomość" : "e wiadomości"}.` : "Brak nowych wiadomości.");
        }
      } finally {
        setSyncing(false);
      }
    },
    [load, toast]
  );

  /** Zmiana statusu wprost z plakietki na liście — bez otwierania podglądu
   * (04d pkt 3). Optymistycznie: lista reaguje od razu, `load()` na końcu
   * tylko dociąga policzone na nowo liczniki filtrów. */
  const setMailStatus = useCallback(
    async (id: string, status: MailStatus) => {
      setStatusMenuFor(null);
      const prev = messages;
      setMessages((cur) => (cur ? cur.map((m) => (m.id === id ? { ...m, status } : m)) : cur));
      const res = await fetch(`/api/mail/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setMessages(prev);
        toast("Nie udało się zmienić statusu.", "error");
        return;
      }
      toast(status === "obsłużony" ? "Oznaczono jako obsłużone." : status === "zignorowany" ? "Wyciszono." : "Przywrócono do odpowiedzi.");
      void load();
    },
    [messages, load, toast]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set((messages ?? []).map((m) => m.id)) : new Set());
    },
    [messages]
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  /** Zbiorcza zmiana statusu (pasek "Zaznaczono: N") — jeden podsumowujący
   * toast zamiast N pojedynczych (w przeciwieństwie do setMailStatus() wyżej,
   * które toastuje przy KAŻDYM pojedynczym kliknięciu — to normalne dla
   * jednej wiadomości, ale ogłuszające przy dziesiątkach naraz). */
  const bulkSetStatus = useCallback(
    async (status: MailStatus) => {
      const ids = [...selectedIds];
      if (ids.length === 0) return;
      setBulkBusy(true);
      for (const id of ids) {
        await fetch(`/api/mail/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
      }
      setBulkBusy(false);
      clearSelection();
      await load();
      toast(`Zaktualizowano status dla ${ids.length} wiadomości.`);
    },
    [selectedIds, clearSelection, load, toast]
  );

  /** Zbiorcze przeniesienie (Usuń/Archiwizuj/Przywróć) — prawdziwy MOVE na
   * serwerze per wiadomość (PATCH .../route.ts), sekwencyjnie, bez nowego
   * endpointu zbiorczego (ten sam wzorzec co bulkDelete w
   * ClientsDashboard.tsx). "Usuń" prosi o potwierdzenie — dotyczy wielu
   * wiadomości naraz, więc warto zapytać mimo że MOVE do Kosza jest
   * odwracalne. */
  const bulkMove = useCallback(
    async (move: "trash" | "archive" | "inbox") => {
      const ids = [...selectedIds];
      if (ids.length === 0) return;
      if (move === "trash") {
        const ok = await confirm(`Przenieść ${ids.length} ${ids.length === 1 ? "wiadomość" : "wiadomości"} do Kosza?`, { danger: true });
        if (!ok) return;
      }
      setBulkBusy(true);
      let failed = 0;
      for (const id of ids) {
        const res = await fetch(`/api/mail/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ move }),
        });
        if (!res.ok) failed++;
      }
      setBulkBusy(false);
      clearSelection();
      await load();
      if (failed > 0) toast(`${failed} z ${ids.length} nie udało się przenieść.`, "error");
      else toast(`Przeniesiono ${ids.length} ${ids.length === 1 ? "wiadomość" : "wiadomości"}.`);
    },
    [selectedIds, confirm, clearSelection, load, toast]
  );

  // Otwarcie widoku = pobranie nowych (decyzja właściciela 2026-07-15:
  // on-demand + raz dziennie w cronie). Najpierw pokazujemy to, co jest w
  // bazie, żeby lista nie czekała na IMAP-a.
  useEffect(() => {
    void (async () => {
      await load();
      void sync(true);
    })();
    // Celowo raz przy wejściu — ponowny sync jest pod przyciskiem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Przeładowanie listy przy zmianie folderu (NATYCHMIAST — to jedno
  // kliknięcie, nie pisanie po znaku) albo frazy szukania (Z opóźnieniem —
  // bez tego każda litera to osobne zapytanie). Zmiana folderu dodatkowo
  // czyści zaznaczenie: zaznaczanie "w poprzek" folderów nie ma sensu.
  const prevFolderRef = useRef(activeFolder);
  const firstLoadEffectRun = useRef(true);
  useEffect(() => {
    if (firstLoadEffectRun.current) {
      firstLoadEffectRun.current = false;
      prevFolderRef.current = activeFolder;
      return;
    }
    const folderChanged = prevFolderRef.current !== activeFolder;
    prevFolderRef.current = activeFolder;
    if (folderChanged) {
      clearSelection();
      void load();
      return;
    }
    const t = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(t);
  }, [activeFolder, query, load, clearSelection]);

  // Fokus klawiaturowy wraca na górę listy przy każdym świeżym wczytaniu
  // (nowy folder, nowe wyniki szukania) — stara pozycja nie ma już sensu.
  useEffect(() => {
    setFocusedIndex(0);
  }, [messages]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${focusedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex]);

  useRegisterActions(
    [
      { id: "add", label: "Nowa wiadomość", run: () => setComposeOpen(true) },
      { id: "sync", label: "Pobierz nowe wiadomości", run: () => void sync(false) },
    ],
    [sync]
  );

  const filtered = useMemo(() => {
    if (!messages) return [];
    let out = messages;
    // Podczas szukania filtry NIE zawężają wyniku: jeśli wpisujesz frazę,
    // chcesz ją znaleźć wszędzie — także w wyciszonych reklamach czy w
    // obsłużonych. Inaczej wyszukiwarka "nie znajduje" maila, który jest.
    if (query.trim()) return out;
    // "Do odpowiedzi"/"Nieprzypisane"/kategorie mają sens TYLKO w Odebranych
    // (Etap 2 Modułu 4b) — serwer i tak zwraca tylko wiadomości aktywnego
    // folderu, ale bez tej straży filtr z poprzedniej wizyty w Odebranych
    // (np. "Rachunek") zostałby "przyklejony" i pokazywałby 0 wyników po
    // przełączeniu na Wysłane/Kosz/Archiwum, gdzie kategoria zawsze jest null.
    if (activeFolder === "inbox") {
      if (filter === "nowy") out = out.filter((m) => m.status === "nowy" && m.kierunek === "in");
      else if (filter === "unassigned") {
        out = out.filter((m) => !m.client_id && !m.lead_id && m.kierunek === "in" && m.status !== "zignorowany");
      }
      if (catFilter !== "wszystkie") {
        // Wiersze sprzed wprowadzenia kategorii mają null — traktujemy je jak
        // "inne", żeby nie znikały z widoku, zanim backfill je przeliczy.
        out = out.filter((m) => (m.kategoria ?? "inne") === catFilter);
      }
    }
    return out;
  }, [messages, filter, catFilter, query, activeFolder]);

  // Nawigacja klawiaturą (Etap 2 Modułu 4b): j/k albo strzałki po liście,
  // Enter otwiera, spacja zaznacza, "r" otwiera odpowiedź na otwartej
  // wiadomości, "e" oznacza jako obsłużone (decyzja właściciela 2026-07-16:
  // NIE archiwizacja — status i folder to dwie osobne osie), Escape zamyka
  // podgląd. isTypingTarget() (już używane w innych modułach panelu, patrz
  // ClientsDashboard.tsx) chroni pisanie w polu szukania/odpowiedzi.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (openId) setOpenId(null);
        return;
      }
      if (isTypingTarget(e.target)) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && filtered[focusedIndex]) {
        e.preventDefault();
        setOpenId(filtered[focusedIndex].id);
        return;
      }
      if (e.key === " " && filtered[focusedIndex]) {
        e.preventDefault();
        toggleSelect(filtered[focusedIndex].id);
        return;
      }
      if (e.key === "r" && openId) {
        e.preventDefault();
        setReplyShortcutNonce((n) => n + 1);
        return;
      }
      if (e.key === "e") {
        const targetId = openId ?? filtered[focusedIndex]?.id;
        if (targetId) {
          e.preventDefault();
          void setMailStatus(targetId, "obsłużony");
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openId, filtered, focusedIndex, toggleSelect, setMailStatus]);

  const openMessage = messages?.find((m) => m.id === openId) ?? null;

  if (!messages) {
    return (
      <div className="space-y-3 p-4 sm:p-6">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--hairline)]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--hairline)]" />
      </div>
    );
  }

  const folderCount = (f: MailFolder): number => (f === "inbox" ? counts.nowe : (counts[`folder_${f}`] ?? 0));

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-liquid text-xl font-medium">Poczta</h1>
          <p className="text-[13px] text-muted">
            {counts.nowe > 0 ? `${counts.nowe} do odpowiedzi` : "Wszystko obsłużone"}
            {counts.nieprzypisane > 0 ? ` · ${counts.nieprzypisane} nieprzypisane` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj w poczcie…"
              className="w-56 rounded-full border hairline bg-transparent py-1.5 pl-8 pr-7 text-[13px] outline-none focus:border-brand-purple/50"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted" aria-hidden>
              🔍
            </span>
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted hover:text-[var(--fg)]"
                aria-label="Wyczyść szukanie"
              >
                ×
              </button>
            )}
          </div>
          <button
            onClick={() => void sync(false)}
            disabled={syncing}
            className="rounded-full border hairline px-4 py-1.5 text-[13px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
          >
            {syncing ? "Pobieram…" : "Pobierz nowe"}
          </button>
          <button
            onClick={() => setComposeOpen(true)}
            disabled={!configured}
            title={configured ? undefined : "Skrzynka nie jest skonfigurowana — dodaj dane az.pl w zmiennych środowiskowych Vercela."}
            className="btn-primary rounded-full px-4 py-1.5 text-[13px] disabled:opacity-50"
          >
            ✎ Nowa wiadomość
          </button>
        </div>
      </div>

      {composeOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px] sm:p-8"
          onClick={() => setComposeOpen(false)}
        >
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <MailComposeForm mode="compose" endpoint="/api/mail/compose" onSent={load} onClose={() => setComposeOpen(false)} />
          </div>
        </div>
      )}

      {!configured && (
        <div className="mb-4 rounded-xl border hairline bg-brand-gold/10 p-4 text-[13px]">
          <p className="font-medium">Skrzynka pocztowa nie jest jeszcze podłączona.</p>
          <p className="mt-1 text-muted">
            Panel pokazuje na razie tylko to, co ma w bazie. Żeby pobierał i wysyłał maile z Twojej skrzynki az.pl, dodaj w
            zmiennych środowiskowych Vercela: <code>MAIL_IMAP_HOST</code>, <code>MAIL_USER</code>, <code>MAIL_PASS</code> (oraz
            opcjonalnie <code>MAIL_IMAP_PORT</code>, <code>MAIL_SMTP_HOST</code>, <code>MAIL_SMTP_PORT</code>). Wartości znajdziesz
            w panelu az.pl.
          </p>
        </div>
      )}

      {activeFolder === "inbox" && (
        <>
          <div className="mb-2 flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-3 py-1 text-[12px] transition ${
                  filter === f.id ? "bg-[var(--hairline)] font-medium" : "text-muted hover:text-[var(--fg)]"
                }`}
              >
                {f.label}
                {f.id === "nowy" && counts.nowe > 0 ? ` (${counts.nowe})` : ""}
                {f.id === "unassigned" && counts.nieprzypisane > 0 ? ` (${counts.nieprzypisane})` : ""}
              </button>
            ))}
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-1 border-t hairline pt-2">
            <span className="mr-1 text-[11px] text-muted opacity-70">Rodzaj:</span>
            {CAT_FILTERS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCatFilter(c.id)}
                className={`rounded-full px-2.5 py-0.5 text-[12px] transition ${
                  catFilter === c.id ? "bg-[var(--hairline)] font-medium" : "text-muted hover:text-[var(--fg)]"
                }`}
              >
                {c.label}
                {c.id !== "wszystkie" && counts[c.id] > 0 ? ` (${counts[c.id]})` : ""}
              </button>
            ))}
          </div>
        </>
      )}

      {selectedIds.size > 0 && (
        <div className="card-paper sticky top-2 z-30 mb-3 flex flex-wrap items-center gap-2 rounded-full px-4 py-2 text-[12px]">
          <span className="font-semibold">Zaznaczono: {selectedIds.size}</span>
          <button
            onClick={() => void bulkSetStatus("obsłużony")}
            disabled={bulkBusy}
            className="rounded-full border hairline px-3 py-1 hover:bg-[var(--hairline)]/50 disabled:opacity-50"
          >
            Obsłużone
          </button>
          {activeFolder !== "archive" && (
            <button
              onClick={() => void bulkMove("archive")}
              disabled={bulkBusy || !configured}
              className="rounded-full border hairline px-3 py-1 hover:bg-[var(--hairline)]/50 disabled:opacity-50"
            >
              🗄️ Archiwizuj
            </button>
          )}
          {activeFolder !== "trash" && (
            <button
              onClick={() => void bulkMove("trash")}
              disabled={bulkBusy || !configured}
              className="rounded-full border border-red-500/40 px-3 py-1 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              🗑️ Usuń
            </button>
          )}
          {(activeFolder === "trash" || activeFolder === "archive") && (
            <button
              onClick={() => void bulkMove("inbox")}
              disabled={bulkBusy || !configured}
              className="rounded-full border hairline px-3 py-1 hover:bg-[var(--hairline)]/50 disabled:opacity-50"
            >
              📥 Przywróć
            </button>
          )}
          <span className="flex-1" />
          <button onClick={clearSelection} className="rounded-full border hairline px-3 py-1 text-muted">
            Odznacz wszystko
          </button>
        </div>
      )}

      {/* Trzy kolumny — foldery (styl Apple Mail, Etap 2 Modułu 4b) + lista +
          podgląd. Poniżej `lg` kolumny się składają: foldery jako poziomy
          pasek pigułek (ten sam wzorzec co FILTERS wyżej), lista nad
          podglądem. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex flex-row flex-wrap gap-1 lg:w-40 lg:shrink-0 lg:flex-col lg:gap-0.5">
          {MAIL_FOLDERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFolder(f)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-left text-[13px] transition lg:rounded-xl lg:px-3 lg:py-2 ${
                activeFolder === f ? "bg-[var(--hairline)] font-medium" : "text-muted hover:bg-[var(--hairline)]/40 hover:text-[var(--fg)]"
              }`}
            >
              <span aria-hidden>{MAIL_FOLDER_ICON[f]}</span>
              <span className="lg:flex-1">{MAIL_FOLDER_LABEL[f]}</span>
              {folderCount(f) > 0 && <span className="text-[11px] text-muted">{folderCount(f)}</span>}
            </button>
          ))}
        </div>

        <div className="card-paper min-w-0 rounded-xl border hairline lg:max-h-[calc(100vh-260px)] lg:w-[420px] lg:shrink-0 lg:overflow-y-auto">
          {filtered.length > 0 && (
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b hairline bg-[var(--bg-soft)] px-4 py-2 text-[11px] text-muted">
              <input
                type="checkbox"
                checked={filtered.every((m) => selectedIds.has(m.id))}
                onChange={(e) => toggleSelectAll(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer accent-brand-purple"
                aria-label="Zaznacz wszystkie widoczne"
              />
              <span>Zaznacz wszystkie widoczne ({filtered.length})</span>
            </div>
          )}
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted opacity-60">
              {activeFolder !== "inbox"
                ? `Brak wiadomości w folderze „${MAIL_FOLDER_LABEL[activeFolder]}”.`
                : filter === "nowy"
                  ? "Nic — wszystko obsłużone."
                  : filter === "unassigned"
                    ? "Nic nieprzypisanego."
                    : "Brak wiadomości."}
            </p>
          ) : (
            <ul ref={listRef} className="divide-y divide-[var(--hairline)]">
              {filtered.map((m, i) => (
                <li key={m.id} className="relative" data-idx={i}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setOpenId(m.id);
                      setFocusedIndex(i);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setOpenId(m.id);
                    }}
                    className={`flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition hover:bg-[var(--hairline)]/40 ${
                      openId === m.id ? "bg-[var(--hairline)]/50" : ""
                    } ${focusedIndex === i ? "ring-2 ring-inset ring-brand-purple/50" : ""}`}
                  >
                    <span onClick={(e) => e.stopPropagation()} className="mt-1 shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(m.id)}
                        onChange={() => toggleSelect(m.id)}
                        className="h-3.5 w-3.5 cursor-pointer accent-brand-purple"
                        aria-label={`Zaznacz: ${m.subject || "bez tematu"}`}
                      />
                    </span>
                    {/* Kropka nieprzeczytanych wzorem Apple Mail — stała
                        kolumna (niewidoczna, gdy obsłużone), żeby wiersze nie
                        przeskakiwały w bok po odhaczeniu. */}
                    <span className="mt-1.5 flex w-2 shrink-0 justify-center" aria-hidden>
                      {m.status === "nowy" && m.kierunek === "in" && (
                        <span className="h-2 w-2 rounded-full bg-brand-cyan" title="Nieprzeczytana" />
                      )}
                    </span>
                    <span className="mt-0.5 shrink-0 text-base" aria-hidden>
                      {m.kierunek === "out" ? "↩️" : "✉️"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[13px] font-medium">
                          {m.kierunek === "out" ? `Do: ${m.to_addr}` : m.from_name || m.from_addr}
                        </span>
                        {m.client_nazwa && (
                          <span className="shrink-0 rounded-full bg-brand-purple/15 px-2 py-0.5 text-[11px] text-brand-purple">
                            {m.client_nazwa}
                          </span>
                        )}
                        {m.lead_nazwa && (
                          <span className="shrink-0 rounded-full bg-brand-cyan/15 px-2 py-0.5 text-[11px] text-brand-cyan">
                            {m.lead_nazwa}
                          </span>
                        )}
                        {!m.client_nazwa && !m.lead_nazwa && m.kierunek === "in" && m.status !== "zignorowany" && (
                          <span className="shrink-0 rounded-full bg-[var(--hairline)] px-2 py-0.5 text-[11px] text-muted">
                            Nieprzypisany
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px]">{m.subject || "(bez tematu)"}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-muted opacity-70">
                        {(m.body_text || "").slice(0, 120)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {m.kategoria && <MailCategoryTag kategoria={m.kategoria} />}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusMenuFor((cur) => (cur === m.id ? null : m.id));
                        }}
                        title="Zmień status"
                      >
                        <MailStatusTag status={m.status as MailStatus} />
                      </button>
                      <span className="w-14 text-right text-[11px] text-muted">{formatWhen(m.received_at)}</span>
                    </span>
                  </div>

                  {statusMenuFor === m.id && (
                    <div
                      className="card-paper absolute right-4 top-11 z-20 w-40 rounded-xl border hairline p-1 shadow-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {m.status !== "obsłużony" && (
                        <button
                          onClick={() => void setMailStatus(m.id, "obsłużony")}
                          className="block w-full rounded-lg px-3 py-1.5 text-left text-[12px] hover:bg-[var(--hairline)]/60"
                        >
                          Obsłużone
                        </button>
                      )}
                      {m.status !== "zignorowany" && (
                        <button
                          onClick={() => void setMailStatus(m.id, "zignorowany")}
                          className="block w-full rounded-lg px-3 py-1.5 text-left text-[12px] hover:bg-[var(--hairline)]/60"
                        >
                          Wycisz
                        </button>
                      )}
                      {m.status !== "nowy" && (
                        <button
                          onClick={() => void setMailStatus(m.id, "nowy")}
                          className="block w-full rounded-lg px-3 py-1.5 text-left text-[12px] hover:bg-[var(--hairline)]/60"
                        >
                          Przywróć
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {openMessage ? (
            <MailDetailPanel
              lang={lang}
              mailId={openMessage.id}
              configured={configured}
              onClose={() => setOpenId(null)}
              onChanged={load}
              replyShortcut={replyShortcutNonce}
            />
          ) : (
            <div className="card-paper flex min-h-[300px] items-center justify-center rounded-2xl border hairline p-8 text-center text-sm text-muted opacity-60">
              Wybierz wiadomość z listy.
            </div>
          )}
        </div>
      </div>

      {statusMenuFor && <div className="fixed inset-0 z-10" onClick={() => setStatusMenuFor(null)} />}
    </div>
  );
}
