import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
function numItems(rows: Row[]): Row[] {
  return rows.map((r) => ({ ...r, ilosc: Number(r.ilosc), cena_netto: Number(r.cena_netto), rabat_procent: Number(r.rabat_procent) }));
}

/** GET /api/invoices/public/:token — podgląd faktury dla KLIENTA, bez
 * logowania (link wysyłany mailem). Świadomie brak isAuthed() — token jest
 * losowy (32 znaki hex) i pełni rolę hasła-w-linku; dostępne tylko dla
 * faktur już wystawionych (szkiców nikt z zewnątrz nie powinien widzieć). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM invoices WHERE share_token = ${token} AND status != 'Szkic';`;
  const invoice = rows[0];
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Ukryj wewnętrzne FK-i i metadane, których wydruk nie używa — publiczny
  // klient nie musi widzieć powiązanych id leada/projektu ani daty ostatniego
  // przypomnienia (zasada minimalnego ujawniania danych).
  const { lead_id, project_id, last_reminder_at, ...publicInvoice } = invoice;
  void lead_id;
  void project_id;
  void last_reminder_at;
  const items = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${invoice.id} ORDER BY position ASC;`;
  const settings = await sql`SELECT * FROM company_settings WHERE id = 'default';`;
  return NextResponse.json({ invoice: publicInvoice, items: numItems(items), settings: settings[0] ?? null });
}
