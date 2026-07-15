import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailSchema } from "@/lib/db";
import { mailSummaryLine, type MailMessage } from "@/lib/mail";
import { findContactsByEmail } from "@/lib/contactLookup";
import { logMailOnTimeline } from "@/lib/mailSync";
import { todayLocalISO } from "@/lib/dates";

export const runtime = "nodejs";

/**
 * POST /api/mail/[id]/create-lead — "Inbound = nowy lead" (pomysł 4 z briefu,
 * wybrany przez właściciela 2026-07-15).
 *
 * Mail z nieznanego adresu jednym kliknięciem staje się leadem: zapytanie nie
 * ginie i od razu wchodzi w istniejący proces (status "Nowe zgłoszenie ze
 * strony" jest w lib/leads.ts natychmiast `isOverdue`, więc ląduje na
 * Pulpicie jako "do zrobienia dziś").
 *
 * Nazwa firmy jest zgadywana z domeny nadawcy — ale to zgadywanie jawne i
 * deterministyczne (nie AI), a właściciel poprawi ją na karcie leada.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as { firma?: unknown } | null;

  await ensureMailSchema();
  const sql = getSql();

  const rows = (await sql`SELECT * FROM mail_messages WHERE id = ${id};`) as unknown as MailMessage[];
  const mail = rows[0];
  if (!mail) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!mail.from_addr) {
    return NextResponse.json({ error: "Ta wiadomość nie ma adresu nadawcy — nie da się z niej zrobić leada." }, { status: 400 });
  }
  if (mail.client_id || mail.lead_id) {
    return NextResponse.json({ error: "Ta wiadomość jest już przypisana do klienta lub leada." }, { status: 400 });
  }

  // Ktoś mógł w międzyczasie założyć ten kontakt ręcznie (albo kliknąć dwa
  // razy) — wtedy przypnij do istniejącego zamiast tworzyć duplikat.
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

  // Nazwa firmy: to, co podał właściciel → nazwa z nagłówka "From" → domena
  // (bez TLD) → sam adres. Zawsze coś sensownego do poprawienia ręcznie.
  const domain = mail.from_addr.split("@")[1] || "";
  const fromDomain = domain.split(".")[0] || "";
  const firma =
    (typeof body?.firma === "string" && body.firma.trim()) ||
    mail.from_name.trim() ||
    (fromDomain ? fromDomain.charAt(0).toUpperCase() + fromDomain.slice(1) : "") ||
    mail.from_addr;

  const leadId = randomUUID();
  const today = todayLocalISO();
  const notatki = `Lead utworzony z wiadomości e-mail.\n\nTemat: ${mail.subject || "(bez tematu)"}\n\n${(mail.body_text || "").slice(0, 3000)}`;

  await sql`
    INSERT INTO leads (id, firma, osoba_kontaktowa, email, zrodlo_kategoria, zrodlo, status, ostatni_kontakt, ostatni_kanal, notatki)
    VALUES (
      ${leadId}, ${firma.slice(0, 200)}, ${mail.from_name.slice(0, 200)}, ${mail.from_addr.slice(0, 200)},
      'Inbound', 'E-mail', 'Nowe zgłoszenie ze strony', ${today}, 'email', ${notatki}
    );
  `;

  await sql`UPDATE mail_messages SET lead_id = ${leadId} WHERE id = ${id};`;

  await logMailOnTimeline(sql, {
    mailId: id,
    match: { type: "lead", id: leadId },
    text: mailSummaryLine(mail.subject, mail.body_text),
    kierunek: "przychodzacy",
  });

  return NextResponse.json({ ok: true, reused: false, type: "lead", id: leadId, nazwa: firma });
}
