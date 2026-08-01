import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { type CatalogItem } from "@/lib/invoices";
import { czytajPolaKatalogu, normalizeCatalogRow } from "@/lib/catalog";

export const runtime = "nodejs";

/** GET /api/catalog — lista zapisanych pozycji katalogu. Admin-only. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureInvoicesSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM service_catalog ORDER BY nazwa ASC;`;
  return NextResponse.json({ items: rows.map((r) => normalizeCatalogRow(r as Record<string, unknown>)) as CatalogItem[] });
}

/** POST /api/catalog — dodaj pozycję do katalogu. Admin-only.
 *
 * Walidacja stoi w `czytajPolaKatalogu` (wspólnej z `PATCH`) i odpowiada 400
 * z powodem — do Modułu 62 ta trasa przyjmowała każdy śmieć, podmieniała go na
 * wartość domyślną i odpowiadała `{"ok":true}`. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const wynik = czytajPolaKatalogu(body);
  if (wynik.blad != null) return NextResponse.json({ error: wynik.blad }, { status: 400 });
  const f = wynik.pola;

  await ensureInvoicesSchema();
  const sql = getSql();
  const id = randomUUID();
  await sql`
    INSERT INTO service_catalog
      (id, nazwa, cena_netto, waluta, vat_stawka, jednostka, kategoria, cena_min, cena_max, koszt_zakupu, dostawca, opis)
    VALUES
      (${id}, ${f.nazwa}, ${f.cena_netto}, ${f.waluta}, ${f.vat_stawka}, ${f.jednostka}, ${f.kategoria},
       ${f.cena_min}, ${f.cena_max}, ${f.koszt_zakupu}, ${f.dostawca}, ${f.opis});
  `;
  const rows = await sql`SELECT * FROM service_catalog ORDER BY nazwa ASC;`;
  return NextResponse.json({
    ok: true,
    id,
    items: rows.map((r) => normalizeCatalogRow(r as Record<string, unknown>)) as CatalogItem[],
  });
}
