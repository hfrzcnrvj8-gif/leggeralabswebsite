import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureLeadsSchema, ensureHubSchema, ensureInvoicesSchema, ensureInvoiceShareToken, ensureClientsSchema, ensureFollowupsSchema, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isOverdue, overdueReason, STATUSES, type Lead } from "@/lib/leads";
import { isProjectOverdue, type Project } from "@/lib/projects";
import { isClientOverdue, clientOverdueReason, type Client } from "@/lib/clients";
import type { HubEvent } from "@/lib/events";
import { isInvoiceOverdue, formatMoney, addDaysISO, type Invoice } from "@/lib/invoices";
import { sendEmail } from "@/lib/email";
import { nextRunAfter, todayISO, type RecurringInvoice, type RecurringItem } from "@/lib/recurring";
import { todayLocalISO } from "@/lib/dates";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 30;

const NOTIFY_TO = "kontakt@leggeralabs.pl";
// Nie przypominaj klientowi codziennie o tej samej zaległej fakturze —
// odstęp między automatycznymi przypomnieniami tej samej faktury.
const REMINDER_COOLDOWN_DAYS = 7;
const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://leggeralabs.pl";

/** Wysyła klientom automatyczne przypomnienia o zaległych fakturach (z
 * e-mailem nabywcy, wystawionych, po terminie), z odstępem
 * `REMINDER_COOLDOWN_DAYS` między kolejnymi przypomnieniami tej samej
 * faktury. Błędy pojedynczych wysyłek nie przerywają reszty — liczy się
 * "wysłano ile się dało", nie "wszystko albo nic". */
async function sendOverdueInvoiceReminders(): Promise<{ sent: number; failed: number }> {
  await ensureInvoicesSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM invoices
    WHERE status = 'Wystawiona' AND typ_dokumentu != 'proforma' AND klient_email != ''
      AND (last_reminder_at IS NULL OR last_reminder_at < now() - make_interval(days => ${REMINDER_COOLDOWN_DAYS}));
  `) as unknown as Invoice[];

  const dueRows = await Promise.all(
    rows.map(async (inv) => {
      const totals = await sql`
        SELECT COALESCE(SUM(ilosc * cena_netto * (1 + CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END)), 0)::float8 AS brutto
        FROM invoice_items WHERE invoice_id = ${inv.id};
      `;
      return { inv, brutto: Number(totals[0]?.brutto ?? 0) };
    })
  );

  let sent = 0;
  let failed = 0;
  for (const { inv, brutto } of dueRows) {
    if (!isInvoiceOverdue(inv)) continue;
    try {
      const token = await ensureInvoiceShareToken(sql, inv.id, inv.share_token);
      const url = `${SITE_ORIGIN}/pl/faktura/${token}`;
      await sendEmail({
        to: inv.klient_email,
        subject: `Przypomnienie o płatności — faktura ${inv.numer}`,
        text: [
          `Dzień dobry,`,
          ``,
          `przypominamy o płatności za fakturę nr ${inv.numer} na kwotę ${formatMoney(brutto, inv.waluta || "PLN")}, `,
          `z terminem płatności ${inv.termin_platnosci ?? "—"}.`,
          ``,
          url,
          ``,
          `Jeśli płatność została już zrealizowana, prosimy zignorować tę wiadomość.`,
          ``,
          `Pozdrawiamy,`,
          `Leggera Labs`,
        ].join("\n"),
      });
      await sql`UPDATE invoices SET last_reminder_at = now() WHERE id = ${inv.id};`;
      await logClientEvent(sql, inv.client_id, "invoice_reminder", `Automatyczne przypomnienie o płatności — faktura ${inv.numer}`);
      sent += 1;
    } catch (e) {
      console.error("[sendOverdueInvoiceReminders] failed for", inv.id, e);
      failed += 1;
    }
  }
  return { sent, failed };
}

/** Generuje kolejny szkic faktury dla każdego aktywnego szablonu cyklicznego,
 * którego `next_run` nadszedł — kopiuje dane nabywcy/pozycje, ustawia
 * `data_wystawienia`/`termin_platnosci` na dziś/dziś+termin_dni, i przesuwa
 * `next_run` szablonu na kolejny cykl. Wystawienie (nadanie numeru) i
 * ewentualna wysyłka mailem zostają ręczne — świadomie, żeby właściciel
 * zawsze mógł spojrzeć na szkic przed wysłaniem klientowi. */
async function generateDueRecurringInvoices(): Promise<{ generated: number; failed: number }> {
  await ensureInvoicesSchema();
  const sql = getSql();
  const today = todayISO();
  const rows = (await sql`
    SELECT * FROM recurring_invoices WHERE active = true AND next_run <= ${today};
  `) as unknown as (Omit<RecurringInvoice, "pozycje"> & { pozycje: unknown })[];

  let generated = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      const pozycje: RecurringItem[] = typeof r.pozycje === "string" ? JSON.parse(r.pozycje) : (r.pozycje as RecurringItem[]);
      const newId = randomUUID();
      const shareToken = randomUUID().replace(/-/g, "");
      const dataWyst = today;
      const terminPlatnosci = addDaysISO(dataWyst, r.termin_dni);
      await sql`
        INSERT INTO invoices (
          id, klient_nazwa, klient_nip, klient_ulica, klient_kod, klient_miasto, klient_kraj,
          klient_email, share_token, waluta, jezyk, data_wystawienia, data_sprzedazy, termin_platnosci, uwagi
        ) VALUES (
          ${newId}, ${r.klient_nazwa}, ${r.klient_nip}, ${r.klient_ulica}, ${r.klient_kod}, ${r.klient_miasto}, ${r.klient_kraj},
          ${r.klient_email}, ${shareToken}, ${r.waluta}, ${r.jezyk}, ${dataWyst}, ${dataWyst}, ${terminPlatnosci},
          ${`Wygenerowano automatycznie z cyklicznego szablonu „${r.nazwa}”.`}
        );
      `;
      let pos = 0;
      for (const it of pozycje) {
        await sql`
          INSERT INTO invoice_items (id, invoice_id, nazwa, ilosc, jednostka, cena_netto, vat_stawka, position)
          VALUES (${randomUUID()}, ${newId}, ${it.nazwa}, ${it.ilosc}, ${it.jednostka}, ${it.cena_netto}, ${it.vat_stawka}, ${pos});
        `;
        pos += 1;
      }
      const next = nextRunAfter(r.next_run <= today ? today : r.next_run, r.cykl);
      await sql`UPDATE recurring_invoices SET next_run = ${next}, updated_at = now() WHERE id = ${r.id};`;
      generated += 1;
    } catch (e) {
      console.error("[generateDueRecurringInvoices] failed for", r.id, e);
      failed += 1;
    }
  }
  return { generated, failed };
}

/** Dzienny raport ze wszystkich modułów panelu (leady + projekty +
 * dzisiejszy kalendarz), nie tylko z rejestru leadów — jeden mail spinający
 * całość, zamiast osobnych powiadomień per moduł. */
async function buildAndSendDigest(): Promise<{ overdue: number; total: number; invoiceReminders: number; recurringGenerated: number }> {
  await ensureLeadsSchema();
  await ensureHubSchema();
  await ensureClientsSchema();
  await ensureFollowupsSchema();
  const sql = getSql();
  const today = todayLocalISO();

  const [leads, projects, clients, dueFollowups, overdueMilestones, todayEvents, draftInvoices, invoiceReminders, recurring] = await Promise.all([
    sql`SELECT * FROM leads ORDER BY created_at DESC;` as unknown as Promise<Lead[]>,
    sql`SELECT * FROM projects ORDER BY created_at DESC;` as unknown as Promise<Project[]>,
    sql`SELECT * FROM clients;` as unknown as Promise<Client[]>,
    // Zaplanowane kontakty nurture (Moduł 2) wymagalne dziś lub wcześniej —
    // ta sama reguła co na Pulpicie (patrz app/api/hub/today).
    sql`
      SELECT f.id, f.client_id, f.due_date, f.powod, c.nazwa AS client_nazwa
      FROM client_followups f
      JOIN clients c ON c.id = f.client_id
      WHERE f.due_date <= ${today} AND f.done_at IS NULL
      ORDER BY f.due_date ASC;
    ` as unknown as Promise<{ id: string; client_id: string; due_date: string; powod: string; client_nazwa: string }[]>,
    // Kamienie milowe po terminie (ta sama reguła co na pulpicie, patrz
    // app/api/hub/today) — niewdrożony projekt, nieukończony kamień.
    sql`
      SELECT m.nazwa, m.termin, p.tytul AS projekt
      FROM project_milestones m
      JOIN projects p ON p.id = m.project_id
      WHERE p.status != 'Wdrożone' AND m.termin IS NOT NULL AND m.termin <= ${today}
        AND (
          EXISTS (SELECT 1 FROM project_tasks t WHERE t.milestone_id = m.id AND t.done = false)
          OR NOT EXISTS (SELECT 1 FROM project_tasks t WHERE t.milestone_id = m.id)
        )
      ORDER BY m.termin ASC;
    ` as unknown as Promise<{ nazwa: string; termin: string; projekt: string }[]>,
    sql`SELECT * FROM events WHERE data = ${today} ORDER BY godzina ASC NULLS LAST;` as unknown as Promise<HubEvent[]>,
    // Faktury-szkice czekające na wystawienie (z treścią, nie utworzone dziś) —
    // ta sama reguła co na pulpicie (patrz app/api/hub/today). Liczą się tylko
    // właściwe faktury, nie proformy/zaliczkowe.
    sql`
      SELECT i.id FROM invoices i
      WHERE i.status = 'Szkic' AND i.typ_dokumentu = 'faktura'
        AND i.created_at::date < ${today}::date
        AND EXISTS (SELECT 1 FROM invoice_items it WHERE it.invoice_id = i.id);
    ` as unknown as Promise<{ id: string }[]>,
    sendOverdueInvoiceReminders(),
    generateDueRecurringInvoices(),
  ]);

  const overdueLeads = leads.filter(isOverdue);
  const dueProjects = projects.filter(isProjectOverdue);
  const overdueClients = clients.filter(isClientOverdue);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length]));

  const leadLines = overdueLeads.length
    ? overdueLeads.map((l) => `- ${l.firma} — ${overdueReason(l)}`).join("\n")
    : "Brak leadów wymagających dziś działania.";

  // Dwa źródła "klient wymaga kontaktu": ręcznie ustawiony next_followup i
  // automatyczny harmonogram nurture (Moduł 2) — osobne linie, bo mają inny
  // powód, ale sumują się do jednej sekcji w mailu, tak jak na Pulpicie.
  const clientLines = overdueClients.length
    ? overdueClients.map((c) => `- ${c.nazwa} — ${clientOverdueReason(c)}`).join("\n")
    : "Brak klientów z ręcznie ustawionym przypomnieniem.";

  const followupLines = dueFollowups.length
    ? dueFollowups.map((f) => `- ${f.client_nazwa} — ${f.powod}`).join("\n")
    : "Brak zaplanowanych kontaktów nurture.";

  const projectLines = dueProjects.length
    ? dueProjects.map((p) => `- ${p.tytul} — termin ${p.termin}`).join("\n")
    : "Brak projektów z minionym terminem.";

  const milestoneLines = overdueMilestones.length
    ? overdueMilestones.map((m) => `- ${m.nazwa} (${m.projekt}) — termin ${m.termin}`).join("\n")
    : "Brak kamieni po terminie.";

  const eventLines = todayEvents.length
    ? todayEvents.map((e) => `- ${e.godzina ? `${e.godzina} ` : ""}${e.tytul}`).join("\n")
    : "Brak wydarzeń w kalendarzu na dziś.";

  const summaryLines = STATUSES.map((s) => `  ${s}: ${counts[s] ?? 0}`).join("\n");
  const totalActionable =
    overdueLeads.length + overdueClients.length + dueFollowups.length + dueProjects.length + overdueMilestones.length + draftInvoices.length;

  const text = [
    "Dzień dobry,",
    "",
    "Dzienny przegląd panelu Leggera Labs:",
    "",
    `Leady wymagające działania dziś (${overdueLeads.length}):`,
    leadLines,
    "",
    `Klienci z ręcznym przypomnieniem (${overdueClients.length}):`,
    clientLines,
    "",
    `Zaplanowane kontakty nurture (${dueFollowups.length}):`,
    followupLines,
    "",
    `Projekty z minionym terminem (${dueProjects.length}):`,
    projectLines,
    "",
    `Kamienie milowe po terminie (${overdueMilestones.length}):`,
    milestoneLines,
    "",
    `Faktury-szkice czekające na wystawienie: ${draftInvoices.length}`,
    "",
    `Dziś w kalendarzu (${todayEvents.length}):`,
    eventLines,
    "",
    "Podsumowanie leadów wg statusu:",
    summaryLines,
    "",
    `Przypomnienia o zaległych fakturach wysłane klientom dziś: ${invoiceReminders.sent}` +
      (invoiceReminders.failed ? ` (${invoiceReminders.failed} nieudanych)` : ""),
    "",
    `Wygenerowane dziś szkice faktur cyklicznych: ${recurring.generated}` +
      (recurring.failed ? ` (${recurring.failed} nieudanych)` : ""),
    "",
    `Łącznie: ${leads.length} leadów, ${projects.length} projektów.`,
    "",
    "— automatyczny raport z /admin",
  ].join("\n");

  const totalActionableWithReminders = totalActionable;
  const subject =
    totalActionableWithReminders > 0
      ? `[Panel] ${totalActionableWithReminders} ${totalActionableWithReminders === 1 ? "sprawa wymaga" : "spraw wymaga"} dziś działania`
      : "[Panel] Dzienny raport — wszystko ogarnięte";

  await sendEmail({ to: NOTIFY_TO, subject, text });

  return {
    overdue: totalActionable,
    total: leads.length + projects.length,
    invoiceReminders: invoiceReminders.sent,
    recurringGenerated: recurring.generated,
  };
}

/**
 * GET /api/leads/notify — wywoływane raz dziennie przez Vercel Cron (patrz
 * vercel.json). Wymaga nagłówka `Authorization: Bearer <CRON_SECRET>`, który
 * Vercel dołącza automatycznie do wywołań crona — chroni endpoint przed
 * przypadkowym/obcym wywołaniem. Fail-closed: jeśli CRON_SECRET nie jest
 * ustawiony w env, endpoint jest zablokowany, a nie cicho publiczny —
 * inaczej ktokolwiek znający URL mógłby wielokrotnie wywoływać dzienny
 * raport i generowanie faktur cyklicznych.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[GET /api/leads/notify] CRON_SECRET nie jest ustawiony w env — endpoint zablokowany.");
    return NextResponse.json({ error: "CRON_SECRET nie jest skonfigurowany w env Vercela." }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await buildAndSendDigest();
    return NextResponse.json({ ok: true, sent: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** POST /api/leads/notify — ręczne wysłanie raportu z panelu admina
 * (przycisk "Wyślij raport teraz"). Admin-only. */
export async function POST() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await buildAndSendDigest();
    return NextResponse.json({ ok: true, sent: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
