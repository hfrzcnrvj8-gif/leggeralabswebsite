import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** PATCH /api/notes/:id — update fields. Admin-only. */
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
    await sql`UPDATE notes SET tytul = ${str(body.tytul)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("tresc" in body) {
    await sql`UPDATE notes SET tresc = ${str(body.tresc)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("tagi" in body) {
    await sql`UPDATE notes SET tagi = ${str(body.tagi)}, updated_at = now() WHERE id = ${id};`;
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/notes/:id — remove a note. Admin-only. */
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
  await sql`DELETE FROM notes WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
