import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureMailTemplatesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** PATCH /api/mail-templates/:id — edycja szablonu wiadomości. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  try {
    await ensureMailTemplatesSchema();
    const sql = getSql();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

    if ("nazwa" in body) await sql`UPDATE mail_templates SET nazwa = ${str(body.nazwa, 200)}, updated_at = now() WHERE id = ${id};`;
    if ("temat" in body) await sql`UPDATE mail_templates SET temat = ${str(body.temat, 300)}, updated_at = now() WHERE id = ${id};`;
    if ("tresc" in body) await sql`UPDATE mail_templates SET tresc = ${str(body.tresc, 10000)}, updated_at = now() WHERE id = ${id};`;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/mail-templates/:id] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu szablonu: ${message}` }, { status: 500 });
  }
}

/** DELETE /api/mail-templates/:id — usuwa szablon wiadomości. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureMailTemplatesSchema();
  const sql = getSql();
  await sql`DELETE FROM mail_templates WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
