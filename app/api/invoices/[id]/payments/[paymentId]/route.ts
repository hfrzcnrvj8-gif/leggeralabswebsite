import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { totalPaid } from "@/lib/invoices";

export const runtime = "nodejs";

/** DELETE /api/invoices/:id/payments/:paymentId — usuwa zarejestrowaną wpłatę.
 * Symetria z POST .../payments (który podbija status na "Opłacona", gdy
 * wpłaty pokryją brutto): jeśli usunięcie zdejmuje fakturę poniżej progu
 * pełnej zapłaty, cofa status z powrotem na "Wystawiona". Bez tego usunięcie
 * wpłaty, która wcześniej domknęła fakturę, zostawiało `status = 'Opłacona'`
 * na fakturze faktycznie nieopłaconej. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, paymentId } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();

  const inv = await sql`SELECT status, rozlicza_zaliczke_id FROM invoices WHERE id = ${id};`;
  if (!inv[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  await sql`DELETE FROM invoice_payments WHERE id = ${paymentId};`;

  let status = String(inv[0].status);
  if (status === "Opłacona") {
    const payments = await sql`SELECT kwota FROM invoice_payments WHERE invoice_id = ${id};`;
    const paymentsNum = payments.map((p) => ({ kwota: Number(p.kwota) }));

    const totals = await sql`
      SELECT COALESCE(SUM(ilosc * cena_netto * (1 - rabat_procent / 100) * (1 + CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END)), 0)::float8 AS brutto
      FROM invoice_items WHERE invoice_id = ${id};
    `;
    let brutto = Number(totals[0]?.brutto ?? 0);
    const rozliczaZaliczkeId = typeof inv[0].rozlicza_zaliczke_id === "string" ? inv[0].rozlicza_zaliczke_id : null;
    if (rozliczaZaliczkeId) {
      const zTotals = await sql`
        SELECT COALESCE(SUM(ilosc * cena_netto * (1 - rabat_procent / 100) * (1 + CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END)), 0)::float8 AS brutto
        FROM invoice_items WHERE invoice_id = ${rozliczaZaliczkeId};
      `;
      brutto = Math.max(0, brutto - Number(zTotals[0]?.brutto ?? 0));
    }
    if (!(brutto > 0 && totalPaid(paymentsNum) >= brutto)) {
      status = "Wystawiona";
      await sql`UPDATE invoices SET status = 'Wystawiona', updated_at = now() WHERE id = ${id};`;
    }
  }

  return NextResponse.json({ ok: true, status });
}
