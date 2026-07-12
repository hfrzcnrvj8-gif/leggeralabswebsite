import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { VAT_RATES, type CatalogItem } from "@/lib/invoices";

export const runtime = "nodejs";

function normalizeRow(r: Record<string, unknown>): CatalogItem {
  return {
    id: String(r.id),
    nazwa: String(r.nazwa ?? ""),
    cena_netto: Number(r.cena_netto ?? 0),
    vat_stawka: String(r.vat_stawka ?? "23"),
    jednostka: String(r.jednostka ?? "szt."),
    created_at: String(r.created_at ?? ""),
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
  const nazwa = (typeof body.nazwa === "string" ? body.nazwa : "").trim().slice(0, 500);
  if (!nazwa) return NextResponse.json({ error: "Podaj nazwę pozycji." }, { status: 400 });

  await ensureInvoicesSchema();
  const sql = getSql();
  const cena = Number(body.cena_netto);
  const vat = typeof body.vat_stawka === "string" && (VAT_RATES as readonly string[]).includes(body.vat_stawka) ? body.vat_stawka : "23";
  const jednostka = (typeof body.jednostka === "string" ? body.jednostka : "szt.").slice(0, 20) || "szt.";
  const id = randomUUID();
  await sql`
    INSERT INTO service_catalog (id, nazwa, cena_netto, vat_stawka, jednostka)
    VALUES (${id}, ${nazwa}, ${Number.isFinite(cena) ? cena : 0}, ${vat}, ${jednostka});
  `;
  const rows = await sql`SELECT * FROM service_catalog ORDER BY nazwa ASC;`;
  return NextResponse.json({ ok: true, id, items: rows.map((r) => normalizeRow(r as Record<string, unknown>)) });
}
