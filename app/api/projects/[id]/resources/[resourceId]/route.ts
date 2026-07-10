import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** DELETE /api/projects/:id/resources/:resourceId — remove a link. Admin-only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; resourceId: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, resourceId } = await params;
  await ensureHubSchema();
  const sql = getSql();
  await sql`DELETE FROM project_resources WHERE id = ${resourceId} AND project_id = ${id};`;
  return NextResponse.json({ ok: true });
}
