import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOffersSchema, ensureOfferShareToken, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

/** POST /api/offers/:id/send — wysyła klientowi mailem link do publicznego
 * podglądu oferty. Admin-only. Wzorem app/api/invoices/[id]/send. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await ensureOffersSchema();
    const sql = getSql();
    const rows = await sql`SELECT * FROM offers WHERE id = ${id};`;
    const offer = rows[0];
    if (!offer) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!offer.klient_email) return NextResponse.json({ error: "Brak adresu e-mail klienta — uzupełnij go w edytorze." }, { status: 400 });

    const token = await ensureOfferShareToken(sql, id, typeof offer.share_token === "string" ? offer.share_token : null);
    const url = `${req.nextUrl.origin}/pl/oferta/${token}`;
    const tytul = typeof offer.tytul === "string" && offer.tytul ? offer.tytul : "oferta";

    await sendEmail({
      to: String(offer.klient_email),
      subject: `Oferta — ${tytul}`,
      text: [
        `Dzień dobry,`,
        ``,
        `w załączeniu link do oferty: ${tytul}.`,
        ``,
        url,
        ``,
        `Ofertę można podejrzeć i zapisać jako PDF pod powyższym adresem.`,
        ``,
        `Pozdrawiamy,`,
        `Leggera Labs`,
      ].join("\n"),
    });

    // Wysyłka to naturalny moment przejścia Szkic → Wysłana (real-world
    // akcja "wysłałem ofertę"); zamkniętych statusów (Zaakceptowana/
    // Odrzucona/Wygasła) nie ruszamy — to świadome decyzje właściciela.
    let status = String(offer.status);
    if (status === "Szkic") {
      await sql`UPDATE offers SET status = 'Wysłana', updated_at = now() WHERE id = ${id};`;
      status = "Wysłana";
    }
    const clientId = typeof offer.client_id === "string" ? offer.client_id : null;
    await logClientEvent(sql, clientId, "offer_sent", `Wysłano ofertę „${tytul}” mailem`, null, id);

    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error("[POST /api/offers/:id/send] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd wysyłki: ${message}` }, { status: 500 });
  }
}
