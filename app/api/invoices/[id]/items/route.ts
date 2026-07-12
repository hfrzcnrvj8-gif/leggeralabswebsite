import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { VAT_RATES } from "@/lib/invoices";

export const runtime = "nodejs";

// Domyślna jednostka nowej pozycji, dopasowana do języka faktury — inaczej
// polskie "szt." wyglądałoby dziwnie na fakturze wystawionej po angielsku.
const DEFAULT_UNIT: Record<string, string> = { pl: "szt.", en: "pcs.", de: "Stk." };

/** POST /api/invoices/:id/items — dodaj pozycję do faktury. Admin-only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await ensureInvoicesSchema();
  const sql = getSql();

  const inv = await sql`SELECT jezyk FROM invoices WHERE id = ${id};`;
  if (!inv[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  const unit = DEFAULT_UNIT[String(inv[0].jezyk)] ?? DEFAULT_UNIT.pl;

  const posRows = await sql`SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM invoice_items WHERE invoice_id = ${id};`;
  const pos = Number(posRows[0]?.pos ?? 0);
  const itemId = randomUUID();
  // Domyślnie pusta pozycja; opcjonalnie od razu wypełniona danymi z katalogu
  // (nazwa, cena, VAT, jednostka), gdy body je poda — jeden request zamiast
  // dodawania i osobnego edytowania każdego pola.
  const nazwa = typeof body.nazwa === "string" ? body.nazwa.slice(0, 500) : "";
  const cenaRaw = Number(body.cena_netto);
  const cena = Number.isFinite(cenaRaw) ? cenaRaw : 0;
  const vat = typeof body.vat_stawka === "string" && (VAT_RATES as readonly string[]).includes(body.vat_stawka) ? body.vat_stawka : "23";
  const jednostka = typeof body.jednostka === "string" && body.jednostka.trim() ? body.jednostka.slice(0, 20) : unit;
  const iloscRaw = Number(body.ilosc);
  const ilosc = Number.isFinite(iloscRaw) && iloscRaw > 0 ? iloscRaw : 1;
  await sql`
    INSERT INTO invoice_items (id, invoice_id, nazwa, ilosc, jednostka, cena_netto, vat_stawka, position)
    VALUES (${itemId}, ${id}, ${nazwa}, ${ilosc}, ${jednostka}, ${cena}, ${vat}, ${pos});
  `;
  const items = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${id} ORDER BY position ASC;`;
  return NextResponse.json({ ok: true, items: items.map((r) => ({ ...r, ilosc: Number(r.ilosc), cena_netto: Number(r.cena_netto) })) });
}
