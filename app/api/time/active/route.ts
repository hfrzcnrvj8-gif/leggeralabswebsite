import { NextResponse } from "next/server";
import { getSql, ensureTimeSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/time/active — aktualnie działający stoper (globalnie, panel
 * jednoosobowy = co najwyżej jeden naraz), z nazwą projektu do wskaźnika w
 * AppShell. Admin-only. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await ensureTimeSchema();
  const sql = getSql();

  const rows = await sql`
    SELECT te.*, p.tytul AS project_tytul, pt.text AS task_text
    FROM time_entries te
    JOIN projects p ON p.id = te.project_id
    LEFT JOIN project_tasks pt ON pt.id = te.task_id
    WHERE te.ended_at IS NULL AND te.source = 'timer'
    ORDER BY te.started_at DESC
    LIMIT 1;
  `;

  return NextResponse.json({ ok: true, active: rows[0] ?? null });
}
