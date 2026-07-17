"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconRepeat } from "@tabler/icons-react";
import type { Locale } from "@/i18n/config";
import type { Lead } from "@/lib/leads";
import { type Project, formatPlDate } from "@/lib/projects";
import type { HubEvent } from "@/lib/events";
import type { Note } from "@/lib/notes";
import { overdueReason } from "@/lib/leads";
import { type Invoice, formatMoney } from "@/lib/invoices";
import type { Offer } from "@/lib/offers";
import { type Client, clientOverdueReason } from "@/lib/clients";
import { todayLocalISO } from "@/lib/dates";
import { useUI } from "./ui";

type InvoiceRow = Invoice & { netto: number; vat: number; brutto: number; zaplacono: number };
type OfferRow = Offer & { kwota: number };
type OverdueMilestone = { id: string; nazwa: string; termin: string; project_id: string; projekt: string };
type DueFollowup = { id: string; client_id: string; project_id: string | null; due_date: string; powod: string; client_nazwa: string };
// Moduł 4 — przychodzący mail bez reakcji. Bez treści: Pulpit pokazuje kto i
// w jakiej sprawie, pełna wiadomość jest w zakładce Poczta.
type PendingMail = {
  id: string;
  from_addr: string;
  from_name: string;
  subject: string;
  received_at: string;
  client_nazwa: string | null;
  lead_nazwa: string | null;
};

/** Moduł 31 — umowa/NDA wysłana i niepodpisana od CONTRACT_STALE_DAYS dni.
 * `silenceDays` liczy serwer (api/hub/today), żeby Pulpit i dzienny mail
 * mówiły tę samą liczbę. */
type StaleContract = {
  id: string;
  typ: "umowa" | "nda";
  status: string;
  project_id: string | null;
  client_id: string | null;
  klient_nazwa: string;
  client_nazwa: string | null;
  silenceDays: number;
};

type TaxReserve = { vat: number; pit: number; zus: number };

type Kpi = {
  revenueThisMonth: [string, number][];
  revenueLastMonth: [string, number][];
  outstanding: [string, number][];
  pipeline: number;
  pipelineRaw: number;
  taxReserve: TaxReserve;
  avgClientRating: number | null;
  /** Moduł 31 — miara Etapu 3 mapy drogi klienta (cel 100%), liczona tylko po
   * projektach z klientem. `null` = nie ma czego mierzyć (patrz
   * signedContractRate w lib/contracts.ts). */
  signedContracts: { rate: number; withContract: number; total: number } | null;
  reviewsCollected: number;
  closedProjectsCount: number;
};

type TodayData = {
  overdueLeads: Lead[];
  overdueClients: Client[];
  dueProjects: Project[];
  overdueMilestones: OverdueMilestone[];
  overdueInvoices: InvoiceRow[];
  draftInvoices: InvoiceRow[];
  expiredOffers: OfferRow[];
  staleContracts: StaleContract[];
  dueFollowups: DueFollowup[];
  pendingMails: PendingMail[];
  todayEvents: HubEvent[];
  recentNotes: Note[];
  kpi: Kpi;
  counts: { leads: number; clients: number; projects: number; invoices: number; offers: number };
};

/** Sumy w różnych walutach nie da się zmergować w jedną liczbę — każda
 * waluta dostaje osobną kwotę, sklejone znakiem "+" (jak w InvoicesDashboard). */
function formatByCurrency(entries: [string, number][]): string {
  if (entries.length === 0) return formatMoney(0);
  return entries.map(([currency, sum]) => formatMoney(sum, currency)).join(" + ");
}

function sumPln(entries: [string, number][]): number {
  return entries.find(([c]) => c === "PLN")?.[1] ?? 0;
}

/** Pulpit dnia — jedno miejsce spinające wszystkie moduły: co dziś wymaga
 * działania (leady, projekty), co jest w kalendarzu, i ostatnie notatki.
 * To jest strona, od której zaczynasz każdy dzień pracy. */
export function DashboardHome({ lang }: { lang: Locale }) {
  const { toast, confirm } = useUI();
  const [data, setData] = useState<TodayData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Szkic kontaktu retencyjnego (Moduł 17) — na raz otwarty jest tylko jeden,
  // stan trzymany tu, nie per-item, bo panel niczego nie wysyła bez tego
  // jawnego rozwinięcia i edycji.
  const [openDraftId, setOpenDraftId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftEmail, setDraftEmail] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftSending, setDraftSending] = useState(false);

  const loadToday = () => {
    setLoadError(null);
    fetch("/api/hub/today")
      .then((res) => {
        if (res.status === 401) {
          window.location.reload();
          return null;
        }
        if (!res.ok) throw new Error(`Serwer zwrócił błąd ${res.status}.`);
        return res.json();
      })
      .then((d) => d && setData(d))
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Nie udało się wczytać pulpitu."));
  };

  useEffect(() => {
    loadToday();
  }, []);

  const markLeadHandled = async (id: string) => {
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Przypomnienie wysłane", ostatni_kontakt: todayLocalISO() }),
    });
    if (!res.ok) {
      toast("Nie udało się zapisać zmiany.", "error");
      return;
    }
    setData((prev) => (prev ? { ...prev, overdueLeads: prev.overdueLeads.filter((l) => l.id !== id) } : prev));
    toast("Lead oznaczony jako obsłużony.");
  };

  const markClientHandled = async (id: string) => {
    const res = await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next_followup: "", ostatni_kontakt: todayLocalISO() }),
    });
    if (!res.ok) {
      toast("Nie udało się zapisać zmiany.", "error");
      return;
    }
    setData((prev) => (prev ? { ...prev, overdueClients: prev.overdueClients.filter((c) => c.id !== id) } : prev));
    toast("Klient oznaczony jako obsłużony.");
  };

  /** Obsługuje jeden zaplanowany kontakt nurture (Moduł 2) — osobno od
   * markClientHandled, bo to inne źródło "wymaga kontaktu" (harmonogram
   * client_followups, nie ręczny next_followup). */
  const markFollowupHandled = async (followupId: string) => {
    const res = await fetch(`/api/client-followups/${followupId}`, { method: "PATCH" });
    if (!res.ok) {
      toast("Nie udało się zapisać zmiany.", "error");
      return;
    }
    setData((prev) => (prev ? { ...prev, dueFollowups: prev.dueFollowups.filter((f) => f.id !== followupId) } : prev));
    toast("Kontakt oznaczony jako obsłużony.");
  };

  /** Odhacza wiadomość bez odpisywania (Moduł 4) — np. "przeczytałem, nic nie
   * wymaga odpowiedzi". Odpisanie z zakładki Poczta zdejmuje ją z tej listy
   * automatycznie, więc ten przycisk jest dla pozostałych przypadków. */
  const markMailHandled = async (mailId: string) => {
    const res = await fetch(`/api/mail/${mailId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "obsłużony" }),
    });
    if (!res.ok) {
      toast("Nie udało się zapisać zmiany.", "error");
      return;
    }
    setData((prev) => (prev ? { ...prev, pendingMails: prev.pendingMails.filter((m) => m.id !== mailId) } : prev));
    toast("Wiadomość oznaczona jako obsłużona.");
  };

  /** Rozwija/zwija szkic wiadomości retencyjnej pod danym kontaktem —
   * dociąga treść dopiero na żądanie (Moduł 17), żeby nie generować linków
   * do opinii dla wszystkich zaplanowanych kontaktów naraz. */
  const toggleFollowupDraft = async (followupId: string) => {
    if (openDraftId === followupId) {
      setOpenDraftId(null);
      return;
    }
    setOpenDraftId(followupId);
    setDraftText("");
    setDraftEmail(null);
    setDraftLoading(true);
    const res = await fetch(`/api/client-followups/${followupId}/draft`);
    setDraftLoading(false);
    if (!res.ok) {
      toast("Nie udało się wczytać szkicu.", "error");
      setOpenDraftId(null);
      return;
    }
    const body = (await res.json()) as { text: string; clientEmail: string | null };
    setDraftText(body.text);
    setDraftEmail(body.clientEmail);
  };

  const copyFollowupDraft = async () => {
    try {
      await navigator.clipboard.writeText(draftText);
      toast("Skopiowano do schowka.");
    } catch {
      toast("Nie udało się skopiować — zaznacz i skopiuj ręcznie.", "error");
    }
  };

  const sendFollowupDraft = async (followupId: string) => {
    if (!draftText.trim() || draftSending) return;
    setDraftSending(true);
    const res = await fetch(`/api/client-followups/${followupId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draftText }),
    });
    setDraftSending(false);
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast(body.error ?? "Nie udało się wysłać wiadomości.", "error");
      return;
    }
    setData((prev) => (prev ? { ...prev, dueFollowups: prev.dueFollowups.filter((f) => f.id !== followupId) } : prev));
    setOpenDraftId(null);
    toast("Wiadomość wysłana, kontakt oznaczony jako obsłużony.");
  };

  const markProjectDone = async (id: string, tytul: string) => {
    const ok = await confirm(`Oznaczyć "${tytul}" jako wdrożone?`);
    if (!ok) return;
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Wdrożone" }),
    });
    if (!res.ok) {
      toast("Nie udało się zapisać zmiany.", "error");
      return;
    }
    setData((prev) => (prev ? { ...prev, dueProjects: prev.dueProjects.filter((p) => p.id !== id) } : prev));
    toast("Projekt oznaczony jako wdrożony.");
  };

  const removeEvent = async (id: string) => {
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Nie udało się usunąć wydarzenia.", "error");
      return;
    }
    setData((prev) => (prev ? { ...prev, todayEvents: prev.todayEvents.filter((e) => e.id !== id) } : prev));
  };

  const remindInvoice = async (id: string, numer: string | null) => {
    const res = await fetch(`/api/invoices/${id}/remind`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(body?.error ?? "Nie udało się wysłać przypomnienia.", "error");
      return;
    }
    toast(`Przypomnienie wysłane${numer ? ` (${numer})` : ""}.`);
  };

  if (loadError) {
    return (
      <div className="card-paper rounded-2xl p-6">
        <p className="font-medium">Nie udało się wczytać pulpitu.</p>
        <p className="mt-1 text-sm opacity-70">{loadError}</p>
        <button className="btn-primary mt-4" onClick={loadToday}>
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--hairline)]" />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-[var(--hairline)]" />
          ))}
        </div>
      </div>
    );
  }

  const totalActionable =
    data.overdueLeads.length +
    data.overdueClients.length +
    data.dueFollowups.length +
    data.pendingMails.length +
    data.dueProjects.length +
    data.overdueMilestones.length +
    data.overdueInvoices.length +
    data.draftInvoices.length +
    data.expiredOffers.length +
    data.staleContracts.length;

  const revenueThisMonthPln = sumPln(data.kpi.revenueThisMonth);
  const revenueLastMonthPln = sumPln(data.kpi.revenueLastMonth);
  const revenueDelta =
    revenueLastMonthPln > 0 ? Math.round(((revenueThisMonthPln - revenueLastMonthPln) / revenueLastMonthPln) * 100) : null;

  return (
    <div className="-mx-4 sm:-mx-6">
      <div className="flex items-center border-b hairline px-4 sm:px-6" style={{ height: "44px" }}>
        <span className="text-[13px] text-muted">
          {totalActionable === 0
            ? "Pulpit — nic pilnego dziś nie czeka."
            : `Pulpit — ${totalActionable} ${totalActionable === 1 ? "sprawa wymaga" : "spraw wymaga"} dziś działania.`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pt-4 sm:px-6 lg:grid-cols-6">
        <div className="card-paper rounded-xl border hairline p-4">
          <div className="text-[11px] text-muted">Przychód (ten miesiąc)</div>
          <div className="mt-1 text-liquid text-lg font-semibold">{formatByCurrency(data.kpi.revenueThisMonth)}</div>
          {revenueDelta !== null && (
            <div className={`mt-0.5 text-[11px] ${revenueDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {revenueDelta >= 0 ? "▲" : "▼"} {Math.abs(revenueDelta)}% vs poprzedni miesiąc
            </div>
          )}
        </div>
        <div className="card-paper rounded-xl border hairline p-4">
          <div className="text-[11px] text-muted">Należności (zaległe)</div>
          <div className="mt-1 text-lg font-semibold">{formatByCurrency(data.kpi.outstanding)}</div>
          <div className="mt-0.5 text-[11px] text-muted">
            {data.overdueInvoices.length} {data.overdueInvoices.length === 1 ? "faktura" : "faktur"} po terminie
          </div>
        </div>
        <div className="card-paper rounded-xl border hairline p-4">
          <div className="text-[11px] text-muted">Pipeline ofert (ważony)</div>
          <div className="mt-1 text-lg font-semibold">{formatMoney(data.kpi.pipeline)}</div>
          <div className="mt-0.5 text-[11px] text-muted">{formatMoney(data.kpi.pipelineRaw)} otwartych ofert (nieważone)</div>
        </div>
        <div className="card-paper rounded-xl border hairline p-4">
          <div className="text-[11px] text-muted">Wymaga działania dziś</div>
          <div className="mt-1 text-lg font-semibold">{totalActionable}</div>
          <div className="mt-0.5 text-[11px] text-muted">leady, projekty, faktury, oferty</div>
        </div>
        <div className="card-paper rounded-xl border hairline p-4">
          <div className="text-[11px] text-muted">Rezerwa podatkowa (ten miesiąc)</div>
          <div className="mt-1.5 space-y-0.5 text-[12px]">
            <div className="flex justify-between">
              <span className="text-muted">VAT</span>
              <span className="tabular-nums">{formatMoney(data.kpi.taxReserve.vat)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">PIT</span>
              <span className="tabular-nums">{formatMoney(data.kpi.taxReserve.pit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">ZUS</span>
              <span className="tabular-nums">{formatMoney(data.kpi.taxReserve.zus)}</span>
            </div>
          </div>
        </div>
        {/* Moduł 31 — miara Etapu 3 mapy drogi klienta (cel: 100%). Liczona
            tylko po projektach z klientem: projekt wewnętrzny nie ma z kim
            podpisać umowy, więc wliczanie go zaniżałoby wskaźnik na stałe. */}
        <div className="card-paper rounded-xl border hairline p-4">
          <div className="text-[11px] text-muted">Papier przed pracą</div>
          <div
            className={`mt-1 text-lg font-semibold ${
              data.kpi.signedContracts && data.kpi.signedContracts.rate < 1 ? "text-amber-500" : ""
            }`}
          >
            {data.kpi.signedContracts ? `${Math.round(data.kpi.signedContracts.rate * 100)}%` : "—"}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {data.kpi.signedContracts
              ? `${data.kpi.signedContracts.withContract}/${data.kpi.signedContracts.total} projektów klienckich z podpisaną umową`
              : "Brak projektów z klientem — nie ma czego mierzyć."}
          </div>
        </div>
        <div className="card-paper rounded-xl border hairline p-4">
          <div className="text-[11px] text-muted">Opinie klientów</div>
          <div className="mt-1 text-lg font-semibold">
            {data.kpi.avgClientRating != null ? `★ ${data.kpi.avgClientRating.toFixed(1)}/5` : "—"}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {data.kpi.reviewsCollected}/{data.kpi.closedProjectsCount} zamkniętych projektów z opinią
          </div>
        </div>
        <Link
          href={`/${lang}/admin/stats`}
          className="card-paper col-span-2 flex items-center justify-between rounded-xl border hairline p-4 hover:border-brand-purple/40 lg:col-span-6"
        >
          <span className="text-[11px] text-muted">Czy trzymam wzorzec pracy? Zobacz wskaźniki zdrowia biznesu.</span>
          <span className="text-[13px] font-semibold text-brand-purple">Statystyki →</span>
        </Link>
      </div>

      <div className="grid gap-4 px-4 py-4 sm:px-6 lg:grid-cols-2">
        <section className="card-paper rounded-xl border hairline p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Leady wymagające działania</h2>
            <Link href={`/${lang}/admin/leads`} className="text-xs text-muted hover:text-[var(--fg)]">
              Zobacz wszystkie →
            </Link>
          </div>
          {data.overdueLeads.length === 0 ? (
            <p className="text-sm text-muted opacity-60">Nic — wszystko obsłużone.</p>
          ) : (
            <ul className="space-y-2">
              {data.overdueLeads.slice(0, 6).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <Link href={`/${lang}/admin/leads/${l.id}`} className="font-medium hover:underline">
                      {l.firma}
                    </Link>
                    <span className="text-muted"> — {overdueReason(l)}</span>
                  </span>
                  <button
                    onClick={() => markLeadHandled(l.id)}
                    className="shrink-0 rounded-full border border-orange-500/40 px-2 py-0.5 text-[11px] text-orange-400"
                  >
                    Obsłużone
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Moduł 4 — "Wiadomości do odpowiedzi". Wysoko na Pulpicie, zaraz po
            leadach: nieodpisany mail starzeje się szybciej niż większość
            pozostałych spraw. */}
        <section className="card-paper rounded-xl border hairline p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Wiadomości do odpowiedzi</h2>
            <Link href={`/${lang}/admin/mail`} className="text-xs text-muted hover:text-[var(--fg)]">
              Zobacz wszystkie →
            </Link>
          </div>
          {data.pendingMails.length === 0 ? (
            <p className="text-sm text-muted opacity-60">Nic — wszystko obsłużone.</p>
          ) : (
            <ul className="space-y-2">
              {data.pendingMails.slice(0, 6).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <Link href={`/${lang}/admin/mail/${m.id}`} className="font-medium hover:underline">
                      {m.client_nazwa || m.lead_nazwa || m.from_name || m.from_addr}
                    </Link>
                    <span className="text-muted"> — {m.subject || "(bez tematu)"}</span>
                  </span>
                  <button
                    onClick={() => markMailHandled(m.id)}
                    className="shrink-0 rounded-full border border-orange-500/40 px-2 py-0.5 text-[11px] text-orange-400"
                  >
                    Obsłużone
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-paper rounded-xl border hairline p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Klienci wymagający kontaktu</h2>
            <Link href={`/${lang}/admin/clients`} className="text-xs text-muted hover:text-[var(--fg)]">
              Zobacz wszystkie →
            </Link>
          </div>
          {data.overdueClients.length === 0 && data.dueFollowups.length === 0 ? (
            <p className="text-sm text-muted opacity-60">Nic — wszystko obsłużone.</p>
          ) : (
            <div className="space-y-3">
              {data.overdueClients.length > 0 && (
                <ul className="space-y-2">
                  {data.overdueClients.slice(0, 6).map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>
                        <Link href={`/${lang}/admin/clients/${c.id}`} className="font-medium hover:underline">
                          {c.nazwa}
                        </Link>
                        <span className="text-muted"> — {clientOverdueReason(c)}</span>
                      </span>
                      <button
                        onClick={() => markClientHandled(c.id)}
                        className="shrink-0 rounded-full border border-orange-500/40 px-2 py-0.5 text-[11px] text-orange-400"
                      >
                        Obsłużone
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {data.dueFollowups.length > 0 && (
                <div>
                  {data.overdueClients.length > 0 && (
                    <div className="mb-1.5 mt-1 flex items-center gap-1 text-[10.5px] uppercase tracking-wide text-muted opacity-70">
                      <IconRepeat size={12} />
                      <span>Zaplanowany kontakt retencyjny</span>
                    </div>
                  )}
                  <ul className="space-y-2">
                    {data.dueFollowups.slice(0, 6).map((f) => (
                      <li key={f.id} className="text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span>
                            <IconRepeat size={12} className="mr-1 inline align-[-2px]" aria-label="Zaplanowany kontakt retencyjny (Moduł 17)" />
                            <Link href={`/${lang}/admin/clients/${f.client_id}`} className="font-medium hover:underline">
                              {f.client_nazwa}
                            </Link>
                            <span className="text-muted"> — {f.powod}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <button
                              onClick={() => toggleFollowupDraft(f.id)}
                              className="rounded-full border hairline px-2 py-0.5 text-[11px] text-muted hover:text-[var(--fg)]"
                            >
                              {openDraftId === f.id ? "Ukryj szkic" : "Szkic"}
                            </button>
                            <button
                              onClick={() => markFollowupHandled(f.id)}
                              className="rounded-full border border-orange-500/40 px-2 py-0.5 text-[11px] text-orange-400"
                            >
                              Obsłużone
                            </button>
                          </span>
                        </div>
                        {openDraftId === f.id && (
                          <div className="mt-2 rounded-xl border hairline p-2.5">
                            {draftLoading ? (
                              <p className="text-[12px] text-muted">Wczytywanie szkicu…</p>
                            ) : (
                              <>
                                <div className="mb-1.5 flex items-center justify-between">
                                  <span className="text-[11px] text-muted opacity-70">Szkic do edycji — zawiera pytanie o polecenie</span>
                                  <button
                                    onClick={copyFollowupDraft}
                                    className="shrink-0 rounded-full border hairline px-2 py-0.5 text-[11px] text-muted hover:text-[var(--fg)]"
                                  >
                                    Kopiuj do schowka
                                  </button>
                                </div>
                                <textarea
                                  value={draftText}
                                  onChange={(e) => setDraftText(e.target.value)}
                                  rows={7}
                                  className="w-full rounded-xl border hairline bg-transparent px-3 py-2 text-[12.5px] text-[var(--fg)] placeholder:text-muted"
                                />
                                <button
                                  onClick={() => sendFollowupDraft(f.id)}
                                  disabled={!draftText.trim() || draftSending || !draftEmail}
                                  className="btn-primary mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {draftSending ? "Wysyłanie…" : "Wyślij mailem"}
                                </button>
                                {!draftEmail && (
                                  <p className="mt-1 text-[11px] text-orange-400">Brak adresu e-mail klienta — uzupełnij go w karcie klienta.</p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="card-paper rounded-xl border hairline p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Projekty z minionym terminem</h2>
            <Link href={`/${lang}/admin/projects`} className="text-xs text-muted hover:text-[var(--fg)]">
              Zobacz wszystkie →
            </Link>
          </div>
          {data.dueProjects.length === 0 ? (
            <p className="text-sm text-muted opacity-60">Nic — wszystko na czas.</p>
          ) : (
            <ul className="space-y-2">
              {data.dueProjects.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <Link href={`/${lang}/admin/projects/${p.id}`} className="font-medium hover:underline">
                      {p.tytul}
                    </Link>
                    <span className="text-muted"> — termin {formatPlDate(p.termin)}</span>
                  </span>
                  <button
                    onClick={() => markProjectDone(p.id, p.tytul)}
                    className="shrink-0 rounded-full border border-orange-500/40 px-2 py-0.5 text-[11px] text-orange-400"
                  >
                    Wdrożone
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-paper rounded-xl border hairline p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Kamienie po terminie</h2>
          </div>
          {data.overdueMilestones.length === 0 ? (
            <p className="text-sm text-muted opacity-60">Nic — kamienie na czas.</p>
          ) : (
            <ul className="space-y-2">
              {data.overdueMilestones.slice(0, 6).map((m) => (
                <li key={m.id} className="text-sm">
                  <Link href={`/${lang}/admin/projects/${m.project_id}`} className="font-medium hover:underline">
                    {m.nazwa}
                  </Link>
                  <span className="text-muted"> — {m.projekt} — termin {formatPlDate(m.termin)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-paper rounded-xl border hairline p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Zaległe faktury</h2>
            <Link href={`/${lang}/admin/invoices`} className="text-xs text-muted hover:text-[var(--fg)]">
              Zobacz wszystkie →
            </Link>
          </div>
          {data.overdueInvoices.length === 0 ? (
            <p className="text-sm text-muted opacity-60">Nic — wszystko opłacone na czas.</p>
          ) : (
            <ul className="space-y-2">
              {data.overdueInvoices.slice(0, 6).map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <Link href={`/${lang}/admin/invoices/${inv.id}`} className="font-medium hover:underline">
                      {inv.numer ?? "(szkic)"}
                    </Link>
                    <span className="text-muted">
                      {" "}
                      — {inv.klient_nazwa || "bez klienta"} — {formatMoney(inv.brutto - inv.zaplacono, inv.waluta || "PLN")}
                    </span>
                  </span>
                  <button
                    onClick={() => remindInvoice(inv.id, inv.numer)}
                    className="shrink-0 rounded-full border border-orange-500/40 px-2 py-0.5 text-[11px] text-orange-400"
                  >
                    Przypomnij
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-paper rounded-xl border hairline p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Faktury do wystawienia</h2>
            <Link href={`/${lang}/admin/invoices`} className="text-xs text-muted hover:text-[var(--fg)]">
              Zobacz wszystkie →
            </Link>
          </div>
          {data.draftInvoices.length === 0 ? (
            <p className="text-sm text-muted opacity-60">Nic — żaden szkic nie czeka.</p>
          ) : (
            <ul className="space-y-2">
              {data.draftInvoices.slice(0, 6).map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <Link href={`/${lang}/admin/invoices/${inv.id}`} className="font-medium hover:underline">
                      {inv.klient_nazwa || "(szkic bez klienta)"}
                    </Link>
                    <span className="text-muted"> — {formatMoney(inv.brutto, inv.waluta || "PLN")}</span>
                  </span>
                  <Link
                    href={`/${lang}/admin/invoices/${inv.id}`}
                    className="shrink-0 rounded-full border border-amber-500/40 px-2 py-0.5 text-[11px] text-amber-500"
                  >
                    Wystaw
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Moduł 31 — do tej pory Umowy były jedynym modułem, o którym Pulpit
            nigdy sam z siebie nie wspomniał: umowa wisząca tydzień
            niepodpisana nie przypominała się nigdy, mimo że blokuje formalny
            start projektu. */}
        <section className="card-paper rounded-xl border hairline p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Umowy czekające na podpis</h2>
            <Link href={`/${lang}/admin/contracts`} className="text-xs text-muted hover:text-[var(--fg)]">
              Zobacz wszystkie →
            </Link>
          </div>
          {data.staleContracts.length === 0 ? (
            <p className="text-sm text-muted opacity-60">Nic — nic nie wisi bez podpisu.</p>
          ) : (
            <ul className="space-y-2">
              {data.staleContracts.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <Link href={`/${lang}/admin/contracts/${c.id}`} className="font-medium hover:underline">
                      {c.client_nazwa || c.klient_nazwa || "(bez nazwy)"}
                    </Link>
                    <span className="text-muted">
                      {" "}
                      — {c.typ === "nda" ? "NDA" : "Umowa"}, cisza od {c.silenceDays}{" "}
                      {c.silenceDays === 1 ? "dnia" : "dni"}
                    </span>
                  </span>
                  <Link
                    href={`/${lang}/admin/contracts/${c.id}`}
                    className="shrink-0 rounded-full border border-brand-cyan/40 px-2 py-0.5 text-[11px] text-brand-cyan"
                  >
                    Przypomnij
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-paper rounded-xl border hairline p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Dziś w kalendarzu</h2>
            <Link href={`/${lang}/admin/calendar`} className="text-xs text-muted hover:text-[var(--fg)]">
              Otwórz kalendarz →
            </Link>
          </div>
          {data.todayEvents.length === 0 ? (
            <p className="text-sm text-muted opacity-60">Brak wydarzeń na dziś.</p>
          ) : (
            <ul className="space-y-2">
              {data.todayEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {e.godzina && <span className="mr-1.5 text-muted">{e.godzina}</span>}
                    {e.tytul}
                  </span>
                  <button
                    onClick={() => removeEvent(e.id)}
                    className="shrink-0 text-muted hover:text-red-400"
                    aria-label={`Usuń ${e.tytul}`}
                    title="Usuń"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-paper rounded-xl border hairline p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Ostatnie notatki</h2>
            <Link href={`/${lang}/admin/notes`} className="text-xs text-muted hover:text-[var(--fg)]">
              Otwórz notatnik →
            </Link>
          </div>
          {data.recentNotes.length === 0 ? (
            <p className="text-sm text-muted opacity-60">Brak notatek.</p>
          ) : (
            <ul className="space-y-2">
              {data.recentNotes.map((n) => (
                <li key={n.id} className="text-sm">
                  <span className="font-medium">{n.tytul || "Bez tytułu"}</span>
                  {n.tresc && <span className="text-muted"> — {n.tresc.slice(0, 80)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-2 px-4 pb-4 text-xs text-muted sm:px-6">
        <span>
          W rejestrze: {data.counts.leads} leadów, {data.counts.clients} klientów, {data.counts.projects} projektów,{" "}
          {data.counts.invoices} faktur, {data.counts.offers} ofert.
        </span>
      </div>
    </div>
  );
}
