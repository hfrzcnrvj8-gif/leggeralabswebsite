import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { VAT_RATES, type CatalogItem } from "@/lib/invoices";
import { normalizeCategory } from "@/lib/catalog";

export const runtime = "nodejs";

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

/** PATCH /api/catalog/:id — edytuj pozycję katalogu. Admin-only. Zwraca całą
 * odświeżoną listę (jak POST), żeby UI nie musiał scalać ręcznie. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nazwa = (typeof body.nazwa === "string" ? body.nazwa : "").trim().slice(0, 500);
  if (!nazwa) return NextResponse.json({ error: "Podaj nazwę pozycji." }, { status: 400 });

  await ensureInvoicesSchema();
  const sql = getSql();
  const existing = await sql`SELECT id FROM service_catalog WHERE id = ${id};`;
  if (!existing[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const cena = Number(body.cena_netto);
  const vat =
    typeof body.vat_stawka === "string" && (VAT_RATES as readonly string[]).includes(body.vat_stawka)
      ? body.vat_stawka
      : "23";
  const jednostka = (typeof body.jednostka === "string" ? body.jednostka : "szt.").slice(0, 20) || "szt.";
  await sql`
    UPDATE service_catalog SET
      nazwa = ${nazwa},
      cena_netto = ${Number.isFinite(cena) ? cena : 0},
      vat_stawka = ${vat},
      jednostka = ${jednostka},
      kategoria = ${normalizeCategory(body.kategoria)},
      cena_min = ${optionalNumber(body.cena_min)},
      cena_max = ${optionalNumber(body.cena_max)},
      koszt_zakupu = ${optionalNumber(body.koszt_zakupu)},
      dostawca = ${(typeof body.dostawca === "string" ? body.dostawca : "").slice(0, 200)},
      opis = ${(typeof body.opis === "string" ? body.opis : "").slice(0, 1000)}
    WHERE id = ${id};
  `;
  const rows = await sql`SELECT * FROM service_catalog ORDER BY nazwa ASC;`;
  return NextResponse.json({ ok: true, items: rows.map((r) => normalizeRow(r as Record<string, unknown>)) });
}

/** DELETE /api/catalog/:id — usuń pozycję z katalogu (nie rusza faktur/ofert,
 * które z niej korzystały — pozycje dokumentów to niezależne kopie). Admin-only. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();
  await sql`DELETE FROM service_catalog WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
