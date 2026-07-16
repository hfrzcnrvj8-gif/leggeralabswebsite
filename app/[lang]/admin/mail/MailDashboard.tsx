"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { useUI, useRegisterActions } from "../ui";
import { MailStatusTag, MailCategoryTag, MAIL_CATEGORY_LABEL, type MailMessageWithLinks, type MailStatus } from "./shared";
import { MailDetailPanel } from "./MailDetailPanel";
import { MailComposeForm } from "./MailComposeForm";

// Filtry to dwie NIEZALEŻNE osie, jak status vs zdrowie projektu: co wymaga
// mojej reakcji (góra) i czego dotyczy (dół, kategorie). Mieszanie ich w jedną
// listę zmuszałoby do wyboru "albo do odpowiedzi, albo rachunki".
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
  const { toast } = useUI();
  const [messages, setMessages] = useState<MailMessageWithLinks[] | null>(null);
  const [counts, setCounts] = useState<Counts>({ nowe: 0, nieprzypisane: 0 });
  const [configured, setConfigured] = useState(true);
  const [filter, setFilter] = useState<Filter>("nowy");
  const [catFilter, setCatFilter] = useState<CatFilter>("wszystkie");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [statusMenuFor, setStatusMenuFor] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const load = useCallback(async () => {
    // Szukanie idzie do serwera, a nie filtruje wczytanej listy — lista ma
    // limit 200, więc filtrowanie po stronie przeglądarki gubiłoby starsze
    // trafienia i "nie znajdowałoby" maili, które są w skrzynce.
    const res = await fetch(`/api/mail${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    if (!res.ok) {
      toast("Nie udało się wczytać poczty.", "error");
      return;
    }
    const data = await res.json();
    setMessages(data.messages);
    setCounts(data.counts ?? { nowe: 0, nieprzypisane: 0 });
    setConfigured(data.configured);
  }, [query, toast]);

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

  // Szukanie z opóźnieniem — bez tego każda litera to osobne zapytanie.
  // Pomijamy pierwsze uruchomienie (pustą frazę), bo listę wczytał już
  // efekt wejścia w widok.
  const firstQueryRun = useRef(true);
  useEffect(() => {
    if (firstQueryRun.current) {
      firstQueryRun.current = false;
      return;
    }
    const t = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(t);
  }, [query, load]);

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
    if (filter === "nowy") out = out.filter((m) => m.status === "nowy" && m.kierunek === "in");
    else if (filter === "unassigned") {
      out = out.filter((m) => !m.client_id && !m.lead_id && m.kierunek === "in" && m.status !== "zignorowany");
    }
    if (catFilter !== "wszystkie") {
      // Wiersze sprzed wprowadzenia kategorii mają null — traktujemy je jak
      // "inne", żeby nie znikały z widoku, zanim backfill je przeliczy.
      out = out.filter((m) => (m.kategoria ?? "inne") === catFilter);
    }
    return out;
  }, [messages, filter, catFilter, query]);

  const openMessage = messages?.find((m) => m.id === openId) ?? null;

  if (!messages) {
    return (
      <div className="space-y-3 p-4 sm:p-6">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--hairline)]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--hairline)]" />
      </div>
    );
  }

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

      {/* Dwie kolumny — lista + podgląd obok siebie (wzorem Outlooka), żeby
          wykorzystać całą szerokość ekranu i żeby zmiana wiadomości nie
          wymagała otwierania osobnego modala (04d pkt 3 i 4). Poniżej `lg`
          kolumny się składają — lista nad podglądem. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="card-paper min-w-0 rounded-xl border hairline lg:max-h-[calc(100vh-260px)] lg:w-[420px] lg:shrink-0 lg:overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted opacity-60">
              {filter === "nowy"
                ? "Nic — wszystko obsłużone."
                : filter === "unassigned"
                  ? "Nic nieprzypisanego."
                  : "Brak wiadomości."}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--hairline)]">
              {filtered.map((m) => (
                <li key={m.id} className="relative">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenId(m.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setOpenId(m.id);
                    }}
                    className={`flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition hover:bg-[var(--hairline)]/40 ${
                      openId === m.id ? "bg-[var(--hairline)]/50" : ""
                    }`}
                  >
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
