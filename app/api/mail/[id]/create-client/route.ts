import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailSchema, ensureClientsSchema, logClientEvent } from "@/lib/db";
import { mailSummaryLine, type MailMessage } from "@/lib/mail";
import { findContactsByEmail } from "@/lib/contactLookup";
import { logMailOnTimeline } from "@/lib/mailSync";
import { todayLocalISO } from "@/lib/dates";

export const runtime = "nodejs";

/**
 * POST /api/mail/[id]/create-client — "Utwórz klienta z tego maila".
 *
 * Bliźniak `create-lead`, ale dla sytuacji, gdy piszący to NIE jest ktoś do
 * przepchnięcia przez lejek sprzedaży, tylko od razu realna relacja
 * (właściciel poprosił 2026-07-15). Dwie osobne ścieżki, bo to dwie różne
 * decyzje biznesowe — panel nie zgaduje, którą wybrać.
 *
 * Status "Prospekt" (domyślny dla `clients`), a nie "Aktywny": klient z maila
 * jeszcze niczego nie kupił. Awansuje go dopiero oferta/faktura, jak każdego
 * innego — patrz CLIENT_STATUSES w lib/clients.ts.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as { nazwa?: unknown } | null;

  await ensureMailSchema();
  await ensureClientsSchema();
  const sql = getSql();

  const rows = (await sql`SELECT * FROM mail_messages WHERE id = ${id};`) as unknown as MailMessage[];
  const mail = rows[0];
  if (!mail) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!mail.from_addr) {
    return NextResponse.json({ error: "Ta wiadomość nie ma adresu nadawcy — nie da się z niej zrobić klienta." }, { status: 400 });
  }
  if (mail.client_id || mail.lead_id) {
    return NextResponse.json({ error: "Ta wiadomość jest już przypisana do klienta lub leada." }, { status: 400 });
  }

  // Ktoś mógł założyć ten kontakt ręcznie w międzyczasie (albo kliknąć dwa
  // razy) — przypnij do istniejącego zamiast robić duplikat.
  const existing = (await findContactsByEmail(mail.from_addr))[0];
  if (existing) {
    const clientId = existing.type === "client" ? existing.id : null;
    const leadId = existing.type === "lead" ? existing.id : null;
    await sql`UPDATE mail_messages SET client_id = ${clientId}, lead_id = ${leadId} WHERE id = ${id};`;
    await logMailOnTimeline(sql, {
      mailId: id,
      match: existing,
      text: mailSummaryLine(mail.subject, mail.body_text),
      kierunek: "przychodzacy",
    });
    return NextResponse.json({ ok: true, reused: true, type: existing.type, id: existing.id, nazwa: existing.nazwa });
  }

  // Nazwa: to, co podał właściciel → nazwa z nagłówka "From" → domena bez TLD
  // → sam adres. Zawsze coś sensownego do poprawienia na karcie.
  const domain = mail.from_addr.split("@")[1] || "";
  const fromDomain = domain.split(".")[0] || "";
  const nazwa =
    (typeof body?.nazwa === "string" && body.nazwa.trim()) ||
    mail.from_name.trim() ||
    (fromDomain ? fromDomain.charAt(0).toUpperCase() + fromDomain.slice(1) : "") ||
    mail.from_addr;

  const clientId = randomUUID();
  const today = todayLocalISO();
  const notatki = `Klient utworzony z wiadomości e-mail.\n\nTemat: ${mail.subject || "(bez tematu)"}\n\n${(mail.body_text || "").slice(0, 3000)}`;

  await sql`
    INSERT INTO clients (id, nazwa, osoba_kontaktowa, email, www, zrodlo_kategoria, zrodlo, ostatni_kontakt, ostatni_kanal, notatki)
    VALUES (
      ${clientId}, ${nazwa.slice(0, 200)}, ${mail.from_name.slice(0, 200)}, ${mail.from_addr.slice(0, 200)},
      ${domain.slice(0, 200)}, 'Inbound', 'E-mail', ${today}, 'email', ${notatki}
    );
  `;

  // Oś czasu klienta zaczyna się od momentu jego powstania — ten sam wzorzec
  // co przy awansie leada (patrz app/api/leads/[id]/promote).
  await logClientEvent(sql, clientId, "client_created", `Klient utworzony z wiadomości e-mail od ${mail.from_addr}`);

  await sql`UPDATE mail_messages SET client_id = ${clientId} WHERE id = ${id};`;

  await logMailOnTimeline(sql, {
    mailId: id,
    match: { type: "client", id: clientId },
    text: mailSummaryLine(mail.subject, mail.body_text),
    kierunek: "przychodzacy",
  });

  return NextResponse.json({ ok: true, reused: false, type: "client", id: clientId, nazwa });
}
