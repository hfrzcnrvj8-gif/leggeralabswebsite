import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOffersSchema, ensureOfferShareToken, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { CLOSED_OFFER_STATUSES, type OfferStatus } from "@/lib/offers";
import { formatPlDate } from "@/lib/projects";

export const runtime = "nodejs";

/** POST /api/offers/:id/remind — uprzejme przypomnienie o ofercie bez decyzji.
 *
 * Wzorem `app/api/invoices/[id]/remind`, ale z innym tonem: faktura po terminie
 * to windykacja, oferta bez odpowiedzi to sprzedaż. Treść nie naciska — wraca
 * na wierzch skrzynki klienta razem z linkiem i wprost daje wyjście („jeśli
 * temat jest nieaktualny, proszę o krótką informację").
 *
 * Wysyłkę zawsze klika właściciel (zasada „automat proponuje, decyzję klikasz
 * Ty"); panel jedynie podpowiada, przy których ofertach cisza trwa za długo
 * (patrz `app/api/hub/today`). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await ensureOffersSchema();
    const sql = getSql();
    const rows = await sql`SELECT * FROM offers WHERE id = ${id};`;
    const offer = rows[0];
    if (!offer) return NextResponse.json({ error: "not found" }, { status: 404 });

    if (CLOSED_OFFER_STATUSES.has(String(offer.status) as OfferStatus)) {
      return NextResponse.json({ error: "Ta oferta jest już zamknięta — nie ma o czym przypominać." }, { status: 409 });
    }
    if (String(offer.status) === "Szkic") {
      return NextResponse.json({ error: "Oferta jest szkicem — najpierw ją wyślij." }, { status: 409 });
    }
    if (offer.share_revoked_at) {
      return NextResponse.json({ error: "Link do tej oferty jest unieważniony — wygeneruj nowy przed wysyłką." }, { status: 409 });
    }
    if (!offer.klient_email) {
      return NextResponse.json({ error: "Brak adresu e-mail klienta — uzupełnij go w edytorze." }, { status: 400 });
    }

    const token = await ensureOfferShareToken(sql, id, typeof offer.share_token === "string" ? offer.share_token : null);
    const url = `${req.nextUrl.origin}/pl/oferta/${token}`;
    const tytul = typeof offer.tytul === "string" && offer.tytul ? offer.tytul : "oferta";
    const waznaDo = typeof offer.wazna_do === "string" ? offer.wazna_do : null;

    await sendEmail({
      to: String(offer.klient_email),
      subject: `Przypomnienie: ${tytul}`,
      text: [
        `Dzień dobry,`,
        ``,
        `wracam do oferty „${tytul}", którą przesłałem wcześniej.`,
        ``,
        url,
        ``,
        waznaDo
          ? `Oferta jest ważna do ${formatPlDate(waznaDo)}.`
          : `Chętnie odpowiem na pytania albo dopasuję zakres.`,
        ``,
        `Jeśli temat jest nieaktualny — proszę o krótką informację, żebym nie wracał niepotrzebnie.`,
        ``,
        `Pozdrawiam,`,
        `Leggera Labs`,
      ].join("\n"),
    });

    await sql`UPDATE offers SET przypomniano_at = now(), updated_at = now() WHERE id = ${id};`;
    await logClientEvent(
      sql,
      typeof offer.client_id === "string" ? offer.client_id : null,
      "offer_sent",
      `Przypomniano o ofercie „${tytul}”`,
      null,
      id
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/offers/:id/remind] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd wysyłki przypomnienia: ${message}` }, { status: 500 });
  }
}
