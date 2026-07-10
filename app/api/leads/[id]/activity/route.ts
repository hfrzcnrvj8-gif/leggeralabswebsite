import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureLeadsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/leads/:id/activity — append a timestamped activity entry
 * ("zadzwoniłem, obiecał odpowiedzieć do piątku" etc.). Optionally also
 * updates the parent lead's ostatni_kontakt / next_followup in the same
 * request, so logging an interaction and setting the next reminder is one
 * action instead of two.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | { text?: unknown; ostatni_kontakt?: unknown; next_followup?: unknown }
    | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  await ensureLeadsSchema();
  const sql = getSql();

  const leadRows = await sql`SELECT id FROM leads WHERE id = ${id};`;
  if (!leadRows[0]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const activityId = randomUUID();
  await sql`
    INSERT INTO lead_activity (id, lead_id, text) VALUES (${activityId}, ${id}, ${text.slice(0, 4000)});
  `;

  if (typeof body?.ostatni_kontakt === "string" && body.ostatni_kontakt.trim()) {
    await sql`UPDATE leads SET ostatni_kontakt = ${body.ostatni_kontakt}, updated_at = now() WHERE id = ${id};`;
  }
  if ("next_followup" in (body ?? {})) {
    const raw = body?.next_followup;
    const value = typeof raw === "string" && raw.trim() ? raw : null;
    await sql`UPDATE leads SET next_followup = ${value}, updated_at = now() WHERE id = ${id};`;
  }

  const activity = await sql`
    SELECT * FROM lead_activity WHERE lead_id = ${id} ORDER BY created_at DESC;
  `;

  return NextResponse.json({ ok: true, activity });
}
