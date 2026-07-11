import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureOffersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/offers/:id/items — dodaj pozycję do oferty. Admin-only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await ensureOffersSchema();
  const sql = getSql();

  const offer = await sql`SELECT id FROM offers WHERE id = ${id};`;
  if (!offer[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const posRows = await sql`SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM offer_items WHERE offer_id = ${id};`;
  const pos = Number(posRows[0]?.pos ?? 0);
  const itemId = randomUUID();
  const nazwa = typeof body.nazwa === "string" ? body.nazwa.slice(0, 500) : "";
  await sql`
    INSERT INTO offer_items (id, offer_id, nazwa, ilosc, jednostka, cena, position)
    VALUES (${itemId}, ${id}, ${nazwa}, 1, 'szt.', 0, ${pos});
  `;
  const items = await sql`SELECT * FROM offer_items WHERE offer_id = ${id} ORDER BY position ASC;`;
  return NextResponse.json({ ok: true, items: items.map((r) => ({ ...r, ilosc: Number(r.ilosc), cena: Number(r.cena) })) });
}
