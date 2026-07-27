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
    // Moduł 40 — wysyłka nie może iść unieważnionym linkiem. Świadomie NIE
    // regenerujemy tokenu po cichu: nowy link to osobna, jawna decyzja.
    if (offer.share_revoked_at) return NextResponse.json({ error: "Link do tej oferty jest unieważniony — wygeneruj nowy przed wysyłką." }, { status: 409 });
    if (!offer.klient_email) return NextResponse.json({ error: "Brak adresu e-mail klienta — uzupełnij go w edytorze." }, { status: 400 });

    // MIGAWKA — robimy ją PRZED wysyłką maila, żeby link w mailu od pierwszej
    // sekundy prowadził do treści, która właśnie poszła. Kolejność ma tu
    // znaczenie: mail wychodzi raz, migawkę da się powtórzyć.
    const pozycjeDoMigawki = await sql`SELECT * FROM offer_items WHERE offer_id = ${id} ORDER BY position ASC;`;
    const sekcjeDoMigawki = await sql`SELECT * FROM offer_sections WHERE offer_id = ${id} ORDER BY position ASC;`;
    await sql`
      UPDATE offers SET
        migawka = ${JSON.stringify({ offer, items: pozycjeDoMigawki, sections: sekcjeDoMigawki })},
        migawka_at = now()
      WHERE id = ${id};
    `;

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
    // `wyslana_at` liczy się od KAŻDEJ wysyłki (także ponownej), bo od niej
    // liczy się cisza po stronie klienta — a przypominacz pyta właśnie
    // „ile dni bez decyzji". Ponowna wysyłka zeruje też ślad przypomnienia.
    await sql`UPDATE offers SET wyslana_at = now(), przypomniano_at = NULL WHERE id = ${id};`;
    const clientId = typeof offer.client_id === "string" ? offer.client_id : null;
    await logClientEvent(sql, clientId, "offer_sent", `Wysłano ofertę „${tytul}” mailem`, null, id);

    // shareToken wraca do panelu, żeby przycisk „Unieważnij link" (Moduł 40)
    // pojawił się od razu po wysyłce, bez przeładowania edytora.
    return NextResponse.json({ ok: true, status, shareToken: token });
  } catch (err) {
    console.error("[POST /api/offers/:id/send] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd wysyłki: ${message}` }, { status: 500 });
  }
}
