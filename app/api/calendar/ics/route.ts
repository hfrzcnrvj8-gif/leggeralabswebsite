import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema } from "@/lib/db";
import { buildICS, type HubEvent } from "@/lib/events";
import { addDaysLocalISO } from "@/lib/dates";

export const runtime = "nodejs";

/**
 * GET /api/calendar/ics?token=... — subskrybowalny feed .ics ręcznych
 * wydarzeń kalendarza (do wpięcia w Apple/Google Calendar na telefonie, bez
 * logowania się do panelu). Moduł 10.
 *
 * Uwierzytelnienie: token w query string (wzorem `TELEFONIA_WEBHOOK_SECRET`
 * w app/api/telefonia/webhook/route.ts) — aplikacje kalendarzowe subskrybują
 * zwykły URL, bez obsługi cookies/nagłówków. Fail-closed: jeśli
 * CALENDAR_ICS_SECRET nie jest ustawiony w env, endpoint jest zablokowany,
 * nie cicho publiczny.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CALENDAR_ICS_SECRET;
  if (!secret) {
    console.error("[GET /api/calendar/ics] CALENDAR_ICS_SECRET nie jest ustawiony w env — endpoint zablokowany.");
    return NextResponse.json({ error: "CALENDAR_ICS_SECRET nie jest skonfigurowany w env Vercela." }, { status: 500 });
  }
  const token = req.nextUrl.searchParams.get("token");
  if (token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await ensureHubSchema();
  const sql = getSql();
  // Okno -30/+365 dni od dziś — wystarczające do subskrypcji bez ładowania
  // całej, potencjalnie wieloletniej historii wydarzeń.
  //
  // Serie NIE są tu rozwijane na wystąpienia — schodzą jako jeden VEVENT
  // z RRULE (patrz `buildICS()`), więc okno dotyczy tylko tego, czy seria
  // jeszcze trwa, a nie kiedy się zaczęła. Cotygodniowy przegląd założony
  // dwa lata temu ma dalej wejść do feedu.
  const from = addDaysLocalISO(-30);
  const to = addDaysLocalISO(365);
  const rows = (await sql`
    SELECT * FROM events
    WHERE data <= ${to}::date
      AND (
        COALESCE(data_koniec, data) >= ${from}::date
        OR (powtarzanie IS NOT NULL AND (powtarzanie_do IS NULL OR powtarzanie_do >= ${from}::date))
      )
    ORDER BY data ASC;
  `) as unknown as HubEvent[];

  return new NextResponse(buildICS(rows), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="leggera-labs-kalendarz.ics"',
    },
  });
}
