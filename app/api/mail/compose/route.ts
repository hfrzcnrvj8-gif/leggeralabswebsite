import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailSchema } from "@/lib/db";
import { extractEmailAddress, mailSummaryLine, parseAddressList, textToHtml } from "@/lib/mail";
import { findContactsByEmail } from "@/lib/contactLookup";
import { appendToSent, fetchSignatureImages, isMailboxConfigured, sendMail } from "@/lib/mailbox";
import { logMailOnTimeline } from "@/lib/mailSync";
import { signatureHtml, signatureText } from "@/lib/mailSignature";
import { getBookingUrl } from "@/lib/site";
import { i18n, type Locale } from "@/i18n/config";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/mail/compose — nowa wiadomość napisana od zera (Etap 1 Modułu 4b,
 * "Zostało w tym etapie"). Świadomie NOWY wątek: brak `in_reply_to`/`refs`,
 * bo nie ma oryginału, do którego się odnieść.
 *
 * Ten sam wzorzec kolejności co POST /api/mail/[id]/reply: wysyłka jest
 * nieodwracalna, więc idzie pierwsza — błąd czegokolwiek PO niej (kopia w
 * Sent, zapis w panelu) jest ostrzeżeniem, nie błędem 5xx.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!isMailboxConfigured()) {
    return NextResponse.json(
      { error: "Skrzynka pocztowa nie jest skonfigurowana — dodaj MAIL_IMAP_HOST, MAIL_USER i MAIL_PASS w zmiennych środowiskowych Vercela (dane z panelu az.pl)." },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { to?: unknown; cc?: unknown; subject?: unknown; text?: unknown; podpis?: unknown }
    | null;

  const to = extractEmailAddress(typeof body?.to === "string" ? body.to : "");
  if (!to) return NextResponse.json({ error: "Adres odbiorcy jest nieprawidłowy." }, { status: 400 });

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Treść wiadomości nie może być pusta." }, { status: 400 });

  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const cc = typeof body?.cc === "string" ? parseAddressList(body.cc) : [];

  // Język podpisu wybiera właściciel przy pisaniu (decyzja 2026-07-15:
  // przełącznik ręczny, NIE automat po kraju klienta).
  const podpis = (i18n.locales as readonly string[]).includes(body?.podpis as string) ? (body!.podpis as Locale) : null;

  await ensureMailSchema();
  const sql = getSql();

  const bookingUrl = podpis ? getBookingUrl(podpis) : "";
  const fullText = podpis ? `${text}\n\n${signatureText(podpis, bookingUrl)}` : text;
  const fullHtml = podpis ? `${textToHtml(text)}<br />${signatureHtml(podpis, bookingUrl)}` : undefined;
  const inlineImages = podpis ? await fetchSignatureImages() : [];

  let sent: { messageId: string; raw: string };
  try {
    sent = await sendMail({ to, cc, subject, text: fullText, html: fullHtml, inlineImages });
  } catch (e) {
    console.error("[POST /api/mail/compose] wysyłka nie powiodła się", e);
    const message = e instanceof Error ? e.message : "Nieznany błąd wysyłki.";
    return NextResponse.json({ error: `Nie udało się wysłać wiadomości: ${message}` }, { status: 502 });
  }

  // Od tego miejsca mail JUŻ poleciał — żaden błąd nie może zwrócić 5xx.
  const warnings: string[] = [];

  const appended = await appendToSent(sent.raw).catch((e) => {
    console.error("[POST /api/mail/compose] APPEND do Sent nie powiódł się", e);
    return false;
  });
  if (!appended) {
    warnings.push("Wiadomość wysłana, ale nie udało się dopisać kopii do folderu Sent — w Outlooku może jej nie być w „Wysłanych”.");
  }

  const mailId = randomUUID();
  try {
    const match = (await findContactsByEmail(to))[0];
    const clientId = match?.type === "client" ? match.id : null;
    const leadId = match?.type === "lead" ? match.id : null;

    await sql`
      INSERT INTO mail_messages (
        id, kierunek, client_id, lead_id, from_addr, to_addr, cc_addr,
        subject, body_text, message_id, status, received_at, handled_at
      ) VALUES (
        ${mailId}, 'out', ${clientId}, ${leadId},
        '', ${to}, ${cc.join(", ")}, ${subject}, ${text},
        ${sent.messageId}, 'obsłużony', now(), now()
      )
      ON CONFLICT (message_id) DO NOTHING;
    `;

    if (match) {
      await logMailOnTimeline(sql, {
        mailId,
        match,
        text: mailSummaryLine(subject, text),
        kierunek: "wychodzacy",
      });
    }
  } catch (e) {
    console.error("[POST /api/mail/compose] zapis wiadomości nie powiódł się", e);
    warnings.push("Wiadomość wysłana, ale nie udało się zapisać jej w panelu — odśwież widok, a jeśli nadal jej nie ma, sprawdź Outlooka.");
  }

  return NextResponse.json({ ok: true, id: mailId, warnings });
}
