import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** PATCH /api/events/:id — update fields. Admin-only. */
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
    await sql`UPDATE events SET tytul = ${str(body.tytul)} WHERE id = ${id};`;
  }
  if ("opis" in body) {
    await sql`UPDATE events SET opis = ${str(body.opis)} WHERE id = ${id};`;
  }
  if ("data" in body && typeof body.data === "string" && body.data.trim()) {
    await sql`UPDATE events SET data = ${body.data} WHERE id = ${id};`;
  }
  if ("godzina" in body) {
    const raw = body.godzina;
    const value = typeof raw === "string" && raw.trim() ? raw.trim() : null;
    await sql`UPDATE events SET godzina = ${value} WHERE id = ${id};`;
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/events/:id — remove an event. Admin-only. */
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
  await sql`DELETE FROM events WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
