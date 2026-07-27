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
  // Klient dostaje MIGAWKĘ z chwili wysyłki, nie żywe dane (decyzja
  // właściciela 2026-07-27). Bez tego dokument „u klienta" zmieniał się razem
  // z bazą, a przy sporze nie było czego pokazać. Fallback na dane żywe
  // dotyczy ofert wysłanych przed tą zmianą — te migawki nie mają.
  const migawka = (offer.migawka ?? null) as { offer?: Record<string, unknown>; items?: unknown[]; sections?: unknown[] } | null;
  const zMigawki = migawka && Array.isArray(migawka.items);
  let items = zMigawki
    ? (migawka.items as Record<string, unknown>[])
    : await sql`SELECT * FROM offer_items WHERE offer_id = ${offer.id} ORDER BY position ASC;`;

  // `wybrana` musi być ŻYWA — to jedyne pole pozycji, które należy do KLIENTA,
  // a nie do dokumentu. Migawka powstaje przy wysyłce, więc zamraża ją na
  // „nic nie zaznaczono": po akceptacji klient wracający pod ten sam link
  // widział dodatek jako niewybrany i kwotę bez niego, choć na fakturze ten
  // dodatek był (audyt Modułu 57 — oferta AUDYT-WYBOR: certyfikat akceptacji
  // pod kwotą 1 000 zł przy fakturze na 1 500 zł). Komentarz w OfferPrint.tsx
  // zakładał dokładnie to, czego migawka nie dowoziła.
  if (zMigawki) {
    const wyborKlienta = new Map(
      (
        (await sql`SELECT id, wybrana FROM offer_items WHERE offer_id = ${offer.id};`) as unknown as {
          id: string;
          wybrana: boolean;
        }[]
      ).map((r) => [r.id, r.wybrana])
    );
    items = items.map((it) =>
      wyborKlienta.has(String(it.id)) ? { ...it, wybrana: wyborKlienta.get(String(it.id)) } : it
    );
  }
  const sections = zMigawki && Array.isArray(migawka.sections)
    ? (migawka.sections as Record<string, unknown>[])
    : await sql`SELECT id, tytul, tresc, position FROM offer_sections WHERE offer_id = ${offer.id} ORDER BY position ASC;`;
  // Nagłówek (tytuł, dane klienta, waluta, ROI) z MIGAWKI, ale wąska lista
  // pól musi zostać ŻYWA: status i ślady akceptacji. Inaczej klient po
  // podpisaniu dalej widziałby przycisk „Akceptuję".
  //
  // Kolejność scalania jest tu całą różnicą. Pierwsza wersja robiła
  // `{ ...migawka, ...offer }` — czyli żywe dane nadpisywały migawkę w
  // KOMPLECIE i cała ta funkcja nic nie dawała (złapane testem: po zmianie
  // tytułu w bazie klient widział nowy). Teraz migawka jest podstawą,
  // a z bazy dokładamy tylko to, co wymienione.
  //
  // `wazna_do` dołączyło do listy w audycie Modułu 57. Blokada dokumentu
  // JAWNIE pozwala przedłużyć ważność mimo wysyłki i nazywa to „ustępstwem
  // wobec klienta" (POLA_MIMO_BLOKADY_OFERTY) — a ustępstwo, którego klient
  // nie widzi, nie jest ustępstwem. Sonda: przedłużenie do 2026-12-31 dawało
  // 200, w bazie było 2026-12-31, a na stronie klienta dalej 2026-08-01.
  // Odwrotny kierunek był gorszy: klient widział ofertę jako ważną i dostawał
  // odmowę przy akceptacji, bo `isOfferExpired` liczy się z danych ŻYWYCH.
  const ZAWSZE_ZYWE = ["status", "accepted_at", "accepted_by_name", "share_revoked_at", "id", "created_at", "wazna_do"] as const;
  const naglowek = zMigawki && migawka?.offer
    ? { ...migawka.offer, ...Object.fromEntries(ZAWSZE_ZYWE.map((k) => [k, (offer as Record<string, unknown>)[k]])) }
    : offer;
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
    offer: pickFields(naglowek, OFFER_PUBLIC_FIELDS),
    items: numItems(items),
    // Sekcje idą w całości — to treść napisana przez właściciela DLA klienta,
    // nie kolumny rekordu, więc nie ma tu czego przesiewać białą listą.
    sections,
    settings: settings[0] ? pickFields(settings[0], COMPANY_SETTINGS_PUBLIC_FIELDS) : null,
  });
}
