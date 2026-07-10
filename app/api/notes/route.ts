import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/notes — list all notes, newest first. Admin-only. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureHubSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM notes ORDER BY updated_at DESC;`;
  return NextResponse.json({ notes: rows });
}

/** POST /api/notes — create a note. Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const tresc = typeof body?.tresc === "string" ? body.tresc.trim() : "";
  const tytul = typeof body?.tytul === "string" ? body.tytul.trim() : "";
  if (!tresc && !tytul) {
    return NextResponse.json({ error: "tytul or tresc is required" }, { status: 400 });
  }

  await ensureHubSchema();
  const sql = getSql();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const id = randomUUID();
  const tagi = str(body?.tagi, 500);

  await sql`
    INSERT INTO notes (id, tytul, tresc, tagi)
    VALUES (${id}, ${tytul.slice(0, 300)}, ${tresc.slice(0, 8000)}, ${tagi});
  `;

  return NextResponse.json({ ok: true, id });
}
