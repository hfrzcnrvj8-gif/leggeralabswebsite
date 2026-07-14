import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureContractsSchema } from "@/lib/db";

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
  const { lead_id, client_id, project_id, offer_id, ...publicContract } = contract;
  void lead_id;
  void client_id;
  void project_id;
  void offer_id;
  const settings = await sql`SELECT * FROM company_settings WHERE id = 'default';`;
  return NextResponse.json({ contract: { ...publicContract, cena: Number(contract.cena) }, settings: settings[0] ?? null });
}
