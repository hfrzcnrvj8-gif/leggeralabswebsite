import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailSchema } from "@/lib/db";
import { mailSummaryLine, parseAddressList, textToHtml, MAIL_ATTACHMENT_MIME_TYPES, MAIL_ATTACHMENT_MAX_FILE_BYTES, MAIL_ATTACHMENT_MAX_TOTAL_BYTES } from "@/lib/mail";
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

  // FormData zamiast JSON (druga runda Etapu 1 Modułu 4b) — wymagane dla
  // załączników, ten sam duch co app/api/costs/[id]/attachment/route.ts.
  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Nieprawidłowe dane formularza." }, { status: 400 });

  const to = parseAddressList(String(formData.get("to") ?? ""));
  if (to.length === 0) return NextResponse.json({ error: "Adres odbiorcy jest nieprawidłowy." }, { status: 400 });

  const text = String(formData.get("text") ?? "").trim();
  if (!text) return NextResponse.json({ error: "Treść wiadomości nie może być pusta." }, { status: 400 });

  const subject = String(formData.get("subject") ?? "").trim();
  const cc = parseAddressList(String(formData.get("cc") ?? ""));
  const bcc = parseAddressList(String(formData.get("bcc") ?? ""));

  // Język podpisu wybiera właściciel przy pisaniu (decyzja 2026-07-15:
  // przełącznik ręczny, NIE automat po kraju klienta).
  const podpisRaw = formData.get("podpis");
  const podpis = (i18n.locales as readonly string[]).includes(podpisRaw as string) ? (podpisRaw as Locale) : null;

  // Załączniki — walidacja MIME/rozmiaru PO STRONIE SERWERA (obrona w głąb,
  // front już waliduje, ale klientowi nie ufamy), ten sam duch co
  // app/api/costs/[id]/attachment/route.ts. TYLKO w pamięci na czas tego
  // żądania — patrz komentarz przy MAIL_ATTACHMENT_* w lib/mail.ts.
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

  const bookingUrl = podpis ? getBookingUrl(podpis) : "";
  const fullText = podpis ? `${text}\n\n${signatureText(podpis, bookingUrl)}` : text;
  const fullHtml = podpis ? `${textToHtml(text)}<br />${signatureHtml(podpis, bookingUrl)}` : undefined;
  const inlineImages = podpis ? await fetchSignatureImages() : [];

  let sent: { messageId: string; raw: string };
  try {
    sent = await sendMail({ to, cc, bcc, subject, text: fullText, html: fullHtml, inlineImages, attachments });
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
    // Dopasowanie do klienta/leada po PIERWSZYM adresie "Do" — baza wspiera
    // jeden powiązany kontakt na wiadomość, wieloosobowe "Do" nie zmienia
    // tego (świadome ograniczenie zakresu, patrz plan tej rundy).
    const match = (await findContactsByEmail(to[0]))[0];
    const clientId = match?.type === "client" ? match.id : null;
    const leadId = match?.type === "lead" ? match.id : null;

    // Nowa wiadomość to ZAWSZE nowy wątek (patrz komentarz na górze pliku) —
    // self-rooted, własny message_id jako thread_id.
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
