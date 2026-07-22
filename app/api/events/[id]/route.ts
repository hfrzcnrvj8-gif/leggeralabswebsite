import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";

export const runtime = "nodejs";

/** PATCH /api/events/:id — update fields. Admin-only. */
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

  await ensureHubSchema();
  const sql = getSql();
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  if ("tytul" in body) {
    await sql`UPDATE events SET tytul = ${str(body.tytul)} WHERE id = ${id};`;
  }
  if ("opis" in body) {
    await sql`UPDATE events SET opis = ${str(body.opis)} WHERE id = ${id};`;
  }
  if ("data" in body && typeof body.data === "string" && body.data.trim()) {
    const trimmed = body.data.trim();
    if (!isPlausibleDateString(trimmed)) {
      return NextResponse.json({ error: "invalid data" }, { status: 400 });
    }
    await sql`UPDATE events SET data = ${trimmed} WHERE id = ${id};`;
  }
  if ("godzina" in body) {
    const raw = body.godzina;
    const value = typeof raw === "string" && raw.trim() ? raw.trim() : null;
    await sql`UPDATE events SET godzina = ${value} WHERE id = ${id};`;
  }
  if ("lead_id" in body) {
    const value = typeof body.lead_id === "string" && body.lead_id.trim() ? body.lead_id : null;
    await sql`UPDATE events SET lead_id = ${value} WHERE id = ${id};`;
  }
  if ("project_id" in body) {
    const value = typeof body.project_id === "string" && body.project_id.trim() ? body.project_id : null;
    await sql`UPDATE events SET project_id = ${value} WHERE id = ${id};`;
  }
  if ("client_id" in body) {
    const value = typeof body.client_id === "string" && body.client_id.trim() ? body.client_id : null;
    await sql`UPDATE events SET client_id = ${value} WHERE id = ${id};`;
  }
  if ("data_koniec" in body) {
    const raw = body.data_koniec;
    if (typeof raw === "string" && raw.trim()) {
      const trimmed = raw.trim();
      if (!isPlausibleDateString(trimmed)) {
        return NextResponse.json({ error: "invalid data_koniec" }, { status: 400 });
      }
      await sql`UPDATE events SET data_koniec = ${trimmed} WHERE id = ${id};`;
    } else {
      await sql`UPDATE events SET data_koniec = NULL WHERE id = ${id};`;
    }
  }
  if ("czas_trwania_min" in body) {
    const raw = body.czas_trwania_min;
    const value = typeof raw === "number" && Number.isFinite(raw) && raw > 0 && raw <= 1440 ? Math.round(raw) : null;
    await sql`UPDATE events SET czas_trwania_min = ${value} WHERE id = ${id};`;
  }
  if ("lokalizacja" in body) {
    const raw = body.lokalizacja;
    const value = typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 300) : null;
    await sql`UPDATE events SET lokalizacja = ${value} WHERE id = ${id};`;
  }
  if ("alert_minut_przed" in body) {
    const raw = body.alert_minut_przed;
    const value =
      typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= 43200 ? Math.round(raw) : null;
    await sql`UPDATE events SET alert_minut_przed = ${value} WHERE id = ${id};`;
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/events/:id — remove an event. Admin-only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureHubSchema();
  const sql = getSql();
  await sql`DELETE FROM events WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
