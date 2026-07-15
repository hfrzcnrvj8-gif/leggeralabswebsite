"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Locale } from "@/i18n/config";
import { useUI, useRegisterActions } from "../ui";
import { MailStatusTag, MailCategoryTag, MAIL_CATEGORY_LABEL, type MailMessageWithLinks, type MailStatus } from "./shared";
import { MailDetailPanel } from "./MailDetailPanel";

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
  const [counts, setCounts] = useState<{ nowe: number; nieprzypisane: number; zapytania: number; rachunki: number }>({
    nowe: 0,
    nieprzypisane: 0,
    zapytania: 0,
    rachunki: 0,
  });
  const [configured, setConfigured] = useState(true);
  const [filter, setFilter] = useState<Filter>("nowy");
  const [catFilter, setCatFilter] = useState<CatFilter>("wszystkie");
  const [openId, setOpenId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/mail");
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
    setCounts(data.counts ?? { nowe: 0, nieprzypisane: 0, zapytania: 0, rachunki: 0 });
    setConfigured(data.configured);
  }, [toast]);

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

  useRegisterActions(
    [{ id: "sync", label: "Pobierz nowe wiadomości", run: () => void sync(false) }],
    [sync]
  );

  const filtered = useMemo(() => {
    if (!messages) return [];
    let out = messages;
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
  }, [messages, filter, catFilter]);

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
        <button
          onClick={() => void sync(false)}
          disabled={syncing}
          className="btn-primary rounded-full px-4 py-1.5 text-[13px] disabled:opacity-50"
        >
          {syncing ? "Pobieram…" : "Pobierz nowe"}
        </button>
      </div>

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
            {c.id === "oferta" && counts.zapytania > 0 ? ` (${counts.zapytania})` : ""}
            {c.id === "rachunek" && counts.rachunki > 0 ? ` (${counts.rachunki})` : ""}
          </button>
        ))}
      </div>

      <div className="card-paper rounded-xl border hairline">
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
              <li key={m.id}>
                <button
                  onClick={() => setOpenId(m.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[var(--hairline)]/40"
                >
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
                    <MailStatusTag status={m.status as MailStatus} />
                    <span className="w-14 text-right text-[11px] text-muted">{formatWhen(m.received_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AnimatePresence>
        {openMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px] sm:p-8"
            onClick={() => setOpenId(null)}
          >
            <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
              <MailDetailPanel
                lang={lang}
                mailId={openMessage.id}
                configured={configured}
                onClose={() => setOpenId(null)}
                onChanged={load}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
