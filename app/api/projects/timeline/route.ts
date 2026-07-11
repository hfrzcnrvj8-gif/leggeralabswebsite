import { NextResponse } from "next/server";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/projects/timeline — projekty wraz z kamieniami milowymi,
 * spłaszczone pod widok osi czasu (Gantt-lite, styl Linear "Roadmap").
 * Osobny, lekki endpoint, żeby nie obciążać listy używanej przez Kanban. Admin-only. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureHubSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      p.id, p.tytul, p.status, p.zdrowie, p.priorytet, p.start, p.termin, p.created_at, p.kolor, p.ikona,
      COALESCE(
        json_agg(
          json_build_object('id', m.id, 'nazwa', m.nazwa, 'termin', m.termin)
          ORDER BY m.position
        ) FILTER (WHERE m.id IS NOT NULL),
        '[]'
      ) AS milestones
    FROM projects p
    LEFT JOIN project_milestones m ON m.project_id = p.id
    GROUP BY p.id
    ORDER BY p.start ASC NULLS LAST, p.termin ASC NULLS LAST, p.created_at DESC;
  `;
  return NextResponse.json({ projects: rows });
}
