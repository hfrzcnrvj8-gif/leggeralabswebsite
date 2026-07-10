import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/events?month=YYYY-MM — list events in a given month (default: current). Admin-only. */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureHubSchema();
  const sql = getSql();

  const month = req.nextUrl.searchParams.get("month");
  const prefix = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);

  const rows = await sql`
    SELECT * FROM events WHERE to_char(data, 'YYYY-MM') = ${prefix} ORDER BY data ASC, godzina ASC NULLS LAST;
  `;
  return NextResponse.json({ events: rows });
}

/** POST /api/events — create an event. Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const tytul = typeof body?.tytul === "string" ? body.tytul.trim() : "";
  const data = typeof body?.data === "string" ? body.data.trim() : "";
  if (!tytul || !data) {
    return NextResponse.json({ error: "tytul and data are required" }, { status: 400 });
  }

  await ensureHubSchema();
  const sql = getSql();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const id = randomUUID();
  const opis = str(body?.opis, 2000);
  const godzina = typeof body?.godzina === "string" && body.godzina.trim() ? body.godzina.trim() : null;
  const leadId = typeof body?.lead_id === "string" && body.lead_id.trim() ? body.lead_id : null;
  const projectId = typeof body?.project_id === "string" && body.project_id.trim() ? body.project_id : null;

  await sql`
    INSERT INTO events (id, tytul, opis, data, godzina, lead_id, project_id)
    VALUES (${id}, ${tytul.slice(0, 300)}, ${opis}, ${data}, ${godzina}, ${leadId}, ${projectId});
  `;

  return NextResponse.json({ ok: true, id });
}
