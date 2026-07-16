import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema, ensureLinksSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString, formatPlDate } from "@/lib/projects";

export const runtime = "nodejs";

/**
 * POST /api/notes/:id/schedule — „Do kalendarza". Admin-only.
 *
 * Moduł 26 pkt 4. Notatka „zadzwonić do X we wtorek" ma jednym kliknięciem
 * trafić do kalendarza — Z POWIĄZANIEM. Przeniesienie `client_id`/`lead_id`/
 * `project_id` na wydarzenie to ta sama zasada, którą stosuje offerAccept.ts
 * przy akceptacji oferty: rekord potomny dziedziczy kontekst, zamiast zaczynać
 * jako sierota, którą trzeba ręcznie podpiąć drugi raz.
 *
 * Idempotencja jak w /promote — `notes.event_id` jest źródłem prawdy.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const data = typeof body?.data === "string" ? body.data.trim() : "";
  if (!data) {
    return NextResponse.json({ error: "data is required" }, { status: 400 });
  }
  // Walidacja daty także po stronie serwera — `<input type="date">` potrafi
  // oddać niepełny rok („0202"), gdy pole straci fokus w trakcie wpisywania
  // (znana pułapka, CLAUDE.md).
  if (!isPlausibleDateString(data)) {
    return NextResponse.json({ error: "invalid data" }, { status: 400 });
  }
  const godzina = typeof body?.godzina === "string" && body.godzina.trim() ? body.godzina.trim() : null;

  await ensureHubSchema();
  await ensureLinksSchema();
  const sql = getSql();

  const rows = (await sql`SELECT * FROM notes WHERE id = ${id};`) as unknown as {
    tytul: string;
    tresc: string;
    client_id: string | null;
    lead_id: string | null;
    project_id: string | null;
    event_id: string | null;
  }[];
  const note = rows[0];
  if (!note) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (note.event_id) {
    return NextResponse.json({ ok: true, id: note.event_id, existing: true });
  }

  const eventId = randomUUID();
  await sql`
    INSERT INTO events (id, tytul, opis, data, godzina, lead_id, project_id, client_id)
    VALUES (
      ${eventId},
      ${(note.tytul || "Notatka").slice(0, 300)},
      ${note.tresc.slice(0, 2000)},
      ${data},
      ${godzina},
      ${note.lead_id},
      ${note.project_id},
      ${note.client_id}
    );
  `;

  await sql`UPDATE notes SET event_id = ${eventId} WHERE id = ${id};`;
  // Data w logu przez formatPlDate — wpis czyta człowiek, a surowy ISO z bazy
  // nie ma prawa wyciekać do UI (CLAUDE.md).
  await sql`
    INSERT INTO notes_activity (id, note_id, text)
    VALUES (${randomUUID()}, ${id}, ${`Zaplanowano w kalendarzu na ${formatPlDate(data)}${godzina ? `, godz. ${godzina}` : " (całodniowe)"}.`});
  `;

  return NextResponse.json({ ok: true, id: eventId, existing: false });
}
