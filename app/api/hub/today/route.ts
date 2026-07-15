import { NextResponse } from "next/server";
import { getSql, ensureLeadsSchema, ensureHubSchema, ensureInvoicesSchema, ensureOffersSchema, ensureClientsSchema, ensureFollowupsSchema, ensureMailSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isOverdue, type Lead } from "@/lib/leads";
import { isProjectOverdue, projectReviewAverage, type Project } from "@/lib/projects";
import { isInvoiceOverdue, taxReserveBreakdown, type Invoice, type CompanySettings } from "@/lib/invoices";
import { isOfferExpired, weightedOfferValue, CLOSED_OFFER_STATUSES, type Offer } from "@/lib/offers";
import { isClientOverdue, type Client } from "@/lib/clients";
import type { HubEvent } from "@/lib/events";
import type { Note } from "@/lib/notes";
import { todayLocalISO } from "@/lib/dates";

export const runtime = "nodejs";

type InvoiceRow = Invoice & { netto: number; vat: number; brutto: number; zaplacono: number };
type OfferRow = Offer & { kwota: number };

function addToCurrencyMap(map: Map<string, number>, currency: string, amount: number) {
  map.set(currency, (map.get(currency) ?? 0) + amount);
}

/** GET /api/hub/today — agreguje dane z leadów, projektów, faktur, ofert,
 * kalendarza i notatnika w jeden widok "co dziś" + KPI dla pulpitu. Admin-only. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureLeadsSchema();
  await ensureHubSchema();
  await ensureInvoicesSchema();
  await ensureOffersSchema();
  await ensureClientsSchema();
  await ensureFollowupsSchema();
  await ensureMailSchema();
  const sql = getSql();

  const today = todayLocalISO();
  const thisMonth = today.slice(0, 7); // "YYYY-MM"
  // Miesiąc poprzedni liczony przez arytmetykę na roku/miesiącu (nie przez
  // Date), żeby uniknąć tej samej pułapki UTC-vs-lokalny czas co przy `today`.
  const [thisYearNum, thisMonthNum] = thisMonth.split("-").map(Number);
  const lastMonth =
    thisMonthNum === 1 ? `${thisYearNum - 1}-12` : `${thisYearNum}-${String(thisMonthNum - 1).padStart(2, "0")}`;

  const [leads, clients, projects, overdueMilestones, todayEvents, recentNotes, invoices, offers, dueFollowups, companySettingsRows, pendingMails] = await Promise.all([
    sql`SELECT * FROM leads;` as unknown as Promise<Lead[]>,
    sql`SELECT * FROM clients;` as unknown as Promise<Client[]>,
    sql`SELECT * FROM projects;` as unknown as Promise<Project[]>,
    // Kamienie milowe po terminie (projekt niewdrożony, kamień nieukończony) —
    // widoczne NIEZALEŻNIE od terminu całego projektu. Bez tego spóźniony
    // kamień w trwającym projekcie był zupełnie cichy (patrz isProjectOverdue,
    // które patrzy tylko na termin projektu).
    sql`
      SELECT m.id, m.nazwa, m.termin, m.project_id, p.tytul AS projekt
      FROM project_milestones m
      JOIN projects p ON p.id = m.project_id
      WHERE p.status != 'Wdrożone' AND m.termin IS NOT NULL AND m.termin <= ${today}
        AND (
          EXISTS (SELECT 1 FROM project_tasks t WHERE t.milestone_id = m.id AND t.done = false)
          OR NOT EXISTS (SELECT 1 FROM project_tasks t WHERE t.milestone_id = m.id)
        )
      ORDER BY m.termin ASC;
    ` as unknown as Promise<{ id: string; nazwa: string; termin: string; project_id: string; projekt: string }[]>,
    sql`SELECT * FROM events WHERE data = ${today} ORDER BY godzina ASC NULLS LAST;` as unknown as Promise<HubEvent[]>,
    sql`SELECT * FROM notes ORDER BY updated_at DESC LIMIT 5;` as unknown as Promise<Note[]>,
    sql`
      SELECT i.*,
        COALESCE(t.netto, 0)::float8 AS netto,
        COALESCE(t.vat, 0)::float8 AS vat,
        COALESCE(t.brutto, 0)::float8 AS brutto,
        COALESCE(p.zaplacono, 0)::float8 AS zaplacono
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id,
          SUM(ilosc * cena_netto) AS netto,
          SUM(ilosc * cena_netto * CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END) AS vat,
          SUM(ilosc * cena_netto * (1 + CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END)) AS brutto
        FROM invoice_items GROUP BY invoice_id
      ) t ON t.invoice_id = i.id
      LEFT JOIN (
        SELECT invoice_id, SUM(kwota) AS zaplacono FROM invoice_payments GROUP BY invoice_id
      ) p ON p.invoice_id = i.id;
    ` as unknown as Promise<InvoiceRow[]>,
    sql`
      SELECT o.*, COALESCE(t.kwota, 0)::float8 AS kwota
      FROM offers o
      LEFT JOIN (
        SELECT offer_id, SUM(ilosc * cena) AS kwota FROM offer_items GROUP BY offer_id
      ) t ON t.offer_id = o.id;
    ` as unknown as Promise<OfferRow[]>,
    // Zaplanowane kontakty nurture (Moduł 2) wymagalne dziś lub wcześniej,
    // jeszcze nieobsłużone — osobno od isClientOverdue (ręczny next_followup),
    // scalane z nim dopiero w UI (DashboardHome.tsx), żeby zachować czytelny,
    // własny powód przy każdym.
    sql`
      SELECT f.id, f.client_id, f.project_id, f.due_date, f.powod, c.nazwa AS client_nazwa
      FROM client_followups f
      JOIN clients c ON c.id = f.client_id
      WHERE f.due_date <= ${today} AND f.done_at IS NULL
      ORDER BY f.due_date ASC;
    ` as unknown as Promise<
      { id: string; client_id: string; project_id: string | null; due_date: string; powod: string; client_nazwa: string }[]
    >,
    sql`SELECT * FROM company_settings WHERE id = 'default';` as unknown as Promise<CompanySettings[]>,
    // Moduł 4 — "Wiadomości do odpowiedzi": każdy przychodzący mail jest do
    // obsłużenia, dopóki nie odpiszesz albo go nie odhaczysz. Wyciszone
    // (newslettery/no-reply) mają status 'zignorowany', więc tu nie wpadną.
    // Bez body_html/body_text — Pulpit pokazuje tylko nadawcę i temat.
    sql`
      SELECT m.id, m.from_addr, m.from_name, m.subject, m.received_at,
             c.nazwa AS client_nazwa, l.firma AS lead_nazwa
      FROM mail_messages m
      LEFT JOIN clients c ON c.id = m.client_id
      LEFT JOIN leads l ON l.id = m.lead_id
      WHERE m.status = 'nowy' AND m.kierunek = 'in'
      ORDER BY m.received_at DESC;
    ` as unknown as Promise<
      { id: string; from_addr: string; from_name: string; subject: string; received_at: string; client_nazwa: string | null; lead_nazwa: string | null }[]
    >,
  ]);

  const overdueLeads = leads.filter(isOverdue);
  const overdueClients = clients.filter(isClientOverdue);
  const dueProjects = projects.filter(isProjectOverdue);
  // Proforma nie jest dokumentem fiskalnym — nie liczy się do żadnego KPI (patrz lib/invoices.ts).
  const realInvoices = invoices.filter((i) => i.typ_dokumentu !== "proforma");
  const overdueInvoices = realInvoices.filter(isInvoiceOverdue);
  const expiredOffers = offers.filter(isOfferExpired);

  // Faktury-szkice czekające na wystawienie — robota zrobiona, ale dokument
  // nigdy nie dostał numeru (a więc: nie liczy się do przychodu i nikt za
  // niego nie zapłaci). Nagabujemy tylko o szkice właściwych faktur (nie
  // proform/zaliczkowych), które mają jakąkolwiek treść i NIE powstały dziś —
  // żeby faktura, którą właśnie edytujesz, nie wyskakiwała od razu jako
  // „zaległa". Najczęstsze źródło: szkic utworzony automatycznie z
  // zaakceptowanej oferty albo z szablonu cyklicznego.
  const draftInvoices = invoices.filter(
    (i) =>
      i.status === "Szkic" &&
      i.typ_dokumentu === "faktura" &&
      i.brutto > 0 &&
      String(i.created_at ?? "").slice(0, 10) < today
  );

  // Przychód wg daty wystawienia (nie wg wpłat — wpłaty częściowe są opcjonalne
  // i nie każda opłacona faktura ma zarejestrowaną wpłatę).
  const revenueThisMonth = new Map<string, number>();
  const revenueLastMonth = new Map<string, number>();
  // Rezerwa podatkowa (Moduł 13) liczona TYLKO z faktur w PLN — stawki
  // podatkowe (VAT/PIT/ZUS) i tak rozliczane są w PLN, a przeliczanie obcych
  // walut po kursie NBP na potrzeby samego poglądowego wskaźnika byłoby
  // niepotrzebną komplikacją (dokładny kurs VAT liczy już `kurs_nbp` na
  // fakturze, ale to osobny, węższy mechanizm — patrz lib/ksef.ts).
  let nettoThisMonthPln = 0;
  for (const inv of realInvoices) {
    if (inv.status === "Anulowana" || inv.status === "Szkic") continue;
    if (!inv.data_wystawienia) continue;
    const month = String(inv.data_wystawienia).slice(0, 7);
    const currency = inv.waluta || "PLN";
    if (month === thisMonth) {
      addToCurrencyMap(revenueThisMonth, currency, inv.brutto);
      if (currency === "PLN") nettoThisMonthPln += inv.netto;
    } else if (month === lastMonth) {
      addToCurrencyMap(revenueLastMonth, currency, inv.brutto);
    }
  }
  const companySettings = companySettingsRows[0] ?? null;
  const taxReserve = companySettings ? taxReserveBreakdown(nettoThisMonthPln, companySettings) : { vat: 0, pit: 0, zus: 0 };

  const outstanding = new Map<string, number>();
  for (const inv of overdueInvoices) {
    addToCurrencyMap(outstanding, inv.waluta || "PLN", inv.brutto - inv.zaplacono);
  }

  // Wartość pipeline'u — oferty jeszcze nie zamknięte (oferty są wyłącznie w PLN, bez pola waluty),
  // ważona szacowanym prawdopodobieństwem zamknięcia wg statusu (patrz OFFER_STATUS_WEIGHT).
  const pipeline = offers.reduce((sum, o) => sum + weightedOfferValue(o.status, o.kwota), 0);
  // Surowa (nieważona) suma otwartych ofert — do podpisu KPI, dla przejrzystości.
  const pipelineRaw = offers.reduce((sum, o) => (CLOSED_OFFER_STATUSES.has(o.status) ? sum : sum + o.kwota), 0);

  // Moduł 15 (zamknięcie i opinie): średnia z ocen zebranych opinii + jaki
  // odsetek zamkniętych projektów w ogóle ma zebraną opinię (patrz "Monitorować"
  // w docs/plany-modulow/15-zamkniecie-i-opinie.md).
  const closedProjects = projects.filter((p) => p.status === "Wdrożone");
  const reviewedProjects = projects.filter((p) => p.review_submitted_at);
  const reviewAverages = reviewedProjects.map(projectReviewAverage).filter((v): v is number => v != null);
  const avgClientRating = reviewAverages.length ? reviewAverages.reduce((a, b) => a + b, 0) / reviewAverages.length : null;

  return NextResponse.json({
    overdueLeads,
    overdueClients,
    dueProjects,
    overdueInvoices,
    draftInvoices,
    overdueMilestones,
    expiredOffers,
    dueFollowups,
    pendingMails,
    todayEvents,
    recentNotes,
    kpi: {
      revenueThisMonth: Array.from(revenueThisMonth.entries()),
      revenueLastMonth: Array.from(revenueLastMonth.entries()),
      outstanding: Array.from(outstanding.entries()),
      pipeline,
      pipelineRaw,
      taxReserve,
      avgClientRating,
      reviewsCollected: reviewedProjects.length,
      closedProjectsCount: closedProjects.length,
    },
    counts: {
      leads: leads.length,
      clients: clients.length,
      projects: projects.length,
      invoices: invoices.length,
      offers: offers.length,
    },
  });
}
