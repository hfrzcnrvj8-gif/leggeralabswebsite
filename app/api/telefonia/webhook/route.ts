import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureLeadsSchema, ensureClientsSchema } from "@/lib/db";
import { findContactsByPhone } from "@/lib/contactLookup";
import { CONTACT_DIRECTIONS, CALL_OUTCOMES } from "@/lib/contact";
import { todayLocalISO } from "@/lib/dates";

export const runtime = "nodejs";

/**
 * POST /api/telefonia/webhook?token=... — automatyczne logowanie połączeń
 * z dostawcy VoIP (patrz [[telefonia-voip-plan]] w pamięci projektu i
 * docs/plany-modulow/03-kanaly-kontaktu.md). NIEUŻYWANE jeszcze naprawdę —
 * właściciel nie ma jeszcze konta VoIP (rozważana Zadarma). Endpoint
 * gotowy i przetestowany z generycznym payloadem; gdy konto powstanie,
 * trzeba będzie tylko dopasować NAZWY pól do tego, co faktycznie wysyła
 * webhook danego dostawcy (Zadarma/Sipgate/inny) — cała logika
 * dopasowania numeru i zapisu wpisu już działa.
 *
 * Uwierzytelnienie: token w query string (nie nagłówek) — większość
 * dostawców VoIP pozwala skonfigurować tylko URL webhooka, nie własne
 * nagłówki, więc token-w-URL jest jedynym uniwersalnym wariantem (ten sam
 * wzorzec co `share_token` przy publicznych linkach do faktur/ofert).
 * Fail-closed: jeśli TELEFONIA_WEBHOOK_SECRET nie jest ustawiony w env,
 * endpoint jest zablokowany, nie cicho publiczny (wzorem CRON_SECRET w
 * app/api/leads/notify/route.ts).
 *
 * Oczekiwany payload (JSON) — dostosuj do konkretnego dostawcy przy
 * podłączaniu:
 * {
 *   "telefon": "600100200",              // wymagane — numer drugiej strony
 *   "kierunek": "wychodzacy" | "przychodzacy", // opcjonalne
 *   "wynik": "odebrane" | "nieodebrane", // opcjonalne
 *   "czas_trwania_sek": 125,             // opcjonalne, tylko gdy wynik="odebrane"
 *   "opis": "Połączenie z Zadarma"       // opcjonalne, treść wpisu na osi
 * }
 *
 * Jeśli numer nie pasuje do żadnego leada/klienta, zwraca 200 z
 * `{ matched: false }` — webhooki VoIP nie powinny dostawać błędu za
 * zdarzenie, które po prostu nas nie dotyczy (np. spam/nieznany numer).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.TELEFONIA_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[POST /api/telefonia/webhook] TELEFONIA_WEBHOOK_SECRET nie jest ustawiony w env — endpoint zablokowany.");
    return NextResponse.json({ error: "TELEFONIA_WEBHOOK_SECRET nie jest skonfigurowany w env Vercela." }, { status: 500 });
  }
  const token = req.nextUrl.searchParams.get("token");
  if (token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { telefon?: unknown; kierunek?: unknown; wynik?: unknown; czas_trwania_sek?: unknown; opis?: unknown }
    | null;
  const telefon = typeof body?.telefon === "string" ? body.telefon : "";
  if (!telefon.trim()) {
    return NextResponse.json({ error: "telefon is required" }, { status: 400 });
  }

  const kierunek = (CONTACT_DIRECTIONS as readonly string[]).includes(body?.kierunek as string) ? (body!.kierunek as string) : null;
  const wynik = (CALL_OUTCOMES as readonly string[]).includes(body?.wynik as string) ? (body!.wynik as string) : null;
  const rawDuration = Number(body?.czas_trwania_sek);
  const czasTrwaniaSek =
    wynik === "odebrane" && Number.isFinite(rawDuration) && rawDuration >= 0 ? Math.min(Math.round(rawDuration), 24 * 60 * 60) : null;
  const text = typeof body?.opis === "string" && body.opis.trim() ? body.opis.trim().slice(0, 4000) : "Połączenie (automatycznie z VoIP)";

  const matches = await findContactsByPhone(telefon);
  const match = matches[0];
  if (!match) {
    return NextResponse.json({ matched: false });
  }

  await ensureLeadsSchema();
  await ensureClientsSchema();
  const sql = getSql();
  const activityId = randomUUID();
  const today = todayLocalISO();

  if (match.type === "lead") {
    await sql`
      INSERT INTO lead_activity (id, lead_id, text, kanal, kierunek, wynik, czas_trwania_sek)
      VALUES (${activityId}, ${match.id}, ${text}, 'telefon', ${kierunek}, ${wynik}, ${czasTrwaniaSek});
    `;
    await sql`UPDATE leads SET ostatni_kontakt = ${today}, ostatni_kanal = 'telefon', updated_at = now() WHERE id = ${match.id};`;
  } else {
    await sql`
      INSERT INTO client_activity (id, client_id, text, kanal, kierunek, wynik, czas_trwania_sek)
      VALUES (${activityId}, ${match.id}, ${text}, 'telefon', ${kierunek}, ${wynik}, ${czasTrwaniaSek});
    `;
    await sql`UPDATE clients SET ostatni_kontakt = ${today}, ostatni_kanal = 'telefon', updated_at = now() WHERE id = ${match.id};`;
  }

  return NextResponse.json({ matched: true, type: match.type, id: match.id });
}
