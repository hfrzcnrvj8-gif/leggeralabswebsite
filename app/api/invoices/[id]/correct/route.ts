import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/invoices/:id/correct — wystawia fakturę korygującą do wskazanej
 * (musi być już wystawiona — korygować można tylko coś, co realnie ma numer).
 * Nowa faktura startuje z pozycjami skopiowanymi z oryginału (punkt wyjścia
 * do edycji — "stan po korekcie"); oryginał zostaje nienaruszony. Numer z
 * osobnej sekwencji "KOR n/rok" nadawany dopiero przy wystawieniu korekty. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await ensureInvoicesSchema();
    const sql = getSql();

    const rows = await sql`SELECT * FROM invoices WHERE id = ${id};`;
    const src = rows[0];
    if (!src) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!src.numer) return NextResponse.json({ error: "Korektę można wystawić tylko do już wystawionej faktury." }, { status: 400 });

    const items = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${id} ORDER BY position ASC;`;

    const newId = randomUUID();
    const shareToken = randomUUID().replace(/-/g, "");
    await sql`
      INSERT INTO invoices (
        id, lead_id, project_id, klient_nazwa, klient_nip, klient_adres,
        klient_ulica, klient_kod, klient_miasto, klient_kraj,
        odbiorca_nazwa, odbiorca_ulica, odbiorca_kod, odbiorca_miasto, odbiorca_kraj,
        klient_email, share_token, typ_dokumentu, waluta, jezyk, koryguje_id,
        data_wystawienia, data_sprzedazy, termin_platnosci
      )
      VALUES (
        ${newId}, ${src.lead_id}, ${src.project_id}, ${src.klient_nazwa}, ${src.klient_nip}, ${src.klient_adres},
        ${src.klient_ulica}, ${src.klient_kod}, ${src.klient_miasto}, ${src.klient_kraj},
        ${src.odbiorca_nazwa}, ${src.odbiorca_ulica}, ${src.odbiorca_kod}, ${src.odbiorca_miasto}, ${src.odbiorca_kraj},
        ${src.klient_email}, ${shareToken}, 'faktura', ${src.waluta}, ${src.jezyk}, ${id},
        ${src.data_wystawienia}, ${src.data_sprzedazy}, ${src.termin_platnosci}
      );
    `;

    let pos = 0;
    for (const it of items) {
      await sql`
        INSERT INTO invoice_items (id, invoice_id, nazwa, ilosc, jednostka, cena_netto, vat_stawka, rabat_procent, position)
        VALUES (${randomUUID()}, ${newId}, ${it.nazwa}, ${it.ilosc}, ${it.jednostka}, ${it.cena_netto}, ${it.vat_stawka}, ${it.rabat_procent}, ${pos});
      `;
      pos += 1;
    }

    return NextResponse.json({ ok: true, id: newId });
  } catch (err) {
    console.error("[POST /api/invoices/:id/correct] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd tworzenia korekty: ${message}` }, { status: 500 });
  }
}
