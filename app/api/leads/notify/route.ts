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
  ensureContractsSchema,
  logClientEvent,
  getNudgeThreads,
  ensureBackupSchema,
} from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isOverdue, overdueReason, STATUSES, type Lead } from "@/lib/leads";
import { isProjectOverdue, type Project } from "@/lib/projects";
import { isClientOverdue, clientOverdueReason, type Client } from "@/lib/clients";
import { rozwinSerieWydarzen, type HubEvent } from "@/lib/events";
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
import { ocenKopie, type BackupRun } from "@/lib/backup";
import { isContractStale, contractSilenceDays, CONTRACT_TYP_LABEL, type Contract } from "@/lib/contracts";
import { sendEmail } from "@/lib/email";
import { syncMailbox, purgeOldMail } from "@/lib/mailSync";
import { isMailboxConfigured } from "@/lib/mailbox";
import { MAIL_RETENTION_MONTHS } from "@/lib/mail";
import { nextRunAfter, todayISO, type RecurringInvoice, type RecurringItem } from "@/lib/recurring";
import { todayLocalISO, daysSinceISO } from "@/lib/dates";
import { notify, purgeOldNotifications } from "@/lib/notificationLog";
import { odnotujPrzebieg, stanAutomatow, wczytajBledy, wyslijAlarmy, zapiszWyjatek } from "@/lib/errorLog";
import { opisBledu, wymagaUwagi } from "@/lib/observability";

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
    // Moduł 40 — nie wysyłamy automatu linkiem, który właściciel unieważnił.
    // ensure*ShareToken() jest idempotentne, więc bez tego warunku poszedłby
    // mailem adres zwracający 410, a właściciel nie miałby o tym pojęcia.
    const revokedFor = targetLevel === 3 ? inv.wezwanie_share_revoked_at : inv.share_revoked_at;
    if (revokedFor) {
      console.warn(`[notify] pomijam przypomnienie dla faktury ${inv.numer ?? inv.id} — link unieważniony`);
      continue;
    }
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
        // Formalne wezwanie to najpoważniejszy krok, jaki panel wykonuje bez
        // pytania — musi zostawić ślad tam, gdzie właściciel patrzy, nie tylko
        // w mailu o 6:00.
        await notify({
          kind: "invoice_dunning",
          title: `Wysłano wezwanie do zapłaty — faktura ${inv.numer ?? ""}`.trim(),
          body: `${dni ?? 0} dni po terminie. Sygnatura ${reference}.`,
          entity: "invoice",
          entityId: inv.id,
          dedupeKey: `invoice_dunning:${inv.id}`,
        });
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
        // Poziom w kluczu, nie sam id faktury: +3 dni i +10 dni to DWA różne
        // zdarzenia w życiu tej samej faktury i oba mają być widoczne. Sama
        // eskalacja i tak nie powtórzy się per poziom (`reminder_level` wyżej),
        // ale klucz musi to odzwierciedlać, a nie zakładać.
        await notify({
          kind: "invoice_reminder",
          title: `Wysłano przypomnienie o płatności — faktura ${inv.numer ?? ""}`.trim(),
          body: `Poziom ${targetLevel}, ${dni ?? 0} dni po terminie. Klient: ${inv.klient_nazwa}.`,
          entity: "invoice",
          entityId: inv.id,
          dedupeKey: `invoice_reminder:${inv.id}:${targetLevel}`,
        });
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
      // Klucz per WYGENEROWANY szkic, nie per szablon — ten sam szablon
      // wygeneruje kolejny szkic za miesiąc i to będzie osobne zdarzenie.
      await notify({
        kind: "recurring_invoice",
        title: `Wygenerowano szkic faktury cyklicznej — ${r.nazwa}`,
        body: `${r.klient_nazwa} · czeka na sprawdzenie i wystawienie.`,
        entity: "invoice",
        entityId: newId,
        dedupeKey: `recurring_invoice:${newId}`,
      });
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
      // Koszt nie ma podstrony rekordu (`/admin/costs` bez `[id]`), więc
      // kliknięcie prowadzi do listy — patrz `notificationHref()`.
      await notify({
        kind: "recurring_cost",
        title: `Wygenerowano koszt cykliczny — ${r.nazwa}`,
        body: `${r.dostawca_nazwa} · ${kwotaBrutto.toFixed(2)} zł brutto · sprawdź kwotę przed opłaceniem.`,
        entity: "cost",
        entityId: newId,
        dedupeKey: `recurring_cost:${newId}`,
      });
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
  const start = Date.now();
  try {
    const r = await syncMailbox();
    fetched = r.saved;
    matched = r.matched;
    await odnotujPrzebieg("sync-poczty", true, "", Date.now() - start);
  } catch (e) {
    console.error("[cron] sync poczty nie powiódł się", e);
    await odnotujPrzebieg("sync-poczty", false, opisBledu(e), Date.now() - start);
    await zapiszWyjatek("sync-poczty", "Nie udało się pobrać poczty ze skrzynki", e);
    failed = true;
  }

  let purged = 0;
  try {
    // Retencja leci nawet gdy sync padł — to niezależny obowiązek (RODO), a
    // nie krok pobierania.
    purged = (await purgeOldMail()).purged;
  } catch (e) {
    console.error("[cron] czyszczenie starych maili nie powiodło się", e);
    // Zapisujemy, bo to obowiązek RODO, a nie wygoda: nieudane czyszczenie
    // znaczy, że stare wiadomości zostają w bazie dłużej, niż deklaruje
    // polityka retencji. Nikt by tego nie zauważył — retencja nie ma UI.
    await zapiszWyjatek("retencja", "Nie udało się usunąć starych wiadomości (retencja RODO)", e);
  }

  return { fetched, matched, purged, failed };
}

async function buildAndSendDigest(): Promise<{ overdue: number; total: number; invoiceReminders: number; recurringGenerated: number; recurringCostsGenerated: number }> {
  await ensureLeadsSchema();
  await ensureHubSchema();
  await ensureClientsSchema();
  await ensureFollowupsSchema();
  await ensureContractsSchema();
  const sql = getSql();
  const today = todayLocalISO();

  // ŚWIADOMIE przed Promise.all, a nie w środku: sync zapisuje nowe wiersze do
  // mail_messages, a zapytanie o "wiadomości do odpowiedzi" niżej z nich
  // czyta. Puszczone równolegle ścigałoby się z własnym zapisem i raport
  // pomijałby maile pobrane tego samego ranka.
  const mail = await syncMailAndPurge();

  const [leads, projects, clients, contracts, dueFollowups, overdueMilestones, todayEvents, draftInvoices, pendingMails, nudgeThreads, invoiceReminders, recurring, recurringCosts] = await Promise.all([
    sql`SELECT * FROM leads ORDER BY created_at DESC;` as unknown as Promise<Lead[]>,
    sql`SELECT * FROM projects ORDER BY created_at DESC;` as unknown as Promise<Project[]>,
    sql`SELECT * FROM clients;` as unknown as Promise<Client[]>,
    // Moduł 31 — umowy/NDA do sekcji "czekające na podpis". Ta sama reguła co
    // na Pulpicie (isContractStale), żeby mail i panel nie mówiły dwóch
    // różnych rzeczy.
    sql`
      SELECT c.id, c.typ, c.status, c.sent_at, c.klient_nazwa, cl.nazwa AS client_nazwa
      FROM contracts c
      LEFT JOIN clients cl ON cl.id = c.client_id;
    ` as unknown as Promise<
      (Pick<Contract, "id" | "typ" | "status" | "sent_at" | "klient_nazwa"> & { client_nazwa: string | null })[]
    >,
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
    // Serie wchodzą jako wiersze-wzorce (patrz identyczny warunek w
    // `app/api/hub/today`) i są rozwijane na dzisiejszy dzień niżej — inaczej
    // powtarzalne spotkanie trafiłoby do dziennego maila tylko za pierwszym
    // razem.
    sql`
      SELECT * FROM events
      WHERE data = ${today}
         OR (powtarzanie IS NOT NULL AND data <= ${today}::date
             AND (powtarzanie_do IS NULL OR powtarzanie_do >= ${today}::date))
      ORDER BY godzina ASC NULLS LAST;
    ` as unknown as Promise<HubEvent[]>,
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
    // Moduł 4f — nudge/follow-up ("wysłałeś, cisza od N dni"). Ta sama
    // definicja co zakładka „Bez odpowiedzi" w panelu, patrz getNudgeThreads()
    // w lib/db.ts.
    getNudgeThreads(sql),
    sendOverdueInvoiceReminders(),
    generateDueRecurringInvoices(),
    generateDueRecurringCosts(),
  ]);

  // Bicie serca generatora cyklicznych. Liczby porażek były dotąd widoczne
  // WYŁĄCZNIE jako „(N nieudanych)" w treści maila — czyli znikały razem
  // z nim. Teraz zostaje ślad, który przeżywa nieprzeczytany raport.
  await odnotujPrzebieg(
    "faktury-cykliczne",
    recurring.failed === 0 && recurringCosts.failed === 0,
    recurring.failed || recurringCosts.failed
      ? `Nieudane: ${recurring.failed} faktur, ${recurringCosts.failed} kosztów.`
      : ""
  );

  // Centrum powiadomień (Moduł 24) — cisza w wątku. Klucz to sam wątek, więc
  // o milczącym wątku dzwonek mówi RAZ, mimo że cron widzi tę ciszę codziennie
  // aż do odpowiedzi. Bez tego jeden nieodpisany mail generowałby wpis co rano
  // w nieskończoność. Zdarzeniem jest „ten wątek ucichł", nie „nadal milczy" —
  // od pilnowania stanu jest Pulpit i zakładka „Bez odpowiedzi" w Poczcie.
  for (const t of nudgeThreads) {
    await notify({
      kind: "mail_nudge",
      title: `Brak odpowiedzi od ${t.client_nazwa || t.lead_nazwa || t.to_addr}`,
      body: `${t.subject || "(bez tematu)"} — ${daysSinceISO(t.received_at)} dni ciszy od Twojej wiadomości.`,
      entity: "mail",
      entityId: t.id,
      dedupeKey: `mail_nudge:${t.thread_id ?? t.id}`,
    });
  }

  // Retencja kroniki (30 dni) — jedziemy tym samym cronem co retencja poczty.
  const purgedNotifications = await purgeOldNotifications().catch(async (e) => {
    console.error("[cron] czyszczenie starych powiadomień nie powiodło się", e);
    await zapiszWyjatek("retencja", "Nie udało się wyczyścić starej kroniki powiadomień", e);
    return { purged: 0 };
  });
  if (purgedNotifications.purged > 0) {
    console.log(`[cron] usunięto ${purgedNotifications.purged} powiadomień starszych niż 30 dni`);
  }

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

  // Wzorce serii → konkretne dzisiejsze wystąpienia (patrz komentarz przy
  // zapytaniu wyżej). Wydarzenia jednorazowe przechodzą nietknięte.
  const dzisiejszeWydarzenia = rozwinSerieWydarzen(todayEvents, today, today);

  const eventLines = dzisiejszeWydarzenia.length
    ? dzisiejszeWydarzenia.map((e) => `- ${e.godzina ? `${e.godzina} ` : ""}${e.tytul}`).join("\n")
    : "Brak wydarzeń w kalendarzu na dziś.";

  // Moduł 31 — umowy wysłane i niepodpisane od tygodnia. Do tego modułu raport
  // nie pytał bazy o umowy w ogóle.
  const staleContracts = contracts.filter((c) => isContractStale(c));
  const contractLines = staleContracts.length
    ? staleContracts
        .map(
          (c) =>
            `  • ${c.client_nazwa || c.klient_nazwa || "(bez nazwy)"} — ${CONTRACT_TYP_LABEL[c.typ]}, cisza od ${
              contractSilenceDays(c) ?? 0
            } dni`
        )
        .join("\n")
    : "  (nic — nic nie wisi bez podpisu)";

  const summaryLines = STATUSES.map((s) => `  ${s}: ${counts[s] ?? 0}`).join("\n");
  const totalActionable =
    overdueLeads.length +
    overdueClients.length +
    dueFollowups.length +
    pendingMails.length +
    nudgeThreads.length +
    dueProjects.length +
    overdueMilestones.length +
    draftInvoices.length +
    staleContracts.length;

  // Stan kopii zapasowych bazy (2026-07-20). Osobne, tanie zapytanie —
  // ŚWIADOMIE poza głównym Promise.all i w try/catch: awaria tego odczytu nie
  // może wywrócić całego dziennego raportu. Raport jest ważniejszy niż jedna
  // linijka w nim.
  //
  // Po co to w mailu, skoro jest na Pulpicie: ostrzeżenie na Pulpicie jest
  // BIERNE — czeka, aż właściciel zajrzy. Gdyby NAS padł w piątek, a panel
  // został otwarty we wtorek, cztery dni bez kopii przeszłyby niezauważone.
  // Mail przychodzi sam, tym kanałem, który i tak jest czytany codziennie.
  let backupLinia = "";
  let backupZepsute = false;
  try {
    await ensureBackupSchema();
    const backupRuns = (await sql`
      SELECT id, ok, host, powod, tabel, rozmiar_bajtow, trwalo_sekund, created_at
      FROM backup_runs ORDER BY created_at DESC LIMIT 20;
    `) as unknown as BackupRun[];
    const stanKopii = ocenKopie(backupRuns);
    if (stanKopii.stan === "ok") {
      // Przy sprawnych kopiach jedna spokojna linijka. W mailu — inaczej niż
      // na Pulpicie — potwierdzenie ma wartość: buduje zaufanie, że mechanizm
      // żyje, zamiast zostawiać ciszę nie do odróżnienia od awarii.
      const t = stanKopii.ostatniaUdana.tabel;
      backupLinia = `Kopia zapasowa bazy: OK — ${stanKopii.opis}${t ? ` Tabel: ${t}.` : ""}`;
    } else if (stanKopii.stan === "blad") {
      backupZepsute = true;
      backupLinia = `UWAGA: ostatnia kopia zapasowa bazy SIĘ NIE UDAŁA. ${stanKopii.powod}`;
    } else if (stanKopii.stan === "przestarzale") {
      backupZepsute = true;
      backupLinia = `UWAGA: kopie zapasowe bazy są nieaktualne. ${stanKopii.opis}`;
    } else {
      backupZepsute = true;
      backupLinia = "UWAGA: kopie zapasowe bazy nie są uruchomione (patrz scripts/kopia-zapasowa/README.md).";
    }
  } catch (e) {
    console.error("[cron] nie udało się odczytać stanu kopii zapasowych", e);
    // Cichy błąd TUTAJ jest groźniejszy niż gdzie indziej: gdy odczyt padnie,
    // `backupLinia` zostaje pusta i mail wygląda dokładnie tak, jakby z
    // kopiami było wszystko w porządku. Awaria nadzoru udawałaby zdrowie.
    await zapiszWyjatek("kopie", "Nie udało się odczytać stanu kopii zapasowych", e);
    backupZepsute = true;
    backupLinia = "UWAGA: nie udało się sprawdzić stanu kopii zapasowych — traktuj to jak brak potwierdzenia, że kopie działają.";
  }

  // Zdrowie automatów (Audyt 4). Ten sam try/catch co przy kopiach i z tego
  // samego powodu: nadzór nie może wywrócić tego, co nadzoruje.
  //
  // UWAGA na kolejność — czytamy stan PRZED odnotowaniem własnego przebiegu
  // (ten leci dopiero w przebiegRaportu(), po wysłaniu maila). Dzięki temu
  // linijka o dziennym raporcie mówi o POPRZEDNIM przebiegu, a nie o tym,
  // który właśnie trwa. Inaczej raport zawsze meldowałby „przed chwilą" —
  // także wtedy, gdyby poprzednie trzy dni wypadły.
  // Ostatnie błędy z error_log.
  //
  // **To NIE jest ozdoba — bez tej sekcji `error_log` byłby tabelą tylko do
  // zapisu.** Dokładnie ten antywzorzec, który ten sam audyt wytknął przy
  // `mail_folders.last_error` (zapisywane od Modułu 4, nigdy nieczytane).
  // Zbieranie błędów, których nikt nigdy nie ogląda, to koszt bez pożytku.
  //
  // Tylko `waga='blad'` i tylko 5 najświeższych: raport ma być czytany
  // codziennie, więc nie może puchnąć. Powtórki są zwinięte licznikiem, co
  // z pięciu wierszy robi realny przegląd, a nie wycinek.
  let bledyLinie = "";
  try {
    const bledy = (await wczytajBledy(20)).filter((b) => b.waga === "blad").slice(0, 5);
    if (bledy.length > 0) {
      bledyLinie = [
        "",
        "Ostatnie błędy zapisane przez panel:",
        ...bledy.map((b) => `  • [${b.zakres}] ${b.komunikat}${b.ile > 1 ? ` (${b.ile}×)` : ""}`),
      ].join("\n");
    }
  } catch (e) {
    console.error("[cron] nie udało się odczytać ostatnich błędów", e);
  }

  let automatyLinie = "  (nie udało się odczytać)";
  let automatZepsuty = false;
  try {
    const stany = await stanAutomatow();
    automatZepsuty = stany.some(wymagaUwagi);
    automatyLinie = stany
      .map((s) => `  ${wymagaUwagi(s) ? "UWAGA" : "•"} ${s.opis}${s.stan === "blad" ? ` Powód: ${s.powod}` : ""}`)
      .join("\n");
  } catch (e) {
    console.error("[cron] nie udało się odczytać stanu automatów", e);
    await zapiszWyjatek("nadzor", "Nie udało się odczytać stanu automatów", e);
  }

  const mailLines = pendingMails.length
    ? pendingMails
        .map((m) => `  • ${m.client_nazwa || m.lead_nazwa || m.from_name || m.from_addr} — ${m.subject || "(bez tematu)"}`)
        .join("\n")
    : "  (nic — wszystko obsłużone)";

  const nudgeLines = nudgeThreads.length
    ? nudgeThreads
        .map((t) => `  • ${t.client_nazwa || t.lead_nazwa || t.to_addr} — ${t.subject || "(bez tematu)"} (${daysSinceISO(t.received_at)} dni ciszy)`)
        .join("\n")
    : "  (nic — na wszystko dostałeś odpowiedź)";

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
    `Wysłane, bez odpowiedzi od klienta (${nudgeThreads.length}):`,
    nudgeLines,
    "",
    `Projekty z minionym terminem (${dueProjects.length}):`,
    projectLines,
    "",
    `Kamienie milowe po terminie (${overdueMilestones.length}):`,
    milestoneLines,
    "",
    `Umowy czekające na podpis (${staleContracts.length}):`,
    contractLines,
    "",
    `Faktury-szkice czekające na wystawienie: ${draftInvoices.length}`,
    "",
    `Dziś w kalendarzu (${dzisiejszeWydarzenia.length}):`,
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
    backupLinia,
    "",
    // Zdrowie automatów jednym rzutem oka (Audyt 4). Wypisujemy WSZYSTKIE,
    // także zdrowe — inaczej cisza w tej sekcji byłaby nie do odróżnienia od
    // sekcji, która sama przestała działać.
    "Automaty (kiedy ostatnio zadziałały):",
    automatyLinie,
    bledyLinie,
    "",
    `Łącznie: ${leads.length} leadów, ${projects.length} projektów.`,
    "",
    "— automatyczny raport z /admin",
  ].join("\n");

  const totalActionableWithReminders = totalActionable;
  // Zepsute kopie MUSZĄ być widoczne w temacie, nie tylko w treści.
  //
  // Bez tego w spokojny dzień (nic nie wymaga działania) mail przychodziłby
  // z tematem „wszystko ogarnięte", podczas gdy od trzech dni nie ma kopii
  // zapasowej. Temat, który uspokaja wbrew treści, jest gorszy niż brak
  // tematu — a właśnie po temacie decyduje się, czy w ogóle otworzyć maila.
  const subject = backupZepsute
    ? `[Panel] UWAGA: kopie zapasowe nie działają${
        totalActionableWithReminders > 0 ? ` · ${totalActionableWithReminders} spraw na dziś` : ""
      }`
    : // Ta sama zasada rozciągnięta na automaty (Audyt 4): temat nie może
      // mówić „wszystko ogarnięte", gdy poczta nie pobiera się od dwóch dni.
      automatZepsuty
      ? `[Panel] UWAGA: automat nie działa${
          totalActionableWithReminders > 0 ? ` · ${totalActionableWithReminders} spraw na dziś` : ""
        }`
      : totalActionableWithReminders > 0
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
  return await przebiegRaportu();
}

/**
 * Jeden przebieg dziennego raportu — z meldunkiem o tym, że się odbył.
 *
 * **Do Audytu 4 (2026-07-22) ten `catch` nie logował NICZEGO** i zwracał samo
 * 500. Skutek był poważniejszy, niż wygląda: `sendEmail()` rzuca wyjątkiem
 * przy błędzie Resend, więc padnięta wysyłka kończyła cały przebieg po cichu.
 * A dzienny raport jest jedynym kanałem, którym docierają ostrzeżenia o
 * kopiach zapasowych — jego cicha śmierć wyciszała również tamten alarm.
 * Strażnik nie miał strażnika.
 *
 * Teraz każdy przebieg zostawia ślad w `automation_runs`, więc brak meldunku
 * jest sam w sobie wykrywalny — nawet wtedy, gdy cron w ogóle nie wystartował
 * i nie miał jak zgłosić błędu.
 */
async function przebiegRaportu() {
  const start = Date.now();
  try {
    const result = await buildAndSendDigest();
    await odnotujPrzebieg("raport-dzienny", true, "", Date.now() - start);
    // Alarm o INNYCH automatach leci przy okazji — raport chodzi codziennie,
    // więc jest najtańszym momentem na sprawdzenie, czy reszta żyje.
    await wyslijAlarmy();
    return NextResponse.json({ ok: true, sent: true, ...result });
  } catch (e) {
    const powod = opisBledu(e);
    await odnotujPrzebieg("raport-dzienny", false, powod, Date.now() - start);
    await zapiszWyjatek("cron", "Dzienny raport nie wykonał się do końca", e);
    // Alarm MUSI polecieć także tutaj: skoro raport nie wyszedł, wiadomość
    // schowana w jego treści nigdy by nie dojechała.
    await wyslijAlarmy();
    return NextResponse.json({ error: powod }, { status: 500 });
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
    // ŚWIADOMIE bez odnotujPrzebieg(): to jest kliknięcie właściciela, nie
    // przebieg automatu. Gdyby ręczna wysyłka odświeżała bicie serca,
    // jedno kliknięcie „Wyślij raport teraz" wyciszałoby alarm o martwym
    // cronie — czyli dokładnie w chwili, gdy właściciel sprawdza, czemu
    // maile nie przychodzą, system przestawałby mu o tym mówić.
    await zapiszWyjatek("panel", "Ręczne wysłanie raportu nie powiodło się", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
