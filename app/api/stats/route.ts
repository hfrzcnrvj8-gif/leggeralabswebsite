import { NextResponse } from "next/server";
import {
  getSql,
  ensureLeadsSchema,
  ensureHubSchema,
  ensureInvoicesSchema,
  ensureClientsSchema,
} from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { todayLocalISO, daysBetweenISO } from "@/lib/dates";
import { isInvoiceOverdue, type Invoice } from "@/lib/invoices";
import { PROJECT_HEALTHS, type Project } from "@/lib/projects";
import { statsMonthKeys, statsAvg, statsRound1, type StatsTrendPoint } from "@/lib/stats";

export const runtime = "nodejs";

const TREND_MONTHS = 12;

/** GET /api/stats — wskaźniki zdrowia biznesu (Moduł 18): agregacje SQL nad
 * danymi, które już istnieją (leady, projekty, faktury, klienci) — zero AI,
 * zero nowych tabel. Admin-only. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureLeadsSchema();
  await ensureHubSchema();
  await ensureInvoicesSchema();
  await ensureClientsSchema();
  const sql = getSql();

  const today = todayLocalISO();
  const months = statsMonthKeys(today, TREND_MONTHS);

  const [
    firstResponseRows,
    leadRows,
    projectRows,
    invoiceRows,
    nurtureAskRows,
  ] = await Promise.all([
    // Czas do pierwszej odpowiedzi: pierwszy wpis na osi leada zainicjowany
    // PRZEZ NAS ("wychodzacy") po utworzeniu leada — nie ma dedykowanej
    // kolumny, to jedyny sposób odczytać to z lead_activity (patrz
    // docs/plany-modulow/18-pulpit-wskazniki.md).
    // Bez filtra po dacie — nagłówkowa średnia liczona OD POCZĄTKU
    // działalności (decyzja właściciela), okno `months` filtruje dopiero
    // przy budowaniu trendu niżej.
    sql`
      SELECT l.id, l.created_at AS lead_created, MIN(a.created_at) AS first_response
      FROM leads l
      JOIN lead_activity a ON a.lead_id = l.id AND a.kierunek = 'wychodzacy' AND a.created_at >= l.created_at
      GROUP BY l.id, l.created_at;
    ` as unknown as Promise<{ id: string; lead_created: string; first_response: string }[]>,
    // Konwersja lead→klient: per lead miesiąc utworzenia + czy dziś ma client_id.
    sql`SELECT id, created_at, zrodlo_kategoria, client_id FROM leads;` as unknown as Promise<
      Pick<import("@/lib/leads").Lead, "id" | "created_at" | "zrodlo_kategoria" | "client_id">[]
    >,
    sql`SELECT zdrowie, status, review_submitted_at, review_rating_jakosc, review_rating_terminowosc, review_rating_komunikacja, updated_at FROM projects;` as unknown as Promise<
      Pick<Project, "zdrowie" | "status" | "review_submitted_at" | "review_rating_jakosc" | "review_rating_terminowosc" | "review_rating_komunikacja" | "updated_at">[]
    >,
    // DSO: tylko realne faktury PLN, sprzedażowe (nie proformy), z policzoną
    // sumą brutto i datą ostatniej wpłaty — reszta (waluty obce) świadomie
    // pominięta, tak jak przy rezerwie podatkowej w app/api/hub/today.
    sql`
      SELECT i.id, i.data_wystawienia, i.status, i.typ_dokumentu, i.waluta, i.termin_platnosci,
        COALESCE(t.brutto, 0)::float8 AS brutto,
        COALESCE(p.zaplacono, 0)::float8 AS zaplacono,
        p.ostatnia_wplata
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id,
          SUM(ilosc * cena_netto * (1 + CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END)) AS brutto
        FROM invoice_items GROUP BY invoice_id
      ) t ON t.invoice_id = i.id
      LEFT JOIN (
        SELECT invoice_id, SUM(kwota) AS zaplacono, MAX(data) AS ostatnia_wplata FROM invoice_payments GROUP BY invoice_id
      ) p ON p.invoice_id = i.id
      WHERE i.typ_dokumentu = 'faktura';
    ` as unknown as Promise<
      { id: string; data_wystawienia: string | null; status: string; typ_dokumentu: string; waluta: string; termin_platnosci: string | null; brutto: number; zaplacono: number; ostatnia_wplata: string | null }[]
    >,
    // Moduł 17: ile razy panel realnie wysłał szkic z pytaniem o polecenie —
    // razem z % Polecenie pokazuje nie tylko "ile poleceń przyszło", ale "ile
    // razy o nie zapytaliśmy" (patrz plik modułu, sekcja "Licznik poleceń").
    sql`SELECT COUNT(*)::int AS n FROM client_events WHERE kind = 'nurture_contact_sent';` as unknown as Promise<{ n: number }[]>,
  ]);

  // --- 1) Czas do pierwszej odpowiedzi (godziny) ---
  const responseHoursAll: number[] = [];
  const responseHoursByMonth = new Map<string, number[]>();
  for (const r of firstResponseRows) {
    const hours = (new Date(r.first_response).getTime() - new Date(r.lead_created).getTime()) / 3_600_000;
    if (!Number.isFinite(hours) || hours < 0) continue;
    responseHoursAll.push(hours);
    const month = r.lead_created.slice(0, 7);
    if (!responseHoursByMonth.has(month)) responseHoursByMonth.set(month, []);
    responseHoursByMonth.get(month)!.push(hours);
  }
  const responseTimeTrend: StatsTrendPoint[] = months.map((m) => {
    const avg = statsAvg(responseHoursByMonth.get(m) ?? []);
    return { month: m, value: avg == null ? null : statsRound1(avg) };
  });
  const avgResponseHours = statsAvg(responseHoursAll);

  // --- 2) Konwersja lead→klient ---
  const leadsByMonth = new Map<string, { total: number; converted: number }>();
  for (const l of leadRows) {
    const month = String(l.created_at).slice(0, 7);
    const bucket = leadsByMonth.get(month) ?? { total: 0, converted: 0 };
    bucket.total += 1;
    if (l.client_id) bucket.converted += 1;
    leadsByMonth.set(month, bucket);
  }
  const conversionTrend: StatsTrendPoint[] = months.map((m) => {
    const b = leadsByMonth.get(m);
    return { month: m, value: b && b.total > 0 ? statsRound1((b.converted / b.total) * 100) : null };
  });
  const totalLeadsInWindow = leadRows.length;
  const convertedLeadsInWindow = leadRows.filter((l) => l.client_id).length;

  // --- 3) Rozkład zdrowia projektów (snapshot, wszystkie projekty) ---
  const healthCounts: Record<string, number> = Object.fromEntries(PROJECT_HEALTHS.map((h) => [h, 0]));
  for (const p of projectRows) {
    if (p.zdrowie in healthCounts) healthCounts[p.zdrowie] += 1;
    else healthCounts["Na dobrej drodze"] += 1; // stare projekty sprzed pola — nie gubić z licznika
  }

  // --- 4) DSO + wiek najstarszej zaległości ---
  const dsoByMonth = new Map<string, number[]>();
  const dsoAll: number[] = [];
  const realInvoices = invoiceRows.filter((i) => (i.waluta || "PLN") === "PLN");
  for (const inv of realInvoices) {
    if (inv.status !== "Opłacona" || !inv.data_wystawienia || !inv.ostatnia_wplata) continue;
    const days = daysBetweenISO(String(inv.data_wystawienia).slice(0, 10), String(inv.ostatnia_wplata).slice(0, 10));
    if (days < 0) continue;
    dsoAll.push(days);
    const month = String(inv.data_wystawienia).slice(0, 7);
    if (!dsoByMonth.has(month)) dsoByMonth.set(month, []);
    dsoByMonth.get(month)!.push(days);
  }
  const dsoTrend: StatsTrendPoint[] = months.map((m) => {
    const avg = statsAvg(dsoByMonth.get(m) ?? []);
    return { month: m, value: avg == null ? null : statsRound1(avg) };
  });
  const avgDso = statsAvg(dsoAll);

  const overdueInvoices = realInvoices.filter((inv) =>
    isInvoiceOverdue({
      status: inv.status,
      termin_platnosci: inv.termin_platnosci,
    } as Pick<Invoice, "status" | "termin_platnosci">)
  );
  const oldestOverdueDays =
    overdueInvoices.length === 0
      ? null
      : Math.max(...overdueInvoices.map((inv) => daysBetweenISO(String(inv.termin_platnosci), today)));

  // --- 5) % zamkniętych projektów z zebraną opinią ---
  const closedProjects = projectRows.filter((p) => p.status === "Wdrożone");
  const reviewedProjects = projectRows.filter((p) => p.review_submitted_at);
  const reviewAverages = reviewedProjects
    .map((p) => {
      const vals = [p.review_rating_jakosc, p.review_rating_terminowosc, p.review_rating_komunikacja].filter(
        (v): v is number => v != null
      );
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    })
    .filter((v): v is number => v != null);
  const avgClientRating = statsAvg(reviewAverages);

  // --- 6) % leadów ze źródła "Polecenie" ---
  const referralByMonth = new Map<string, { total: number; referral: number }>();
  let totalReferral = 0;
  for (const l of leadRows) {
    const month = String(l.created_at).slice(0, 7);
    const bucket = referralByMonth.get(month) ?? { total: 0, referral: 0 };
    bucket.total += 1;
    if (l.zrodlo_kategoria === "Polecenie") {
      bucket.referral += 1;
      totalReferral += 1;
    }
    referralByMonth.set(month, bucket);
  }
  const referralTrend: StatsTrendPoint[] = months.map((m) => {
    const b = referralByMonth.get(m);
    return { month: m, value: b && b.total > 0 ? statsRound1((b.referral / b.total) * 100) : null };
  });

  return NextResponse.json({
    months,
    firstResponse: { avgHours: avgResponseHours == null ? null : statsRound1(avgResponseHours), trend: responseTimeTrend },
    conversion: {
      totalLeads: totalLeadsInWindow,
      convertedLeads: convertedLeadsInWindow,
      pct: totalLeadsInWindow > 0 ? statsRound1((convertedLeadsInWindow / totalLeadsInWindow) * 100) : null,
      trend: conversionTrend,
    },
    projectHealth: { counts: healthCounts, total: projectRows.length },
    dso: {
      avgDays: avgDso == null ? null : statsRound1(avgDso),
      oldestOverdueDays,
      overdueCount: overdueInvoices.length,
      trend: dsoTrend,
    },
    reviews: {
      closedProjectsCount: closedProjects.length,
      reviewsCollected: reviewedProjects.length,
      pct: closedProjects.length > 0 ? statsRound1((reviewedProjects.length / closedProjects.length) * 100) : null,
      avgClientRating,
    },
    referral: {
      totalLeads: totalLeadsInWindow,
      referralLeads: totalReferral,
      pct: totalLeadsInWindow > 0 ? statsRound1((totalReferral / totalLeadsInWindow) * 100) : null,
      nurtureAsksSent: nurtureAskRows[0]?.n ?? 0,
      trend: referralTrend,
    },
  });
}
