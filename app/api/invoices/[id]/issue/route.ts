import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { formatInvoiceNumber } from "@/lib/invoices";

export const runtime = "nodejs";

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** POST /api/invoices/:id/issue — "wystaw fakturę": nadaje numer (kolejny/rok),
 * ustawia daty (jeśli puste) i status "Wystawiona". Numer nadawany dopiero tu,
 * żeby szkice nie zużywały numeracji. Admin-only. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();

  const rows = await sql`SELECT * FROM invoices WHERE id = ${id};`;
  const inv = rows[0];
  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });

  const itemCount = await sql`SELECT COUNT(*)::int AS n FROM invoice_items WHERE invoice_id = ${id};`;
  if (Number(itemCount[0]?.n ?? 0) === 0) {
    return NextResponse.json({ error: "Faktura bez pozycji — dodaj co najmniej jedną pozycję." }, { status: 400 });
  }

  const today = new Date();
  const year = today.getFullYear();

  // Numer: kolejny w obrębie roku. Zachowaj istniejący, jeśli już nadany.
  let numer = typeof inv.numer === "string" && inv.numer ? inv.numer : null;
  if (!numer) {
    const numbered = await sql`SELECT numer FROM invoices WHERE numer IS NOT NULL AND numer LIKE ${"%/" + year};`;
    let maxSeq = 0;
    for (const r of numbered) {
      const m = /^(\d+)\//.exec(String(r.numer));
      if (m) maxSeq = Math.max(maxSeq, Number(m[1]));
    }
    numer = formatInvoiceNumber(maxSeq + 1, year);
  }

  const settings = await sql`SELECT domyslny_termin_dni FROM company_settings WHERE id = 'default';`;
  const terminDni = Number(settings[0]?.domyslny_termin_dni ?? 14);

  const dataWyst = inv.data_wystawienia ? String(inv.data_wystawienia).slice(0, 10) : toLocalISO(today);
  const dataSprz = inv.data_sprzedazy ? String(inv.data_sprzedazy).slice(0, 10) : dataWyst;
  const termin = inv.termin_platnosci
    ? String(inv.termin_platnosci).slice(0, 10)
    : toLocalISO(new Date(today.getTime() + terminDni * 86400000));

  await sql`
    UPDATE invoices
    SET numer = ${numer}, status = 'Wystawiona',
        data_wystawienia = ${dataWyst}, data_sprzedazy = ${dataSprz}, termin_platnosci = ${termin},
        updated_at = now()
    WHERE id = ${id};
  `;
  return NextResponse.json({ ok: true, numer });
}
