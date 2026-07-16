import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureMailTemplatesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/mail-templates — lista szablonów wiadomości (Etap 1 Modułu 4b,
 * wzorem app/api/offer-templates). */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureMailTemplatesSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM mail_templates ORDER BY created_at ASC;`;
  return NextResponse.json({ templates: rows });
}

/** POST /api/mail-templates — nowy szablon wiadomości. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await ensureMailTemplatesSchema();
    const sql = getSql();
    const id = randomUUID();
    const nazwa = typeof body.nazwa === "string" ? body.nazwa.slice(0, 200) : "Nowy szablon";
    const temat = typeof body.temat === "string" ? body.temat.slice(0, 300) : "";
    const tresc = typeof body.tresc === "string" ? body.tresc.slice(0, 10000) : "";
    await sql`
      INSERT INTO mail_templates (id, nazwa, temat, tresc)
      VALUES (${id}, ${nazwa}, ${temat}, ${tresc});
    `;
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[POST /api/mail-templates] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu szablonu: ${message}` }, { status: 500 });
  }
}
