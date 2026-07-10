import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/projects/:id/tasks — add a checklist item. Admin-only. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { text?: unknown; milestone_id?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const milestoneId = typeof body?.milestone_id === "string" && body.milestone_id.trim() ? body.milestone_id : null;

  await ensureHubSchema();
  const sql = getSql();

  const countRows = await sql`SELECT COUNT(*)::int AS n FROM project_tasks WHERE project_id = ${id};`;
  const position = (countRows[0]?.n as number | undefined) ?? 0;

  const taskId = randomUUID();
  await sql`
    INSERT INTO project_tasks (id, project_id, text, position, milestone_id)
    VALUES (${taskId}, ${id}, ${text.slice(0, 500)}, ${position}, ${milestoneId});
  `;

  const tasks = await sql`
    SELECT * FROM project_tasks WHERE project_id = ${id} ORDER BY position ASC, created_at ASC;
  `;

  return NextResponse.json({ ok: true, tasks });
}
