import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureOffersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { blokadaOferty } from "@/lib/blokadaDokumentu";

export const runtime = "nodejs";

/** Domyślna jednostka nowej pozycji wg języka wydruku — bliźniak
 * `DEFAULT_UNIT` z `app/api/invoices/[id]/items/route.ts`. */
const DOMYSLNA_JEDNOSTKA: Record<string, string> = { pl: "szt.", en: "pcs.", de: "Stk." };

/** POST /api/offers/:id/items — dodaj pozycję do oferty. Admin-only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await ensureOffersSchema();
  const sql = getSql();

  // Treść wysłanej oferty jest zamknięta — patrz lib/blokadaDokumentu.ts.
  const stanOferty = (await sql`SELECT status FROM offers WHERE id = ${id};`)[0];
  if (!stanOferty) return NextResponse.json({ error: "not found" }, { status: 404 });
  const blokadaTresci = blokadaOferty(String(stanOferty.status ?? ""));
  if (blokadaTresci.zablokowane) {
    return NextResponse.json({ error: blokadaTresci.komunikat }, { status: 409 });
  }

  const offer = await sql`SELECT id, jezyk FROM offers WHERE id = ${id};`;
  if (!offer[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const posRows = await sql`SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM offer_items WHERE offer_id = ${id};`;
  const pos = Number(posRows[0]?.pos ?? 0);
  const itemId = randomUUID();
  const nazwa = typeof body.nazwa === "string" ? body.nazwa.slice(0, 500) : "";
  // Wstawienie z katalogu (Moduł 47) podaje jednostkę i cenę bazową; ręczne
  // „+ Pozycja" ich nie podaje → zostają domyślne (jednostka wg języka, 0).
  // Koszt zakupu z katalogu tu NIE trafia — pozycja oferty to niezależna
  // kopia bez marży.
  //
  // Jednostka domyślna szła kiedyś na sztywno „szt.", także na ofercie
  // wystawionej po niemiecku — audyt Modułu 57 zobaczył na wydruku
  // „EINHEIT: szt.". Faktury miały to poprawnie od dawna (DEFAULT_UNIT
  // w api/invoices/[id]/items); oferty dostały ten sam słownik.
  const jednostka =
    typeof body.jednostka === "string" && body.jednostka.trim()
      ? body.jednostka.slice(0, 20)
      : DOMYSLNA_JEDNOSTKA[String(offer[0].jezyk)] ?? DOMYSLNA_JEDNOSTKA.pl;
  const cenaRaw = Number(body.cena);
  const cena = Number.isFinite(cenaRaw) && cenaRaw >= 0 ? cenaRaw : 0;
  // Ilość szła na sztywno `1`, mimo że ciało żądania mogło ją podać — panel
  // zaraz potem robi PATCH, więc nikt tego nie widział, ale trasa wołana
  // z zewnątrz (apka, skrypt, katalog) gubiła ilość bez śladu błędu.
  const iloscRaw = Number(body.ilosc);
  const ilosc = Number.isFinite(iloscRaw) && iloscRaw >= 0 ? iloscRaw : 1;
  await sql`
    INSERT INTO offer_items (id, offer_id, nazwa, ilosc, jednostka, cena, position)
    VALUES (${itemId}, ${id}, ${nazwa}, ${ilosc}, ${jednostka}, ${cena}, ${pos});
  `;
  const items = await sql`SELECT * FROM offer_items WHERE offer_id = ${id} ORDER BY position ASC;`;
  return NextResponse.json({ ok: true, items: items.map((r) => ({ ...r, ilosc: Number(r.ilosc), cena: Number(r.cena) })) });
}
