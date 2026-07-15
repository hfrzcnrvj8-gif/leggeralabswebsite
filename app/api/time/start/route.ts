import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureTimeSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { todayLocalISO } from "@/lib/dates";

export const runtime = "nodejs";

/** POST /api/time/start — start stopera dla projektu (opcjonalnie zadania).
 * Panel jednoosobowy: co najwyżej jeden stoper aktywny naraz — jeśli inny już
 * chodzi, jest tu zatrzymywany (a UI informuje o tym właściciela, żeby nie
 * zniknął cicho). Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { project_id?: unknown; task_id?: unknown } | null;
  const projectId = typeof body?.project_id === "string" ? body.project_id : "";
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }
  const taskId = typeof body?.task_id === "string" && body.task_id.trim() ? body.task_id : null;

  await ensureTimeSchema();
  const sql = getSql();

  const runningRows = await sql`
    SELECT id, project_id, started_at FROM time_entries WHERE ended_at IS NULL AND source = 'timer' LIMIT 1;
  `;
  const running = runningRows[0] as { id: string; project_id: string; started_at: string } | undefined;
  let stopped: { id: string; project_id: string; minutes: number } | null = null;

  if (running) {
    const minutesRows = await sql`
      SELECT GREATEST(1, ROUND(EXTRACT(EPOCH FROM (now() - ${running.started_at}::timestamptz)) / 60))::int AS minutes;
    `;
    const minutes = (minutesRows[0]?.minutes as number | undefined) ?? 1;
    await sql`UPDATE time_entries SET ended_at = now(), minutes = ${minutes} WHERE id = ${running.id};`;
    stopped = { id: running.id, project_id: running.project_id, minutes };
  }

  const id = randomUUID();
  await sql`
    INSERT INTO time_entries (id, project_id, task_id, source, entry_date, started_at)
    VALUES (${id}, ${projectId}, ${taskId}, 'timer', ${todayLocalISO()}, now());
  `;
  const activeRows = await sql`SELECT * FROM time_entries WHERE id = ${id};`;

  return NextResponse.json({ ok: true, active: activeRows[0], stopped_previous: stopped });
}
