import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailSchema } from "@/lib/db";
import { buildReferences, mailSummaryLine, replySubject, type MailMessage } from "@/lib/mail";
import { appendToSent, isMailboxConfigured, sendReply } from "@/lib/mailbox";
import { logMailOnTimeline } from "@/lib/mailSync";

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

  const body = (await req.json().catch(() => null)) as { text?: unknown; subject?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Treść odpowiedzi nie może być pusta." }, { status: 400 });

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

  let sent: { messageId: string; raw: string };
  try {
    sent = await sendReply({
      to: original.from_addr,
      subject,
      text,
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
    await sql`
      INSERT INTO mail_messages (
        id, kierunek, client_id, lead_id, invoice_id, from_addr, to_addr,
        subject, body_text, message_id, in_reply_to, refs, status, received_at, handled_at
      ) VALUES (
        ${replyId}, 'out', ${original.client_id}, ${original.lead_id}, ${original.invoice_id},
        ${original.to_addr}, ${original.from_addr}, ${subject}, ${text},
        ${sent.messageId}, ${original.message_id}, ${references}, 'obsłużony', now(), now()
      )
      ON CONFLICT (message_id) DO NOTHING;
    `;

    // Odpowiedź zamyka temat — oryginał przestaje być "do odpowiedzi".
    await sql`UPDATE mail_messages SET status = 'obsłużony', handled_at = now() WHERE id = ${id};`;

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
