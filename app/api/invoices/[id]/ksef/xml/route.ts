import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { DEFAULT_COMPANY_SETTINGS, type Invoice, type InvoiceItem, type CompanySettings } from "@/lib/invoices";
import { buildFA3Xml, validateForFA3 } from "@/lib/ksef";

export const runtime = "nodejs";

/**
 * GET /api/invoices/:id/ksef/xml — generuje dokument FA(3) z faktury (Krok 2).
 * W PEŁNI OFFLINE: składa i waliduje XML lokalnie, NIC nie wysyła do KSeF.
 *   • domyślnie      → JSON { xml, validation: { errors, warnings } }
 *   • ?download=1    → surowy plik XML jako załącznik (do wglądu/archiwum)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();

  const rows = await sql`SELECT * FROM invoices WHERE id = ${id};`;
  const invoice = rows[0] as unknown as Invoice | undefined;
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });

  const itemRows = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${id} ORDER BY position ASC;`;
  const items = itemRows.map((r) => ({
    ...(r as Record<string, unknown>),
    ilosc: Number((r as Record<string, unknown>).ilosc),
    cena_netto: Number((r as Record<string, unknown>).cena_netto),
  })) as unknown as InvoiceItem[];

  const settingsRows = await sql`SELECT * FROM company_settings WHERE id = 'default';`;
  const company = (settingsRows[0] as unknown as CompanySettings) ?? DEFAULT_COMPANY_SETTINGS;

  const validation = validateForFA3(invoice, items, company);
  const xml = buildFA3Xml(invoice, items, company);

  if (req.nextUrl.searchParams.get("download") === "1") {
    const fname = `FA3_${(invoice.numer || id).replace(/[^\w.-]/g, "_")}.xml`;
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fname}"`,
      },
    });
  }

  return NextResponse.json({ xml, validation });
}
