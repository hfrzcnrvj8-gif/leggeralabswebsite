"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { useUI, useRegisterActions, isTypingTarget } from "../ui";
import {
  MailStatusTag,
  MailCategoryTag,
  MAIL_CATEGORY_LABEL,
  MAIL_CATEGORY_ICON,
  MAIL_FOLDERS,
  MAIL_FOLDER_LABEL,
  MAIL_FOLDER_ICON,
  formatPlDateTime,
  daysSinceISO,
  type MailMessageWithLinks,
  type MailStatus,
  type MailFolder,
  type MailCategory,
  type NudgeThread,
} from "./shared";
import { MailDetailPanel } from "./MailDetailPanel";
import { MailComposeForm } from "./MailComposeForm";
import { Modal } from "../Modal";
import { FilterPills } from "../FilterPills";
import { ViewSwitch } from "../ViewTabs";

// Filtry to dwie NIEZALEŻNE osie, jak status vs zdrowie projektu: co wymaga
// mojej reakcji (góra) i czego dotyczy (dół, kategorie). Mieszanie ich w jedną
// listę zmuszałoby do wyboru "albo do odpowiedzi, albo rachunki". Sensowne
// TYLKO w Odebranych (Etap 2 Modułu 4b) — Wysłane/Kosz/Archiwum nie mają
// pojęcia "do odpowiedzi" ani klasyfikacji treści.
type Filter = "nowy" | "unassigned" | "vip" | "snoozed" | "screener" | "all" | "nudge";
type CatFilter = "wszystkie" | "oferta" | "rachunek" | "urzedowe" | "inne" | "reklama";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "nowy", label: "Do odpowiedzi" },
  { id: "unassigned", label: "Nieprzypisane" },
  { id: "vip", label: "VIP" },
  { id: "snoozed", label: "Uśpione" },
  { id: "screener", label: "Nowi nadawcy" },
  { id: "all", label: "Wszystkie" },
];

// Moduł 4f — sensowne TYLKO w Wysłane (agregacja na poziomie wątku w
// poprzek folderów, patrz getNudgeThreads() w lib/db.ts), stąd osobny zestaw
// pigułek od FILTERS wyżej (te są dla Odebranych).
const SENT_FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Wszystkie" },
  { id: "nudge", label: "Bez odpowiedzi" },
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

/** "Wróć do poczty" (zgłoszone przez właściciela) — klik w tag klienta/leada
 * (tu albo w MailDetailPanel.tsx) zapamiętuje DOKŁADNIE gdzie byliśmy
 * (folder/filtry/otwarta wiadomość), zanim przejdziemy na kartę kontaktu.
 * Przy powrocie do Poczty (dowolną drogą — link "← Wróć do poczty" na karcie
 * klienta/leada ALBO zwykłe wejście z sidebara) stan odtwarza się raz i jest
 * kasowany, żeby nie "zostawał przyklejony" na zawsze. localStorage, nie
 * URL — to samo podejście co inne zapamiętane widoki panelu (np.
 * `leggera_clients_view`), tylko jednorazowe (konsumowane), nie trwałe. */
const MAIL_RETURN_STATE_KEY = "leggera_mail_return_state";
type MailReturnState = { folder: MailFolder; filter: Filter; catFilter: CatFilter; openId: string | null };

function readMailReturnState(): MailReturnState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MAIL_RETURN_STATE_KEY);
    return raw ? (JSON.parse(raw) as MailReturnState) : null;
  } catch {
    return null;
  }
}

function writeMailReturnState(state: MailReturnState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MAIL_RETURN_STATE_KEY, JSON.stringify(state));
  } catch {
    // localStorage niedostępny (np. tryb prywatny) — powrót po prostu nie
    // zadziała, nic poza tym się nie psuje.
  }
}

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
  // Nudge/Follow-up (Moduł 4f) — osobny stan, NIE część `messages`: to
  // agregat na poziomie wątku w poprzek folderów (getNudgeThreads(),
  // lib/db.ts), którego generyczna lista jednego folderu nie zwraca.
  // Wczytywany raz przy wejściu (żeby liczba na pigułce była od razu
  // widoczna) i po każdym syncu/wyciszeniu.
  const [nudgeThreads, setNudgeThreads] = useState<NudgeThread[] | null>(null);
  const [nudgeBusyId, setNudgeBusyId] = useState<string | null>(null);
  // Lazy initializery (nie zwykłe literały) — jeśli właściciel wrócił tu z
  // karty klienta/leada (patrz MAIL_RETURN_STATE_KEY wyżej), stan startowy to
  // DOKŁADNIE to, co zostawił, nie zawsze domyślne Odebrane/"Do odpowiedzi".
  // Czyta wielokrotnie (raz na pole) — czysty odczyt bez efektu ubocznego,
  // bezpieczny nawet przy podwójnym wywołaniu w React Strict Mode (dev).
  const [activeFolder, setActiveFolder] = useState<MailFolder>(() => readMailReturnState()?.folder ?? "inbox");
  const [filter, setFilter] = useState<Filter>(() => readMailReturnState()?.filter ?? "nowy");
  const [catFilter, setCatFilter] = useState<CatFilter>(() => readMailReturnState()?.catFilter ?? "wszystkie");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(() => readMailReturnState()?.openId ?? null);
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
  // Analogiczne nonce dla "f" (Przekaż) i "a" (Odpowiedz wszystkim) — 04e
  // runda 2, dorobione skróty wzorem Apple Mail.
  const [forwardShortcutNonce, setForwardShortcutNonce] = useState(0);
  const [replyAllShortcutNonce, setReplyAllShortcutNonce] = useState(0);
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

  /** Moduł 4f — osobne zapytanie, patrz komentarz przy stanie `nudgeThreads`
   * wyżej. Cicho ignoruje błąd (brak `res.ok` check poza 401): licznik na
   * pigułce po prostu zostaje 0, to nie jest krytyczna ścieżka jak `load()`. */
  const loadNudge = useCallback(async () => {
    const res = await fetch("/api/mail/nudge");
    if (res.status === 401) return;
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    setNudgeThreads(Array.isArray(data?.threads) ? data.threads : []);
  }, []);

  /** Wycisz pojedynczy przypominacz — jedyny naturalny powrót to wysłanie
   * kolejnej wiadomości w wątku (patrz komentarz przy PATCH /api/mail/[id]).
   * Optymistycznie znika z listy od razu, bez czekania na load(). */
  const dismissNudge = useCallback(
    async (thread: NudgeThread) => {
      setNudgeBusyId(thread.id);
      const res = await fetch(`/api/mail/${thread.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nudgeDismissed: true }),
      });
      setNudgeBusyId(null);
      if (!res.ok) {
        toast("Nie udało się wyciszyć przypomnienia.", "error");
        return;
      }
      setNudgeThreads((cur) => (cur ? cur.filter((t) => t.id !== thread.id) : cur));
      toast("Wyciszono przypomnienie.");
    },
    [toast]
  );

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
        void loadNudge(); // nowo pobrana poczta może zawierać odpowiedź, która czyści nudge
        if (!silent) {
          toast(data.saved > 0 ? `Pobrano ${data.saved} now${data.saved === 1 ? "ą wiadomość" : "e wiadomości"}.` : "Brak nowych wiadomości.");
        }
      } finally {
        setSyncing(false);
      }
    },
    [load, loadNudge, toast]
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

  /** Flaga "ważne" (04e runda 2) — TYLKO lokalna (decyzja właściciela), więc
   * przełącza się natychmiast bez czekania na żaden zewnętrzny serwer.
   * Ten sam optymistyczny wzorzec co setMailStatus() wyżej. */
  const toggleFlag = useCallback(
    async (id: string, flagged: boolean) => {
      const prev = messages;
      setMessages((cur) => (cur ? cur.map((m) => (m.id === id ? { ...m, flagged } : m)) : cur));
      const res = await fetch(`/api/mail/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagged }),
      });
      if (!res.ok) {
        setMessages(prev);
        toast("Nie udało się zmienić flagi.", "error");
      }
    },
    [messages, toast]
  );

  /** Przenosi POJEDYNCZĄ wiadomość między folderami — skróty klawiszowe "y"
   * (Archiwizuj) i Backspace (Usuń), 04e runda 2. Ten sam PATCH co
   * `moveTo()` w MailDetailPanel.tsx i pętla w bulkMove() niżej, ale bez
   * potwierdzenia (tak jak pojedynczy przycisk "Usuń" w podglądzie — tylko
   * akcja ZBIORCZA pyta o potwierdzenie, bo dotyczy wielu wiadomości naraz). */
  const moveMail = useCallback(
    async (id: string, move: "trash" | "archive" | "inbox") => {
      const res = await fetch(`/api/mail/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ move }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(data?.error || "Nie udało się przenieść wiadomości.", "error");
        return;
      }
      if (openId === id) setOpenId(null);
      await load();
      toast(move === "trash" ? "Przeniesiono do Kosza." : move === "archive" ? "Zarchiwizowano." : "Przywrócono do Odebranych.");
    },
    [openId, load, toast]
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
      // Osobno od sync(true) NIE wewnątrz niego — sync() wraca wcześniej,
      // gdy skrzynka nie jest skonfigurowana (configured===false, zawsze
      // lokalnie), więc licznik nudge zostałby wiecznie pusty mimo że dane
      // leżą w bazie niezależnie od IMAP-a.
      void loadNudge();
      void sync(true);
    })();
    // Celowo raz przy wejściu — ponowny sync jest pod przyciskiem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skonsumuj zapamiętany stan powrotu (wyżej, lazy initializery) — jednym
  // razowo, żeby kolejne zwykłe wejścia w Pocztę nie zostały "przyklejone"
  // do starego folderu/wiadomości na zawsze.
  useEffect(() => {
    window.localStorage.removeItem(MAIL_RETURN_STATE_KEY);
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
      // Zakładki filtrów są inne w Odebranych ("Do odpowiedzi"…) i w Wysłane
      // ("Bez odpowiedzi") — bez resetu przełączenie folderu zostawiałoby
      // np. `filter === "nudge"` aktywne w Odebranych, gdzie nic takiego nie
      // istnieje (patrz SENT_FILTERS/FILTERS wyżej).
      setFilter(activeFolder === "inbox" ? "nowy" : "all");
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
      // Screener (Moduł 4, Etap 3) — nadawca 'pending'/'blocked' jest
      // wykluczony z "Do odpowiedzi"/"Nieprzypisane" (bramkowanie przy
      // odczycie, patrz app/api/mail/route.ts) i widoczny TYLKO pod "Nowi
      // nadawcy", dopóki właściciel nie podejmie decyzji.
      // Snooze (Moduł 4, Etap 3) — odłożona-a-jeszcze-nie-należna wiadomość
      // znika z "Do odpowiedzi"/"Nieprzypisane" (wraca SAMA, bez crona, gdy
      // `snooze_until <= now()` — liczone tu, przy KAŻDYM renderze).
      const notSnoozed = (m: MailMessageWithLinks) => !m.snooze_until || new Date(m.snooze_until) <= new Date();
      if (filter === "nowy") {
        out = out.filter(
          (m) =>
            m.status === "nowy" &&
            m.kierunek === "in" &&
            m.sender_status !== "pending" &&
            m.sender_status !== "blocked" &&
            notSnoozed(m)
        );
      } else if (filter === "unassigned") {
        out = out.filter(
          (m) =>
            !m.client_id &&
            !m.lead_id &&
            m.kierunek === "in" &&
            m.status !== "zignorowany" &&
            m.sender_status !== "pending" &&
            m.sender_status !== "blocked" &&
            notSnoozed(m)
        );
      } else if (filter === "screener") {
        out = out.filter((m) => m.sender_status === "pending" && m.kierunek === "in");
      } else if (filter === "vip") {
        // VIP bije KLASYFIKACJĘ ("Aktywny" klient = VIP z automatu) —
        // świadomie BEZ warunków na status/kategoria/sender_status, w
        // odróżnieniu od gałęzi wyżej. Dopasowany klient nigdy nie dostaje
        // kategoria='reklama' (patrz komentarz w saveIncoming(),
        // lib/mailSync.ts) — realny przypadek to ręcznie wyciszona/obsłużona
        // wiadomość VIP-a, którą ta zakładka ma pokazać mimo wszystko.
        out = out.filter((m) => m.client_status === "Aktywny" && m.kierunek === "in");
      } else if (filter === "snoozed") {
        out = out.filter((m) => m.kierunek === "in" && m.snooze_until && new Date(m.snooze_until) > new Date());
      }
      // Kategoria bije wszystkie zakładki OPRÓCZ VIP — VIP ma z definicji
      // ignorować klasyfikację treści (patrz gałąź wyżej), więc pillsy
      // kategorii nie mają tu zastosowania.
      if (catFilter !== "wszystkie" && filter !== "vip") {
        // Wiersze sprzed wprowadzenia kategorii mają null — traktujemy je jak
        // "inne", żeby nie znikały z widoku, zanim backfill je przeliczy.
        out = out.filter((m) => (m.kategoria ?? "inne") === catFilter);
      }
    }
    return out;
  }, [messages, filter, catFilter, query, activeFolder]);

  // Grupowanie w wątki (Moduł 4, Etap 3) — jeden wiersz na wątek zamiast
  // jednego na wiadomość. `filtered` jest już `received_at DESC` z serwera,
  // więc PIERWSZE wystąpienie danego thread_id to najnowsza wiadomość wątku
  // — ona jest reprezentantem wiersza. Świadomie grupowanie TYLKO w obrębie
  // aktualnie wczytanego folderu (serwer i tak zwraca jeden folder na raz) —
  // licznik pokazuje więc "ile wiadomości TEGO wątku jest w tym folderze",
  // nie prawdziwą wielkość całej rozmowy rozpiętej między folderami (tę
  // pokazuje dopiero pasek wątku w podglądzie, patrz MailDetailPanel.tsx).
  const threadGroups = useMemo(() => {
    const byThread = new Map<string, { rep: MailMessageWithLinks; count: number }>();
    const order: string[] = [];
    for (const m of filtered) {
      const key = m.thread_id || m.id; // fallback dla wierszy sprzed migracji wątkowania
      const g = byThread.get(key);
      if (g) g.count++;
      else {
        byThread.set(key, { rep: m, count: 1 });
        order.push(key);
      }
    }
    return order.map((k) => byThread.get(k)!);
  }, [filtered]);

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
        setFocusedIndex((i) => Math.min(i + 1, Math.max(threadGroups.length - 1, 0)));
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && threadGroups[focusedIndex]) {
        e.preventDefault();
        setOpenId(threadGroups[focusedIndex].rep.id);
        return;
      }
      if (e.key === " " && threadGroups[focusedIndex]) {
        e.preventDefault();
        toggleSelect(threadGroups[focusedIndex].rep.id);
        return;
      }
      if (e.key === "r" && openId) {
        e.preventDefault();
        setReplyShortcutNonce((n) => n + 1);
        return;
      }
      // "f" (Przekaż) i "a" (Odpowiedz wszystkim) — 04e runda 2, wymagają
      // otwartego podglądu (potrzebują formularza z MailComposeForm/pola DW,
      // które żyją tylko w MailDetailPanel), analogicznie do "r" wyżej.
      if (e.key === "f" && openId) {
        e.preventDefault();
        setForwardShortcutNonce((n) => n + 1);
        return;
      }
      if (e.key === "a" && openId) {
        e.preventDefault();
        setReplyAllShortcutNonce((n) => n + 1);
        return;
      }
      // Skróty niżej ("e"/"s"/"y"/Backspace) rozstrzygają cel przez
      // threadGroups (reprezentanci wątków), nie przez surowe `filtered` —
      // patrz komentarz przy threadGroups wyżej. Świadome ograniczenie v1:
      // jeśli `openId` wskazuje wiadomość spoza aktualnie wczytanego folderu
      // (siostra z wątku otwarta przez pasek w podglądzie —
      // MailDetailPanel.tsx), te skróty stają się no-opem, dopóki właściciel
      // nie wróci do wiadomości faktycznie obecnej na liście — to NIE błąd,
      // kliknięcia myszką w samym podglądzie nadal działają normalnie.
      if (e.key === "e") {
        const targetId = openId ?? threadGroups[focusedIndex]?.rep.id;
        if (targetId) {
          e.preventDefault();
          void setMailStatus(targetId, "obsłużony");
        }
      }
      if (e.key === "s") {
        const target = threadGroups.map((g) => g.rep).find((m) => m.id === (openId ?? threadGroups[focusedIndex]?.rep.id));
        if (target) {
          e.preventDefault();
          void toggleFlag(target.id, !target.flagged);
        }
      }
      // "y" (Archiwizuj) i Backspace (Usuń) — 04e runda 2, działają na
      // otwartej LUB fokusowanej wiadomości (jak "e"/"s" wyżej), bez
      // potwierdzenia (patrz komentarz przy moveMail()).
      if (e.key === "y") {
        const target = threadGroups.map((g) => g.rep).find((m) => m.id === (openId ?? threadGroups[focusedIndex]?.rep.id));
        if (target && configured && target.folder !== "archive") {
          e.preventDefault();
          void moveMail(target.id, "archive");
        }
      }
      if (e.key === "Backspace") {
        const target = threadGroups.map((g) => g.rep).find((m) => m.id === (openId ?? threadGroups[focusedIndex]?.rep.id));
        if (target && configured && target.folder !== "trash") {
          e.preventDefault();
          void moveMail(target.id, "trash");
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openId, threadGroups, focusedIndex, configured, toggleSelect, setMailStatus, toggleFlag, moveMail]);

  if (!messages) {
    return (
      <div className="space-y-3 p-4 sm:p-6">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--hairline)]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--hairline)]" />
      </div>
    );
  }

  const folderCount = (f: MailFolder): number => (f === "inbox" ? counts.nowe : (counts[`folder_${f}`] ?? 0));

  /** Licznik doklejany do etykiety pigułki filtra, np. „VIP (2)”. Zero
   *  chowamy — pigułka „Uśpione (0)” tylko dodaje szumu. */
  const filterCountSuffix = (id: Filter): string => {
    const n =
      id === "nowy"
        ? counts.nowe
        : id === "unassigned"
          ? counts.nieprzypisane
          : id === "vip"
            ? counts.vip
            : id === "snoozed"
              ? counts.snoozed
              : id === "screener"
                ? counts.pending_screener
                : id === "nudge"
                  ? (nudgeThreads?.length ?? 0)
                  : 0;
    return n > 0 ? ` (${n})` : "";
  };

  // Moduł 4f — zakładka "Bez odpowiedzi" pokazuje zupełnie inne dane
  // (agregat NudgeThread z /api/mail/nudge, nie MailMessageWithLinks z
  // `messages`), więc lista niżej ma dwie gałęzie renderowania zamiast
  // filtrowania wspólnego źródła jak VIP/Uśpione.
  const isNudgeView = activeFolder === "sent" && filter === "nudge";

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          {/* Jasny wariant gradientu marki (04e runda 6) — .text-liquid-outline
              to .text-liquid z jaśniejszymi stopniami, po tym jak wersja z
              pustym konturem liter (poprzednia runda) okazała się
              niezadowalająca. */}
          <h1 className="text-liquid-outline text-xl font-medium">Poczta</h1>
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

      <Modal open={composeOpen} onClose={() => setComposeOpen(false)} card="my-auto w-full max-w-4xl">
        <MailComposeForm mode="compose" endpoint="/api/mail/compose" onSent={load} onClose={() => setComposeOpen(false)} />
      </Modal>

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

      {(activeFolder === "inbox" || activeFolder === "sent") && (
        <div className="mb-3 flex gap-1">
          <FilterPills
            value={filter}
            onChange={setFilter}
            pills={(activeFolder === "inbox" ? FILTERS : SENT_FILTERS).map((f) => ({
              id: f.id,
              label: f.label + filterCountSuffix(f.id),
            }))}
          />
        </div>
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

      {/* Trzy kolumny — sidebar (foldery + "Rodzaj", styl "Inteligentne
          skrzynki pocztowe" Apple Mail, Moduł 4e) + lista + podgląd. Poniżej
          `lg` obie sekcje sidebara stają się poziomymi paskami pigułek (ten
          sam wzorzec co FILTERS wyżej), oddzielonymi linią, lista nad
          podglądem. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-1 lg:w-44 lg:shrink-0">
          <div className="flex flex-row flex-wrap gap-1 lg:flex-col lg:gap-0.5">
            {MAIL_FOLDERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFolder(f)}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-left text-[13px] transition lg:rounded-xl lg:px-3 lg:py-2 ${
                  activeFolder === f ? "pill-active font-medium" : "text-muted hover:bg-[var(--hairline)]/40 hover:text-[var(--fg)]"
                }`}
              >
                <span aria-hidden>{MAIL_FOLDER_ICON[f]}</span>
                <span className="lg:flex-1">{MAIL_FOLDER_LABEL[f]}</span>
                {folderCount(f) > 0 && <span className="text-[11px] text-muted">{folderCount(f)}</span>}
              </button>
            ))}
          </div>

          {/* "Rodzaj" — wzorem "Inteligentnych skrzynek pocztowych" Apple
              Mail (04e pkt 2): dawniej poziomy rządek pigułek nad listą,
              teraz osobna sekcja sidebara pod folderami. Sensowne TYLKO w
              Odebranych — Wysłane/Kosz/Archiwum nie mają kategorii treści. */}
          {activeFolder === "inbox" && (
            <div className="mt-3 border-t hairline pt-3 lg:mt-4 lg:pt-4">
              <div className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wide text-muted opacity-60 lg:px-3">Rodzaj</div>
              <div className="flex flex-row flex-wrap gap-1 lg:flex-col lg:gap-0.5">
                {CAT_FILTERS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCatFilter(c.id)}
                    className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-left text-[13px] transition lg:rounded-xl lg:px-3 lg:py-1.5 ${
                      catFilter === c.id ? "pill-active font-medium" : "text-muted hover:bg-[var(--hairline)]/40 hover:text-[var(--fg)]"
                    }`}
                  >
                    {c.id !== "wszystkie" && <span aria-hidden>{MAIL_CATEGORY_ICON[c.id as MailCategory]}</span>}
                    <span className="lg:flex-1">{c.label}</span>
                    {c.id !== "wszystkie" && counts[c.id] > 0 && <span className="text-[11px] text-muted">{counts[c.id]}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Szerokość responsywna, nie sztywne 420px (04e runda 2, zgłoszone
            przez właściciela) — na szerokim ekranie kolumna rośnie razem ze
            stroną (dzięki pełnej szerokości Poczty w AppShell.tsx), zamiast
            zostawać przyklejoną do stałej wartości i wymuszać brutalne
            obcinanie nadawcy/tematu/podglądu w wierszu niżej. */}
        <div className="card-paper min-w-0 rounded-xl border hairline lg:max-h-[calc(100vh-260px)] lg:w-[38%] lg:min-w-[380px] lg:max-w-[620px] lg:shrink-0 lg:overflow-y-auto">
          {/* Przenikanie przy zmianie folderu/filtra/kategorii — do audytu
              2026-07-16 lista podmieniała się w jednej klatce. Ramka karty
              zostaje na zewnątrz, żeby przenikała tylko TREŚĆ, a nie całe
              pudełko wraz z obrysem. */}
          <ViewSwitch viewKey={`${activeFolder}:${filter}:${catFilter}`}>
          {isNudgeView ? (
            nudgeThreads === null ? (
              <p className="p-8 text-center text-sm text-muted opacity-60">Wczytuję…</p>
            ) : nudgeThreads.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted opacity-60">Nic — na wszystko dostałeś odpowiedź.</p>
            ) : (
              <ul className="divide-y divide-[var(--hairline)]">
                {nudgeThreads.map((t) => (
                  <li key={t.id} className="relative">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenId(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setOpenId(t.id);
                      }}
                      className={`flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left transition-all duration-200 ease-out hover:bg-[var(--hairline)]/40 ${
                        openId === t.id ? "bg-brand-purple/[0.07]" : ""
                      }`}
                    >
                      <span className="mt-0.5 shrink-0 text-base" aria-hidden>
                        ⏰
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">Do: {t.to_addr}</span>
                          <span className="shrink-0 text-[11px] text-brand-gold">{daysSinceISO(t.received_at)} dni ciszy</span>
                        </span>
                        <span className="mt-1 flex items-center gap-1.5">
                          <span className="min-w-0 flex-1 truncate text-[13px]">{t.subject || "(bez tematu)"}</span>
                          {t.client_id && t.client_nazwa && (
                            <Link
                              href={`/${lang}/admin/clients/${t.client_id}?from=mail`}
                              onClick={(e) => {
                                e.stopPropagation();
                                writeMailReturnState({ folder: activeFolder, filter, catFilter, openId: t.id });
                              }}
                              className="shrink-0 rounded-full bg-brand-purple/15 px-2 py-0.5 text-[11px] text-brand-purple hover:opacity-80"
                            >
                              {t.client_nazwa}
                            </Link>
                          )}
                          {t.lead_id && t.lead_nazwa && (
                            <Link
                              href={`/${lang}/admin/leads/${t.lead_id}?from=mail`}
                              onClick={(e) => {
                                e.stopPropagation();
                                writeMailReturnState({ folder: activeFolder, filter, catFilter, openId: t.id });
                              }}
                              className="shrink-0 rounded-full bg-brand-cyan/15 px-2 py-0.5 text-[11px] text-brand-cyan hover:opacity-80"
                            >
                              {t.lead_nazwa}
                            </Link>
                          )}
                        </span>
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void dismissNudge(t);
                        }}
                        disabled={nudgeBusyId === t.id}
                        title="Przestań przypominać o tym wątku"
                        className="shrink-0 self-center rounded-full border hairline px-2 py-1 text-[11px] text-muted hover:text-[var(--fg)] disabled:opacity-50"
                      >
                        Wycisz
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <>
          {threadGroups.length > 0 && (
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b hairline bg-[var(--bg-soft)] px-4 py-2 text-[11px] text-muted">
              <input
                type="checkbox"
                checked={threadGroups.every((g) => selectedIds.has(g.rep.id))}
                onChange={(e) => toggleSelectAll(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer accent-brand-purple"
                aria-label="Zaznacz wszystkie widoczne"
              />
              <span>Zaznacz wszystkie widoczne ({threadGroups.length})</span>
            </div>
          )}
          {threadGroups.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted opacity-60">
              {activeFolder !== "inbox"
                ? `Brak wiadomości w folderze „${MAIL_FOLDER_LABEL[activeFolder]}”.`
                : filter === "nowy"
                  ? "Nic — wszystko obsłużone."
                  : filter === "unassigned"
                    ? "Nic nieprzypisanego."
                    : filter === "vip"
                      ? "Brak poczty od klientów VIP."
                      : filter === "snoozed"
                        ? "Nic uśpionego."
                        : "Brak wiadomości."}
            </p>
          ) : (
            <ul ref={listRef} className="divide-y divide-[var(--hairline)]">
              {threadGroups.map((g, i) => {
                const m = g.rep;
                return (
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
                    // Lżejsze oznaczenie wybranej/fokusowanej wiadomości (04e
                    // runda 4, zgłoszone jako "toporne") — dotychczasowy
                    // gruby `ring-2` w 50% krycia był widoczny na PIERWSZYM
                    // wierszu już przy wejściu (focusedIndex zaczyna od 0),
                    // więc wyglądał ciężko nawet bez żadnej interakcji.
                    // Cieńszy ring (1px, 25%) + delikatny fioletowy odcień
                    // zamiast szarego tła dla otwartej wiadomości, płynne
                    // przejście zamiast skoku.
                    className={`flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left transition-all duration-200 ease-out hover:bg-[var(--hairline)]/40 ${
                      openId === m.id ? "bg-brand-purple/[0.07]" : ""
                    } ${focusedIndex === i ? "ring-1 ring-inset ring-brand-purple/25" : ""}`}
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
                    {/* Treść wiersza rozłożona na TRZY linie zamiast jednej
                        linii tekstu + osobnej, stałej-szerokości kolumny
                        znaczników z boku (04e runda 2) — poprzedni układ
                        rezerwował ~200px na kategorię/status/czas NIEZALEŻNIE
                        od tego, ile miejsca miał do dyspozycji nadawca/temat/
                        podgląd, więc te trzy pola obcinały się brutalnie nawet
                        na szerokiej kolumnie. Teraz każdy znacznik dzieli
                        szerokość TYLKO ze swoją linią. */}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                          {m.kierunek === "out" ? `Do: ${m.to_addr}` : m.from_name || m.from_addr}
                        </span>
                        {/* Flaga "ważne" (04e runda 2) — lokalna, klik od razu
                            przełącza bez otwierania podglądu, ten sam wzorzec
                            co status niżej. */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void toggleFlag(m.id, !m.flagged);
                          }}
                          title={m.flagged ? "Usuń flagę" : "Oflaguj jako ważne"}
                          className={`shrink-0 text-[13px] leading-none ${m.flagged ? "text-brand-gold" : "text-muted opacity-40 hover:opacity-80"}`}
                        >
                          {m.flagged ? "★" : "☆"}
                        </button>
                        {/* Snooze (Moduł 4, Etap 3) — widoczna tylko dopóki
                            termin nie minął; potem znika sama (patrz filtered). */}
                        {m.snooze_until && new Date(m.snooze_until) > new Date() && (
                          <span className="shrink-0 text-[12px]" title={`Uśpiona do ${formatPlDateTime(m.snooze_until)}`} aria-hidden>
                            ⏰
                          </span>
                        )}
                        <span className="shrink-0 text-[11px] text-muted">{formatWhen(m.received_at)}</span>
                      </span>
                      <span className="mt-1 flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-[13px]">{m.subject || "(bez tematu)"}</span>
                        {/* Licznik wątku (Moduł 4, Etap 3) — ile wiadomości TEGO
                            wątku jest w TYM folderze (grupowanie jest świadomie
                            folder-scoped, patrz threadGroups wyżej); pełny obraz
                            rozmowy rozpiętej między folderami pokazuje dopiero
                            pasek wątku w podglądzie. */}
                        {g.count > 1 && (
                          <span className="shrink-0 rounded-full bg-[var(--hairline)] px-1.5 py-0.5 text-[11px] text-muted">({g.count})</span>
                        )}
                        {/* Klikalne wprost z listy (zgłoszone przez
                            właściciela) — tak jak już działało w podglądzie
                            (MailDetailPanel.tsx). stopPropagation, żeby klik
                            nie "przeciekał" do onClick wiersza (otwarcie
                            maila). `?from=mail` + zapis stanu w localStorage
                            (MAIL_RETURN_STATE_KEY wyżej) — karta klienta/leada
                            pokaże wtedy "← Wróć do poczty" zamiast domyślnego
                            "← Wróć do tablicy", a Poczta po powrocie otworzy
                            DOKŁADNIE tę wiadomość w tym samym folderze. */}
                        {m.client_id && m.client_nazwa && (
                          <Link
                            href={`/${lang}/admin/clients/${m.client_id}?from=mail`}
                            onClick={(e) => {
                              e.stopPropagation();
                              writeMailReturnState({ folder: activeFolder, filter, catFilter, openId: m.id });
                            }}
                            className="shrink-0 rounded-full bg-brand-purple/15 px-2 py-0.5 text-[11px] text-brand-purple hover:opacity-80"
                          >
                            {m.client_nazwa}
                          </Link>
                        )}
                        {/* VIP (Moduł 4, Etap 3) — klient ze statusem "Aktywny",
                            widoczna niezależnie od aktywnej zakładki. */}
                        {m.client_status === "Aktywny" && (
                          <span
                            className="shrink-0 rounded-full bg-brand-gold/15 px-1.5 py-0.5 text-[11px] text-brand-gold"
                            title="Klient VIP (status „Aktywny”)"
                          >
                            ⭐ VIP
                          </span>
                        )}
                        {m.lead_id && m.lead_nazwa && (
                          <Link
                            href={`/${lang}/admin/leads/${m.lead_id}?from=mail`}
                            onClick={(e) => {
                              e.stopPropagation();
                              writeMailReturnState({ folder: activeFolder, filter, catFilter, openId: m.id });
                            }}
                            className="shrink-0 rounded-full bg-brand-cyan/15 px-2 py-0.5 text-[11px] text-brand-cyan hover:opacity-80"
                          >
                            {m.lead_nazwa}
                          </Link>
                        )}
                        {!m.client_nazwa && !m.lead_nazwa && m.kierunek === "in" && m.status !== "zignorowany" && (
                          <span className="shrink-0 rounded-full bg-[var(--hairline)] px-2 py-0.5 text-[11px] text-muted">
                            Nieprzypisany
                          </span>
                        )}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-[12px] text-muted opacity-70">
                          {(m.body_text || "").slice(0, 160)}
                        </span>
                        {m.kategoria && <MailCategoryTag kategoria={m.kategoria} />}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusMenuFor((cur) => (cur === m.id ? null : m.id));
                          }}
                          title="Zmień status"
                          className="shrink-0"
                        >
                          <MailStatusTag status={m.status as MailStatus} />
                        </button>
                      </span>
                    </span>
                  </div>

                  {statusMenuFor === m.id && (
                    <div
                      className="glass absolute right-4 top-11 z-20 w-40 rounded-xl p-1"
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
                );
              })}
            </ul>
          )}
            </>
          )}
          </ViewSwitch>
        </div>

        <div className="min-w-0 flex-1">
          {openId ? (
            <MailDetailPanel
              lang={lang}
              mailId={openId}
              configured={configured}
              onClose={() => setOpenId(null)}
              onChanged={load}
              replyShortcut={replyShortcutNonce}
              forwardShortcut={forwardShortcutNonce}
              replyAllShortcut={replyAllShortcutNonce}
              onNavigateToContact={() => writeMailReturnState({ folder: activeFolder, filter, catFilter, openId })}
              onOpenThreadMessage={setOpenId}
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
