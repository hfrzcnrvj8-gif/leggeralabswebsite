import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailSchema } from "@/lib/db";
import {
  forwardHtml,
  forwardHeaderText,
  forwardSubject,
  mailSummaryLine,
  parseAddressList,
  textToHtml,
  MAIL_ATTACHMENT_MIME_TYPES,
  MAIL_ATTACHMENT_MAX_FILE_BYTES,
  MAIL_ATTACHMENT_MAX_TOTAL_BYTES,
  type MailMessage,
} from "@/lib/mail";
import { findContactsByEmail } from "@/lib/contactLookup";
import { appendToSent, fetchSignatureImages, isMailboxConfigured, sendMail } from "@/lib/mailbox";
import { logMailOnTimeline } from "@/lib/mailSync";
import { sanitizeMailHtml } from "@/lib/mailHtml";
import { signatureHtml, signatureText } from "@/lib/mailSignature";
import { getBookingUrl } from "@/lib/site";
import { i18n, type Locale } from "@/i18n/config";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/mail/[id]/forward — przekazanie wiadomości dalej (Etap 1 Modułu
 * 4b). Świadomie NOWY wątek (bez `in_reply_to`/`refs`) — tak samo zachowuje
 * się Gmail/Outlook przy "Fwd:", w odróżnieniu od odpowiedzi.
 *
 * Załączniki ORYGINAŁU NIE są automatycznie doklejane przy przekazywaniu —
 * świadomie odłożone w planie modułu (`docs/plany-modulow/
 * 04b-poczta-pelny-klient.md`, "Świadomie ODŁOŻONE"): panel dziś w ogóle nie
 * przechowuje treści załączników przychodzącej poczty. To NIE dotyczy
 * NOWEGO pliku, który właściciel może ręcznie dołączyć przy przekazywaniu
 * (druga runda Etapu 1) — to inna, niezależna możliwość, patrz `attachments`
 * niżej.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  if (!isMailboxConfigured()) {
    return NextResponse.json(
      { error: "Skrzynka pocztowa nie jest skonfigurowana — dodaj MAIL_IMAP_HOST, MAIL_USER i MAIL_PASS w zmiennych środowiskowych Vercela (dane z panelu az.pl)." },
      { status: 400 }
    );
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Nieprawidłowe dane formularza." }, { status: 400 });

  const to = parseAddressList(String(formData.get("to") ?? ""));
  if (to.length === 0) return NextResponse.json({ error: "Adres odbiorcy jest nieprawidłowy." }, { status: 400 });

  const comment = String(formData.get("text") ?? "").trim();
  const cc = parseAddressList(String(formData.get("cc") ?? ""));
  const bcc = parseAddressList(String(formData.get("bcc") ?? ""));
  const podpisRaw = formData.get("podpis");
  const podpis = (i18n.locales as readonly string[]).includes(podpisRaw as string) ? (podpisRaw as Locale) : null;

  // Załączniki — walidacja MIME/rozmiaru PO STRONIE SERWERA, ten sam duch co
  // app/api/costs/[id]/attachment/route.ts. TYLKO w pamięci, patrz komentarz
  // przy MAIL_ATTACHMENT_* w lib/mail.ts.
  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);
  const attachments: { filename: string; content: Buffer; contentType?: string }[] = [];
  let totalBytes = 0;
  for (const file of files) {
    if (!(MAIL_ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json({ error: `Niedozwolony typ pliku: ${file.name}.` }, { status: 400 });
    }
    if (file.size > MAIL_ATTACHMENT_MAX_FILE_BYTES) {
      return NextResponse.json({ error: `Plik za duży: ${file.name}.` }, { status: 400 });
    }
    totalBytes += file.size;
    if (totalBytes > MAIL_ATTACHMENT_MAX_TOTAL_BYTES) {
      return NextResponse.json({ error: "Łączny rozmiar załączników jest za duży." }, { status: 400 });
    }
    attachments.push({ filename: file.name.slice(0, 300), content: Buffer.from(await file.arrayBuffer()), contentType: file.type || undefined });
  }

  await ensureMailSchema();
  const sql = getSql();

  const rows = (await sql`SELECT * FROM mail_messages WHERE id = ${id};`) as unknown as MailMessage[];
  const original = rows[0];
  if (!original) return NextResponse.json({ error: "not found" }, { status: 404 });

  const subject = forwardSubject(original.subject);
  const originalMeta = {
    fromName: original.from_name,
    fromAddr: original.from_addr,
    receivedAt: original.received_at,
    subject: original.subject,
    toAddr: original.to_addr,
  };

  // Cytowana treść: HTML, gdy oryginał go ma, w przeciwnym razie zwykły tekst
  // opakowany w ten sam blockquote co przy odpowiedzi. `allowImages: true`,
  // bo to NIE jest widok w panelu (blokada zdalnych obrazków chroni przed
  // śledzeniem OTWARCIA w naszym własnym podglądzie) — odbiorca i tak
  // zastosuje własną blokadę w swoim kliencie.
  const { html: sanitizedOriginal } = original.body_html
    ? sanitizeMailHtml(original.body_html, true)
    : { html: textToHtml(original.body_text || "(pusta treść)") };

  const bookingUrl = podpis ? getBookingUrl(podpis) : "";
  const commentText = comment ? `${comment}\n\n` : "";
  const commentHtml = comment ? `${textToHtml(comment)}<br />` : "";

  const fullText = [
    podpis ? `${commentText}${signatureText(podpis, bookingUrl)}\n\n` : commentText,
    forwardHeaderText(originalMeta),
    original.body_text || "",
  ].join("\n");
  const fullHtml = `${commentHtml}${podpis ? `${signatureHtml(podpis, bookingUrl)}<br />` : ""}${forwardHtml(originalMeta, sanitizedOriginal)}`;
  const inlineImages = podpis ? await fetchSignatureImages() : [];

  let sent: { messageId: string; raw: string };
  try {
    sent = await sendMail({ to, cc, bcc, subject, text: fullText, html: fullHtml, inlineImages, attachments });
  } catch (e) {
    console.error("[POST /api/mail/[id]/forward] wysyłka nie powiodła się", e);
    const message = e instanceof Error ? e.message : "Nieznany błąd wysyłki.";
    return NextResponse.json({ error: `Nie udało się przekazać wiadomości: ${message}` }, { status: 502 });
  }

  // Od tego miejsca mail JUŻ poleciał — żaden błąd nie może zwrócić 5xx.
  const warnings: string[] = [];

  const appended = await appendToSent(sent.raw).catch((e) => {
    console.error("[POST /api/mail/[id]/forward] APPEND do Sent nie powiódł się", e);
    return false;
  });
  if (!appended) {
    warnings.push("Wiadomość przekazana, ale nie udało się dopisać kopii do folderu Sent — w Outlooku może jej nie być w „Wysłanych”.");
  }

  const mailId = randomUUID();
  try {
    // Dopasowanie po PIERWSZYM adresie "Do" — patrz komentarz w
    // app/api/mail/compose/route.ts, ten sam wzorzec.
    const match = (await findContactsByEmail(to[0]))[0];
    const clientId = match?.type === "client" ? match.id : null;
    const leadId = match?.type === "lead" ? match.id : null;

    // Przekazanie to ZAWSZE nowy wątek (patrz komentarz na górze pliku) —
    // self-rooted, własny message_id jako thread_id.
    await sql`
      INSERT INTO mail_messages (
        id, kierunek, folder, client_id, lead_id, from_addr, to_addr, cc_addr, bcc_addr,
        subject, body_text, message_id, thread_id, status, received_at, handled_at
      ) VALUES (
        ${mailId}, 'out', 'sent', ${clientId}, ${leadId},
        '', ${to.join(", ")}, ${cc.join(", ")}, ${bcc.join(", ")}, ${subject}, ${comment},
        ${sent.messageId}, ${sent.messageId}, 'obsłużony', now(), now()
      )
      ON CONFLICT (message_id) DO NOTHING;
    `;

    if (match) {
      await logMailOnTimeline(sql, {
        mailId,
        match,
        text: mailSummaryLine(subject, comment || `Przekazano: ${original.subject}`),
        kierunek: "wychodzacy",
      });
    }
  } catch (e) {
    console.error("[POST /api/mail/[id]/forward] zapis wiadomości nie powiódł się", e);
    warnings.push("Wiadomość przekazana, ale nie udało się zapisać jej w panelu — odśwież widok, a jeśli nadal jej nie ma, sprawdź Outlooka.");
  }

  return NextResponse.json({ ok: true, id: mailId, warnings });
}
