import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { pickFields, DUNNING_PUBLIC_FIELDS, COMPANY_SETTINGS_PUBLIC_FIELDS } from "@/lib/publicFields";
import { SHARE_LINK_REVOKED_MESSAGE } from "@/lib/shareLinks";

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
  // 410 Gone, nie 404 (Moduł 40). Znacznik unieważnienia jest WŁASNY dla
  // wezwania — unieważnienie linku do faktury nie rusza wezwania i odwrotnie,
  // tak jak same tokeny są celowo osobne.
  if (invoice.wezwanie_share_revoked_at) return NextResponse.json({ error: SHARE_LINK_REVOKED_MESSAGE }, { status: 410 });
  const settings = await sql`SELECT * FROM company_settings WHERE id = 'default';`;
  return NextResponse.json({
    invoice: pickFields(invoice, DUNNING_PUBLIC_FIELDS),
    settings: settings[0] ? pickFields(settings[0], COMPANY_SETTINGS_PUBLIC_FIELDS) : null,
  });
}
