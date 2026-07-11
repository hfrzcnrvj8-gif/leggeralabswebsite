import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/settings — dane firmy (sprzedawcy) + tryb VAT. Admin-only. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureInvoicesSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM company_settings WHERE id = 'default';`;
  return NextResponse.json({ settings: rows[0] ?? null });
}

/** PATCH /api/settings — zapis danych firmy. Admin-only. */
export async function PATCH(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  try {
    await ensureInvoicesSchema();
    const sql = getSql();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

    if ("nazwa" in body) await sql`UPDATE company_settings SET nazwa = ${str(body.nazwa, 300)}, updated_at = now() WHERE id = 'default';`;
    if ("nip" in body) await sql`UPDATE company_settings SET nip = ${str(body.nip, 30)}, updated_at = now() WHERE id = 'default';`;
    if ("adres" in body) await sql`UPDATE company_settings SET adres = ${str(body.adres, 500)}, updated_at = now() WHERE id = 'default';`;
    if ("email" in body) await sql`UPDATE company_settings SET email = ${str(body.email, 200)}, updated_at = now() WHERE id = 'default';`;
    if ("telefon" in body) await sql`UPDATE company_settings SET telefon = ${str(body.telefon, 60)}, updated_at = now() WHERE id = 'default';`;
    if ("konto" in body) await sql`UPDATE company_settings SET konto = ${str(body.konto, 60)}, updated_at = now() WHERE id = 'default';`;
    if ("bank_nazwa" in body) await sql`UPDATE company_settings SET bank_nazwa = ${str(body.bank_nazwa, 200)}, updated_at = now() WHERE id = 'default';`;
    if ("swift" in body) await sql`UPDATE company_settings SET swift = ${str(body.swift, 20)}, updated_at = now() WHERE id = 'default';`;
    if ("zwolnienie_podstawa" in body) await sql`UPDATE company_settings SET zwolnienie_podstawa = ${str(body.zwolnienie_podstawa, 300)}, updated_at = now() WHERE id = 'default';`;
    if ("vat_payer" in body) await sql`UPDATE company_settings SET vat_payer = ${Boolean(body.vat_payer)}, updated_at = now() WHERE id = 'default';`;
    if ("domyslny_termin_dni" in body) {
      const n = Number(body.domyslny_termin_dni);
      const val = Number.isFinite(n) && n >= 0 && n <= 365 ? Math.round(n) : 14;
      await sql`UPDATE company_settings SET domyslny_termin_dni = ${val}, updated_at = now() WHERE id = 'default';`;
    }

    const rows = await sql`SELECT * FROM company_settings WHERE id = 'default';`;
    return NextResponse.json({ ok: true, settings: rows[0] ?? null });
  } catch (err) {
    console.error("[PATCH /api/settings] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu danych firmy: ${message}` }, { status: 500 });
  }
}
