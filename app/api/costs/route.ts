import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureCostsSchema, ensureLinksSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { costBrutto, COST_CATEGORIES, VAT_RATES } from "@/lib/costs";

export const runtime = "nodejs";

/** GET /api/costs — lista kosztów z nazwą podpiętego projektu (do listy). Admin-only. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureCostsSchema();
  // `costs.client_id` / `costs.lead_id` zakłada `ensureLinksSchema()`, nie
  // `ensureCostsSchema()` — a niżej je SELECT-ujemy. Bez tej linii lista
  // kosztów zwraca 500 (42703) na każdej bazie, na której migracja „links"
  // jeszcze nie poszła. Sąsiedni `[id]/route.ts` robił to poprawnie od
  // początku; ta trasa została pominięta (złapane audytem Fazy 13.4).
  await ensureLinksSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT c.id, c.dostawca_nazwa, c.dostawca_nip, c.kategoria, c.opis, c.data_wydatku,
      c.kwota_netto, c.vat_stawka, c.kwota_brutto, c.status, c.data_platnosci, c.project_id,
      c.created_at, c.updated_at, c.zalacznik_nazwa, c.zalacznik_typ, c.ksef_numer, c.ksef_tryb,
      c.metoda_platnosci, c.dostawca_konto, c.numer_faktury, c.data_wplywu,
      c.vat_odliczenie_procent, c.duplikat_potwierdzony,
      c.client_id, c.lead_id,
      p.tytul AS project_tytul,
      cl.nazwa AS client_nazwa,
      l.firma AS lead_firma
    FROM costs c
    LEFT JOIN projects p ON p.id = c.project_id
    LEFT JOIN clients cl ON cl.id = c.client_id
    LEFT JOIN leads l ON l.id = c.lead_id
    ORDER BY c.data_wydatku DESC, c.created_at DESC;
  `;
  return NextResponse.json({
    costs: rows.map((r) => ({ ...r, kwota_netto: Number(r.kwota_netto), kwota_brutto: Number(r.kwota_brutto) })),
  });
}

/** POST /api/costs — nowy koszt (draft, dane uzupełniane potem PATCH-em). Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  await ensureCostsSchema();
  const sql = getSql();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

  const id = randomUUID();
  const projectId = typeof body?.project_id === "string" && body.project_id.trim() ? body.project_id : null;
  const dostawcaNazwa = str(body?.dostawca_nazwa, 300);
  const kategoria = typeof body?.kategoria === "string" && (COST_CATEGORIES as readonly string[]).includes(body.kategoria) ? body.kategoria : "Inne";
  const vatStawka = typeof body?.vat_stawka === "string" && (VAT_RATES as readonly string[]).includes(body.vat_stawka) ? body.vat_stawka : "23";
  const kwotaNetto = typeof body?.kwota_netto === "number" && Number.isFinite(body.kwota_netto) ? body.kwota_netto : 0;
  const kwotaBrutto = costBrutto(kwotaNetto, vatStawka);

  await sql`
    INSERT INTO costs (id, dostawca_nazwa, kategoria, vat_stawka, kwota_netto, kwota_brutto, project_id)
    VALUES (${id}, ${dostawcaNazwa}, ${kategoria}, ${vatStawka}, ${kwotaNetto}, ${kwotaBrutto}, ${projectId});
  `;
  return NextResponse.json({ ok: true, id });
}
