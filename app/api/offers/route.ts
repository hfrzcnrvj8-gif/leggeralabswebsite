import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureOffersSchema, ensureClientsSchema, logZdarzenieDokumentu } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { zasiejOsobeZMigawki } from "@/lib/clientContacts";
import { zKlienta, zLeada, scalDaneKlienta, zapiszDaneKlienta, PUSTE_DANE_KLIENTA } from "@/lib/przepisanie";

export const runtime = "nodejs";

/** Górny limit tego, ile ofert trasa odda naraz — ten sam wzorzec co przy
 * klientach (Moduł 54, krok 3a): sufit z GŁOŚNYM ostrzeżeniem zamiast
 * przedwczesnego stronicowania.
 *
 * Trasa świadomie NIE jest stronicowana: lista ofert filtruje, sortuje i liczy
 * SZEŚĆ wskaźników po stronie przeglądarki (ważony pipeline, skuteczność,
 * średnia wartość), a każdy z nich odpowiada na pytanie o CAŁY rejestr, nie
 * o jedną stronę. Stronicowanie bez przeniesienia tego na serwer dałoby
 * wskaźniki liczone z połowy danych — czyli liczby, które kłamią po cichu.
 * Zamiast tego obok listy leci `total` z pełnym przelicznikiem. */
const OFFERS_LIMIT = 1000;

/** GET /api/offers — lista ofert z sumą kwoty (do listy). Admin-only.
 * Zwraca `{ offers, total }` — patrz OFFERS_LIMIT. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureOffersSchema();
  const sql = getSql();
  // `COUNT(*) OVER ()` liczy się PRZED `LIMIT`, więc `total` to pełny rozmiar
  // rejestru, a nie długość zwróconej strony (jedno zapytanie zamiast dwóch —
  // neon() płaci rundę HTTP za każde).
  const rows = (await sql`
    SELECT o.*, COALESCE(t.kwota, 0)::float8 AS kwota, COUNT(*) OVER () AS _total
    FROM offers o
    LEFT JOIN (
      -- Pozycje opcjonalne wchodzą do kwoty dopiero, gdy klient je
      -- zaznaczy (runda 2 Modułu 57) — inaczej lista i wskaźniki
      -- pokazywałyby cenę wariantu, którego nikt nie kupił.
      SELECT offer_id, SUM(ilosc * cena) FILTER (WHERE NOT opcjonalna OR wybrana) AS kwota
      FROM offer_items GROUP BY offer_id
    ) t ON t.offer_id = o.id
    ORDER BY o.created_at DESC
    LIMIT ${OFFERS_LIMIT};
  `) as unknown as Record<string, unknown>[];

  const total = rows.length > 0 ? Number(rows[0]._total) : 0;
  const offers = rows.map(({ _total, ...o }) => o);
  return NextResponse.json({ offers, total });
}

/** POST /api/offers — nowa oferta (szkic). Może wejść z leada albo z gotowego
 * klienta; dane klienta przepisuje `lib/przepisanie.ts` (Faza 1, luka B1 —
 * do 2026-08-02 przechodziła sama nazwa firmy, więc panel blokował potem
 * wysyłkę komunikatem „Uzupełnij e-mail klienta" nad danymi, które miał pod
 * ręką na karcie klienta). Admin-only. */
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
  // Zapamiętany lead — po niego sięga przepisanie danych, gdy oferta wchodzi
  // z leada, który nie ma jeszcze karty klienta (patrz niżej).
  let leadRow: Record<string, unknown> | null = null;

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
    leadRow = lead ?? null;
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
      await logZdarzenieDokumentu(sql, { clientId, leadId }, "client_created", "Awansował z leada przy tworzeniu pierwszej oferty");
      // Patrz `zasiejOsobeZMigawki` (Moduł 54, krok 4).
      await zasiejOsobeZMigawki(sql, clientId, String(lead.osoba_kontaktowa ?? ""));
    }
  }

  await sql`
    INSERT INTO offers (id, tytul, lead_id, klient_nazwa, client_id)
    VALUES (${id}, ${tytul}, ${leadId}, ${klientNazwa}, ${clientId});
  `;

  // ── Komplet danych klienta na dokument (luka B1) ─────────────────────────
  // Karta klienta jest źródłem pierwszego wyboru — jako jedyna ma NIP. Lead
  // wchodzi tylko wtedy, gdy karty jeszcze nie ma (nie zdarza się na tej
  // ścieżce, bo pierwsza oferta kartę zakłada, ale nie opieramy poprawności
  // na tym, że gałąź wyżej zawsze się wykona).
  const zrodlo = clientId
    ? zKlienta((await sql`SELECT nazwa, nip, ulica, kod, miasto, kraj, email FROM clients WHERE id = ${clientId};`)[0])
    : leadRow
      ? zLeada(leadRow)
      : { ...PUSTE_DANE_KLIENTA };
  // Nazwa podana wprost w żądaniu wygrywa — tak wchodzą oferty zakładane bez
  // klienta i bez leada („+ Dodaj ofertę" z samą nazwą w polu).
  const dane = scalDaneKlienta(zrodlo, { ...PUSTE_DANE_KLIENTA, nazwa: klientNazwa });
  await zapiszDaneKlienta(sql, "oferta", id, dane);

  await logZdarzenieDokumentu(sql, { clientId, leadId }, "offer_created", `Utworzono ofertę „${tytul || "(bez tytułu)"}”`, null, id);
  return NextResponse.json({ ok: true, id });
}
