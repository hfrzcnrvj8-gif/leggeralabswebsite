import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/projects/:id/milestones/reorder — zapis nowej kolejności kamieni
 * milowych (tablica id w docelowej kolejności → position 0,1,2…). Admin-only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === "string") : null;
  if (!ids) return NextResponse.json({ error: "ids required" }, { status: 400 });

  await ensureHubSchema();
  const sql = getSql();
  for (let i = 0; i < ids.length; i++) {
    await sql`UPDATE project_milestones SET position = ${i} WHERE id = ${ids[i]} AND project_id = ${id};`;
  }
  const milestones = await sql`SELECT * FROM project_milestones WHERE project_id = ${id} ORDER BY position ASC, created_at ASC;`;
  return NextResponse.json({ ok: true, milestones });
}
