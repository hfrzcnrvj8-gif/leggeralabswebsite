import { NextResponse } from "next/server";
import { getSql, ensureLeadsSchema, ensureHubSchema, ensureInvoicesSchema, ensureOffersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isOverdue, type Lead } from "@/lib/leads";
import { isProjectOverdue, type Project } from "@/lib/projects";
import { isInvoiceOverdue, type Invoice } from "@/lib/invoices";
import { isOfferExpired, type Offer } from "@/lib/offers";
import type { HubEvent } from "@/lib/events";
import type { Note } from "@/lib/notes";

export const runtime = "nodejs";

type InvoiceRow = Invoice & { netto: number; vat: number; brutto: number; zaplacono: number };
type OfferRow = Offer & { kwota: number };

const CLOSED_OFFER_STATUSES = new Set<string>(["Zaakceptowana", "Odrzucona", "Wygasła"]);

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
  const sql = getSql();

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7); // "YYYY-MM"
  const lastMonthDate = new Date();
  lastMonthDate.setUTCMonth(lastMonthDate.getUTCMonth() - 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);

  const [leads, projects, todayEvents, recentNotes, invoices, offers] = await Promise.all([
    sql`SELECT * FROM leads;` as unknown as Promise<Lead[]>,
    sql`SELECT * FROM projects;` as unknown as Promise<Project[]>,
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
  ]);

  const overdueLeads = leads.filter(isOverdue);
  const dueProjects = projects.filter(isProjectOverdue);
  // Proforma nie jest dokumentem fiskalnym — nie liczy się do żadnego KPI (patrz lib/invoices.ts).
  const realInvoices = invoices.filter((i) => i.typ_dokumentu !== "proforma");
  const overdueInvoices = realInvoices.filter(isInvoiceOverdue);
  const expiredOffers = offers.filter(isOfferExpired);

  // Przychód wg daty wystawienia (nie wg wpłat — wpłaty częściowe są opcjonalne
  // i nie każda opłacona faktura ma zarejestrowaną wpłatę).
  const revenueThisMonth = new Map<string, number>();
  const revenueLastMonth = new Map<string, number>();
  for (const inv of realInvoices) {
    if (inv.status === "Anulowana" || inv.status === "Szkic") continue;
    if (!inv.data_wystawienia) continue;
    const month = inv.data_wystawienia.slice(0, 7);
    const currency = inv.waluta || "PLN";
    if (month === thisMonth) addToCurrencyMap(revenueThisMonth, currency, inv.brutto);
    else if (month === lastMonth) addToCurrencyMap(revenueLastMonth, currency, inv.brutto);
  }

  const outstanding = new Map<string, number>();
  for (const inv of overdueInvoices) {
    addToCurrencyMap(outstanding, inv.waluta || "PLN", inv.brutto - inv.zaplacono);
  }

  // Wartość pipeline'u — oferty jeszcze nie zamknięte (oferty są wyłącznie w PLN, bez pola waluty).
  const pipeline = offers.reduce((sum, o) => (CLOSED_OFFER_STATUSES.has(o.status) ? sum : sum + o.kwota), 0);

  return NextResponse.json({
    overdueLeads,
    dueProjects,
    overdueInvoices,
    expiredOffers,
    todayEvents,
    recentNotes,
    kpi: {
      revenueThisMonth: Array.from(revenueThisMonth.entries()),
      revenueLastMonth: Array.from(revenueLastMonth.entries()),
      outstanding: Array.from(outstanding.entries()),
      pipeline,
    },
    counts: {
      leads: leads.length,
      projects: projects.length,
      invoices: invoices.length,
      offers: offers.length,
    },
  });
}
