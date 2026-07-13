import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureLeadsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";

export const runtime = "nodejs";

/** GET /api/leads/:id — a single lead plus its activity log. Admin-only. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureLeadsSchema();
  const sql = getSql();

  const leadRows = await sql`SELECT * FROM leads WHERE id = ${id};`;
  const lead = leadRows[0];
  if (!lead) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const activity = await sql`
    SELECT * FROM lead_activity WHERE lead_id = ${id} ORDER BY created_at DESC;
  `;

  return NextResponse.json({ lead, activity });
}

/** PATCH /api/leads/:id — update one or more fields. Admin-only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  await ensureLeadsSchema();
  const sql = getSql();

  const str = (v: unknown) => (typeof v === "string" ? v : "");

  if ("firma" in body) {
    await sql`UPDATE leads SET firma = ${str(body.firma)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("osoba_kontaktowa" in body) {
    await sql`UPDATE leads SET osoba_kontaktowa = ${str(body.osoba_kontaktowa)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("branza" in body) {
    await sql`UPDATE leads SET branza = ${str(body.branza)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("kontakt" in body) {
    await sql`UPDATE leads SET kontakt = ${str(body.kontakt)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("telefon" in body) {
    await sql`UPDATE leads SET telefon = ${str(body.telefon)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("email" in body) {
    await sql`UPDATE leads SET email = ${str(body.email)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("www" in body) {
    await sql`UPDATE leads SET www = ${str(body.www)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("linkedin_url" in body) {
    await sql`UPDATE leads SET linkedin_url = ${str(body.linkedin_url)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("next_action" in body) {
    await sql`UPDATE leads SET next_action = ${str(body.next_action).slice(0, 500)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("ulica" in body) {
    await sql`UPDATE leads SET ulica = ${str(body.ulica)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("kod" in body) {
    await sql`UPDATE leads SET kod = ${str(body.kod)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("miasto" in body) {
    await sql`UPDATE leads SET miasto = ${str(body.miasto)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("kraj" in body) {
    await sql`UPDATE leads SET kraj = ${str(body.kraj)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("zrodlo_kategoria" in body) {
    await sql`UPDATE leads SET zrodlo_kategoria = ${str(body.zrodlo_kategoria)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("zrodlo" in body) {
    await sql`UPDATE leads SET zrodlo = ${str(body.zrodlo)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("status" in body) {
    await sql`UPDATE leads SET status = ${str(body.status)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("notatki" in body) {
    await sql`UPDATE leads SET notatki = ${str(body.notatki)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("ostatni_kontakt" in body) {
    const raw = body.ostatni_kontakt;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed && !isPlausibleDateString(trimmed)) {
      return NextResponse.json({ error: "invalid ostatni_kontakt" }, { status: 400 });
    }
    await sql`UPDATE leads SET ostatni_kontakt = ${trimmed || null}, updated_at = now() WHERE id = ${id};`;
  }
  if ("next_followup" in body) {
    const raw = body.next_followup;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed && !isPlausibleDateString(trimmed)) {
      return NextResponse.json({ error: "invalid next_followup" }, { status: 400 });
    }
    await sql`UPDATE leads SET next_followup = ${trimmed || null}, updated_at = now() WHERE id = ${id};`;
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/leads/:id — remove a lead. Admin-only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureLeadsSchema();
  const sql = getSql();
  await sql`DELETE FROM leads WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
