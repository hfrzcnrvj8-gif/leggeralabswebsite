import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureDeviceTokensSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** DELETE /api/admin/devices/:id — odbiera urządzeniu dostęp (revoked_at).
 * Wiersz zostaje jako ślad; kolejne żądania z tym tokenem dostają 401. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureDeviceTokensSchema();
  const sql = getSql();
  await sql`UPDATE device_tokens SET revoked_at = now() WHERE id = ${id} AND revoked_at IS NULL;`;
  return NextResponse.json({ ok: true });
}
