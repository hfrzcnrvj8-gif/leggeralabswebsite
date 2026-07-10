import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";

export const runtime = "nodejs";

/** GET /api/projects/:id — project + its checklist + activity log. Admin-only. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureHubSchema();
  const sql = getSql();

  const rows = await sql`SELECT * FROM projects WHERE id = ${id};`;
  const project = rows[0];
  if (!project) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const tasks = await sql`
    SELECT * FROM project_tasks WHERE project_id = ${id} ORDER BY position ASC, created_at ASC;
  `;
  const activity = await sql`
    SELECT * FROM project_activity WHERE project_id = ${id} ORDER BY created_at DESC;
  `;
  const milestones = await sql`
    SELECT * FROM project_milestones WHERE project_id = ${id} ORDER BY position ASC, created_at ASC;
  `;
  const resources = await sql`
    SELECT * FROM project_resources WHERE project_id = ${id} ORDER BY position ASC, created_at ASC;
  `;

  return NextResponse.json({ project, tasks, activity, milestones, resources });
}

/** PATCH /api/projects/:id — update one or more fields. Admin-only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  await ensureHubSchema();
  const sql = getSql();
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  if ("tytul" in body) {
    await sql`UPDATE projects SET tytul = ${str(body.tytul)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("opis" in body) {
    await sql`UPDATE projects SET opis = ${str(body.opis)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("status" in body) {
    await sql`UPDATE projects SET status = ${str(body.status)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("priorytet" in body) {
    await sql`UPDATE projects SET priorytet = ${str(body.priorytet)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("termin" in body) {
    const raw = body.termin;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed && !isPlausibleDateString(trimmed)) {
      return NextResponse.json({ error: "invalid termin" }, { status: 400 });
    }
    const value = trimmed || null;
    await sql`UPDATE projects SET termin = ${value}, updated_at = now() WHERE id = ${id};`;
  }
  if ("lead_id" in body) {
    const raw = body.lead_id;
    const value = typeof raw === "string" && raw.trim() ? raw : null;
    await sql`UPDATE projects SET lead_id = ${value}, updated_at = now() WHERE id = ${id};`;
  }
  if ("zdrowie" in body) {
    await sql`UPDATE projects SET zdrowie = ${str(body.zdrowie)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("start" in body) {
    const raw = body.start;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed && !isPlausibleDateString(trimmed)) {
      return NextResponse.json({ error: "invalid start" }, { status: 400 });
    }
    const value = trimmed || null;
    await sql`UPDATE projects SET start = ${value}, updated_at = now() WHERE id = ${id};`;
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/projects/:id — remove a project (cascades tasks/activity). Admin-only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureHubSchema();
  const sql = getSql();
  await sql`DELETE FROM projects WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
