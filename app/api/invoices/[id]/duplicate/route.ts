import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/invoices/:id/duplicate — kopiuje dane nabywcy/odbiorcy i
 * pozycje do nowej faktury-szkicu (bez numeru, dat, statusu, wpłat). Ciałem
 * `{ typ_dokumentu }` można nadpisać typ dokumentu — używane przez
 * "Przekształć w fakturę VAT" na proformach (Fakturownia/inFakt robią to
 * samo: proforma → kopia jako prawdziwa faktura po opłaceniu). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await ensureInvoicesSchema();
    const sql = getSql();

    const rows = await sql`SELECT * FROM invoices WHERE id = ${id};`;
    const src = rows[0];
    if (!src) return NextResponse.json({ error: "not found" }, { status: 404 });
    const items = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${id} ORDER BY position ASC;`;

    const typOverride = typeof body.typ_dokumentu === "string" && ["faktura", "proforma", "zaliczkowa"].includes(body.typ_dokumentu) ? body.typ_dokumentu : src.typ_dokumentu;
    const newId = randomUUID();
    const shareToken = randomUUID().replace(/-/g, "");
    await sql`
      INSERT INTO invoices (
        id, lead_id, project_id, klient_nazwa, klient_nip, klient_adres,
        klient_ulica, klient_kod, klient_miasto, klient_kraj,
        odbiorca_nazwa, odbiorca_ulica, odbiorca_kod, odbiorca_miasto, odbiorca_kraj,
        klient_email, share_token, typ_dokumentu, waluta, jezyk, uwagi
      )
      VALUES (
        ${newId}, ${src.lead_id}, ${src.project_id}, ${src.klient_nazwa}, ${src.klient_nip}, ${src.klient_adres},
        ${src.klient_ulica}, ${src.klient_kod}, ${src.klient_miasto}, ${src.klient_kraj},
        ${src.odbiorca_nazwa}, ${src.odbiorca_ulica}, ${src.odbiorca_kod}, ${src.odbiorca_miasto}, ${src.odbiorca_kraj},
        ${src.klient_email}, ${shareToken}, ${typOverride}, ${src.waluta}, ${src.jezyk}, ${src.uwagi}
      );
    `;

    let pos = 0;
    for (const it of items) {
      await sql`
        INSERT INTO invoice_items (id, invoice_id, nazwa, ilosc, jednostka, cena_netto, vat_stawka, position)
        VALUES (${randomUUID()}, ${newId}, ${it.nazwa}, ${it.ilosc}, ${it.jednostka}, ${it.cena_netto}, ${it.vat_stawka}, ${pos});
      `;
      pos += 1;
    }

    return NextResponse.json({ ok: true, id: newId });
  } catch (err) {
    console.error("[POST /api/invoices/:id/duplicate] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd duplikowania faktury: ${message}` }, { status: 500 });
  }
}
