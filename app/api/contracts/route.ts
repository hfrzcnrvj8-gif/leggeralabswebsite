import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureContractsSchema, ensureOffersSchema, ensureLeadsSchema, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import type { Offer, OfferItem } from "@/lib/offers";
import type { Lead } from "@/lib/leads";

export const runtime = "nodejs";

/** Sufit listy — wzorzec z Modułu 54 (krok 3a) i Ofert.
 *
 * Trasa oddawała WSZYSTKIE dokumenty bez limitu, więc przy kilkuset umowach
 * jedno wejście na zakładkę wciągało całą tabelę do przeglądarki i do apki.
 * Sufit sam w sobie byłby gorszy od braku sufitu (lista po cichu niepełna),
 * dlatego idzie z `total` — panel mówi wprost, ilu dokumentów NIE pokazuje. */
const SUFIT_UMOW = 1000;

/** GET /api/contracts — lista umów+NDA. Admin-only. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureContractsSchema();
  const sql = getSql();
  const total = Number((await sql`SELECT COUNT(*)::int AS n FROM contracts;`)[0]?.n ?? 0);
  const rows = await sql`SELECT * FROM contracts ORDER BY created_at DESC LIMIT ${SUFIT_UMOW};`;
  return NextResponse.json({ contracts: rows, total, limit: SUFIT_UMOW });
}

/** POST /api/contracts — nowy dokument (szkic).
 * typ="umowa": zwykle z offer_id zaakceptowanej oferty — kopiuje dane
 * klienta, zakres (z pozycji) i kwotę (jeśli umowa dla tej oferty już
 * istnieje, zwraca jej id zamiast tworzyć duplikat). Bez offer_id tworzy
 * wolnostojący szkic (np. do podglądu szablonu klauzul, zanim jest
 * jakakolwiek prawdziwa oferta) — pola zmienne uzupełnia się ręcznie.
 * typ="nda": zwykle z lead_id — kopiuje dane firmy z leada; bez lead_id
 * tworzy wolnostojące NDA (np. rozmowa jeszcze przed założeniem leada). */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  await ensureContractsSchema();
  await ensureOffersSchema();
  await ensureLeadsSchema();
  const sql = getSql();

  const typ = body.typ === "nda" ? "nda" : "umowa";

  if (typ === "umowa") {
    const offerId = typeof body.offer_id === "string" && body.offer_id.trim() ? body.offer_id : "";
    if (!offerId) {
      const id = randomUUID();
      const klientNazwa = typeof body.klient_nazwa === "string" ? body.klient_nazwa.slice(0, 300) : "";
      await sql`INSERT INTO contracts (id, typ, klient_nazwa) VALUES (${id}, 'umowa', ${klientNazwa});`;
      return NextResponse.json({ ok: true, id });
    }

    const existing = await sql`SELECT id FROM contracts WHERE offer_id = ${offerId} AND typ = 'umowa' LIMIT 1;`;
    if (existing.length > 0) return NextResponse.json({ ok: true, id: existing[0].id });

    const offerRows = await sql`SELECT * FROM offers WHERE id = ${offerId};`;
    const offer = offerRows[0] as Offer | undefined;
    if (!offer) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (offer.status !== "Zaakceptowana") {
      return NextResponse.json({ error: "Umowę można wygenerować dopiero po akceptacji oferty." }, { status: 409 });
    }

    const items = (await sql`SELECT * FROM offer_items WHERE offer_id = ${offerId} ORDER BY position ASC;`) as OfferItem[];
    const zakresPrac = items.map((it) => `- ${it.nazwa} (${it.ilosc} ${it.jednostka})`).join("\n");
    const cena = items.reduce((sum, it) => sum + Number(it.ilosc) * Number(it.cena), 0);

    const id = randomUUID();
    await sql`
      INSERT INTO contracts (
        id, typ, lead_id, client_id, project_id, offer_id,
        klient_nazwa, klient_nip, klient_ulica, klient_kod, klient_miasto, klient_kraj, klient_email,
        zakres_prac, cena, waluta, jezyk
      ) VALUES (
        ${id}, 'umowa', ${offer.lead_id}, ${offer.client_id}, ${offer.project_id}, ${offerId},
        ${offer.klient_nazwa}, ${offer.klient_nip}, ${offer.klient_ulica}, ${offer.klient_kod}, ${offer.klient_miasto}, ${offer.klient_kraj}, ${offer.klient_email},
        ${zakresPrac}, ${cena}, ${offer.waluta || "PLN"}, ${offer.jezyk}
      );
    `;
    await logClientEvent(sql, offer.client_id, "contract_created", `Wygenerowano umowę z oferty „${offer.tytul || "(bez tytułu)"}”`, null, id);
    return NextResponse.json({ ok: true, id });
  }

  // typ === "nda" — zwykle z leada (przycisk "Wyślij NDA" w panelu leada),
  // ale dopuszczamy też wolnostojące NDA (bez lead_id) — np. rozmowa
  // odkrywcza jeszcze przed założeniem leada w panelu.
  const leadId = typeof body.lead_id === "string" && body.lead_id.trim() ? body.lead_id : null;
  const id = randomUUID();

  if (leadId) {
    const leadRows = await sql`SELECT * FROM leads WHERE id = ${leadId};`;
    const lead = leadRows[0] as Lead | undefined;
    if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Dedupe jak przy umowie z oferty (wyżej). Do Modułu 51 tej gałęzi nie
    // miała: „+ Przygotuj NDA" na leadzie było jednorazowym strzałem bez
    // śladu na wizytówce, więc drugie kliknięcie tydzień później robiło
    // drugie NDA dla tej samej firmy. Odrzucone świadomie NIE blokuje —
    // kontrahent odmówił podpisu, więc kolejne podejście to nowy dokument,
    // nie duplikat.
    const existingNda = await sql`
      SELECT id FROM contracts
      WHERE lead_id = ${leadId} AND typ = 'nda' AND status <> 'Odrzucona'
      ORDER BY created_at DESC LIMIT 1;
    `;
    if (existingNda.length > 0) {
      return NextResponse.json({ ok: true, id: existingNda[0].id, existing: true });
    }
    await sql`
      INSERT INTO contracts (
        id, typ, lead_id, client_id,
        klient_nazwa, klient_ulica, klient_kod, klient_miasto, klient_kraj, klient_email
      ) VALUES (
        ${id}, 'nda', ${leadId}, ${lead.client_id ?? null},
        ${lead.firma}, ${lead.ulica}, ${lead.kod}, ${lead.miasto}, ${lead.kraj}, ${lead.email}
      );
    `;
    if (lead.client_id) await logClientEvent(sql, lead.client_id, "nda_created", "Utworzono NDA", null, id);
    return NextResponse.json({ ok: true, id });
  }

  const klientNazwa = typeof body.klient_nazwa === "string" ? body.klient_nazwa.slice(0, 300) : "";
  await sql`INSERT INTO contracts (id, typ, klient_nazwa) VALUES (${id}, 'nda', ${klientNazwa});`;
  return NextResponse.json({ ok: true, id });
}
