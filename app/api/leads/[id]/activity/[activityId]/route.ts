import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureLeadsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** DELETE /api/leads/:id/activity/:activityId — remove one log entry (typo correction etc). Admin-only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, activityId } = await params;
  await ensureLeadsSchema();
  const sql = getSql();
  await sql`DELETE FROM lead_activity WHERE id = ${activityId} AND lead_id = ${id};`;
  return NextResponse.json({ ok: true });
}
