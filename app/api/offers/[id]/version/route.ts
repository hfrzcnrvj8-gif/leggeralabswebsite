import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureOffersSchema, ensureClientsSchema, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/offers/:id/version — nowa WERSJA oferty.
 *
 * Różnica wobec `duplicate`: duplikat jest osobną, niepowiązaną ofertą (druga
 * oferta dla stałego klienta — świadomie wspierany przypadek), a wersja to ta
 * sama rozmowa handlowa po poprawce zakresu. Poprzedniczka dostaje
 * `superseded_at` i wypada z liczników: nie jest ani wygrana, ani przegrana.
 *
 * Kopiujemy pozycje (z ich opcjonalnością) i bloki treści; NIE kopiujemy
 * statusu, ważności, tokenu ani śladu otwarcia — nowa wersja startuje jako
 * czysty szkic z własnym linkiem. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await ensureOffersSchema();
    await ensureClientsSchema();
    const sql = getSql();

    const rows = await sql`SELECT * FROM offers WHERE id = ${id};`;
    const src = rows[0];
    if (!src) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (src.status === "Zaakceptowana") {
      return NextResponse.json(
        { error: "Oferta jest zaakceptowana — nowa wersja nie ma czego zastąpić. Zrób duplikat, jeśli to nowa sprzedaż." },
        { status: 409 }
      );
    }

    const items = await sql`SELECT * FROM offer_items WHERE offer_id = ${id} ORDER BY position ASC;`;
    const sections = await sql`SELECT * FROM offer_sections WHERE offer_id = ${id} ORDER BY position ASC;`;
    const wersja = Number(src.wersja ?? 1) + 1;

    const newId = randomUUID();
    await sql`
      INSERT INTO offers (
        id, tytul, lead_id, client_id, klient_nazwa, klient_nip, klient_adres,
        klient_ulica, klient_kod, klient_miasto, klient_kraj, klient_email, jezyk, waluta, uwagi,
        parent_offer_id, wersja
      )
      VALUES (
        ${newId}, ${src.tytul}, ${src.lead_id}, ${src.client_id}, ${src.klient_nazwa}, ${src.klient_nip}, ${src.klient_adres},
        ${src.klient_ulica}, ${src.klient_kod}, ${src.klient_miasto}, ${src.klient_kraj}, ${src.klient_email}, ${src.jezyk}, ${src.waluta}, ${src.uwagi},
        ${id}, ${wersja}
      );
    `;

    let pos = 0;
    for (const it of items) {
      await sql`
        INSERT INTO offer_items (id, offer_id, nazwa, ilosc, jednostka, cena, position, opcjonalna, wybrana)
        VALUES (${randomUUID()}, ${newId}, ${it.nazwa}, ${it.ilosc}, ${it.jednostka}, ${it.cena}, ${pos}, ${it.opcjonalna}, false);
      `;
      pos += 1;
    }
    let sPos = 0;
    for (const sekcja of sections) {
      await sql`
        INSERT INTO offer_sections (id, offer_id, tytul, tresc, position)
        VALUES (${randomUUID()}, ${newId}, ${sekcja.tytul}, ${sekcja.tresc}, ${sPos});
      `;
      sPos += 1;
    }

    // Poprzedniczka schodzi z afisza: `superseded_at` wyjmuje ją z liczników,
    // a status „Wygasła" mówi wprost, że nie czeka już na decyzję klienta.
    // Świadomie NIE „Odrzucona" — nikt jej nie odrzucił, została zastąpiona,
    // a wrzucenie tego do statystyki przegranych fałszowałoby powody porażek.
    await sql`
      UPDATE offers SET superseded_at = now(), status = 'Wygasła', updated_at = now()
      WHERE id = ${id};
    `;

    await logClientEvent(
      sql,
      typeof src.client_id === "string" ? src.client_id : null,
      "offer_created",
      `Nowa wersja oferty „${src.tytul || "(bez tytułu)"}” (wersja ${wersja})`,
      null,
      newId
    );

    return NextResponse.json({ ok: true, id: newId, wersja });
  } catch (err) {
    console.error("[POST /api/offers/:id/version] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd tworzenia wersji: ${message}` }, { status: 500 });
  }
}
