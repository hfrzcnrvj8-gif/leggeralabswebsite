import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOffersSchema } from "@/lib/db";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
function numItems(rows: Row[]): Row[] {
  return rows.map((r) => ({ ...r, ilosc: Number(r.ilosc), cena: Number(r.cena) }));
}

/** GET /api/offers/public/:token — podgląd oferty dla KLIENTA, bez logowania
 * (link wysyłany mailem). Świadomie brak isAuthed() — token jest losowy (32
 * znaki hex) i pełni rolę hasła-w-linku; wzorem app/api/invoices/public. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await ensureOffersSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM offers WHERE share_token = ${token} AND status != 'Szkic';`;
  const offer = rows[0];
  if (!offer) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Ukryj wewnętrzne FK-i, których wydruk nie używa (patrz analogiczna
  // adnotacja w app/api/invoices/public/[token]/route.ts).
  const { lead_id, project_id, invoice_id, ...publicOffer } = offer;
  void lead_id;
  void project_id;
  void invoice_id;
  const items = await sql`SELECT * FROM offer_items WHERE offer_id = ${offer.id} ORDER BY position ASC;`;
  const settings = await sql`SELECT * FROM company_settings WHERE id = 'default';`;
  return NextResponse.json({ offer: publicOffer, items: numItems(items), settings: settings[0] ?? null });
}
