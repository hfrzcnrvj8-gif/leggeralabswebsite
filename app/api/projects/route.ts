import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { getProjectTemplate } from "@/lib/projects";

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const runtime = "nodejs";

/** GET /api/projects — list all projects. Admin-only. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureHubSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT p.*,
      COALESCE(t.total, 0)::int AS task_total,
      COALESCE(t.done, 0)::int AS task_done
    FROM projects p
    LEFT JOIN (
      SELECT project_id, COUNT(*) AS total, COUNT(*) FILTER (WHERE done) AS done
      FROM project_tasks GROUP BY project_id
    ) t ON t.project_id = p.id
    ORDER BY p.created_at DESC;
  `;
  return NextResponse.json({ projects: rows });
}

/** POST /api/projects — create a project. Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const tytul = typeof body?.tytul === "string" ? body.tytul.trim() : "";
  if (!tytul) {
    return NextResponse.json({ error: "tytul is required" }, { status: 400 });
  }

  await ensureHubSchema();
  const sql = getSql();

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const id = randomUUID();
  const status = str(body?.status, 100) || "Pomysł";
  const priorytet = str(body?.priorytet, 50) || "Normalny";
  const leadId = typeof body?.lead_id === "string" && body.lead_id.trim() ? body.lead_id : null;

  // Szablon: rozwijamy kamienie milowe + zadania po stronie serwera (atomowo,
  // jednym żądaniem zamiast wielu z klienta). Start = dziś, termin = ostatni
  // kamień; daty kamieni = dziś + dayOffset. Opis i tytuł mogą wejść z szablonu.
  const template = typeof body?.template === "string" ? getProjectTemplate(body.template) : undefined;
  let opis = str(body?.opis, 4000);
  let start: string | null = null;
  let termin: string | null = typeof body?.termin === "string" && body.termin.trim() ? body.termin : null;

  if (template) {
    if (!opis) opis = template.opis;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastOffset = template.milestones.reduce((mx, m) => Math.max(mx, m.dayOffset), 0);
    start = toLocalISO(today);
    termin = toLocalISO(new Date(today.getTime() + lastOffset * 86400000));
  }

  await sql`
    INSERT INTO projects (id, tytul, opis, status, priorytet, start, termin, lead_id)
    VALUES (${id}, ${tytul.slice(0, 300)}, ${opis}, ${status}, ${priorytet}, ${start}, ${termin}, ${leadId});
  `;

  if (template) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let mPos = 0;
    for (const m of template.milestones) {
      const milestoneId = randomUUID();
      const mTermin = toLocalISO(new Date(today.getTime() + m.dayOffset * 86400000));
      await sql`
        INSERT INTO project_milestones (id, project_id, nazwa, termin, position)
        VALUES (${milestoneId}, ${id}, ${m.nazwa.slice(0, 200)}, ${mTermin}, ${mPos});
      `;
      let tPos = 0;
      for (const taskText of m.tasks) {
        await sql`
          INSERT INTO project_tasks (id, project_id, text, position, milestone_id)
          VALUES (${randomUUID()}, ${id}, ${taskText.slice(0, 1000)}, ${tPos}, ${milestoneId});
        `;
        tPos += 1;
      }
      mPos += 1;
    }
  }

  return NextResponse.json({ ok: true, id });
}
