import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureCostsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { COST_CATEGORIES } from "@/lib/costs";
import { todayLocalISO } from "@/lib/dates";

export const runtime = "nodejs";

/** GET /api/costs/analytics?months=6 — suma kosztów brutto per miesiąc x
 * kategoria, dla ostatnich N miesięcy (domyślnie 6, licząc bieżący).
 * Wyłącznie zwykłe SUM/GROUP BY — zero AI, deterministyczna agregacja. */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureCostsSchema();
  const sql = getSql();

  const monthsParam = Number(req.nextUrl.searchParams.get("months"));
  const monthsCount = Number.isFinite(monthsParam) && monthsParam >= 1 && monthsParam <= 24 ? Math.round(monthsParam) : 6;

  const today = todayLocalISO();
  // Lista kluczy "YYYY-MM" dla ostatnich `monthsCount` miesięcy (najstarszy pierwszy).
  const months: string[] = [];
  {
    const [y0, m0] = today.slice(0, 7).split("-").map(Number);
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(y0, m0 - 1 - i, 1));
      months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    }
  }
  const from = `${months[0]}-01`;

  const rows = await sql`
    SELECT to_char(data_wydatku, 'YYYY-MM') AS miesiac, kategoria, SUM(kwota_brutto)::float8 AS suma
    FROM costs
    WHERE data_wydatku >= ${from}::date
    GROUP BY miesiac, kategoria;
  `;

  // Pivot: dla każdej znanej kategorii (stała kolejność COST_CATEGORIES,
  // patrz dataviz — kolejność kategoryczna nigdy się nie zmienia) tablica
  // sum po miesiącach; nieznane/starsze kategorie (spoza listy) sumują się
  // do "Inne", żeby nie tworzyć nieograniczonej liczby serii.
  const byCategory: Record<string, number[]> = {};
  for (const k of COST_CATEGORIES) byCategory[k] = months.map(() => 0);

  for (const r of rows) {
    const miesiac = String(r.miesiac);
    const idx = months.indexOf(miesiac);
    if (idx === -1) continue;
    const kategoria = (COST_CATEGORIES as readonly string[]).includes(String(r.kategoria)) ? String(r.kategoria) : "Inne";
    byCategory[kategoria][idx] += Number(r.suma);
  }

  return NextResponse.json({ months, categories: COST_CATEGORIES, byCategory });
}
