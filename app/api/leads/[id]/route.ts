import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureLeadsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

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
  if ("branza" in body) {
    await sql`UPDATE leads SET branza = ${str(body.branza)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("kontakt" in body) {
    await sql`UPDATE leads SET kontakt = ${str(body.kontakt)}, updated_at = now() WHERE id = ${id};`;
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
    const value = typeof raw === "string" && raw.trim() ? raw : null;
    await sql`UPDATE leads SET ostatni_kontakt = ${value}, updated_at = now() WHERE id = ${id};`;
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
