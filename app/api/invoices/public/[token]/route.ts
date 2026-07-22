import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { pickFields, INVOICE_PUBLIC_FIELDS, COMPANY_SETTINGS_PUBLIC_FIELDS } from "@/lib/publicFields";
import { SHARE_LINK_REVOKED_MESSAGE } from "@/lib/shareLinks";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
function numItems(rows: Row[]): Row[] {
  return rows.map((r) => ({ ...r, ilosc: Number(r.ilosc), cena_netto: Number(r.cena_netto), rabat_procent: Number(r.rabat_procent) }));
}

/** GET /api/invoices/public/:token — podgląd faktury dla KLIENTA, bez
 * logowania (link wysyłany mailem). Świadomie brak isAuthed() — token jest
 * losowy (32 znaki hex) i pełni rolę hasła-w-linku; dostępne tylko dla
 * faktur już wystawionych (szkiców nikt z zewnątrz nie powinien widzieć)
 * i tylko dopóki właściciel nie unieważni linku (Moduł 40). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM invoices WHERE share_token = ${token} AND status != 'Szkic';`;
  const invoice = rows[0];
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });
  // 410 Gone, nie 404: dokument istnieje, tylko dostęp odebrano — druga
  // strona ma to wiedzieć, żeby nie szukała literówki w adresie.
  if (invoice.share_revoked_at) return NextResponse.json({ error: SHARE_LINK_REVOKED_MESSAGE }, { status: 410 });
  const items = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${invoice.id} ORDER BY position ASC;`;
  const settings = await sql`SELECT * FROM company_settings WHERE id = 'default';`;
  // Biała lista pól (Moduł 40, patrz lib/publicFields.ts) — czarna lista
  // wypuszczała każdą nowo dodaną kolumnę, w tym drugi token (wezwania).
  return NextResponse.json({
    invoice: pickFields(invoice, INVOICE_PUBLIC_FIELDS),
    items: numItems(items),
    settings: settings[0] ? pickFields(settings[0], COMPANY_SETTINGS_PUBLIC_FIELDS) : null,
  });
}
