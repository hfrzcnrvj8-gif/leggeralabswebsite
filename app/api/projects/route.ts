import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/projects — list all projects. Admin-only. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureHubSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM projects ORDER BY created_at DESC;`;
  return NextResponse.json({ projects: rows });
}

/** POST /api/projects — create a project. Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const tytul = typeof body?.tytul === "string" ? body.tytul.trim() : "";
  if (!tytul) {
    return NextResponse.json({ error: "tytul is required" }, { status: 400 });
  }

  await ensureHubSchema();
  const sql = getSql();

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const id = randomUUID();
  const opis = str(body?.opis, 4000);
  const status = str(body?.status, 100) || "Pomysł";
  const priorytet = str(body?.priorytet, 50) || "Normalny";
  const rawTermin = body?.termin;
  const termin = typeof rawTermin === "string" && rawTermin.trim() ? rawTermin : null;
  const leadId = typeof body?.lead_id === "string" && body.lead_id.trim() ? body.lead_id : null;

  await sql`
    INSERT INTO projects (id, tytul, opis, status, priorytet, termin, lead_id)
    VALUES (${id}, ${tytul.slice(0, 300)}, ${opis}, ${status}, ${priorytet}, ${termin}, ${leadId});
  `;

  return NextResponse.json({ ok: true, id });
}
