import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureOffersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/offers/:id/sections — nowy blok treści oferty (runda 2 Modułu 57).
 * Bez ciała dokłada pustą sekcję na koniec; z `tytul`/`tresc` wstawia gotową
 * (tak wchodzą sekcje z szablonu). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await ensureOffersSchema();
  const sql = getSql();

  const offer = await sql`SELECT id FROM offers WHERE id = ${id};`;
  if (!offer[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const posRows = await sql`SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM offer_sections WHERE offer_id = ${id};`;
  const pos = Number(posRows[0]?.pos ?? 0);
  await sql`
    INSERT INTO offer_sections (id, offer_id, tytul, tresc, position)
    VALUES (
      ${randomUUID()}, ${id},
      ${typeof body.tytul === "string" ? body.tytul.slice(0, 200) : ""},
      ${typeof body.tresc === "string" ? body.tresc.slice(0, 8000) : ""},
      ${pos}
    );
  `;
  const sections = await sql`SELECT * FROM offer_sections WHERE offer_id = ${id} ORDER BY position ASC;`;
  return NextResponse.json({ ok: true, sections });
}
