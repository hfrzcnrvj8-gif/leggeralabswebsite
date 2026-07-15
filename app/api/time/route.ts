import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureTimeSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { todayLocalISO } from "@/lib/dates";

export const runtime = "nodejs";

/** GET /api/time?project_id=... — lista wpisów czasu dla projektu. Admin-only. */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const projectId = req.nextUrl.searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  await ensureTimeSchema();
  const sql = getSql();

  const entries = await sql`
    SELECT id, project_id, task_id, source, entry_date, started_at, ended_at, minutes::float8 AS minutes, note, created_at
    FROM time_entries WHERE project_id = ${projectId} ORDER BY entry_date DESC, created_at DESC;
  `;

  return NextResponse.json({ ok: true, entries });
}

/** POST /api/time — ręczny wpis czasu ("X godzin przy projekcie/zadaniu"). Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { project_id?: unknown; task_id?: unknown; minutes?: unknown; entry_date?: unknown; note?: unknown }
    | null;

  const projectId = typeof body?.project_id === "string" ? body.project_id : "";
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }
  const minutes = typeof body?.minutes === "number" ? Math.round(body.minutes) : NaN;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return NextResponse.json({ error: "minutes must be a positive number" }, { status: 400 });
  }
  const taskId = typeof body?.task_id === "string" && body.task_id.trim() ? body.task_id : null;
  const entryDateRaw = typeof body?.entry_date === "string" ? body.entry_date : "";
  const entryDate = isPlausibleDateString(entryDateRaw) ? entryDateRaw : todayLocalISO();
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";

  await ensureTimeSchema();
  const sql = getSql();

  const id = randomUUID();
  await sql`
    INSERT INTO time_entries (id, project_id, task_id, source, entry_date, minutes, note)
    VALUES (${id}, ${projectId}, ${taskId}, 'manual', ${entryDate}, ${minutes}, ${note});
  `;

  const entries = await sql`
    SELECT id, project_id, task_id, source, entry_date, started_at, ended_at, minutes::float8 AS minutes, note, created_at
    FROM time_entries WHERE project_id = ${projectId} ORDER BY entry_date DESC, created_at DESC;
  `;

  return NextResponse.json({ ok: true, entries });
}
