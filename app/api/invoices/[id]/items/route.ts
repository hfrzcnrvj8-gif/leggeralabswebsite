import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { blokadaFaktury } from "@/lib/blokadaDokumentu";
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

  const inv = await sql`SELECT jezyk, numer FROM invoices WHERE id = ${id};`;
  if (!inv[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Wystawionej faktury nie dopisujemy — patrz lib/blokadaDokumentu.ts i
  // komentarz w trasie pozycji obok (audyt Modułu 57, 2026-07-27).
  const blokada = blokadaFaktury(inv[0].numer as string | null);
  if (blokada.zablokowane) return NextResponse.json({ error: blokada.komunikat }, { status: 409 });

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
  // Rabat przyjmowany od razu przy dodawaniu (audyt Faktur, 2026-07-31). Do tej
  // pory ta trasa `rabat_procent` IGNOROWAŁA — zapisywała 0, odpowiadała
  // `{"ok":true}` i pokazywała w odpowiedzi wyzerowaną pozycję. Rabat dawał się
  // ustawić dopiero osobnym PATCH-em, więc każdy wołający, który podał go tu
  // (apka, katalog, automatyzacja), cicho wystawiał fakturę na PEŁNĄ kwotę.
  // To ta sama rodzina błędu co reszta tego audytu: liczba wygląda wiarygodnie,
  // nic nie zapala lampki.
  const rabatRaw = Number(body.rabat_procent);
  const rabat = Number.isFinite(rabatRaw) ? Math.min(100, Math.max(0, rabatRaw)) : 0;
  await sql`
    INSERT INTO invoice_items (id, invoice_id, nazwa, ilosc, jednostka, cena_netto, vat_stawka, rabat_procent, position)
    VALUES (${itemId}, ${id}, ${nazwa}, ${ilosc}, ${jednostka}, ${cena}, ${vat}, ${rabat}, ${pos});
  `;
  // Zmiana pozycji to zmiana DOKUMENTU — więc rusza jego znacznik (etap 3).
  // Bez tego wykrywanie rozjazdu dwóch kart byłoby ślepe dokładnie na
  // najczęstszy przypadek: obie karty edytują cenę tej samej pozycji.
  await sql`UPDATE invoices SET updated_at = now() WHERE id = ${id};`;
  const items = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${id} ORDER BY position ASC;`;
  return NextResponse.json({
    ok: true,
    items: items.map((r) => ({ ...r, ilosc: Number(r.ilosc), cena_netto: Number(r.cena_netto), rabat_procent: Number(r.rabat_procent) })),
  });
}
