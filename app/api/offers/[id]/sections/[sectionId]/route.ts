import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOffersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { blokadaOferty } from "@/lib/blokadaDokumentu";
import { odpowiedzBrakRekordu } from "@/lib/brakRekordu";

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

  // Treść wysłanej oferty jest zamknięta — patrz lib/blokadaDokumentu.ts.
  const stanOferty = (await sql`SELECT status FROM offers WHERE id = ${id};`)[0];
  if (!stanOferty) return NextResponse.json({ error: "not found" }, { status: 404 });
  const blokadaTresci = blokadaOferty(String(stanOferty.status ?? ""));
  if (blokadaTresci.zablokowane) {
    return NextResponse.json({ error: blokadaTresci.komunikat }, { status: 409 });
  }

  // Blok mógł zniknąć w drugim oknie panelu — patrz lib/brakRekordu.ts. To
  // najdotkliwszy przypadek z całej dziewiątki: tu przepada TREŚĆ pisana
  // minutami, a nie jedno pole.
  const istnieje = await sql`SELECT 1 FROM offer_sections WHERE id = ${sectionId} AND offer_id = ${id};`;
  if (istnieje.length === 0) return odpowiedzBrakRekordu("blok treści oferty");

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

  // Ta sama blokada co w PATCH wyżej — patrz audyt Modułu 57 (2026-07-27).
  // Skasowanie bloku treści to zmiana dokumentu tak samo jak jego edycja.
  const stanOferty = (await sql`SELECT status FROM offers WHERE id = ${id};`)[0];
  if (!stanOferty) return NextResponse.json({ error: "not found" }, { status: 404 });
  const blokadaTresci = blokadaOferty(String(stanOferty.status ?? ""));
  if (blokadaTresci.zablokowane) {
    return NextResponse.json({ error: blokadaTresci.komunikat }, { status: 409 });
  }

  await sql`DELETE FROM offer_sections WHERE id = ${sectionId} AND offer_id = ${id};`;
  return NextResponse.json({ ok: true });
}
