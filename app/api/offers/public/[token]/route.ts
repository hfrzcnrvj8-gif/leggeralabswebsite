import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOffersSchema, logClientEvent } from "@/lib/db";
import { notify } from "@/lib/notificationLog";
import { CLOSED_OFFER_STATUSES, type OfferStatus } from "@/lib/offers";
import { pickFields, OFFER_PUBLIC_FIELDS, COMPANY_SETTINGS_PUBLIC_FIELDS } from "@/lib/publicFields";
import { SHARE_LINK_REVOKED_MESSAGE } from "@/lib/shareLinks";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
function numItems(rows: Row[]): Row[] {
  return rows.map((r) => ({ ...r, ilosc: Number(r.ilosc), cena: Number(r.cena) }));
}

/** GET /api/offers/public/:token — podgląd oferty dla KLIENTA, bez logowania
 * (link wysyłany mailem). Świadomie brak isAuthed() — token jest losowy (32
 * znaki hex) i pełni rolę hasła-w-linku; wzorem app/api/invoices/public. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await ensureOffersSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM offers WHERE share_token = ${token} AND status != 'Szkic';`;
  const offer = rows[0];
  if (!offer) return NextResponse.json({ error: "not found" }, { status: 404 });
  // 410 Gone, nie 404 (Moduł 40) — dokument istnieje, dostęp odebrany.
  if (offer.share_revoked_at) return NextResponse.json({ error: SHARE_LINK_REVOKED_MESSAGE }, { status: 410 });
  const items = await sql`SELECT * FROM offer_items WHERE offer_id = ${offer.id} ORDER BY position ASC;`;
  const sections = await sql`SELECT id, tytul, tresc, position FROM offer_sections WHERE offer_id = ${offer.id} ORDER BY position ASC;`;
  const settings = await sql`SELECT * FROM company_settings WHERE id = 'default';`;

  // Ślad otwarcia (runda 2 Modułu 57). Do tej pory po wysłaniu maila zapadała
  // cisza — nie dało się odróżnić „nie przeczytał" od „przeczytał i się
  // zastanawia", a to są dwa różne telefony następnego dnia. Zapisujemy TYLKO
  // czas i licznik (bez IP, bez identyfikacji osoby).
  //
  // Zapis w GET jest tu świadomy: to jedyny moment, w którym klient dotyka
  // systemu. Nie blokuje odpowiedzi — gdyby padł, oferta i tak się pokaże.
  const pierwszeOtwarcie = !offer.otwarta_at;
  const zamknieta = CLOSED_OFFER_STATUSES.has(String(offer.status) as OfferStatus);
  try {
    await sql`
      UPDATE offers SET
        otwarta_at = COALESCE(otwarta_at, now()),
        ostatnio_otwarta_at = now(),
        liczba_otwarc = liczba_otwarc + 1
      WHERE id = ${offer.id};
    `;
    // Powiadomienie i wpis na osi TYLKO przy pierwszym otwarciu i tylko dla
    // oferty wciąż w grze — dziesiąte wejście klienta w zaakceptowaną ofertę
    // nie jest wiadomością, tylko szumem. `dedupeKey` domyka to po stronie
    // dzwonka nawet przy wyścigu dwóch żądań.
    if (pierwszeOtwarcie && !zamknieta) {
      const tytul = String(offer.tytul || "(bez tytułu)");
      await notify({
        kind: "offer_opened",
        title: `Klient otworzył ofertę: ${tytul}`,
        body: "To jest moment, w którym warto zadzwonić — oferta jest właśnie na wierzchu.",
        entity: "offer",
        entityId: String(offer.id),
        dedupeKey: `offer_opened:${offer.id}`,
      });
      await logClientEvent(
        sql,
        typeof offer.client_id === "string" ? offer.client_id : null,
        "offer_opened",
        `Klient otworzył ofertę „${tytul}”`,
        null,
        String(offer.id)
      );
    }
  } catch (err) {
    console.error("[GET /api/offers/public/:token] nie udało się zapisać otwarcia", err);
  }
  // Biała lista pól — patrz lib/publicFields.ts.
  return NextResponse.json({
    offer: pickFields(offer, OFFER_PUBLIC_FIELDS),
    items: numItems(items),
    // Sekcje idą w całości — to treść napisana przez właściciela DLA klienta,
    // nie kolumny rekordu, więc nie ma tu czego przesiewać białą listą.
    sections,
    settings: settings[0] ? pickFields(settings[0], COMPANY_SETTINGS_PUBLIC_FIELDS) : null,
  });
}
