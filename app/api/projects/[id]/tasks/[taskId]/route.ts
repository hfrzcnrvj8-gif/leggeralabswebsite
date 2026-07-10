import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** PATCH /api/projects/:id/tasks/:taskId — toggle done / edit text. Admin-only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, taskId } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  await ensureHubSchema();
  const sql = getSql();

  if ("done" in body) {
    await sql`UPDATE project_tasks SET done = ${Boolean(body.done)} WHERE id = ${taskId} AND project_id = ${id};`;
  }
  if ("text" in body && typeof body.text === "string") {
    await sql`UPDATE project_tasks SET text = ${body.text.slice(0, 500)} WHERE id = ${taskId} AND project_id = ${id};`;
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/projects/:id/tasks/:taskId — remove a checklist item. Admin-only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, taskId } = await params;
  await ensureHubSchema();
  const sql = getSql();
  await sql`DELETE FROM project_tasks WHERE id = ${taskId} AND project_id = ${id};`;
  return NextResponse.json({ ok: true });
}
