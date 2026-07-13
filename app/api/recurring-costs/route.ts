import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureCostsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { COST_CATEGORIES, VAT_RATES } from "@/lib/costs";
import { RECURRING_CYCLES, todayISO } from "@/lib/recurring";

export const runtime = "nodejs";

function parseRow(r: Record<string, unknown>): Record<string, unknown> {
  return { ...r, kwota_netto: Number(r.kwota_netto) };
}

/** GET /api/recurring-costs — lista szablonów kosztów cyklicznych. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureCostsSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM recurring_costs ORDER BY active DESC, next_run ASC;`;
  return NextResponse.json({ recurring: rows.map(parseRow) });
}

/** POST /api/recurring-costs — nowy szablon kosztu cyklicznego. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await ensureCostsSchema();
    const sql = getSql();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
    const cykl = typeof body.cykl === "string" && (RECURRING_CYCLES as readonly string[]).includes(body.cykl) ? body.cykl : "miesiecznie";
    const kategoria = typeof body.kategoria === "string" && (COST_CATEGORIES as readonly string[]).includes(body.kategoria) ? body.kategoria : "Subskrypcje";
    const vatStawka = typeof body.vat_stawka === "string" && (VAT_RATES as readonly string[]).includes(body.vat_stawka) ? body.vat_stawka : "23";
    const kwotaNetto = Number.isFinite(Number(body.kwota_netto)) ? Number(body.kwota_netto) : 0;
    const nextRun = typeof body.next_run === "string" && body.next_run.trim() ? body.next_run.slice(0, 10) : todayISO();

    const id = randomUUID();
    await sql`
      INSERT INTO recurring_costs (id, nazwa, dostawca_nazwa, dostawca_nip, kategoria, kwota_netto, vat_stawka, cykl, next_run, active)
      VALUES (${id}, ${str(body.nazwa, 200)}, ${str(body.dostawca_nazwa, 300)}, ${str(body.dostawca_nip, 30)}, ${kategoria}, ${kwotaNetto}, ${vatStawka}, ${cykl}, ${nextRun}, true);
    `;
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[POST /api/recurring-costs] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu szablonu: ${message}` }, { status: 500 });
  }
}
