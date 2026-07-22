import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema, ensureEventAttendeesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { todayLocalISO } from "@/lib/dates";
import { isPlausibleDateString } from "@/lib/projects";
import { rozwinSerieWydarzen, type HubEvent } from "@/lib/events";
import { normalizujCykl } from "@/lib/recurrence";

export const runtime = "nodejs";

/** Ostatni dzień miesiąca `YYYY-MM`, jako ISO. Dzień 0 kolejnego miesiąca. */
function miesiacKoniec(prefix: string): string {
  const [y, m] = prefix.split("-").map(Number);
  const d = new Date(y, m, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** GET /api/events?month=YYYY-MM — list events in a given month (default: current). Admin-only. */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureHubSchema();
  await ensureEventAttendeesSchema();
  const sql = getSql();

  const month = req.nextUrl.searchParams.get("month");
  const prefix = month && /^\d{4}-\d{2}$/.test(month) ? month : todayLocalISO().slice(0, 7);
  const monthStart = `${prefix}-01`;

  // Zakres nakładania się z miesiącem, nie dopasowanie samej `data` — inaczej
  // wielodniowe wydarzenie (data_koniec) rozpoczęte w poprzednim miesiącu
  // zniknęłoby z widoku miesiąca, w którym realnie trwa.
  // Liczniki zaproszeń doliczane w TYM SAMYM zapytaniu (2026-07-22): kalendarz
  // ma pokazywać „2/3 potwierdziło" przy wydarzeniu, a osobna runda do bazy per
  // miesiąc kosztowałaby drugie żądanie HTTP (neon() = jedno na zapytanie).
  // Zero uczestników → 0/0, czyli plakietka się nie rysuje.
  // Wiersz-wzorzec serii ma `data` z PIERWSZEGO wystąpienia, więc warunek
  // „nakłada się na miesiąc" musi go przepuścić inaczej niż wydarzenie
  // jednorazowe: seria wchodzi, gdy zaczęła się nie później niż koniec
  // miesiąca i nie skończyła przed jego początkiem. Bez tej gałęzi cotygodniowy
  // przegląd założony w styczniu zniknąłby z lipca.
  //
  // Nadal JEDNO zapytanie na miesiąc (wymóg z briefu) — wystąpienia liczy
  // `rozwinSerieWydarzen()` w pamięci, nie baza.
  const rows = (await sql`
    SELECT e.*,
           COUNT(a.id)::int AS uczestnicy_total,
           COUNT(a.id) FILTER (WHERE a.status = 'przyjete')::int AS uczestnicy_tak
    FROM events e
    LEFT JOIN event_attendees a ON a.event_id = e.id
    WHERE e.data <= (date_trunc('month', ${monthStart}::date) + interval '1 month' - interval '1 day')::date
      AND (
        (e.powtarzanie IS NULL AND COALESCE(e.data_koniec, e.data) >= ${monthStart}::date)
        OR (e.powtarzanie IS NOT NULL AND (e.powtarzanie_do IS NULL OR e.powtarzanie_do >= ${monthStart}::date))
      )
    GROUP BY e.id
    ORDER BY e.data ASC, e.godzina ASC NULLS LAST;
  `) as unknown as HubEvent[];

  const monthEnd = miesiacKoniec(prefix);
  return NextResponse.json({ events: rozwinSerieWydarzen(rows, monthStart, monthEnd) });
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
  const alertRaw = body?.alert_minut_przed;
  const alertMinutPrzed =
    typeof alertRaw === "number" && Number.isFinite(alertRaw) && alertRaw >= 0 && alertRaw <= 43200
      ? Math.round(alertRaw)
      : null;

  // Cykl: klucz spoza słownika traktujemy jak brak cyklu (patrz
  // `normalizujCykl()`), a „do kiedy" bez cyklu nie znaczy nic i nie zapisuje
  // się po cichu — inaczej wracałoby jako seria bez reguły.
  const powtarzanie = normalizujCykl(body?.powtarzanie);
  const powtarzanieDoRaw = typeof body?.powtarzanie_do === "string" ? body.powtarzanie_do.trim() : "";
  if (powtarzanieDoRaw && !isPlausibleDateString(powtarzanieDoRaw)) {
    return NextResponse.json({ error: "invalid powtarzanie_do" }, { status: 400 });
  }
  if (powtarzanieDoRaw && powtarzanieDoRaw < data) {
    return NextResponse.json({ error: "powtarzanie_do must not be before data" }, { status: 400 });
  }
  const powtarzanieDo = powtarzanie ? powtarzanieDoRaw || null : null;

  await sql`
    INSERT INTO events (id, tytul, opis, data, godzina, lead_id, project_id, client_id, data_koniec, czas_trwania_min, lokalizacja, alert_minut_przed, powtarzanie, powtarzanie_do)
    VALUES (${id}, ${tytul.slice(0, 300)}, ${opis}, ${data}, ${godzina}, ${leadId}, ${projectId}, ${clientId}, ${dataKoniec}, ${czasTrwaniaMin}, ${lokalizacja}, ${alertMinutPrzed}, ${powtarzanie}, ${powtarzanieDo});
  `;

  return NextResponse.json({ ok: true, id });
}
