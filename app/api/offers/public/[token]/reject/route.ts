import { NextRequest, NextResponse } from "next/server";
import { celDokumentu, getSql, ensureOffersSchema, ensureClientsSchema, kopertaDokumentu, logZdarzenieDokumentu } from "@/lib/db";
import { zlozMail } from "@/lib/kopertaMaila";
import { sendEmail } from "@/lib/email";
import { notify } from "@/lib/notificationLog";
import { isOfferRejectReason, ocenAkceptacje, offerReference, rejectReasonLabel, type Offer } from "@/lib/offers";
import { SHARE_LINK_REVOKED_MESSAGE } from "@/lib/shareLinks";
import { strazDokumentuPublicznego } from "@/lib/rateLimit";

export const runtime = "nodejs";

/** POST /api/offers/public/:token/reject — „dziękuję, rezygnujemy" (C1).
 *
 * **Po co ta trasa istnieje.** Do 2026-08-05 strona klienta dawała dwie drogi:
 * „Akceptuję" i „poproszę o zmianę". Klient, który chciał po prostu odmówić,
 * nie miał czego kliknąć — musiał napisać maila, a właściciel musiał pamiętać,
 * żeby przepisać powód do panelu. Czyli dokładnie ta informacja, którą panel
 * nazywa „jedynym miejscem, z którego da się odczytać, na czym realnie
 * przegrywasz", zależała od czyjejś pamięci. Decyzja właściciela z 2026-08-04.
 *
 * Świadomie BEZ isAuthed() — jak reszta publicznych tras oferty; token pełni
 * rolę hasła-w-linku.
 *
 * **Zapis idzie w TE SAME kolumny co odrzucenie z panelu**
 * (`powod_odrzucenia`, `komentarz_odrzucenia`, `odrzucona_at`) i woła ten sam
 * `logZdarzenieDokumentu("offer_rejected", …)`. Dzięki temu trzy rzeczy dzieją
 * się SAME, bez ani jednej linijki tutaj:
 *   1. wpis ląduje naraz na osi klienta i w logu leada (jeden pomocnik, krok 4),
 *   2. propozycja `odrzucona-oferta-domyka-leada` policzy się sama, bo reguły
 *      liczone są z DANYCH, nie zapisywane przy zdarzeniu (Faza 3),
 *   3. `ocenAkceptacje()` od razu zablokuje akceptację tym samym linkiem.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Hamulec — ten sam co przy e-podpisie (HAMULEC_DOKUMENT_PUBLICZNY). Trasa
  // JEDNORAZOWA: po odrzuceniu status przestaje być „Wysłana", więc druga
  // próba i tak odbija się od claimu niżej.
  const straz = await strazDokumentuPublicznego(req.headers);
  if (straz.blokada) {
    return NextResponse.json(
      { error: straz.blokada.error },
      { status: 429, headers: { "Retry-After": String(straz.blokada.zaMinut * 60) } }
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  // `OFFER_REJECT_REASONS` to ETYKIETY („Za drogo"), nie slugi — strona wysyła
  // etykietę, a tłumaczy tylko to, co POKAZUJE. Sonda kroku 4 przysłała tu
  // „za-drogo", trasa słusznie odrzuciła wartość i zapisała sam komentarz,
  // a czerwień wyglądała jak usterka panelu.
  const powod = isOfferRejectReason(body?.powod) ? body.powod : "";
  const komentarz = typeof body?.komentarz === "string" ? body.komentarz.trim().slice(0, 500) : "";
  const kto = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";

  await ensureOffersSchema();
  await ensureClientsSchema();
  const sql = getSql();

  const rows = await sql`SELECT * FROM offers WHERE share_token = ${token} AND status != 'Szkic';`;
  const offer = rows[0] as Offer | undefined;
  if (!offer) {
    await straz.odnotujNieudana();
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // Moduł 40 — unieważniony link nie zapisuje NICZEGO, także decyzji odmownej.
  if (offer.share_revoked_at) {
    await straz.odnotujNieudana();
    return NextResponse.json({ error: SHARE_LINK_REVOKED_MESSAGE }, { status: 410 });
  }

  // TA SAMA bramka co przy akceptacji i na widoku — dokument zamknięty
  // (zaakceptowany, już odrzucony, zastąpiony, przeterminowany) nie przyjmuje
  // żadnej decyzji klienta. Osobna lista stanów rozjechałaby się z tamtą przy
  // pierwszej zmianie; to lekcja z kroku 1.
  const ocena = ocenAkceptacje(offer);
  if (!ocena.mozna) {
    await straz.odnotujNieudana();
    return NextResponse.json({ error: ocena.error, powod: ocena.powod }, { status: ocena.status });
  }

  const tytul = String(offer.tytul || "(bez tytułu)");

  // Claim przez WYLICZENIE jedynego dozwolonego stanu, nie przez wykluczanie
  // zakazanych — ta druga forma przepuszcza każdy stan dodany później i to ona
  // pozwoliła kiedyś podpisać odrzuconą umowę (krok 1).
  const claimed = await sql`
    UPDATE offers SET status = 'Odrzucona', powod_odrzucenia = ${powod},
      komentarz_odrzucenia = ${komentarz}, odrzucona_at = now(), updated_at = now()
    WHERE id = ${offer.id} AND status = 'Wysłana'
    RETURNING id;
  `;
  if (claimed.length === 0) {
    await straz.odnotujNieudana();
    return NextResponse.json({ error: "Decyzja została już odnotowana." }, { status: 409 });
  }
  await straz.odnotujUdana();

  const dlaczego = rejectReasonLabel(powod, komentarz);
  await logZdarzenieDokumentu(
    sql,
    celDokumentu(offer),
    "offer_rejected",
    `Klient odrzucił ofertę „${tytul}”${dlaczego ? ` — ${dlaczego}` : ""}`,
    null,
    String(offer.id)
  );

  // Dzwonek — jak przy akceptacji przez klienta i z tego samego powodu: to
  // dzieje się o dowolnej porze, bez udziału właściciela. Bliźniacza trasa
  // adminowa (PATCH statusu) świadomie nie dzwoni — tam odrzucenie zapisuje
  // sam właściciel, więc już wie.
  await notify({
    kind: "offer_rejected",
    title: `Oferta odrzucona: ${tytul}`,
    body: `${kto || String(offer.klient_nazwa || "Klient")} zrezygnował(a)${dlaczego ? ` — ${dlaczego}` : ""}.`,
    entity: "offer",
    entityId: String(offer.id),
    dedupeKey: `offer_rejected:${offer.id}`,
  });

  // Jedno zdanie do klienta (decyzja właściciela 2026-08-05). Bez tego
  // kliknięcie „rezygnujemy" kończyło się ciszą i klient nie miał pewności, że
  // cokolwiek do nas dotarło. Świadomie BEZ próby ratowania sprzedaży — to
  // potwierdzenie odbioru, nie kolejny zabieg handlowy. Wysyłka „best effort":
  // gdyby padła, decyzja i tak jest zapisana, więc nie zwracamy błędu.
  if (offer.klient_email) {
    try {
      await sendEmail({
        to: String(offer.klient_email),
        subject: `Potwierdzenie — ${tytul}`,
        text: zlozMail(await kopertaDokumentu(sql, offer), "zwykly", [
          `dziękuję za odpowiedź w sprawie oferty „${tytul}" (nr ref. ${offerReference(offer)}).`,
          ``,
          `Odnotowałem Państwa decyzję i zamykam temat po swojej stronie.`,
          `Gdyby sytuacja się zmieniła — wystarczy odpisać na tę wiadomość.`,
        ]),
      });
    } catch (err) {
      console.error("[POST /api/offers/public/:token/reject] potwierdzenie dla klienta nie poszło", err);
    }
  }

  return NextResponse.json({ ok: true });
}
