import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureContractsSchema } from "@/lib/db";
import { pickFields, CONTRACT_PUBLIC_FIELDS, COMPANY_SETTINGS_PUBLIC_FIELDS } from "@/lib/publicFields";
import { SHARE_LINK_REVOKED_MESSAGE } from "@/lib/shareLinks";

export const runtime = "nodejs";

/** GET /api/contracts/public/:token — podgląd dokumentu dla drugiej strony,
 * bez logowania (link wysyłany mailem). Token pełni rolę hasła-w-linku —
 * wzorem app/api/offers/public/[token]. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await ensureContractsSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM contracts WHERE share_token = ${token} AND status != 'Szkic';`;
  const contract = rows[0];
  if (!contract) return NextResponse.json({ error: "not found" }, { status: 404 });
  // 410 Gone, nie 404 (Moduł 40) — dokument istnieje, dostęp odebrany.
  if (contract.share_revoked_at) return NextResponse.json({ error: SHARE_LINK_REVOKED_MESSAGE }, { status: 410 });
  const settings = await sql`SELECT * FROM company_settings WHERE id = 'default';`;
  // Biała lista pól (lib/publicFields.ts) — bez accepted_ip i
  // accepted_user_agent osoby podpisującej (Audyt 1, ustalenie 5).
  return NextResponse.json({
    contract: { ...pickFields(contract, CONTRACT_PUBLIC_FIELDS), cena: Number(contract.cena) },
    settings: settings[0] ? pickFields(settings[0], COMPANY_SETTINGS_PUBLIC_FIELDS) : null,
  });
}
