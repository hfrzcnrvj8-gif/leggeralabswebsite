import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOffersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** PATCH /api/offers/:id/items/:itemId — edytuj pozycję oferty. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, itemId } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  await ensureOffersSchema();
  const sql = getSql();

  if ("nazwa" in body) await sql`UPDATE offer_items SET nazwa = ${typeof body.nazwa === "string" ? body.nazwa.slice(0, 500) : ""} WHERE id = ${itemId} AND offer_id = ${id};`;
  if ("jednostka" in body) await sql`UPDATE offer_items SET jednostka = ${typeof body.jednostka === "string" ? body.jednostka.slice(0, 20) : "szt."} WHERE id = ${itemId} AND offer_id = ${id};`;
  if ("ilosc" in body) {
    const n = Number(body.ilosc);
    await sql`UPDATE offer_items SET ilosc = ${Number.isFinite(n) && n >= 0 ? n : 0} WHERE id = ${itemId} AND offer_id = ${id};`;
  }
  if ("cena" in body) {
    const n = Number(body.cena);
    await sql`UPDATE offer_items SET cena = ${Number.isFinite(n) ? n : 0} WHERE id = ${itemId} AND offer_id = ${id};`;
  }
  return NextResponse.json({ ok: true });
}

/** DELETE /api/offers/:id/items/:itemId — usuń pozycję. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, itemId } = await params;
  await ensureOffersSchema();
  const sql = getSql();
  await sql`DELETE FROM offer_items WHERE id = ${itemId} AND offer_id = ${id};`;
  return NextResponse.json({ ok: true });
}
