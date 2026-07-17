import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureOffersSchema, ensureClientsSchema, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/offers/:id/duplicate — kopiuje dane klienta i pozycje do nowej
 * oferty-szkicu (bez ważności, statusu, powiązanego projektu/faktury,
 * share_tokenu). Wzorem app/api/invoices/[id]/duplicate. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await ensureOffersSchema();
    await ensureClientsSchema(); // client_id w INSERT niżej — kolumna z tej migracji
    const sql = getSql();

    const rows = await sql`SELECT * FROM offers WHERE id = ${id};`;
    const src = rows[0];
    if (!src) return NextResponse.json({ error: "not found" }, { status: 404 });
    const items = await sql`SELECT * FROM offer_items WHERE offer_id = ${id} ORDER BY position ASC;`;

    const newId = randomUUID();
    await sql`
      INSERT INTO offers (
        id, tytul, lead_id, client_id, klient_nazwa, klient_nip, klient_adres,
        klient_ulica, klient_kod, klient_miasto, klient_kraj, klient_email, jezyk, uwagi
      )
      VALUES (
        ${newId}, ${src.tytul}, ${src.lead_id}, ${src.client_id}, ${src.klient_nazwa}, ${src.klient_nip}, ${src.klient_adres},
        ${src.klient_ulica}, ${src.klient_kod}, ${src.klient_miasto}, ${src.klient_kraj}, ${src.klient_email}, ${src.jezyk}, ${src.uwagi}
      );
    `;

    let pos = 0;
    for (const it of items) {
      await sql`
        INSERT INTO offer_items (id, offer_id, nazwa, ilosc, jednostka, cena, position)
        VALUES (${randomUUID()}, ${newId}, ${it.nazwa}, ${it.ilosc}, ${it.jednostka}, ${it.cena}, ${pos});
      `;
      pos += 1;
    }

    // Oś czasu klienta dostaje duplikat tak samo jak ofertę z POST /api/offers
    // — to też jest nowa oferta, tylko o krótszej drodze powstania.
    await logClientEvent(
      sql,
      typeof src.client_id === "string" ? src.client_id : null,
      "offer_created",
      `Utworzono ofertę „${src.tytul || "(bez tytułu)"}” (duplikat)`,
      null,
      newId
    );

    return NextResponse.json({ ok: true, id: newId });
  } catch (err) {
    console.error("[POST /api/offers/:id/duplicate] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd duplikowania oferty: ${message}` }, { status: 500 });
  }
}
