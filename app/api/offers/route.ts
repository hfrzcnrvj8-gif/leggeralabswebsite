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
  let clientId: string | null = null;

  if (leadId) {
    const lead = (await sql`SELECT firma, branza, telefon, email, www, client_id FROM leads WHERE id = ${leadId};`)[0];
    const firma = typeof lead?.firma === "string" ? lead.firma : "";
    if (!klientNazwa) klientNazwa = firma;
    if (!tytul) tytul = firma ? `Oferta — ${firma}` : "";

    // Pierwsza oferta dla leada = sygnał, że jest realna szansa coś sprzedać —
    // to moment, w którym Lead automatycznie "awansuje" na Klienta (patrz
    // lib/clients.ts). Jeśli lead ma już podpiętego klienta (np. przez ręczne
    // "Utwórz klienta" albo poprzednią ofertę), używamy tego samego rekordu
    // zamiast tworzyć duplikat.
    if (lead?.client_id) {
      clientId = String(lead.client_id);
    } else if (lead) {
      clientId = randomUUID();
      await sql`
        INSERT INTO clients (id, nazwa, branza, telefon, email, www, lead_id)
        VALUES (${clientId}, ${firma}, ${lead.branza}, ${lead.telefon}, ${lead.email}, ${lead.www}, ${leadId});
      `;
      await sql`UPDATE leads SET client_id = ${clientId}, updated_at = now() WHERE id = ${leadId};`;
      await logClientEvent(sql, clientId, "client_created", "Awansował z leada przy tworzeniu pierwszej oferty");
    }
  }

  await sql`
    INSERT INTO offers (id, tytul, lead_id, klient_nazwa, client_id)
    VALUES (${id}, ${tytul}, ${leadId}, ${klientNazwa}, ${clientId});
  `;
  await logClientEvent(sql, clientId, "offer_created", `Utworzono ofertę „${tytul || "(bez tytułu)"}”`);
  return NextResponse.json({ ok: true, id });
}
