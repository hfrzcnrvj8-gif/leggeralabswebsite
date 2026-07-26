import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOffersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** PATCH /api/offers/:id/sections/:sectionId — edycja bloku treści.
 * `position` przyjmujemy wprost, żeby kolejność dała się zmienić strzałkami
 * bez osobnej trasy „przesuń". */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; sectionId: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, sectionId } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  await ensureOffersSchema();
  const sql = getSql();

  if ("tytul" in body) {
    const v = typeof body.tytul === "string" ? body.tytul.slice(0, 200) : "";
    await sql`UPDATE offer_sections SET tytul = ${v} WHERE id = ${sectionId} AND offer_id = ${id};`;
  }
  if ("tresc" in body) {
    const v = typeof body.tresc === "string" ? body.tresc.slice(0, 8000) : "";
    await sql`UPDATE offer_sections SET tresc = ${v} WHERE id = ${sectionId} AND offer_id = ${id};`;
  }
  if ("position" in body) {
    const n = Number(body.position);
    await sql`UPDATE offer_sections SET position = ${Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0} WHERE id = ${sectionId} AND offer_id = ${id};`;
  }
  return NextResponse.json({ ok: true });
}

/** DELETE /api/offers/:id/sections/:sectionId */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; sectionId: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, sectionId } = await params;
  await ensureOffersSchema();
  const sql = getSql();
  await sql`DELETE FROM offer_sections WHERE id = ${sectionId} AND offer_id = ${id};`;
  return NextResponse.json({ ok: true });
}
