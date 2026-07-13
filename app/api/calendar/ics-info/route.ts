import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/calendar/ics-info — mówi panelowi, czy subskrypcja ICS jest
 * skonfigurowana (`CALENDAR_ICS_SECRET` ustawiony w env), i jeśli tak, zwraca
 * sam token, żeby CalendarView mogło złożyć gotowy do skopiowania URL
 * (`/api/calendar/ics?token=...`). Admin-only — token w odpowiedzi widzi
 * tylko zalogowany właściciel, nigdy nieuwierzytelniony klient.
 */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const secret = process.env.CALENDAR_ICS_SECRET ?? null;
  return NextResponse.json({ configured: Boolean(secret), token: secret });
}
