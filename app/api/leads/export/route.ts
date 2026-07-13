import { NextResponse } from "next/server";
import { getSql, ensureLeadsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { toCsv } from "@/lib/export";
import { todayLocalISO } from "@/lib/dates";
import { leadSourceLabel } from "@/lib/leads";

export const runtime = "nodejs";

/** GET /api/leads/export — CSV całego rejestru leadów. W przeciwieństwie do
 * Faktur/Kosztów (zdarzenia z konkretnego okresu) leady to żywy rejestr bez
 * naturalnego zakresu dat, więc eksport bierze wszystkie na raz zamiast
 * pytać o "od-do". */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureLeadsSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM leads ORDER BY created_at DESC;`;

  const header = [
    "Firma", "Osoba kontaktowa", "Branża", "Telefon", "Email", "WWW",
    "Ulica", "Kod", "Miasto", "Kraj", "Źródło", "Status",
    "Ostatni kontakt", "Przypomnij mi", "Notatki",
  ];
  const body = rows.map((r) => [
    String(r.firma ?? ""),
    String(r.osoba_kontaktowa ?? ""),
    String(r.branza ?? ""),
    String(r.telefon ?? ""),
    String(r.email ?? ""),
    String(r.www ?? ""),
    String(r.ulica ?? ""),
    String(r.kod ?? ""),
    String(r.miasto ?? ""),
    String(r.kraj ?? ""),
    leadSourceLabel({ zrodlo_kategoria: String(r.zrodlo_kategoria ?? ""), zrodlo: String(r.zrodlo ?? "") }),
    String(r.status ?? ""),
    String(r.ostatni_kontakt ?? "").slice(0, 10),
    String(r.next_followup ?? "").slice(0, 10),
    String(r.notatki ?? ""),
  ]);

  const csv = toCsv([header, ...body]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leady_${todayLocalISO()}.csv"`,
    },
  });
}
