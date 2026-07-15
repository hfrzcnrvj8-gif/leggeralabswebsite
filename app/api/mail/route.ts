import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailSchema } from "@/lib/db";
import { MAIL_STATUSES, MAIL_CATEGORIES, type MailMessageWithLinks } from "@/lib/mail";
import { isMailboxConfigured } from "@/lib/mailbox";

export const runtime = "nodejs";

/**
 * GET /api/mail?status=nowy&filter=unassigned — lista wiadomości.
 *
 * Nazwy powiązanych rekordów (klient/lead/faktura) dociągamy jednym LEFT JOIN,
 * żeby lista nie musiała odpytywać o każdego klienta osobno.
 * `body_html` świadomie POMIJAMY na liście — bywa ciężki (kilkaset kB przy
 * rozbudowanych mailach), a widać go dopiero w podglądzie pojedynczej
 * wiadomości.
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await ensureMailSchema();
  const sql = getSql();

  const statusParam = req.nextUrl.searchParams.get("status");
  const status = (MAIL_STATUSES as readonly string[]).includes(statusParam || "") ? statusParam : null;
  const unassignedOnly = req.nextUrl.searchParams.get("filter") === "unassigned";
  const katParam = req.nextUrl.searchParams.get("kategoria");
  const kategoria = (MAIL_CATEGORIES as readonly string[]).includes(katParam || "") ? katParam : null;

  // Neon HTTP nie składa fragmentów SQL, więc zamiast budować WHERE
  // dynamicznie, przekazujemy oba filtry jako parametry i wyłączamy je
  // NULL-em (ten sam wzorzec co w innych listach panelu).
  const rows = (await sql`
    SELECT m.id, m.uid, m.kierunek, m.client_id, m.lead_id, m.invoice_id,
           m.from_addr, m.from_name, m.to_addr, m.subject, m.body_text,
           '' AS body_html,
           m.message_id, m.in_reply_to, m.refs, m.status, m.kategoria, m.received_at, m.handled_at,
           c.nazwa AS client_nazwa, l.firma AS lead_nazwa, i.numer AS invoice_numer
    FROM mail_messages m
    LEFT JOIN clients c ON c.id = m.client_id
    LEFT JOIN leads l ON l.id = m.lead_id
    LEFT JOIN invoices i ON i.id = m.invoice_id
    WHERE (${status}::text IS NULL OR m.status = ${status})
      AND (${unassignedOnly} = false OR (m.client_id IS NULL AND m.lead_id IS NULL))
      AND (${kategoria}::text IS NULL OR m.kategoria = ${kategoria})
    ORDER BY m.received_at DESC
    LIMIT 200;
  `) as unknown as MailMessageWithLinks[];

  const [counts] = (await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'nowy' AND kierunek = 'in')::int AS nowe,
      COUNT(*) FILTER (WHERE client_id IS NULL AND lead_id IS NULL AND kierunek = 'in' AND status != 'zignorowany')::int AS nieprzypisane,
      COUNT(*) FILTER (WHERE kategoria = 'oferta' AND status = 'nowy')::int AS zapytania,
      COUNT(*) FILTER (WHERE kategoria = 'rachunek' AND status = 'nowy')::int AS rachunki
    FROM mail_messages;
  `) as unknown as { nowe: number; nieprzypisane: number; zapytania: number; rachunki: number }[];

  return NextResponse.json({ messages: rows, counts, configured: isMailboxConfigured() });
}
