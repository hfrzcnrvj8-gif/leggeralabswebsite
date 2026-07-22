import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureEventAttendeesSchema } from "@/lib/db";
import type { EventAttendee } from "@/lib/eventInvites";

export const runtime = "nodejs";

/** GET /api/events/:id/attendees — kto jest zaproszony i co odpowiedział.
 * Uczestnicy powstają przy WYSYŁCE zaproszenia (POST .../invite), więc nie ma
 * tu POST-a: „dopisany, ale niezaproszony" byłby stanem, który wygląda jak
 * ustalenie, a nikomu niczego nie mówi. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureEventAttendeesSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM event_attendees WHERE event_id = ${id} ORDER BY created_at ASC;
  `) as unknown as EventAttendee[];
  return NextResponse.json({ attendees: rows });
}

/** DELETE /api/events/:id/attendees?email=... — usuwa uczestnika Z PANELU.
 * Świadomie NIE wysyła odwołania (`METHOD:CANCEL`) do jego kalendarza:
 * „pomyliłem adres" i „odwołuję Ci spotkanie" to dwie różne intencje, a
 * odróżnić ich tu nie sposób. Odwołanie spotkania to osobna decyzja i osobny
 * przycisk, gdyby właściciel go kiedyś potrzebował. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const email = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "brak adresu" }, { status: 400 });
  await ensureEventAttendeesSchema();
  const sql = getSql();
  await sql`DELETE FROM event_attendees WHERE event_id = ${id} AND email = ${email};`;
  return NextResponse.json({ ok: true });
}
