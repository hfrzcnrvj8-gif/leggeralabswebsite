import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailOutboxSchema } from "@/lib/db";
import { parseAddressList, isPlausibleTimestamp } from "@/lib/mail";
import { i18n } from "@/i18n/config";
import type { OutboxRow } from "@/lib/mailOutbox";

export const runtime = "nodejs";

/**
 * GET /api/mail/schedule — co czeka w kolejce.
 *
 * Pokazujemy też wysłane i nieudane (ostatnie 50), a nie tylko oczekujące:
 * „zniknęło z kolejki" jest nie do odróżnienia od „nigdy nie zadziałało",
 * a przy wysyłce odłożonej właściciel MUSI móc sprawdzić, czy mail faktycznie
 * poszedł.
 */
export async function GET(_req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await ensureMailOutboxSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT * FROM mail_outbox
    ORDER BY (status IN ('queued','sending')) DESC, send_at ASC
    LIMIT 50;
  `) as unknown as OutboxRow[];

  return NextResponse.json({ queue: rows });
}

/**
 * POST /api/mail/schedule — odłóż wiadomość na później.
 *
 * **Załączniki są tu świadomie poza zakresem.** Musiałyby czekać w bazie jako
 * bajty — czyli dokładnie to, czego właściciel nie chciał przy załącznikach
 * przychodzących (decyzja 2026-07-20). Odrzucamy je WPROST, komunikatem,
 * zamiast po cichu wysłać maila bez plików: cicha zguba wyszłaby na jaw
 * dopiero u odbiorcy.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    to?: unknown;
    cc?: unknown;
    bcc?: unknown;
    subject?: unknown;
    text?: unknown;
    sendAt?: unknown;
    podpis?: unknown;
    replyToMessageId?: unknown;
    hasAttachments?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  if (body.hasAttachments === true) {
    return NextResponse.json(
      { error: "Wiadomości z załącznikami nie da się odłożyć — wyślij ją od razu." },
      { status: 400 }
    );
  }

  const to = parseAddressList(String(body.to ?? ""));
  if (to.length === 0) return NextResponse.json({ error: "Adres odbiorcy jest nieprawidłowy." }, { status: 400 });

  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Treść wiadomości nie może być pusta." }, { status: 400 });

  // Ta sama walidacja co przy każdej innej dacie w panelu — pułapka
  // <input type="date"> zapisującego rok "0202" (CLAUDE.md). Tu jest
  // szczególnie dotkliwa: zły rok znaczy „nigdy nie wyśle" albo
  // „wyśle natychmiast", a jedno i drugie wychodzi na jaw za późno.
  const sendAtRaw = String(body.sendAt ?? "");
  if (!isPlausibleTimestamp(sendAtRaw)) {
    return NextResponse.json({ error: "Nieprawidłowa data wysyłki." }, { status: 400 });
  }
  const sendAt = new Date(sendAtRaw);
  if (sendAt.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: "Termin wysyłki jest w przeszłości." }, { status: 400 });
  }

  const jezyk = (i18n.locales as readonly string[]).includes(String(body.podpis)) ? String(body.podpis) : "pl";

  await ensureMailOutboxSchema();
  const sql = getSql();

  // Kontekst wątku bierzemy z SERWERA po id wiadomości, a nie z tego, co
  // przyszło w żądaniu — dzięki temu odłożona odpowiedź wpada u odbiorcy
  // w ten sam wątek, a klient nie może wstrzyknąć dowolnych nagłówków.
  let inReplyTo: string | null = null;
  let refs: string | null = null;
  let replyTo = typeof body.replyToMessageId === "string" ? body.replyToMessageId : null;
  if (replyTo) {
    const src = (await sql`SELECT message_id, refs FROM mail_messages WHERE id = ${replyTo};`) as unknown as {
      message_id: string;
      refs: string | null;
    }[];
    if (src[0]) {
      inReplyTo = src[0].message_id;
      refs = src[0].refs ? `${src[0].refs} ${src[0].message_id}` : src[0].message_id;
    } else {
      // Wiadomości nie ma (skasowana przez retencję albo nieaktualne id
      // z otwartego od dawna widoku). Zerujemy powiązanie, bo `reply_to_message_id`
      // to klucz obcy — zapisanie nieistniejącego id kończyło się błędem 500
      // zamiast czytelnego komunikatu (złapane curlem 2026-07-20).
      //
      // Odkładamy mimo to: właściciel napisał treść i wybrał godzinę, więc
      // utrata kontekstu wątku jest mniejszą szkodą niż utrata wiadomości.
      // Jedyny skutek: u odbiorcy trafi jako nowy wątek, nie jako odpowiedź.
      console.warn(`[POST /api/mail/schedule] nieznana wiadomość źródłowa ${replyTo} — odkładam bez kontekstu wątku`);
      replyTo = null;
    }
  }

  const id = randomUUID();
  await sql`
    INSERT INTO mail_outbox (
      id, to_addr, cc_addr, bcc_addr, subject, body_text,
      in_reply_to, refs, reply_to_message_id, jezyk, send_at, status
    ) VALUES (
      ${id}, ${to.join(", ")},
      ${parseAddressList(String(body.cc ?? "")).join(", ")},
      ${parseAddressList(String(body.bcc ?? "")).join(", ")},
      ${String(body.subject ?? "").trim()}, ${text},
      ${inReplyTo}, ${refs}, ${replyTo}, ${jezyk}, ${sendAt.toISOString()}, 'queued'
    );
  `;

  return NextResponse.json({ ok: true, id });
}

/**
 * DELETE /api/mail/schedule?id=... — anuluj przed wysyłką.
 *
 * Warunek `status = 'queued'` jest tu istotny: wiersz zaklepany do wysyłki
 * ('sending') albo już wysłany NIE daje się anulować, bo mail może być
 * w powietrzu albo u odbiorcy. Mówimy o tym wprost zamiast udawać sukces.
 */
export async function DELETE(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = (req.nextUrl.searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "brak id" }, { status: 400 });

  await ensureMailOutboxSchema();
  const sql = getSql();

  const anulowane = (await sql`
    UPDATE mail_outbox SET status = 'cancelled'
    WHERE id = ${id} AND status = 'queued'
    RETURNING id;
  `) as unknown as { id: string }[];

  if (anulowane.length === 0) {
    return NextResponse.json(
      { error: "Tej wiadomości nie da się już anulować — jest w trakcie wysyłki albo została wysłana." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
