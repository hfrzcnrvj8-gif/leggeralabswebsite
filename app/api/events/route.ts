import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { todayLocalISO } from "@/lib/dates";
import { isPlausibleDateString } from "@/lib/projects";

export const runtime = "nodejs";

/** GET /api/events?month=YYYY-MM — list events in a given month (default: current). Admin-only. */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureHubSchema();
  const sql = getSql();

  const month = req.nextUrl.searchParams.get("month");
  const prefix = month && /^\d{4}-\d{2}$/.test(month) ? month : todayLocalISO().slice(0, 7);
  const monthStart = `${prefix}-01`;

  // Zakres nakładania się z miesiącem, nie dopasowanie samej `data` — inaczej
  // wielodniowe wydarzenie (data_koniec) rozpoczęte w poprzednim miesiącu
  // zniknęłoby z widoku miesiąca, w którym realnie trwa.
  const rows = await sql`
    SELECT * FROM events
    WHERE data <= (date_trunc('month', ${monthStart}::date) + interval '1 month' - interval '1 day')::date
      AND COALESCE(data_koniec, data) >= ${monthStart}::date
    ORDER BY data ASC, godzina ASC NULLS LAST;
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
  if (!isPlausibleDateString(data)) {
    return NextResponse.json({ error: "invalid data" }, { status: 400 });
  }
  const dataKoniecRaw = typeof body?.data_koniec === "string" ? body.data_koniec.trim() : "";
  if (dataKoniecRaw && !isPlausibleDateString(dataKoniecRaw)) {
    return NextResponse.json({ error: "invalid data_koniec" }, { status: 400 });
  }
  if (dataKoniecRaw && dataKoniecRaw < data) {
    return NextResponse.json({ error: "data_koniec must not be before data" }, { status: 400 });
  }

  await ensureHubSchema();
  const sql = getSql();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const id = randomUUID();
  const opis = str(body?.opis, 2000);
  const godzina = typeof body?.godzina === "string" && body.godzina.trim() ? body.godzina.trim() : null;
  const leadId = typeof body?.lead_id === "string" && body.lead_id.trim() ? body.lead_id : null;
  const projectId = typeof body?.project_id === "string" && body.project_id.trim() ? body.project_id : null;
  const clientId = typeof body?.client_id === "string" && body.client_id.trim() ? body.client_id : null;
  const dataKoniec = dataKoniecRaw || null;
  const durationRaw = body?.czas_trwania_min;
  const czasTrwaniaMin =
    typeof durationRaw === "number" && Number.isFinite(durationRaw) && durationRaw > 0 && durationRaw <= 1440
      ? Math.round(durationRaw)
      : null;
  const lokalizacja = typeof body?.lokalizacja === "string" && body.lokalizacja.trim() ? body.lokalizacja.trim().slice(0, 300) : null;

  await sql`
    INSERT INTO events (id, tytul, opis, data, godzina, lead_id, project_id, client_id, data_koniec, czas_trwania_min, lokalizacja)
    VALUES (${id}, ${tytul.slice(0, 300)}, ${opis}, ${data}, ${godzina}, ${leadId}, ${projectId}, ${clientId}, ${dataKoniec}, ${czasTrwaniaMin}, ${lokalizacja});
  `;

  return NextResponse.json({ ok: true, id });
}
