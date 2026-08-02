import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOffersSchema, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { odczytajPotwierdzenie, odmowaPotwierdzenia } from "@/lib/nieodwracalne";
import { isOfferStatus } from "@/lib/offers";

export const runtime = "nodejs";

/**
 * Operacje masowe na ofertach — wzorem `app/api/clients/bulk` (Moduł 54,
 * krok 3b).
 *
 * Do 2026-07-26 pasek zaznaczenia w `OffersDashboard` wołał `PATCH`/`DELETE`
 * po jednym na ofertę: przy 30 zaznaczonych to 30 rund HTTP z przeglądarki,
 * a `neon()` płaci własną rundę za KAŻDE zapytanie SQL, więc koszt mnożył się
 * drugi raz po stronie serwera. Tutaj to jedno zapytanie na operację,
 * niezależnie od liczby zaznaczonych.
 */

/** Ile ofert wolno ruszyć jedną operacją — bezpiecznik przed żądaniem
 * sklejonym ręcznie, nie ograniczenie pracy (zaznaczenie bierze się z
 * widocznej listy, więc realnie to dziesiątki). */
const BULK_LIMIT = 500;

function readIds(body: Record<string, unknown> | null): string[] | null {
  if (!body || !Array.isArray(body.ids)) return null;
  const ids = body.ids.filter((v): v is string => typeof v === "string" && v.length > 0);
  if (ids.length === 0 || ids.length > BULK_LIMIT) return null;
  return [...new Set(ids)];
}

/** PATCH /api/offers/bulk — ustawia status na wielu ofertach.
 * Ciało: `{ ids: string[], status: OfferStatus }`.
 *
 * Świadomie WĄSKI zakres — wsadowo zmienia się to, co ma sens dla wielu
 * rekordów naraz. Powód odrzucenia celowo NIE wchodzi: jest z definicji
 * per oferta, a wpisany hurtem byłby zmyśloną statystyką („dlaczego
 * przegrywamy") zamiast prawdziwej.
 */
export async function PATCH(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const ids = readIds(body);
  if (!ids) return NextResponse.json({ error: "invalid ids" }, { status: 400 });
  if (!isOfferStatus(body?.status)) return NextResponse.json({ error: "invalid status" }, { status: 400 });
  const status = body.status;

  await ensureOffersSchema();
  const sql = getSql();

  // Stan sprzed zapisu — potrzebny do osi czasu klienta: wpis ma powstać
  // tylko dla ofert, które NAPRAWDĘ zmieniły status (drugie kliknięcie tego
  // samego przycisku nie może dopisać drugiego „odrzucono").
  const przed = (await sql`
    SELECT id, status, tytul, client_id FROM offers WHERE id = ANY(${ids}::text[]);
  `) as unknown as Record<string, unknown>[];
  if (przed.length === 0) return NextResponse.json({ ok: true, updated: 0 });

  if (status === "Odrzucona") {
    await sql`
      UPDATE offers SET status = ${status}, odrzucona_at = now(), updated_at = now()
      WHERE id = ANY(${ids}::text[]);
    `;
  } else {
    await sql`
      UPDATE offers SET status = ${status}, updated_at = now(),
        powod_odrzucenia = '', komentarz_odrzucenia = '', odrzucona_at = NULL
      WHERE id = ANY(${ids}::text[]);
    `;
  }

  const kind = status === "Odrzucona" ? "offer_rejected" : status === "Wygasła" ? "offer_expired" : null;
  if (kind) {
    for (const o of przed) {
      if (String(o.status ?? "") === status) continue;
      const clientId = typeof o.client_id === "string" ? o.client_id : null;
      if (!clientId) continue;
      const tytul = String(o.tytul || "(bez tytułu)");
      await logClientEvent(
        sql,
        clientId,
        kind,
        kind === "offer_rejected" ? `Odrzucono ofertę „${tytul}”` : `Oferta „${tytul}” wygasła bez decyzji`,
        null,
        String(o.id)
      );
    }
  }

  return NextResponse.json({ ok: true, updated: przed.length });
}

/** DELETE /api/offers/bulk — usuwa wiele ofert naraz. Ciało: `{ ids }`.
 * Pozycje lecą kaskadą (FK), projekt/faktura utworzone przy akceptacji
 * zostają — tak samo jak przy pojedynczym `DELETE /api/offers/:id`. */
export async function DELETE(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const ids = readIds(body);
  if (!ids) return NextResponse.json({ error: "invalid ids" }, { status: 400 });

  // POTWIERDZENIE (Faza 4) — usunięcie rekordów głównych jest nieodwracalne.
  const odmowaPotw = odmowaPotwierdzenia("oferty-usun-masowo", odczytajPotwierdzenie(req.headers));
  if (odmowaPotw) {
    return NextResponse.json({ error: odmowaPotw.error, potwierdzenie: odmowaPotw.potwierdzenie }, { status: odmowaPotw.status });
  }

  await ensureOffersSchema();
  const sql = getSql();
  await sql`DELETE FROM offers WHERE id = ANY(${ids}::text[]);`;
  return NextResponse.json({ ok: true, deleted: ids.length });
}
