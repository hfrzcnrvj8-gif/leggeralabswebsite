import { NextResponse } from "next/server";
import { getSql, ensureTimeSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/time/stop — zatrzymuje aktualnie działający stoper (globalnie,
 * panel jednoosobowy). Admin-only. */
export async function POST() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await ensureTimeSchema();
  const sql = getSql();

  const runningRows = await sql`
    SELECT id, project_id, started_at FROM time_entries WHERE ended_at IS NULL AND source = 'timer' LIMIT 1;
  `;
  const running = runningRows[0] as { id: string; project_id: string; started_at: string } | undefined;
  if (!running) {
    return NextResponse.json({ ok: true, stopped: null });
  }

  const minutesRows = await sql`
    SELECT ROUND((EXTRACT(EPOCH FROM (now() - ${running.started_at}::timestamptz)) / 60)::numeric, 2)::float8 AS minutes;
  `;
  const minutes = Math.max(0, (minutesRows[0]?.minutes as number | undefined) ?? 0);
  await sql`UPDATE time_entries SET ended_at = now(), minutes = ${minutes} WHERE id = ${running.id};`;

  return NextResponse.json({ ok: true, stopped: { id: running.id, project_id: running.project_id, minutes } });
}
