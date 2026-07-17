import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureOffersSchema, ensureClientsSchema, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/offers — lista ofert z sumą kwoty (do listy). Admin-only. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureOffersSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT o.*, COALESCE(t.kwota, 0)::float8 AS kwota
    FROM offers o
    LEFT JOIN (
      SELECT offer_id, SUM(ilosc * cena) AS kwota
      FROM offer_items GROUP BY offer_id
    ) t ON t.offer_id = o.id
    ORDER BY o.created_at DESC;
  `;
  return NextResponse.json({ offers: rows });
}

/** POST /api/offers — nowa oferta (szkic). Może wejść z leada (kopiujemy
 * nazwę firmy jako dane klienta). Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  await ensureOffersSchema();
  // INSERT poniżej zawsze zapisuje client_id (nawet gdy oferta nie wchodzi z
  // leada) — kolumna żyje w migracji ensureClientsSchema, więc musi się
  // wykonać bezwarunkowo, nie tylko w gałęzi `if (leadId)`.
  await ensureClientsSchema();
  const sql = getSql();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

  const id = randomUUID();
  const leadId = typeof body?.lead_id === "string" && body.lead_id.trim() ? body.lead_id : null;

  let tytul = str(body?.tytul, 300);
  let klientNazwa = str(body?.klient_nazwa, 300);
  // Moduł 30: oferta może wejść z gotowym klientem (picker przy „+ Dodaj
  // ofertę"), nie tylko wywieść go z leada. Wybór wprost wygrywa z leadem.
  let clientId = typeof body?.client_id === "string" && body.client_id.trim() ? body.client_id : null;

  if (clientId && !klientNazwa) {
    const c = (await sql`SELECT nazwa FROM clients WHERE id = ${clientId};`)[0];
    if (typeof c?.nazwa === "string") {
      klientNazwa = c.nazwa;
      if (!tytul) tytul = klientNazwa ? `Oferta — ${klientNazwa}` : "";
    }
  }

  if (leadId) {
    const lead = (await sql`
      SELECT firma, branza, telefon, email, www, ulica, kod, miasto, kraj, client_id,
        osoba_kontaktowa, linkedin_url, zrodlo, zrodlo_kategoria, notatki
      FROM leads WHERE id = ${leadId};
    `)[0];
    const firma = typeof lead?.firma === "string" ? lead.firma : "";
    if (!klientNazwa) klientNazwa = firma;
    if (!tytul) tytul = firma ? `Oferta — ${firma}` : "";

    // Pierwsza oferta dla leada = sygnał, że jest realna szansa coś sprzedać —
    // to moment, w którym Lead automatycznie "awansuje" na Klienta (patrz
    // lib/clients.ts). Jeśli lead ma już podpiętego klienta (np. przez ręczne
    // "Utwórz klienta" albo poprzednią ofertę), używamy tego samego rekordu
    // zamiast tworzyć duplikat.
    if (clientId) {
      // Klient przyszedł wprost z pickera (Moduł 30) — nie zakładaj drugiego.
      // Jeśli lead nie miał jeszcze klienta, spinamy go z tym wybranym, żeby
      // kolejna oferta z tego leada trafiła w ten sam rekord.
      if (!lead?.client_id) {
        await sql`UPDATE leads SET client_id = ${clientId}, updated_at = now() WHERE id = ${leadId};`;
      }
    } else if (lead?.client_id) {
      clientId = String(lead.client_id);
    } else if (lead) {
      clientId = randomUUID();
      await sql`
        INSERT INTO clients (
          id, nazwa, branza, telefon, email, www, ulica, kod, miasto, kraj, lead_id,
          osoba_kontaktowa, linkedin_url, zrodlo, zrodlo_kategoria, notatki
        )
        VALUES (
          ${clientId}, ${firma}, ${lead.branza}, ${lead.telefon}, ${lead.email}, ${lead.www}, ${lead.ulica}, ${lead.kod}, ${lead.miasto}, ${lead.kraj}, ${leadId},
          ${lead.osoba_kontaktowa}, ${lead.linkedin_url}, ${lead.zrodlo}, ${lead.zrodlo_kategoria}, ${lead.notatki}
        );
      `;
      await sql`UPDATE leads SET client_id = ${clientId}, updated_at = now() WHERE id = ${leadId};`;
      await logClientEvent(sql, clientId, "client_created", "Awansował z leada przy tworzeniu pierwszej oferty");
    }
  }

  await sql`
    INSERT INTO offers (id, tytul, lead_id, klient_nazwa, client_id)
    VALUES (${id}, ${tytul}, ${leadId}, ${klientNazwa}, ${clientId});
  `;
  await logClientEvent(sql, clientId, "offer_created", `Utworzono ofertę „${tytul || "(bez tytułu)"}”`, null, id);
  return NextResponse.json({ ok: true, id });
}
