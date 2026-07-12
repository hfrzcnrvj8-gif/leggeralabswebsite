import { NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** DELETE /api/catalog/:id — usuń pozycję z katalogu (nie rusza faktur, które
 * z niej korzystały — pozycje faktur to niezależne kopie). Admin-only. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();
  await sql`DELETE FROM service_catalog WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
