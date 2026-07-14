import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { DEFAULT_ONBOARDING_ITEMS } from "@/lib/projects";

export const runtime = "nodejs";

/** POST /api/projects/:id/onboarding — add one checklist item, or (with
 * `seedDefaults: true`) fill the whole default checklist in one call (used
 * by the "Uzupełnij domyślną checklistą" button when the list is empty —
 * e.g. a project created before this module existed). Admin-only. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { tekst?: unknown; seedDefaults?: unknown } | null;

  await ensureHubSchema();
  const sql = getSql();

  const countRows = await sql`SELECT COUNT(*)::int AS n FROM project_onboarding_items WHERE project_id = ${id};`;
  let position = (countRows[0]?.n as number | undefined) ?? 0;

  if (body?.seedDefaults === true) {
    for (const tekst of DEFAULT_ONBOARDING_ITEMS) {
      await sql`
        INSERT INTO project_onboarding_items (id, project_id, tekst, position)
        VALUES (${randomUUID()}, ${id}, ${tekst}, ${position});
      `;
      position += 1;
    }
  } else {
    const tekst = typeof body?.tekst === "string" ? body.tekst.trim() : "";
    if (!tekst) {
      return NextResponse.json({ error: "tekst is required" }, { status: 400 });
    }
    await sql`
      INSERT INTO project_onboarding_items (id, project_id, tekst, position)
      VALUES (${randomUUID()}, ${id}, ${tekst.slice(0, 500)}, ${position});
    `;
  }

  const onboarding = await sql`
    SELECT * FROM project_onboarding_items WHERE project_id = ${id} ORDER BY position ASC, created_at ASC;
  `;
  return NextResponse.json({ ok: true, onboarding });
}
