import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/projects/:id/resources — attach a link (Figma, doc, notes). Admin-only. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { etykieta?: unknown; url?: unknown } | null;
  const etykieta = typeof body?.etykieta === "string" ? body.etykieta.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!etykieta || !url) {
    return NextResponse.json({ error: "etykieta and url are required" }, { status: 400 });
  }

  await ensureHubSchema();
  const sql = getSql();

  const countRows = await sql`SELECT COUNT(*)::int AS n FROM project_resources WHERE project_id = ${id};`;
  const position = (countRows[0]?.n as number | undefined) ?? 0;

  const resourceId = randomUUID();
  await sql`
    INSERT INTO project_resources (id, project_id, etykieta, url, position)
    VALUES (${resourceId}, ${id}, ${etykieta.slice(0, 200)}, ${url.slice(0, 1000)}, ${position});
  `;

  const resources = await sql`
    SELECT * FROM project_resources WHERE project_id = ${id} ORDER BY position ASC, created_at ASC;
  `;

  return NextResponse.json({ ok: true, resources });
}
