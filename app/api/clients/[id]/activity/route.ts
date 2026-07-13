import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureClientsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { CONTACT_CHANNELS, CONTACT_DIRECTIONS, CALL_OUTCOMES } from "@/lib/contact";

export const runtime = "nodejs";

/** POST /api/clients/:id/activity — dopisuje wpis do historii kontaktu
 * ("zadzwoniłem, umówiliśmy się na demo za 2 tygodnie" itp.) — dokładnie ta
 * "historia kontaktu" o którą prosił właściciel: kiedy, jak, w jakiej sprawie.
 * Opcjonalnie aktualizuje ostatni_kontakt/next_followup w tym samym żądaniu,
 * wzorem app/api/leads/[id]/activity. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | {
        text?: unknown;
        ostatni_kontakt?: unknown;
        next_followup?: unknown;
        next_action?: unknown;
        kanal?: unknown;
        kierunek?: unknown;
        wynik?: unknown;
        czas_trwania_sek?: unknown;
      }
    | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });
  const kanal = (CONTACT_CHANNELS as readonly string[]).includes(body?.kanal as string) ? (body!.kanal as string) : null;
  const kierunek = (CONTACT_DIRECTIONS as readonly string[]).includes(body?.kierunek as string) ? (body!.kierunek as string) : null;
  const wynik = (CALL_OUTCOMES as readonly string[]).includes(body?.wynik as string) ? (body!.wynik as string) : null;
  const rawDuration = Number(body?.czas_trwania_sek);
  const czasTrwaniaSek =
    wynik === "odebrane" && Number.isFinite(rawDuration) && rawDuration >= 0
      ? Math.min(Math.round(rawDuration), 24 * 60 * 60)
      : null;

  await ensureClientsSchema();
  const sql = getSql();

  const clientRows = await sql`SELECT id FROM clients WHERE id = ${id};`;
  if (!clientRows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const activityId = randomUUID();
  await sql`
    INSERT INTO client_activity (id, client_id, text, kanal, kierunek, wynik, czas_trwania_sek)
    VALUES (${activityId}, ${id}, ${text.slice(0, 4000)}, ${kanal}, ${kierunek}, ${wynik}, ${czasTrwaniaSek});
  `;

  if (typeof body?.ostatni_kontakt === "string" && body.ostatni_kontakt.trim()) {
    const trimmed = body.ostatni_kontakt.trim();
    if (isPlausibleDateString(trimmed)) {
      await sql`UPDATE clients SET ostatni_kontakt = ${trimmed}, ostatni_kanal = COALESCE(${kanal}, ostatni_kanal), updated_at = now() WHERE id = ${id};`;
    }
  }
  if ("next_followup" in (body ?? {})) {
    const raw = body?.next_followup;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (!trimmed) {
      await sql`UPDATE clients SET next_followup = NULL, next_action = '', updated_at = now() WHERE id = ${id};`;
    } else if (isPlausibleDateString(trimmed)) {
      const nextAction = typeof body?.next_action === "string" ? body.next_action.trim().slice(0, 500) : "";
      await sql`UPDATE clients SET next_followup = ${trimmed}, next_action = ${nextAction}, updated_at = now() WHERE id = ${id};`;
    }
  }

  const activity = await sql`SELECT * FROM client_activity WHERE client_id = ${id} ORDER BY created_at DESC;`;
  return NextResponse.json({ ok: true, activity });
}
