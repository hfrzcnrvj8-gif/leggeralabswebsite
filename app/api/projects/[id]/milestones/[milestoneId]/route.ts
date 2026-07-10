import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";

export const runtime = "nodejs";

/** PATCH /api/projects/:id/milestones/:milestoneId — rename / reschedule. Admin-only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, milestoneId } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  await ensureHubSchema();
  const sql = getSql();

  if ("nazwa" in body && typeof body.nazwa === "string") {
    await sql`UPDATE project_milestones SET nazwa = ${body.nazwa.slice(0, 200)} WHERE id = ${milestoneId} AND project_id = ${id};`;
  }
  if ("termin" in body) {
    const raw = body.termin;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed && !isPlausibleDateString(trimmed)) {
      return NextResponse.json({ error: "invalid termin" }, { status: 400 });
    }
    const value = trimmed || null;
    await sql`UPDATE project_milestones SET termin = ${value} WHERE id = ${milestoneId} AND project_id = ${id};`;
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/projects/:id/milestones/:milestoneId — remove a milestone
 * (tasks under it fall back to "unmilestoned", they aren't deleted). Admin-only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, milestoneId } = await params;
  await ensureHubSchema();
  const sql = getSql();
  await sql`DELETE FROM project_milestones WHERE id = ${milestoneId} AND project_id = ${id};`;
  return NextResponse.json({ ok: true });
}
