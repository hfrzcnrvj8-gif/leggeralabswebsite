import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** DELETE /api/notes/:id/activity/:activityId — remove one log entry. Admin-only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, activityId } = await params;
  await ensureHubSchema();
  const sql = getSql();
  // 404 zamiast kasowania na ślepo — patrz komentarz przy DELETE /api/notes/:id.
  const usuniete = await sql`
    DELETE FROM notes_activity WHERE id = ${activityId} AND note_id = ${id} RETURNING id;
  `;
  if (!usuniete[0]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
