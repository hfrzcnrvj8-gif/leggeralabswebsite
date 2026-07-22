import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOffersSchema } from "@/lib/db";
import { pickFields, OFFER_PUBLIC_FIELDS, COMPANY_SETTINGS_PUBLIC_FIELDS } from "@/lib/publicFields";
import { SHARE_LINK_REVOKED_MESSAGE } from "@/lib/shareLinks";

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
  // 410 Gone, nie 404 (Moduł 40) — dokument istnieje, dostęp odebrany.
  if (offer.share_revoked_at) return NextResponse.json({ error: SHARE_LINK_REVOKED_MESSAGE }, { status: 410 });
  const items = await sql`SELECT * FROM offer_items WHERE offer_id = ${offer.id} ORDER BY position ASC;`;
  const settings = await sql`SELECT * FROM company_settings WHERE id = 'default';`;
  // Biała lista pól — patrz lib/publicFields.ts.
  return NextResponse.json({
    offer: pickFields(offer, OFFER_PUBLIC_FIELDS),
    items: numItems(items),
    settings: settings[0] ? pickFields(settings[0], COMPANY_SETTINGS_PUBLIC_FIELDS) : null,
  });
}
