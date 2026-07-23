import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { VAT_RATES, type CatalogItem } from "@/lib/invoices";
import { normalizeCategory } from "@/lib/catalog";

export const runtime = "nodejs";

/** Liczba lub `null` — dla opcjonalnych pól (widełki, koszt zakupu).
 * Pusty string / brak / niepoprawna wartość → null (pole „nie podano"),
 * nie 0 (zerowa marża to co innego niż nieznana). */
function optionalNumber(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeRow(r: Record<string, unknown>): CatalogItem {
  return {
    id: String(r.id),
    nazwa: String(r.nazwa ?? ""),
    cena_netto: Number(r.cena_netto ?? 0),
    vat_stawka: String(r.vat_stawka ?? "23"),
    jednostka: String(r.jednostka ?? "szt."),
    kategoria: normalizeCategory(r.kategoria),
    cena_min: optionalNumber(r.cena_min),
    cena_max: optionalNumber(r.cena_max),
    koszt_zakupu: optionalNumber(r.koszt_zakupu),
    dostawca: String(r.dostawca ?? ""),
    opis: String(r.opis ?? ""),
    created_at: String(r.created_at ?? ""),
  };
}

/** Wspólne czytanie pól z body (POST tworzy, PATCH aktualizuje). */
function readCatalogFields(body: Record<string, unknown>) {
  const nazwa = (typeof body.nazwa === "string" ? body.nazwa : "").trim().slice(0, 500);
  const cena = Number(body.cena_netto);
  const vat =
    typeof body.vat_stawka === "string" && (VAT_RATES as readonly string[]).includes(body.vat_stawka)
      ? body.vat_stawka
      : "23";
  const jednostka = (typeof body.jednostka === "string" ? body.jednostka : "szt.").slice(0, 20) || "szt.";
  return {
    nazwa,
    cena_netto: Number.isFinite(cena) ? cena : 0,
    vat_stawka: vat,
    jednostka,
    kategoria: normalizeCategory(body.kategoria),
    cena_min: optionalNumber(body.cena_min),
    cena_max: optionalNumber(body.cena_max),
    koszt_zakupu: optionalNumber(body.koszt_zakupu),
    dostawca: (typeof body.dostawca === "string" ? body.dostawca : "").slice(0, 200),
    opis: (typeof body.opis === "string" ? body.opis : "").slice(0, 1000),
  };
}

/** GET /api/catalog — lista zapisanych pozycji katalogu. Admin-only. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureInvoicesSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM service_catalog ORDER BY nazwa ASC;`;
  return NextResponse.json({ items: rows.map((r) => normalizeRow(r as Record<string, unknown>)) });
}

/** POST /api/catalog — dodaj pozycję do katalogu. Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const f = readCatalogFields(body);
  if (!f.nazwa) return NextResponse.json({ error: "Podaj nazwę pozycji." }, { status: 400 });

  await ensureInvoicesSchema();
  const sql = getSql();
  const id = randomUUID();
  await sql`
    INSERT INTO service_catalog
      (id, nazwa, cena_netto, vat_stawka, jednostka, kategoria, cena_min, cena_max, koszt_zakupu, dostawca, opis)
    VALUES
      (${id}, ${f.nazwa}, ${f.cena_netto}, ${f.vat_stawka}, ${f.jednostka}, ${f.kategoria},
       ${f.cena_min}, ${f.cena_max}, ${f.koszt_zakupu}, ${f.dostawca}, ${f.opis});
  `;
  const rows = await sql`SELECT * FROM service_catalog ORDER BY nazwa ASC;`;
  return NextResponse.json({ ok: true, id, items: rows.map((r) => normalizeRow(r as Record<string, unknown>)) });
}
