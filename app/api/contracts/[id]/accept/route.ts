import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureContractsSchema, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/contracts/:id/accept — "oznacz jako podpisaną" z panelu
 * (admin-only) — np. druga strona podpisała papierowo. Brak
 * accepted_by_name oznacza, że to właściciel kliknął w panelu, nie że druga
 * strona podpisała się sama przez publiczny link (patrz public/[token]/accept). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureContractsSchema();
  const sql = getSql();

  const rows = await sql`SELECT * FROM contracts WHERE id = ${id};`;
  const contract = rows[0];
  if (!contract) return NextResponse.json({ error: "not found" }, { status: 404 });

  const claimed = await sql`
    UPDATE contracts SET status = 'Podpisana', accepted_at = now(), updated_at = now()
    WHERE id = ${id} AND status != 'Podpisana'
    RETURNING id;
  `;
  if (claimed.length === 0) return NextResponse.json({ error: "Dokument już podpisany." }, { status: 409 });

  const clientId = typeof contract.client_id === "string" ? contract.client_id : null;
  await logClientEvent(sql, clientId, "contract_signed", `${contract.typ === "nda" ? "NDA" : "Umowa"} oznaczona jako podpisana`, null, id);

  return NextResponse.json({ ok: true });
}
