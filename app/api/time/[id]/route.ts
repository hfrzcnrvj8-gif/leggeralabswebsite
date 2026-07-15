import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureTimeSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";

export const runtime = "nodejs";

/** PATCH /api/time/:id — edycja ręcznego wpisu (minuty/zadanie/data/notatka). Admin-only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | { task_id?: unknown; minutes?: unknown; entry_date?: unknown; note?: unknown }
    | null;

  await ensureTimeSchema();
  const sql = getSql();

  const existingRows = await sql`SELECT * FROM time_entries WHERE id = ${id};`;
  const existing = existingRows[0] as { project_id: string; task_id: string | null; minutes: number; entry_date: string; note: string } | undefined;
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const minutes = typeof body?.minutes === "number" && Number.isFinite(body.minutes) && body.minutes > 0
    ? Math.round(body.minutes)
    : existing.minutes;
  const taskId = body && "task_id" in body
    ? (typeof body.task_id === "string" && body.task_id.trim() ? body.task_id : null)
    : existing.task_id;
  const entryDate = typeof body?.entry_date === "string" && isPlausibleDateString(body.entry_date)
    ? body.entry_date
    : existing.entry_date;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : existing.note;

  await sql`
    UPDATE time_entries
    SET task_id = ${taskId}, minutes = ${minutes}, entry_date = ${entryDate}, note = ${note}
    WHERE id = ${id};
  `;

  const entries = await sql`
    SELECT * FROM time_entries WHERE project_id = ${existing.project_id} ORDER BY entry_date DESC, created_at DESC;
  `;

  return NextResponse.json({ ok: true, entries });
}

/** DELETE /api/time/:id — usunięcie wpisu czasu. Admin-only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  await ensureTimeSchema();
  const sql = getSql();

  const existingRows = await sql`SELECT project_id FROM time_entries WHERE id = ${id};`;
  const projectId = (existingRows[0] as { project_id: string } | undefined)?.project_id;
  if (!projectId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await sql`DELETE FROM time_entries WHERE id = ${id};`;

  const entries = await sql`
    SELECT * FROM time_entries WHERE project_id = ${projectId} ORDER BY entry_date DESC, created_at DESC;
  `;

  return NextResponse.json({ ok: true, entries });
}
