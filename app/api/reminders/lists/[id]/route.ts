import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureRemindersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isReminderListColor } from "@/lib/reminders";

export const runtime = "nodejs";

/** PATCH /api/reminders/lists/:id — nazwa, kolor, kolejność. Admin-only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  await ensureRemindersSchema();
  const sql = getSql();

  if ("nazwa" in body) {
    const nazwa = typeof body.nazwa === "string" ? body.nazwa.trim() : "";
    if (!nazwa) {
      return NextResponse.json({ error: "nazwa must not be empty" }, { status: 400 });
    }
    await sql`UPDATE reminder_lists SET nazwa = ${nazwa.slice(0, 120)} WHERE id = ${id};`;
  }
  if ("kolor" in body) {
    // Nieznany kolor odrzucamy zamiast podmieniać na domyślny: cicha podmiana
    // wygląda w UI jak „kliknięcie nie zadziałało".
    if (!isReminderListColor(body.kolor)) {
      return NextResponse.json({ error: "invalid kolor" }, { status: 400 });
    }
    await sql`UPDATE reminder_lists SET kolor = ${body.kolor} WHERE id = ${id};`;
  }
  if ("kolejnosc" in body) {
    const raw = body.kolejnosc;
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      return NextResponse.json({ error: "invalid kolejnosc" }, { status: 400 });
    }
    await sql`UPDATE reminder_lists SET kolejnosc = ${Math.round(raw)} WHERE id = ${id};`;
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/reminders/lists/:id — usuwa listę. Przypomnienia z niej
 * ZOSTAJĄ (trafiają do „Bez listy") dzięki `ON DELETE SET NULL` — patrz
 * komentarz przy schemacie w `lib/db.ts`. Admin-only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureRemindersSchema();
  const sql = getSql();

  // Ile osieroci — UI mówi wprost „3 przypomnienia trafią do «Bez listy»",
  // zamiast kasować w ciemno.
  const [ile] = (await sql`
    SELECT COUNT(*) AS ile FROM reminders WHERE lista_id = ${id} AND ukonczone = false;
  `) as unknown as { ile: string }[];

  await sql`DELETE FROM reminder_lists WHERE id = ${id};`;
  return NextResponse.json({ ok: true, osierocone: Number(ile?.ile ?? 0) });
}
