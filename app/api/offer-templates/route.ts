import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureOfferTemplatesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import type { OfferTemplateItem } from "@/lib/offerTemplates";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
function parseRow(r: Row): Row {
  return { ...r, pozycje: typeof r.pozycje === "string" ? JSON.parse(r.pozycje) : r.pozycje };
}

function parsePozycje(v: unknown): OfferTemplateItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((it: Record<string, unknown>) => ({
    nazwa: typeof it?.nazwa === "string" ? it.nazwa.slice(0, 500) : "",
    ilosc: Number.isFinite(Number(it?.ilosc)) ? Number(it.ilosc) : 1,
    jednostka: typeof it?.jednostka === "string" ? it.jednostka.slice(0, 20) || "szt." : "szt.",
    cena: Number.isFinite(Number(it?.cena)) ? Number(it.cena) : 0,
  }));
}

/** GET /api/offer-templates — lista szablonów ofert. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureOfferTemplatesSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM offer_templates ORDER BY created_at ASC;`;
  return NextResponse.json({ templates: rows.map(parseRow) });
}

/** POST /api/offer-templates — nowy szablon oferty. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await ensureOfferTemplatesSchema();
    const sql = getSql();
    const id = randomUUID();
    const nazwa = typeof body.nazwa === "string" ? body.nazwa.slice(0, 200) : "Nowy szablon";
    const opis = typeof body.opis === "string" ? body.opis.slice(0, 500) : "";
    const uwagi = typeof body.uwagi === "string" ? body.uwagi.slice(0, 4000) : "";
    const pozycje = parsePozycje(body.pozycje);
    await sql`
      INSERT INTO offer_templates (id, nazwa, opis, pozycje, uwagi)
      VALUES (${id}, ${nazwa}, ${opis}, ${JSON.stringify(pozycje)}, ${uwagi});
    `;
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[POST /api/offer-templates] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu szablonu: ${message}` }, { status: 500 });
  }
}
