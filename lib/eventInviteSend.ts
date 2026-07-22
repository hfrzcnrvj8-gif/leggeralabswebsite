// Wysyłka zaproszenia i odwołania spotkania — JEDNA funkcja dla obu
// (2026-07-22). Osobno od lib/eventInvites.ts, bo tamten plik jest czysty
// (importuje go UI), a ten ciąga bazę i skrzynkę pocztową.
//
// Dlaczego wspólnie: „zaproś" i „odwołaj" to ta sama koperta z inną wartością
// METHOD. Dwie kopie tego kodu rozjechałyby się dokładnie tak, jak rozjechały
// się mapy kolorów statusu (patrz `slownik-koloru-audyt`) — a różnicą, która
// by przy tym zginęła, jest numer wersji zaproszenia: bez jego podbicia
// kalendarz klienta ignoruje i aktualizację, i odwołanie.

import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema, ensureMailSchema, ensureEventAttendeesSchema } from "./db";
import { buildICS, type HubEvent } from "./events";
import { mailSummaryLine, textToHtml, extractEmailAddress } from "./mail";
import { findContactsByEmail } from "./contactLookup";
import { appendToSent, fetchSignatureImages, mailboxConfig, mailFrom, sendMail } from "./mailbox";
import { logMailOnTimeline } from "./mailSync";
import { signatureHtml, signatureText } from "./mailSignature";
import { getBookingUrl } from "./site";
import type { Locale } from "@/i18n/config";

export type InviteSendResult =
  | { ok: true; mailId: string; sequence: number; warnings: string[] }
  | { ok: false; status: number; error: string };

export async function sendEventInvite(params: {
  eventId: string;
  method: "REQUEST" | "CANCEL";
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text: string;
  podpis: Locale | null;
}): Promise<InviteSendResult> {
  const { eventId, method, to, cc, bcc, text, podpis } = params;

  await ensureHubSchema();
  await ensureEventAttendeesSchema();
  await ensureMailSchema();
  const sql = getSql();

  const events = (await sql`SELECT * FROM events WHERE id = ${eventId};`) as unknown as HubEvent[];
  const event = events[0];
  if (!event) return { ok: false, status: 404, error: "Nie ma takiego wydarzenia." };

  const subject = params.subject || `${method === "CANCEL" ? "Odwołane" : "Zaproszenie"}: ${event.tytul}`;

  // Wersja rośnie PRZED wysyłką: gdyby wysyłka padła, stracimy jeden numer
  // w sekwencji i nic więcej. Odwrotna kolejność groziłaby wysłaniem dwóch
  // różnych treści pod tym samym numerem — a wtedy kalendarz klienta pokaże
  // tylko pierwszą z nich.
  const bumped = (await sql`
    UPDATE events SET ics_sequence = ics_sequence + 1 WHERE id = ${eventId} RETURNING ics_sequence;
  `) as unknown as { ics_sequence: number }[];
  const sequence = Number(bumped[0]?.ics_sequence ?? 1);

  // Uczestnicy: „Do" i „DW". UDW świadomie NIE — adres w UDW ma z definicji
  // pozostać niewidoczny dla pozostałych, a lista ATTENDEE w pliku .ics jest
  // jawna dla każdego odbiorcy.
  const invited = [...new Set([...to, ...cc].map((a) => a.toLowerCase()))];
  for (const email of invited) {
    if (method === "CANCEL") {
      // Odwołanie nie zakłada nowych uczestników — kogo nie zapraszaliśmy,
      // temu nie ma czego odwoływać.
      await sql`
        UPDATE event_attendees SET status = 'odwolane', odpowiedz_at = NULL
        WHERE event_id = ${eventId} AND email = ${email};
      `;
    } else {
      // `status` wraca do „oczekuje" przy KAŻDEJ wysyłce: nowa wersja
      // zaproszenia (inny termin, inne miejsce) unieważnia poprzednie „będę".
      // Trzymanie starego „przyjmuje" po przeniesieniu spotkania byłoby
      // najgorszym rodzajem błędu — takim, który wygląda na wiedzę.
      await sql`
        INSERT INTO event_attendees (id, event_id, email, status, wyslane_at)
        VALUES (${randomUUID()}, ${eventId}, ${email}, 'oczekuje', now())
        ON CONFLICT (event_id, email) DO UPDATE SET status = 'oczekuje', wyslane_at = now(), odpowiedz_at = NULL;
      `;
    }
  }

  const cfg = mailboxConfig();
  const organizerRaw = mailFrom(cfg);
  const organizerEmail = extractEmailAddress(organizerRaw) || cfg.user;
  const organizerName = organizerRaw.replace(/<[^>]*>/, "").replace(/"/g, "").trim() || "Leggera Labs";

  const ics = buildICS([event], {
    method,
    organizerEmail,
    organizerName,
    attendees: invited.map((email) => ({ email, nazwa: "" })),
    sequence,
  });

  const bookingUrl = podpis ? getBookingUrl(podpis) : "";
  const fullText = podpis ? `${text}\n\n${signatureText(podpis, bookingUrl)}` : text;
  const fullHtml = podpis ? `${textToHtml(text)}<br />${signatureHtml(podpis, bookingUrl)}` : undefined;
  const inlineImages = podpis ? await fetchSignatureImages() : [];

  let sent: { messageId: string; raw: string };
  try {
    sent = await sendMail({
      to,
      cc,
      bcc,
      subject,
      text: fullText,
      html: fullHtml,
      inlineImages,
      icalEvent: { method, filename: method === "CANCEL" ? "odwolanie.ics" : "zaproszenie.ics", content: ics },
    });
  } catch (e) {
    console.error(`[sendEventInvite:${method}] wysyłka nie powiodła się`, eventId, e);
    const message = e instanceof Error ? e.message : "Nieznany błąd wysyłki.";
    return { ok: false, status: 502, error: `Nie udało się wysłać wiadomości: ${message}` };
  }

  // Od tego miejsca mail JUŻ poleciał — żaden błąd nie może zwrócić 5xx
  // (ta sama zasada co w /api/mail/compose).
  const warnings: string[] = [];

  const appended = await appendToSent(sent.raw).catch((e) => {
    console.error(`[sendEventInvite:${method}] APPEND do Sent nie powiódł się`, e);
    return false;
  });
  if (!appended) {
    warnings.push("Wiadomość wysłana, ale nie udało się dopisać kopii do folderu Sent — w Outlooku może jej nie być w „Wysłanych”.");
  }

  const mailId = randomUUID();
  try {
    const match = (await findContactsByEmail(to[0]))[0];
    const clientId = match?.type === "client" ? match.id : null;
    const leadId = match?.type === "lead" ? match.id : null;

    await sql`
      INSERT INTO mail_messages (
        id, kierunek, folder, client_id, lead_id, from_addr, to_addr, cc_addr, bcc_addr,
        subject, body_text, message_id, thread_id, status, received_at, handled_at
      ) VALUES (
        ${mailId}, 'out', 'sent', ${clientId}, ${leadId},
        '', ${to.join(", ")}, ${cc.join(", ")}, ${bcc.join(", ")}, ${subject}, ${text},
        ${sent.messageId}, ${sent.messageId}, 'obsłużony', now(), now()
      )
      ON CONFLICT (message_id) DO NOTHING;
    `;

    if (match) {
      await logMailOnTimeline(sql, { mailId, match, text: mailSummaryLine(subject, text), kierunek: "wychodzacy" });
    }
  } catch (e) {
    console.error(`[sendEventInvite:${method}] zapis wiadomości nie powiódł się`, e);
    warnings.push("Wiadomość wysłana, ale nie udało się zapisać jej w Poczcie — sprawdź folder „Wysłane”.");
  }

  return { ok: true, mailId, sequence, warnings };
}
