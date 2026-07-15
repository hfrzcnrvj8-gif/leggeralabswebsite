import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailSchema } from "@/lib/db";
import { MAIL_STATUSES, mailSummaryLine, type MailMessageWithLinks } from "@/lib/mail";
import { logMailOnTimeline } from "@/lib/mailSync";

export const runtime = "nodejs";

/** GET /api/mail/[id] — pełna wiadomość (z body_html) + wątek. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  await ensureMailSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT m.*, c.nazwa AS client_nazwa, l.firma AS lead_nazwa, i.numer AS invoice_numer
    FROM mail_messages m
    LEFT JOIN clients c ON c.id = m.client_id
    LEFT JOIN leads l ON l.id = m.lead_id
    LEFT JOIN invoices i ON i.id = m.invoice_id
    WHERE m.id = ${id};
  `) as unknown as MailMessageWithLinks[];

  const message = rows[0];
  if (!message) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ message });
}

/**
 * PATCH /api/mail/[id] — zmiana statusu ("Obsłużone"/"Zignoruj"/przywrócenie)
 * albo ręczne przypisanie do klienta/leada z kolejki "Nieprzypisane".
 *
 * Przypisanie dopisuje wiadomość na oś kontaktu wskazanego klienta/leada —
 * inaczej ręcznie przypięty mail byłby widoczny w Poczcie, ale niewidoczny
 * na karcie klienta, czyli dokładnie tam, gdzie właściciel go szuka.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as { status?: unknown; client_id?: unknown; lead_id?: unknown } | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  await ensureMailSchema();
  const sql = getSql();

  const existing = (await sql`SELECT * FROM mail_messages WHERE id = ${id};`) as unknown as {
    id: string;
    subject: string;
    body_text: string;
    client_id: string | null;
    lead_id: string | null;
  }[];
  const mail = existing[0];
  if (!mail) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (typeof body.status === "string") {
    if (!(MAIL_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    // handled_at niesie "kiedy odhaczono" — przy powrocie do "nowy" musi
    // zniknąć, inaczej zostałaby data z poprzedniego odhaczenia.
    const handledAt = body.status === "obsłużony" ? new Date().toISOString() : null;
    await sql`UPDATE mail_messages SET status = ${body.status}, handled_at = ${handledAt} WHERE id = ${id};`;
  }

  // Ręczne przypisanie z kolejki "Nieprzypisane". Zawsze dokładnie jedna
  // strona relacji — przypisanie do klienta czyści leada i odwrotnie.
  const clientId = typeof body.client_id === "string" && body.client_id ? body.client_id : null;
  const leadId = typeof body.lead_id === "string" && body.lead_id ? body.lead_id : null;

  if (clientId || leadId) {
    await sql`UPDATE mail_messages SET client_id = ${clientId}, lead_id = ${leadId} WHERE id = ${id};`;

    // Nie dubluj wpisu, gdy mail był już przypisany do tego samego rekordu.
    const alreadyLinked = (clientId && mail.client_id === clientId) || (leadId && mail.lead_id === leadId);
    if (!alreadyLinked) {
      await logMailOnTimeline(sql, {
        mailId: id,
        match: clientId ? { type: "client", id: clientId } : { type: "lead", id: leadId! },
        text: mailSummaryLine(mail.subject, mail.body_text),
        kierunek: "przychodzacy",
      });
    }
  }

  const updated = (await sql`SELECT * FROM mail_messages WHERE id = ${id};`) as unknown as MailMessageWithLinks[];
  return NextResponse.json({ ok: true, message: updated[0] });
}
