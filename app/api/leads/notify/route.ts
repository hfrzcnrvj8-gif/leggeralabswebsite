import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  getSql,
  ensureLeadsSchema,
  ensureHubSchema,
  ensureInvoicesSchema,
  ensureInvoiceShareToken,
  ensureInvoiceWezwanieShareToken,
  ensureClientsSchema,
  ensureFollowupsSchema,
  ensureCostsSchema,
  logClientEvent,
} from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isOverdue, overdueReason, STATUSES, type Lead } from "@/lib/leads";
import { isProjectOverdue, type Project } from "@/lib/projects";
import { isClientOverdue, clientOverdueReason, type Client } from "@/lib/clients";
import type { HubEvent } from "@/lib/events";
import {
  isInvoiceOverdue,
  daysOverdue,
  reminderLevelForDays,
  reminderEmailText,
  dunningEmailText,
  dunningReference,
  lateInterestAmount,
  addDaysISO,
  type Invoice,
  type CompanySettings,
} from "@/lib/invoices";
import { costBrutto, type RecurringCost } from "@/lib/costs";
import { sendEmail } from "@/lib/email";
import { syncMailbox, purgeOldMail } from "@/lib/mailSync";
import { isMailboxConfigured } from "@/lib/mailbox";
import { MAIL_RETENTION_MONTHS } from "@/lib/mail";
import { nextRunAfter, todayISO, type RecurringInvoice, type RecurringItem } from "@/lib/recurring";
import { todayLocalISO } from "@/lib/dates";

export const runtime = "nodejs";
// Podniesione z 30 s przy Module 4: do raportu doszło pobranie poczty przez
// IMAP (połączenie + parsowanie MIME), które na wolniejszej skrzynce potrafi
// zająć kilkanaście sekund.
export const maxDuration = 60;

const NOTIFY_TO = "kontakt@leggeralabs.pl";
const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://leggeralabs.pl";

/** Wysyła klientom automatyczne przypomnienia o zaległych fakturach (z
 * e-mailem nabywcy, wystawionych, po terminie), z rosnącą eskalacją tonu
 * wg `REMINDER_LEVELS` (lib/invoices.ts): +3 dni uprzejme, +10 stanowcze,
 * +21 formalne wezwanie do zapłaty (osobny dokument, opcjonalne odsetki
 * ustawowe). `invoices.reminder_level` pilnuje, żeby dany poziom nie
 * poszedł dwa razy — zastąpiło to poprzedni, prostszy mechanizm stałego
 * 7-dniowego cooldownu bez eskalacji. Błędy pojedynczych wysyłek nie
 * przerywają reszty — liczy się "wysłano ile się dało", nie "wszystko albo
 * nic". */
async function sendOverdueInvoiceReminders(): Promise<{ sent: number; failed: number }> {
  await ensureInvoicesSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM invoices
    WHERE status = 'Wystawiona' AND typ_dokumentu != 'proforma' AND klient_email != '';
  `) as unknown as Invoice[];
  const settingsRows = (await sql`SELECT * FROM company_settings WHERE id = 'default';`) as unknown as CompanySettings[];
  const stawkaOdsetek = settingsRows[0]?.stawka_odsetek_ustawowych ?? null;

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
    const dni = daysOverdue(inv);
    const targetLevel = reminderLevelForDays(dni);
    if (targetLevel === 0 || targetLevel <= inv.reminder_level) continue;
    try {
      if (targetLevel === 3) {
        const token = await ensureInvoiceWezwanieShareToken(sql, inv.id, inv.wezwanie_share_token);
        const url = `${SITE_ORIGIN}/pl/wezwanie/${token}`;
        const reference = dunningReference(inv.id, inv.created_at);
        const odsetki = lateInterestAmount(brutto, stawkaOdsetek, dni ?? 0);
        const { subject, text } = dunningEmailText({
          numer: inv.numer ?? "",
          brutto,
          waluta: inv.waluta,
          terminPlatnosci: inv.termin_platnosci,
          dni: dni ?? 0,
          odsetki,
          url,
          reference,
        });
        await sendEmail({ to: inv.klient_email, subject, text });
        await sql`UPDATE invoices SET wezwanie_wystawiono_at = now() WHERE id = ${inv.id};`;
        await logClientEvent(sql, inv.client_id, "invoice_dunning_sent", `Wysłano wezwanie do zapłaty — faktura ${inv.numer} (${reference})`, null, inv.id);
      } else {
        const token = await ensureInvoiceShareToken(sql, inv.id, inv.share_token);
        const url = `${SITE_ORIGIN}/pl/faktura/${token}`;
        const { subject, text } = reminderEmailText(targetLevel as 1 | 2, {
          numer: inv.numer ?? "",
          brutto,
          waluta: inv.waluta,
          terminPlatnosci: inv.termin_platnosci,
          url,
        });
        await sendEmail({ to: inv.klient_email, subject, text });
        await logClientEvent(sql, inv.client_id, "invoice_reminder", `Automatyczne przypomnienie o płatności (poziom ${targetLevel}) — faktura ${inv.numer}`, null, inv.id);
      }
      await sql`UPDATE invoices SET last_reminder_at = now(), reminder_level = ${targetLevel} WHERE id = ${inv.id};`;
      await sql`
        INSERT INTO invoice_reminders (id, invoice_id, level, kind)
        VALUES (${randomUUID()}, ${inv.id}, ${targetLevel}, ${targetLevel === 3 ? "wezwanie" : "reminder"});
      `;
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

/** Analogicznie do `generateDueRecurringInvoices`, ale dla kosztów cyklicznych
 * (Moduł 9, koszty cykliczne — abonamenty/subskrypcje). Tworzy nowy koszt
 * "Nieopłacony" ze skopiowanymi danymi szablonu; właściciel i tak musi
 * ręcznie sprawdzić kwotę (może się zmienić od poprzedniego miesiąca) i
 * oznaczyć jako opłacony po zapłaceniu. */
async function generateDueRecurringCosts(): Promise<{ generated: number; failed: number }> {
  await ensureCostsSchema();
  const sql = getSql();
  const today = todayISO();
  const rows = (await sql`
    SELECT * FROM recurring_costs WHERE active = true AND next_run <= ${today};
  `) as unknown as (Omit<RecurringCost, "kwota_netto"> & { kwota_netto: unknown })[];

  let generated = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      const kwotaNetto = Number(r.kwota_netto);
      const kwotaBrutto = costBrutto(kwotaNetto, r.vat_stawka);
      const newId = randomUUID();
      const opis = `Wygenerowano automatycznie z cyklicznego szablonu „${r.nazwa}”.`;
      await sql`
        INSERT INTO costs (
          id, dostawca_nazwa, dostawca_nip, dostawca_konto, kategoria, opis, data_wydatku,
          kwota_netto, vat_stawka, kwota_brutto, status, metoda_platnosci, project_id
        ) VALUES (
          ${newId}, ${r.dostawca_nazwa}, ${r.dostawca_nip}, ${r.dostawca_konto}, ${r.kategoria}, ${opis}, ${today},
          ${kwotaNetto}, ${r.vat_stawka}, ${kwotaBrutto}, 'Nieopłacony', ${r.metoda_platnosci}, ${r.project_id}
        );
      `;
      const next = nextRunAfter(r.next_run <= today ? today : r.next_run, r.cykl);
      await sql`UPDATE recurring_costs SET next_run = ${next}, updated_at = now() WHERE id = ${r.id};`;
      generated += 1;
    } catch (e) {
      console.error("[generateDueRecurringCosts] failed for", r.id, e);
      failed += 1;
    }
  }
  return { generated, failed };
}

/** Dzienny raport ze wszystkich modułów panelu (leady + projekty +
 * dzisiejszy kalendarz), nie tylko z rejestru leadów — jeden mail spinający
 * całość, zamiast osobnych powiadomień per moduł. */
/** Moduł 4 — dzienne pobranie poczty + retencja (24 mies., decyzja
 * właściciela 2026-07-15). Ten sam wzorzec co pozostałe zadania crona: łyka
 * własne błędy i zwraca liczby, bo niedostępna skrzynka nie może wywrócić
 * całego raportu dziennego (leady/faktury/kalendarz mają lecieć niezależnie).
 *
 * Drugie wejście do syncu to POST /api/mail/sync przy otwarciu zakładki
 * Poczta — tu wołamy tę samą funkcję z lib/mailSync.ts wprost, bez HTTP. */
async function syncMailAndPurge(): Promise<{ fetched: number; matched: number; purged: number; failed: boolean }> {
  if (!isMailboxConfigured()) return { fetched: 0, matched: 0, purged: 0, failed: false };

  let fetched = 0;
  let matched = 0;
  let failed = false;
  try {
    const r = await syncMailbox();
    fetched = r.saved;
    matched = r.matched;
  } catch (e) {
    console.error("[cron] sync poczty nie powiódł się", e);
    failed = true;
  }

  let purged = 0;
  try {
    // Retencja leci nawet gdy sync padł — to niezależny obowiązek (RODO), a
    // nie krok pobierania.
    purged = (await purgeOldMail()).purged;
  } catch (e) {
    console.error("[cron] czyszczenie starych maili nie powiodło się", e);
  }

  return { fetched, matched, purged, failed };
}

async function buildAndSendDigest(): Promise<{ overdue: number; total: number; invoiceReminders: number; recurringGenerated: number; recurringCostsGenerated: number }> {
  await ensureLeadsSchema();
  await ensureHubSchema();
  await ensureClientsSchema();
  await ensureFollowupsSchema();
  const sql = getSql();
  const today = todayLocalISO();

  // ŚWIADOMIE przed Promise.all, a nie w środku: sync zapisuje nowe wiersze do
  // mail_messages, a zapytanie o "wiadomości do odpowiedzi" niżej z nich
  // czyta. Puszczone równolegle ścigałoby się z własnym zapisem i raport
  // pomijałby maile pobrane tego samego ranka.
  const mail = await syncMailAndPurge();

  const [leads, projects, clients, dueFollowups, overdueMilestones, todayEvents, draftInvoices, pendingMails, invoiceReminders, recurring, recurringCosts] = await Promise.all([
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
    // Moduł 4 — nieodpisane wiadomości (ta sama reguła co na Pulpicie, patrz
    // app/api/hub/today). Wyciszone (newslettery) mają status 'zignorowany'.
    sql`
      SELECT m.from_addr, m.from_name, m.subject,
             c.nazwa AS client_nazwa, l.firma AS lead_nazwa
      FROM mail_messages m
      LEFT JOIN clients c ON c.id = m.client_id
      LEFT JOIN leads l ON l.id = m.lead_id
      WHERE m.status = 'nowy' AND m.kierunek = 'in'
      ORDER BY m.received_at DESC;
    ` as unknown as Promise<
      { from_addr: string; from_name: string; subject: string; client_nazwa: string | null; lead_nazwa: string | null }[]
    >,
    sendOverdueInvoiceReminders(),
    generateDueRecurringInvoices(),
    generateDueRecurringCosts(),
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
    overdueLeads.length +
    overdueClients.length +
    dueFollowups.length +
    pendingMails.length +
    dueProjects.length +
    overdueMilestones.length +
    draftInvoices.length;

  const mailLines = pendingMails.length
    ? pendingMails
        .map((m) => `  • ${m.client_nazwa || m.lead_nazwa || m.from_name || m.from_addr} — ${m.subject || "(bez tematu)"}`)
        .join("\n")
    : "  (nic — wszystko obsłużone)";

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
    `Wiadomości do odpowiedzi (${pendingMails.length}):`,
    mailLines,
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
    `Wygenerowane dziś szkice kosztów cyklicznych: ${recurringCosts.generated}` +
      (recurringCosts.failed ? ` (${recurringCosts.failed} nieudanych)` : ""),
    "",
    // Awaria skrzynki musi być widoczna w raporcie — inaczej poczta po cichu
    // przestaje się pobierać i wygląda to jak "nikt nie pisze".
    mail.failed
      ? "UWAGA: nie udało się dziś pobrać poczty ze skrzynki — sprawdź dane dostępowe az.pl w zmiennych środowiskowych Vercela."
      : `Nowe wiadomości pobrane dziś: ${mail.fetched}` + (mail.matched ? ` (w tym ${mail.matched} dopasowanych do klienta/leada)` : ""),
    mail.purged > 0 ? `Usunięto starych wiadomości (retencja ${MAIL_RETENTION_MONTHS} mies.): ${mail.purged}` : "",
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
    recurringCostsGenerated: recurringCosts.generated,
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
