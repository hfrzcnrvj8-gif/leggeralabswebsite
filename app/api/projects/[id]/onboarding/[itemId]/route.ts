import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** PATCH /api/projects/:id/onboarding/:itemId — toggle done / edit text. Admin-only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, itemId } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  await ensureHubSchema();
  const sql = getSql();

  if ("done" in body) {
    await sql`UPDATE project_onboarding_items SET done = ${Boolean(body.done)} WHERE id = ${itemId} AND project_id = ${id};`;
  }
  if ("tekst" in body && typeof body.tekst === "string") {
    await sql`UPDATE project_onboarding_items SET tekst = ${body.tekst.slice(0, 500)} WHERE id = ${itemId} AND project_id = ${id};`;
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/projects/:id/onboarding/:itemId — remove a checklist item. Admin-only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, itemId } = await params;
  await ensureHubSchema();
  const sql = getSql();
  await sql`DELETE FROM project_onboarding_items WHERE id = ${itemId} AND project_id = ${id};`;
  return NextResponse.json({ ok: true });
}
