import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureClientsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/clients/search?q=… — szuka frazy w TREŚCI historii klientów.
 *
 * Po co osobna trasa, skoro lista klientów ma już wyszukiwarkę. Tamta filtruje
 * to, co jest w pamięci przeglądarki: nazwę, osobę, e-mail. Nie odpowie na
 * pytanie, które realnie się zadaje po pół roku — „ten klient, z którym
 * gadaliśmy o eksporcie CSV". Treść rozmów, zdarzeń i maili leży w bazie i
 * nigdy nie jest pobierana na listę, więc szukanie po niej musi iść do serwera.
 *
 * Cztery źródła, bo historia klienta ma cztery: ręczne wpisy, zdarzenia
 * systemowe, tematy i treści maili. Pomijanie któregokolwiek dałoby
 * wyszukiwarkę, która milczy o czymś, co widać na osi czasu — a wyszukiwarka,
 * której się nie ufa, jest bezużyteczna.
 *
 * Świadomie ILIKE, nie pełnotekstowy indeks Postgresa: przy rejestrze tej
 * skali to nieodczuwalne, a `to_tsvector` dla polskiego wymagałby konfiguracji
 * słownika, której ta baza nie ma. Gdy rejestr urośnie, to jest miejsce do
 * podmiany — reszta kodu nie zauważy.
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  // Dwa znaki to już sensowna fraza (np. „AI"), jeden to zwykle literówka
  // i zwróciłby pół rejestru.
  if (q.length < 2) return NextResponse.json({ hits: [] });

  await ensureClientsSchema();
  const sql = getSql();
  const like = `%${q}%`;

  const rows = await sql`
    SELECT * FROM (
      -- Wpisy powstałe z maila POMIJAMY: ta sama treść wróciłaby drugi raz
      -- z mail_messages niżej. To ten sam duplikat, który scalaliśmy na osi
      -- czasu klienta — wyszukiwarka pokazująca jedno trafienie dwa razy każe
      -- sprawdzać, czy to aby nie dwie różne rozmowy.
      SELECT a.client_id, c.nazwa, a.text AS tresc, a.created_at, 'rozmowa' AS rodzaj
      FROM client_activity a JOIN clients c ON c.id = a.client_id
      WHERE a.text ILIKE ${like} AND a.mail_message_id IS NULL
      UNION ALL
      SELECT e.client_id, c.nazwa, e.text AS tresc, e.created_at, 'zdarzenie' AS rodzaj
      FROM client_events e JOIN clients c ON c.id = e.client_id
      WHERE e.text ILIKE ${like}
      UNION ALL
      SELECT m.client_id, c.nazwa,
        COALESCE(NULLIF(m.subject, ''), '(bez tematu)') || ' — ' || COALESCE(m.body_text, '') AS tresc,
        m.received_at AS created_at, 'mail' AS rodzaj
      FROM mail_messages m JOIN clients c ON c.id = m.client_id
      WHERE m.subject ILIKE ${like} OR m.body_text ILIKE ${like}
    ) t
    ORDER BY created_at DESC
    LIMIT 30;
  `;

  return NextResponse.json({
    hits: rows.map((r) => ({
      client_id: String(r.client_id),
      nazwa: String(r.nazwa ?? ""),
      rodzaj: String(r.rodzaj),
      created_at: String(r.created_at),
      // Fragment WOKÓŁ trafienia, nie pierwsze 80 znaków: przy mailu
      // początek to grzecznościowy wstęp, a szukana fraza bywa w środku.
      fragment: fragmentWokol(String(r.tresc ?? ""), q),
    })),
  });
}

/** Wycinek treści z frazą w środku, z wielokropkami tam, gdzie uciąto. */
function fragmentWokol(tekst: string, fraza: string, promien = 60): string {
  const plaski = tekst.replace(/\s+/g, " ").trim();
  const i = plaski.toLowerCase().indexOf(fraza.toLowerCase());
  if (i < 0) return plaski.slice(0, promien * 2);
  const od = Math.max(0, i - promien);
  const do_ = Math.min(plaski.length, i + fraza.length + promien);
  return `${od > 0 ? "…" : ""}${plaski.slice(od, do_)}${do_ < plaski.length ? "…" : ""}`;
}
