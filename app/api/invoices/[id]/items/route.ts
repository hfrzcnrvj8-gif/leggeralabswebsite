import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/invoices/:id/items — dodaj pozycję do faktury. Admin-only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await ensureInvoicesSchema();
  const sql = getSql();

  const inv = await sql`SELECT id FROM invoices WHERE id = ${id};`;
  if (!inv[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const posRows = await sql`SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM invoice_items WHERE invoice_id = ${id};`;
  const pos = Number(posRows[0]?.pos ?? 0);
  const itemId = randomUUID();
  const nazwa = typeof body.nazwa === "string" ? body.nazwa.slice(0, 500) : "";
  await sql`
    INSERT INTO invoice_items (id, invoice_id, nazwa, ilosc, jednostka, cena_netto, vat_stawka, position)
    VALUES (${itemId}, ${id}, ${nazwa}, 1, 'szt.', 0, '23', ${pos});
  `;
  const items = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${id} ORDER BY position ASC;`;
  return NextResponse.json({ ok: true, items: items.map((r) => ({ ...r, ilosc: Number(r.ilosc), cena_netto: Number(r.cena_netto) })) });
}
