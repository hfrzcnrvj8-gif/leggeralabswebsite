import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/notes/:id/activity — list log entries for a note. Admin-only. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureHubSchema();
  const sql = getSql();
  const activity = await sql`
    SELECT * FROM notes_activity WHERE note_id = ${id} ORDER BY created_at DESC;
  `;
  return NextResponse.json({ activity });
}

/** POST /api/notes/:id/activity — append a timestamped log entry. Admin-only. */
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

  const noteRows = await sql`SELECT id FROM notes WHERE id = ${id};`;
  if (!noteRows[0]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const activityId = randomUUID();
  await sql`
    INSERT INTO notes_activity (id, note_id, text) VALUES (${activityId}, ${id}, ${text.slice(0, 4000)});
  `;

  const activity = await sql`
    SELECT * FROM notes_activity WHERE note_id = ${id} ORDER BY created_at DESC;
  `;

  return NextResponse.json({ ok: true, activity });
}
