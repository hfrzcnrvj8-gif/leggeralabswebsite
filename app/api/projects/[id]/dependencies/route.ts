import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/projects/:id/dependencies — dodaj zależność: ten projekt (:id)
 * ZALEŻY OD depends_on_id (poprzednik). Blokujemy self-zależność i odwrotność
 * (jeśli już B→A, nie pozwalamy A→B), żeby uniknąć cyklu na osi. Admin-only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { depends_on_id?: unknown } | null;
  const dependsOn = typeof body?.depends_on_id === "string" ? body.depends_on_id : "";
  if (!dependsOn) return NextResponse.json({ error: "depends_on_id required" }, { status: 400 });
  if (dependsOn === id) return NextResponse.json({ error: "Projekt nie może zależeć od samego siebie." }, { status: 400 });

  await ensureHubSchema();
  const sql = getSql();

  // Odwrotna zależność już istnieje? → cykl, odmawiamy.
  const reverse = await sql`SELECT id FROM project_dependencies WHERE project_id = ${dependsOn} AND depends_on_id = ${id};`;
  if (reverse[0]) return NextResponse.json({ error: "Odwrotna zależność już istnieje — to utworzyłoby cykl." }, { status: 400 });

  await sql`
    INSERT INTO project_dependencies (id, project_id, depends_on_id)
    VALUES (${randomUUID()}, ${id}, ${dependsOn})
    ON CONFLICT (project_id, depends_on_id) DO NOTHING;
  `;
  const deps = await sql`SELECT depends_on_id FROM project_dependencies WHERE project_id = ${id};`;
  return NextResponse.json({ ok: true, dependencies: deps });
}

/** DELETE /api/projects/:id/dependencies?depends_on_id=... — usuń zależność. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const dependsOn = req.nextUrl.searchParams.get("depends_on_id") ?? "";
  if (!dependsOn) return NextResponse.json({ error: "depends_on_id required" }, { status: 400 });

  await ensureHubSchema();
  const sql = getSql();
  await sql`DELETE FROM project_dependencies WHERE project_id = ${id} AND depends_on_id = ${dependsOn};`;
  const deps = await sql`SELECT depends_on_id FROM project_dependencies WHERE project_id = ${id};`;
  return NextResponse.json({ ok: true, dependencies: deps });
}
