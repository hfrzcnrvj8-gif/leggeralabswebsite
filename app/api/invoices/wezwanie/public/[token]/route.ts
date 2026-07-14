import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";

export const runtime = "nodejs";

/** GET /api/invoices/wezwanie/public/:token — podgląd formalnego wezwania do
 * zapłaty dla nabywcy, bez logowania (link wysyłany mailem). Token pełni
 * rolę hasła-w-linku, osobny od `share_token` samej faktury (patrz
 * ensureInvoiceWezwanieShareToken) — wzorem app/api/contracts/public/[token].
 * Widoczne tylko po realnym wystawieniu wezwania (`wezwanie_wystawiono_at`
 * ustawione), nie zaraz po wygenerowaniu tokenu. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT i.*, COALESCE(t.brutto, 0)::float8 AS brutto
    FROM invoices i
    LEFT JOIN (
      SELECT invoice_id, SUM(ilosc * cena_netto * (1 - rabat_procent / 100) * (1 + CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END)) AS brutto
      FROM invoice_items GROUP BY invoice_id
    ) t ON t.invoice_id = i.id
    WHERE i.wezwanie_share_token = ${token} AND i.wezwanie_wystawiono_at IS NOT NULL;
  `;
  const invoice = rows[0];
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { lead_id, client_id, project_id, ...publicInvoice } = invoice;
  void lead_id;
  void client_id;
  void project_id;
  const settings = await sql`SELECT * FROM company_settings WHERE id = 'default';`;
  return NextResponse.json({ invoice: publicInvoice, settings: settings[0] ?? null });
}
