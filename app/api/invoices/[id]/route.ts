import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
function numItems(rows: Row[]): Row[] {
  return rows.map((r) => ({ ...r, ilosc: Number(r.ilosc), cena_netto: Number(r.cena_netto) }));
}

/** GET /api/invoices/:id — faktura + pozycje + dane firmy (do podglądu). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM invoices WHERE id = ${id};`;
  const invoice = rows[0];
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });
  const items = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${id} ORDER BY position ASC;`;
  const settings = await sql`SELECT * FROM company_settings WHERE id = 'default';`;
  return NextResponse.json({ invoice, items: numItems(items), settings: settings[0] ?? null });
}

/** PATCH /api/invoices/:id — aktualizacja pól nagłówka faktury. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  await ensureInvoicesSchema();
  const sql = getSql();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const dateOrNull = (v: unknown): string | null | undefined => {
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    if (!t) return null;
    return isPlausibleDateString(t) ? t : undefined;
  };

  if ("klient_nazwa" in body) await sql`UPDATE invoices SET klient_nazwa = ${str(body.klient_nazwa, 300)}, updated_at = now() WHERE id = ${id};`;
  if ("klient_nip" in body) await sql`UPDATE invoices SET klient_nip = ${str(body.klient_nip, 30)}, updated_at = now() WHERE id = ${id};`;
  if ("klient_adres" in body) await sql`UPDATE invoices SET klient_adres = ${str(body.klient_adres, 500)}, updated_at = now() WHERE id = ${id};`;
  if ("uwagi" in body) await sql`UPDATE invoices SET uwagi = ${str(body.uwagi, 2000)}, updated_at = now() WHERE id = ${id};`;
  if ("waluta" in body) await sql`UPDATE invoices SET waluta = ${str(body.waluta, 10) || "PLN"}, updated_at = now() WHERE id = ${id};`;
  if ("status" in body) await sql`UPDATE invoices SET status = ${str(body.status, 40)}, updated_at = now() WHERE id = ${id};`;
  if ("lead_id" in body) {
    const v = typeof body.lead_id === "string" && body.lead_id.trim() ? body.lead_id : null;
    await sql`UPDATE invoices SET lead_id = ${v}, updated_at = now() WHERE id = ${id};`;
  }
  if ("project_id" in body) {
    const v = typeof body.project_id === "string" && body.project_id.trim() ? body.project_id : null;
    await sql`UPDATE invoices SET project_id = ${v}, updated_at = now() WHERE id = ${id};`;
  }
  if ("data_wystawienia" in body) {
    const v = dateOrNull(body.data_wystawienia);
    if (v === undefined) return NextResponse.json({ error: "invalid data_wystawienia" }, { status: 400 });
    await sql`UPDATE invoices SET data_wystawienia = ${v}, updated_at = now() WHERE id = ${id};`;
  }
  if ("data_sprzedazy" in body) {
    const v = dateOrNull(body.data_sprzedazy);
    if (v === undefined) return NextResponse.json({ error: "invalid data_sprzedazy" }, { status: 400 });
    await sql`UPDATE invoices SET data_sprzedazy = ${v}, updated_at = now() WHERE id = ${id};`;
  }
  if ("termin_platnosci" in body) {
    const v = dateOrNull(body.termin_platnosci);
    if (v === undefined) return NextResponse.json({ error: "invalid termin_platnosci" }, { status: 400 });
    await sql`UPDATE invoices SET termin_platnosci = ${v}, updated_at = now() WHERE id = ${id};`;
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/invoices/:id — usuwa fakturę (kaskadowo pozycje). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();
  await sql`DELETE FROM invoices WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
