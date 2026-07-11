import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureClientsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** DELETE /api/clients/:id/activity/:activityId — usuń jeden wpis z historii kontaktu. Admin-only. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; activityId: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, activityId } = await params;
  await ensureClientsSchema();
  const sql = getSql();
  await sql`DELETE FROM client_activity WHERE id = ${activityId} AND client_id = ${id};`;
  return NextResponse.json({ ok: true });
}
