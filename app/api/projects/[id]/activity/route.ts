import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/projects/:id/activity — append a timestamped log entry. Admin-only. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  await ensureHubSchema();
  const sql = getSql();

  const projectRows = await sql`SELECT id FROM projects WHERE id = ${id};`;
  if (!projectRows[0]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const activityId = randomUUID();
  await sql`
    INSERT INTO project_activity (id, project_id, text) VALUES (${activityId}, ${id}, ${text.slice(0, 4000)});
  `;

  const activity = await sql`
    SELECT * FROM project_activity WHERE project_id = ${id} ORDER BY created_at DESC;
  `;

  return NextResponse.json({ ok: true, activity });
}
