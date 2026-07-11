import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString, formatPlDate } from "@/lib/projects";

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
  const dependencies = await sql`SELECT depends_on_id FROM project_dependencies WHERE project_id = ${id};`;

  return NextResponse.json({ project, tasks, activity, milestones, resources, dependencies });
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

  // Stan sprzed zmiany — potrzebny do automatycznego logu aktywności
  // ("Status: X → Y"). Bez tego log nie wiedziałby, co było wcześniej.
  const current = (await sql`SELECT * FROM projects WHERE id = ${id};`)[0] as
    | Record<string, unknown>
    | undefined;

  // Zbieramy czytelne opisy zmian pól śledzonych na osi historii projektu.
  const changes: string[] = [];
  const norm = (v: unknown) => (v == null ? "" : String(v));
  const dateLabel = (v: string) => (v ? formatPlDate(v) : "—");

  if ("tytul" in body) {
    await sql`UPDATE projects SET tytul = ${str(body.tytul)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("opis" in body) {
    await sql`UPDATE projects SET opis = ${str(body.opis)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("status" in body) {
    const nv = str(body.status);
    if (current && norm(current.status) !== nv) changes.push(`Status: ${norm(current.status) || "—"} → ${nv}`);
    await sql`UPDATE projects SET status = ${nv}, updated_at = now() WHERE id = ${id};`;
  }
  if ("priorytet" in body) {
    const nv = str(body.priorytet);
    if (current && norm(current.priorytet) !== nv) changes.push(`Priorytet: ${norm(current.priorytet) || "—"} → ${nv}`);
    await sql`UPDATE projects SET priorytet = ${nv}, updated_at = now() WHERE id = ${id};`;
  }
  if ("zdrowie" in body) {
    const nv = str(body.zdrowie);
    if (current && norm(current.zdrowie) !== nv) changes.push(`Zdrowie: ${norm(current.zdrowie) || "—"} → ${nv}`);
    await sql`UPDATE projects SET zdrowie = ${nv}, updated_at = now() WHERE id = ${id};`;
  }
  if ("termin" in body) {
    const raw = body.termin;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed && !isPlausibleDateString(trimmed)) {
      return NextResponse.json({ error: "invalid termin" }, { status: 400 });
    }
    const value = trimmed || null;
    const oldD = norm(current?.termin).slice(0, 10);
    const newD = value ? value.slice(0, 10) : "";
    if (current && oldD !== newD) changes.push(`Termin: ${dateLabel(oldD)} → ${dateLabel(newD)}`);
    await sql`UPDATE projects SET termin = ${value}, updated_at = now() WHERE id = ${id};`;
  }
  if ("start" in body) {
    const raw = body.start;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed && !isPlausibleDateString(trimmed)) {
      return NextResponse.json({ error: "invalid start" }, { status: 400 });
    }
    const value = trimmed || null;
    const oldD = norm(current?.start).slice(0, 10);
    const newD = value ? value.slice(0, 10) : "";
    if (current && oldD !== newD) changes.push(`Start: ${dateLabel(oldD)} → ${dateLabel(newD)}`);
    await sql`UPDATE projects SET start = ${value}, updated_at = now() WHERE id = ${id};`;
  }
  if ("lead_id" in body) {
    const raw = body.lead_id;
    const value = typeof raw === "string" && raw.trim() ? raw : null;
    await sql`UPDATE projects SET lead_id = ${value}, updated_at = now() WHERE id = ${id};`;
  }
  if ("kolor" in body) {
    const value = typeof body.kolor === "string" && body.kolor.trim() ? body.kolor.slice(0, 20) : null;
    await sql`UPDATE projects SET kolor = ${value}, updated_at = now() WHERE id = ${id};`;
  }
  if ("ikona" in body) {
    const value = typeof body.ikona === "string" && body.ikona.trim() ? body.ikona.slice(0, 16) : null;
    await sql`UPDATE projects SET ikona = ${value}, updated_at = now() WHERE id = ${id};`;
  }

  // Dopisz automatyczne wpisy „system" do logu aktywności (audyt zmian).
  for (const text of changes) {
    await sql`
      INSERT INTO project_activity (id, project_id, text, kind)
      VALUES (${randomUUID()}, ${id}, ${text}, 'system');
    `;
  }

  const activity = await sql`
    SELECT * FROM project_activity WHERE project_id = ${id} ORDER BY created_at DESC;
  `;
  return NextResponse.json({ ok: true, activity });
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
