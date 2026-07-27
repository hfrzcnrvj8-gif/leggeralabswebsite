import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOffersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { blokadaOferty } from "@/lib/blokadaDokumentu";

export const runtime = "nodejs";

/** PATCH /api/offers/:id/items/:itemId — edytuj pozycję oferty. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, itemId } = await params;
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

  if ("nazwa" in body) await sql`UPDATE offer_items SET nazwa = ${typeof body.nazwa === "string" ? body.nazwa.slice(0, 500) : ""} WHERE id = ${itemId} AND offer_id = ${id};`;
  if ("jednostka" in body) await sql`UPDATE offer_items SET jednostka = ${typeof body.jednostka === "string" ? body.jednostka.slice(0, 20) : "szt."} WHERE id = ${itemId} AND offer_id = ${id};`;
  if ("ilosc" in body) {
    const n = Number(body.ilosc);
    await sql`UPDATE offer_items SET ilosc = ${Number.isFinite(n) && n >= 0 ? n : 0} WHERE id = ${itemId} AND offer_id = ${id};`;
  }
  if ("position" in body) {
    const n = Number(body.position);
    await sql`UPDATE offer_items SET position = ${Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0} WHERE id = ${itemId} AND offer_id = ${id};`;
  }
  if ("opcjonalna" in body) {
    const v = body.opcjonalna === true;
    // Zdjęcie „opcjonalnej" czyści wybór klienta — pozycja obowiązkowa liczy
    // się zawsze, więc `wybrana` przestaje cokolwiek znaczyć i zostawienie
    // starej wartości myliłoby tylko przy ponownym włączeniu.
    await sql`UPDATE offer_items SET opcjonalna = ${v}, wybrana = ${v ? false : false} WHERE id = ${itemId} AND offer_id = ${id};`;
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

  // Ta sama blokada co w PATCH wyżej. Audyt Modułu 57 (2026-07-27) złapał tu
  // dziurę: PATCH odmawiał, DELETE przechodził — czyli ceny wysłanej oferty
  // nie dało się zmienić, ale całą pozycję dało się usunąć. Blokada per PLIK
  // by tego nie zobaczyła, bo plik „wspomina" blokadę w drugim uchwycie.
  const stanOferty = (await sql`SELECT status FROM offers WHERE id = ${id};`)[0];
  if (!stanOferty) return NextResponse.json({ error: "not found" }, { status: 404 });
  const blokadaTresci = blokadaOferty(String(stanOferty.status ?? ""));
  if (blokadaTresci.zablokowane) {
    return NextResponse.json({ error: blokadaTresci.komunikat }, { status: 409 });
  }

  await sql`DELETE FROM offer_items WHERE id = ${itemId} AND offer_id = ${id};`;
  return NextResponse.json({ ok: true });
}
