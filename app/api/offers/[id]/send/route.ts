import { NextRequest, NextResponse } from "next/server";
import { celDokumentu, getSql, ensureOffersSchema, ensureOfferShareToken, logZdarzenieDokumentu, odnotujWyslanaWiadomosc, kopertaDokumentu } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { zlozMail } from "@/lib/kopertaMaila";
import { formatPlDate } from "@/lib/dates";
import { sprawdzDokumentPrzedWysylka, odmowaBramki, mimoOstrzezen } from "@/lib/bramkaWysylki";
import { odczytajPotwierdzenie, odmowaPotwierdzenia } from "@/lib/nieodwracalne";
import { wystawcaDoMigawki } from "@/lib/publicFields";

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

    const pozycjeDoMigawki = await sql`SELECT * FROM offer_items WHERE offer_id = ${id} ORDER BY position ASC;`;
    const sekcjeDoMigawki = await sql`SELECT * FROM offer_sections WHERE offer_id = ${id} ORDER BY position ASC;`;
    const wystawca = wystawcaDoMigawki((await sql`SELECT * FROM company_settings WHERE id = 'default';`)[0]);

    // BRAMKA WYSYŁKI (Faza 2) — jedna funkcja odpowiada, co jest nie tak
    // z dokumentem, zanim wyjdzie. Zastąpiła własne `if (!klient_email)`:
    // ta trasa blokowała brak maila KLIENTA, ale przepuszczała dokument bez
    // wystawcy (znalezisko A2 — oferta wyszła i została zaakceptowana
    // z rubryką „Wystawca —”). Odmowa stoi TUTAJ, nie w edytorze: blokada
    // w interfejsie nie jest blokadą.
    const bramka = sprawdzDokumentPrzedWysylka({
      rodzaj: "oferta",
      dokument: offer,
      wystawca,
      pozycje: pozycjeDoMigawki,
      sekcje: sekcjeDoMigawki,
    });
    const odmowa = odmowaBramki(bramka, mimoOstrzezen(await req.json().catch(() => null)));
    if (odmowa) return NextResponse.json({ error: odmowa.error, bramka: odmowa.bramka }, { status: odmowa.status });

    // POTWIERDZENIE (Faza 4) — PO bramce: najpierw „czy to wolno wysłać”,
    // dopiero potem „czy na pewno teraz”. Odwrotna kolejność kazałaby
    // potwierdzać wysyłkę dokumentu, który i tak nie ma prawa wyjść.
    const odmowaPotw = odmowaPotwierdzenia("oferta-wyslij", odczytajPotwierdzenie(req.headers));
    if (odmowaPotw) {
      return NextResponse.json({ error: odmowaPotw.error, potwierdzenie: odmowaPotw.potwierdzenie }, { status: odmowaPotw.status });
    }

    // MIGAWKA — robimy ją PRZED wysyłką maila, żeby link w mailu od pierwszej
    // sekundy prowadził do treści, która właśnie poszła. Kolejność ma tu
    // znaczenie: mail wychodzi raz, migawkę da się powtórzyć.
    //
    // `wystawca` dołączył w Fazie 2: bez niego publiczny link czytał dane
    // firmy NA ŻYWO, więc zmiana nazwy albo numeru konta zmieniała wstecz
    // dokument, który klient wciąż mógł otworzyć (znalezisko A2, druga część).
    await sql`
      UPDATE offers SET
        migawka = ${JSON.stringify({ offer, items: pozycjeDoMigawki, sections: sekcjeDoMigawki, wystawca })},
        migawka_at = now()
      WHERE id = ${id};
    `;

    const token = await ensureOfferShareToken(sql, id, typeof offer.share_token === "string" ? offer.share_token : null);
    const url = `${req.nextUrl.origin}/pl/oferta/${token}`;
    const tytul = typeof offer.tytul === "string" && offer.tytul ? offer.tytul : "oferta";

    // ── Krok 2 planu `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md` ─────────────────────
    //
    // D4: mail o wersji 2 był co do formy IDENTYCZNY z mailem o wersji 1
    // („w załączeniu link do oferty: …"). Że to poprawiona propozycja, wynikało
    // wyłącznie z tematu wpisanego ręcznie przez właściciela — a stary link
    // wciąż działa (decyzja właściciela 1: zostaje do wglądu). Klient miał więc
    // dwie żywe oferty i żadnego zdania o tym, która obowiązuje.
    //
    // D3, druga część: żaden mail z ofertą nie podawał daty ważności, choć
    // panel ją zna i po niej sam oznacza ofertę jako wygasłą.
    const wersja = Number(offer.wersja) || 1;
    const waznaDo = typeof offer.wazna_do === "string" ? offer.wazna_do : null;
    const koperta = await kopertaDokumentu(sql, offer, wystawca);

    await sendEmail({
      to: String(offer.klient_email),
      subject: wersja > 1 ? `Nowa wersja oferty — ${tytul}` : `Oferta — ${tytul}`,
      text: zlozMail(koperta, "zwykly", [
        wersja > 1
          ? `w załączeniu poprawiona oferta: ${tytul} (wersja ${wersja}).`
          : `w załączeniu link do oferty: ${tytul}.`,
        ``,
        url,
        ``,
        ...(wersja > 1
          ? [`Ta wersja zastępuje poprzednią propozycję — wcześniejsza przestaje obowiązywać.`, ``]
          : []),
        ...(waznaDo ? [`Oferta jest ważna do ${formatPlDate(waznaDo)}.`, ``] : []),
        `Ofertę można podejrzeć i zapisać jako PDF pod powyższym adresem.`,
      ]),
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
    const cel = celDokumentu(offer);
    await logZdarzenieDokumentu(sql, cel, "offer_sent", `Wysłano ofertę „${tytul}” mailem`, null, id);
    // B3 — wiadomość poszła do klienta, więc „Ostatni kontakt" idzie za nią.
    await odnotujWyslanaWiadomosc(sql, cel);

    // shareToken wraca do panelu, żeby przycisk „Unieważnij link" (Moduł 40)
    // pojawił się od razu po wysyłce, bez przeładowania edytora.
    return NextResponse.json({ ok: true, status, shareToken: token });
  } catch (err) {
    console.error("[POST /api/offers/:id/send] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd wysyłki: ${message}` }, { status: 500 });
  }
}
