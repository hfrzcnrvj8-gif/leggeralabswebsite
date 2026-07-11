import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { VAT_RATES } from "@/lib/invoices";

export const runtime = "nodejs";

/** PATCH /api/invoices/:id/items/:itemId — edytuj pozycję faktury. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { itemId } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  await ensureInvoicesSchema();
  const sql = getSql();

  if ("nazwa" in body) await sql`UPDATE invoice_items SET nazwa = ${typeof body.nazwa === "string" ? body.nazwa.slice(0, 500) : ""} WHERE id = ${itemId};`;
  if ("jednostka" in body) await sql`UPDATE invoice_items SET jednostka = ${typeof body.jednostka === "string" ? body.jednostka.slice(0, 20) : "szt."} WHERE id = ${itemId};`;
  if ("ilosc" in body) {
    const n = Number(body.ilosc);
    await sql`UPDATE invoice_items SET ilosc = ${Number.isFinite(n) && n >= 0 ? n : 0} WHERE id = ${itemId};`;
  }
  if ("cena_netto" in body) {
    const n = Number(body.cena_netto);
    await sql`UPDATE invoice_items SET cena_netto = ${Number.isFinite(n) ? n : 0} WHERE id = ${itemId};`;
  }
  if ("vat_stawka" in body) {
    const v = typeof body.vat_stawka === "string" && (VAT_RATES as readonly string[]).includes(body.vat_stawka) ? body.vat_stawka : "23";
    await sql`UPDATE invoice_items SET vat_stawka = ${v} WHERE id = ${itemId};`;
  }
  return NextResponse.json({ ok: true });
}

/** DELETE /api/invoices/:id/items/:itemId — usuń pozycję. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { itemId } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();
  await sql`DELETE FROM invoice_items WHERE id = ${itemId};`;
  return NextResponse.json({ ok: true });
}
