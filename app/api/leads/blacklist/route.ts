import { NextResponse } from "next/server";
import { getSql, ensureLeadHunterSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/leads/blacklist — kto został przekreślony i dlaczego.
 *
 * **Po co to w ogóle istnieje.** Do 2026-07-25 czarna lista była zapisem
 * tylko-do-zapisu: „Odrzuć" dopisywał firmę na zawsze, a właściciel nie miał
 * jak zobaczyć, kogo tam wpisał, ani cofnąć machnięcia palcem zrobionego
 * w kolejce po kawę. Nieodwracalna akcja bez podglądu i bez wyjścia to ten sam
 * rodzaj długu, co pole zapisywane i nigdy nieczytane (ustalenie 3 Audytu 4) —
 * z tą różnicą, że tutaj kosztem jest firma, do której już nigdy się nie
 * odezwiemy.
 */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureLeadHunterSchema();
  const sql = getSql();
  const blacklist = await sql`
    SELECT id, nip, nazwa_norm, powod, created_at FROM lead_blacklist ORDER BY created_at DESC LIMIT 500;
  `;
  return NextResponse.json({ blacklist });
}
