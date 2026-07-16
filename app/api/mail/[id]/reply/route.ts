import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailSchema } from "@/lib/db";
import { buildReferences, mailSummaryLine, parseAddressList, replySubject, textToHtml, type MailMessage } from "@/lib/mail";
import { appendToSent, fetchSignatureImages, isMailboxConfigured, sendMail } from "@/lib/mailbox";
import { logMailOnTimeline } from "@/lib/mailSync";
import { signatureHtml, signatureText } from "@/lib/mailSignature";
import { getBookingUrl } from "@/lib/site";
import { i18n, type Locale } from "@/i18n/config";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/mail/[id]/reply — odpowiedz na wiadomość przez SMTP az.pl.
 *
 * Kolejność kroków jest celowa i wynika z tego, czego NIE da się cofnąć:
 * wysyłka jest nieodwracalna, więc idzie pierwsza i tylko jej błąd przerywa
 * całość. Wszystko po niej (kopia w Sent, zapis, oś kontaktu) to porządki —
 * ich awaria nie może zwrócić błędu, bo klient DOSTAŁ już maila i właściciel
 * musi to widzieć, zamiast kliknąć "wyślij" drugi raz.
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

  const body = (await req.json().catch(() => null)) as
    | { text?: unknown; subject?: unknown; podpis?: unknown; cc?: unknown }
    | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Treść odpowiedzi nie może być pusta." }, { status: 400 });

  // Język podpisu wybiera właściciel przy pisaniu (decyzja 2026-07-15:
  // przełącznik ręczny, NIE automat po kraju klienta — ma wiedzieć, co
  // podpina). `null`/nieznana wartość = bez podpisu.
  const podpis = (i18n.locales as readonly string[]).includes(body?.podpis as string) ? (body!.podpis as Locale) : null;

  // DW — adresy oddzielone przecinkiem/średnikiem, odsiane z pustych.
  const cc = typeof body?.cc === "string" ? parseAddressList(body.cc) : [];

  await ensureMailSchema();
  const sql = getSql();

  const rows = (await sql`SELECT * FROM mail_messages WHERE id = ${id};`) as unknown as MailMessage[];
  const original = rows[0];
  if (!original) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!original.from_addr) {
    return NextResponse.json({ error: "Ta wiadomość nie ma adresu nadawcy — nie ma na nią jak odpisać." }, { status: 400 });
  }

  const subject = typeof body?.subject === "string" && body.subject.trim() ? body.subject.trim() : replySubject(original.subject);
  const references = buildReferences({ message_id: original.message_id, refs: original.refs });

  // Podpis doklejamy TU, a nie w polu edycji: właściciel pisze samą treść, a
  // panel gwarantuje, że stopka jest zawsze aktualna i poprawna. Do bazy
  // (i na oś kontaktu) zapisujemy tekst BEZ podpisu — inaczej każda rozmowa
  // na karcie klienta byłaby zaśmiecona powtórzoną stopką.
  const bookingUrl = podpis ? getBookingUrl(podpis) : "";
  const fullText = podpis ? `${text}\n\n${signatureText(podpis, bookingUrl)}` : text;
  const fullHtml = podpis ? `${textToHtml(text)}<br />${signatureHtml(podpis, bookingUrl)}` : undefined;
  const inlineImages = podpis ? await fetchSignatureImages() : [];

  let sent: { messageId: string; raw: string };
  try {
    sent = await sendMail({
      to: original.from_addr,
      cc,
      subject,
      text: fullText,
      html: fullHtml,
      inlineImages,
      inReplyTo: original.message_id || null,
      references: references || null,
    });
  } catch (e) {
    console.error("[POST /api/mail/[id]/reply] wysyłka nie powiodła się", e);
    const message = e instanceof Error ? e.message : "Nieznany błąd wysyłki.";
    return NextResponse.json({ error: `Nie udało się wysłać odpowiedzi: ${message}` }, { status: 502 });
  }

  // Od tego miejsca mail JUŻ poleciał — żaden błąd nie może zwrócić 5xx.
  const warnings: string[] = [];

  const appended = await appendToSent(sent.raw).catch((e) => {
    console.error("[POST /api/mail/[id]/reply] APPEND do Sent nie powiódł się", e);
    return false;
  });
  if (!appended) {
    warnings.push("Odpowiedź wysłana, ale nie udało się dopisać kopii do folderu Sent — w Outlooku może jej nie być w „Wysłanych”.");
  }

  const replyId = randomUUID();
  try {
    // thread_id: rodzic już go ma (albo, dla wiadomości sprzed migracji
    // wątkowania, jeszcze nie doczekał się backfillu) — nie trzeba całego
    // algorytmu resolveThreadId(), wystarczy przejąć/odziedziczyć.
    const threadId = original.thread_id || original.message_id;
    await sql`
      INSERT INTO mail_messages (
        id, kierunek, folder, client_id, lead_id, invoice_id, from_addr, to_addr,
        subject, body_text, message_id, in_reply_to, refs, thread_id, status, received_at, handled_at
      ) VALUES (
        ${replyId}, 'out', 'sent', ${original.client_id}, ${original.lead_id}, ${original.invoice_id},
        ${original.to_addr}, ${original.from_addr}, ${subject}, ${text},
        ${sent.messageId}, ${original.message_id}, ${references}, ${threadId}, 'obsłużony', now(), now()
      )
      ON CONFLICT (message_id) DO NOTHING;
    `;

    // Odpowiedź zamyka temat — oryginał przestaje być "do odpowiedzi".
    await sql`UPDATE mail_messages SET status = 'obsłużony', handled_at = now() WHERE id = ${id};`;

    // Screener nowych nadawców (Moduł 4, Etap 3) — Odpisz to jedyna akcja
    // jednoznacznie mówiąca "chcę tę rozmowę", więc auto-zatwierdza pending
    // nadawcę. No-op, jeśli nadawca nie był 'pending' (znany kontakt, albo już
    // approved/blocked).
    await sql`UPDATE mail_senders SET status = 'approved', decided_at = now() WHERE email = ${original.from_addr} AND status = 'pending';`;

    const match = original.client_id
      ? ({ type: "client", id: original.client_id } as const)
      : original.lead_id
        ? ({ type: "lead", id: original.lead_id } as const)
        : null;
    if (match) {
      await logMailOnTimeline(sql, {
        mailId: replyId,
        match,
        text: mailSummaryLine(subject, text),
        kierunek: "wychodzacy",
      });
    }
  } catch (e) {
    console.error("[POST /api/mail/[id]/reply] zapis odpowiedzi nie powiódł się", e);
    warnings.push("Odpowiedź wysłana, ale nie udało się zapisać jej w panelu — odśwież widok, a jeśli nadal jej nie ma, sprawdź Outlooka.");
  }

  return NextResponse.json({ ok: true, id: replyId, warnings });
}
