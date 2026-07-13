import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureLeadsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { CONTACT_CHANNELS, CONTACT_DIRECTIONS } from "@/lib/contact";

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
    | {
        text?: unknown;
        ostatni_kontakt?: unknown;
        next_followup?: unknown;
        next_action?: unknown;
        kanal?: unknown;
        kierunek?: unknown;
      }
    | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const kanal = (CONTACT_CHANNELS as readonly string[]).includes(body?.kanal as string) ? (body!.kanal as string) : null;
  const kierunek = (CONTACT_DIRECTIONS as readonly string[]).includes(body?.kierunek as string) ? (body!.kierunek as string) : null;

  await ensureLeadsSchema();
  const sql = getSql();

  const leadRows = await sql`SELECT id FROM leads WHERE id = ${id};`;
  if (!leadRows[0]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const activityId = randomUUID();
  await sql`
    INSERT INTO lead_activity (id, lead_id, text, kanal, kierunek) VALUES (${activityId}, ${id}, ${text.slice(0, 4000)}, ${kanal}, ${kierunek});
  `;

  if (typeof body?.ostatni_kontakt === "string" && body.ostatni_kontakt.trim()) {
    const trimmed = body.ostatni_kontakt.trim();
    if (isPlausibleDateString(trimmed)) {
      // `ostatni_kanal` denormalizowany razem z ostatni_kontakt — to
      // JEDEN spójny sygnał "jak i kiedy ostatnio", nie dwa niezależne pola.
      await sql`UPDATE leads SET ostatni_kontakt = ${trimmed}, ostatni_kanal = COALESCE(${kanal}, ostatni_kanal), updated_at = now() WHERE id = ${id};`;
    }
  }
  if ("next_followup" in (body ?? {})) {
    const raw = body?.next_followup;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (!trimmed) {
      await sql`UPDATE leads SET next_followup = NULL, next_action = '', updated_at = now() WHERE id = ${id};`;
    } else if (isPlausibleDateString(trimmed)) {
      const nextAction = typeof body?.next_action === "string" ? body.next_action.trim().slice(0, 500) : "";
      await sql`UPDATE leads SET next_followup = ${trimmed}, next_action = ${nextAction}, updated_at = now() WHERE id = ${id};`;
    }
  }

  const activity = await sql`
    SELECT * FROM lead_activity WHERE lead_id = ${id} ORDER BY created_at DESC;
  `;

  return NextResponse.json({ ok: true, activity });
}
