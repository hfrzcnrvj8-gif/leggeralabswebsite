import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** DELETE /api/invoices/:id/payments/:paymentId — usuwa zarejestrowaną wpłatę. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { paymentId } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();
  await sql`DELETE FROM invoice_payments WHERE id = ${paymentId};`;
  return NextResponse.json({ ok: true });
}
