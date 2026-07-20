import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";

export const runtime = "nodejs";

/** POST /api/projects/:id/milestones — add a milestone. Admin-only. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { nazwa?: unknown; termin?: unknown } | null;
  const nazwa = typeof body?.nazwa === "string" ? body.nazwa.trim() : "";
  if (!nazwa) {
    return NextResponse.json({ error: "nazwa is required" }, { status: 400 });
  }
  // Walidacja terminu — dokładnie ta sama, co w PATCH tego kamienia.
  // Do 2026-07-20 zakładanie kamienia jej NIE MIAŁO: `<input type="date">`
  // potrafi oddać niepełny rok („0202"), więc rok, którego edycja by nie
  // przyjęła, wchodził do bazy przez dodawanie (znana pułapka, CLAUDE.md).
  const terminRaw = typeof body?.termin === "string" ? body.termin.trim() : "";
  if (terminRaw && !isPlausibleDateString(terminRaw)) {
    return NextResponse.json({ error: "invalid termin" }, { status: 400 });
  }
  const termin = terminRaw || null;

  await ensureHubSchema();
  const sql = getSql();

  const countRows = await sql`SELECT COUNT(*)::int AS n FROM project_milestones WHERE project_id = ${id};`;
  const position = (countRows[0]?.n as number | undefined) ?? 0;

  const milestoneId = randomUUID();
  await sql`
    INSERT INTO project_milestones (id, project_id, nazwa, termin, position)
    VALUES (${milestoneId}, ${id}, ${nazwa.slice(0, 200)}, ${termin}, ${position});
  `;

  const milestones = await sql`
    SELECT * FROM project_milestones WHERE project_id = ${id} ORDER BY position ASC, created_at ASC;
  `;

  return NextResponse.json({ ok: true, milestones });
}
