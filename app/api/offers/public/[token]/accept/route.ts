import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOffersSchema, ensureClientsSchema } from "@/lib/db";
import { acceptOffer } from "@/lib/offerAccept";
import { notify } from "@/lib/notificationLog";
import { sendEmail } from "@/lib/email";
import { offerReference } from "@/lib/offers";
import { SHARE_LINK_REVOKED_MESSAGE } from "@/lib/shareLinks";
import { HAMULEC_DOKUMENT_PUBLICZNY, odciskZadania, odnotujProbe, sprawdzHamulec, zglosPrzekroczenie } from "@/lib/rateLimit";
import type { Offer } from "@/lib/offers";

export const runtime = "nodejs";

/** POST /api/offers/public/:token/accept — e-podpis klienta (Faza I).
 * Świadomie brak isAuthed() — token pełni rolę hasła-w-linku, wzorem
 * publicznego GET obok. W przeciwieństwie do adminowej ścieżki NIGDY nie
 * ustawia furtek `allowExpired` / `allowZamknieta` — klient nie może
 * samodzielnie "ożywić" starej oferty jednym kliknięciem.
 *
 * Do 2026-08-04 „stara oferta" znaczyła tu wyłącznie „po dacie ważności".
 * Oferta ODRZUCONA i oferta ZASTĄPIONA nową wersją przechodziły (200) —
 * powstawał z nich projekt i szkic faktury po nieaktualnej cenie. Komplet
 * stanów trzyma teraz `ocenAkceptacje()` w lib/offers.ts, wołane przez
 * acceptOffer() poniżej. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Hamulec (audyt Modułu 57) — patrz HAMULEC_DOKUMENT_PUBLICZNY. Prawdziwy
  // klient podpisuje raz; sama akceptacja jest zabezpieczona „claimem", ale
  // limit obejmuje też próby, które nie doszły do skutku.
  const odcisk = odciskZadania(req.headers);
  const limit = await sprawdzHamulec(HAMULEC_DOKUMENT_PUBLICZNY, odcisk);
  if (!limit.dozwolone) {
    await zglosPrzekroczenie(HAMULEC_DOKUMENT_PUBLICZNY, limit.globalny);
    return NextResponse.json(
      { error: `Zbyt wiele prób. Spróbuj ponownie za ${limit.zaMinut} min.` },
      { status: 429, headers: { "Retry-After": String(limit.zaMinut * 60) } }
    );
  }
  await odnotujProbe(HAMULEC_DOKUMENT_PUBLICZNY, odcisk);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
  if (!name) return NextResponse.json({ error: "Podaj imię i nazwisko." }, { status: 400 });

  await ensureOffersSchema();
  await ensureClientsSchema();
  const sql = getSql();

  const rows = await sql`SELECT * FROM offers WHERE share_token = ${token} AND status != 'Szkic';`;
  const offer = rows[0] as Offer | undefined;
  if (!offer) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Moduł 40: unieważnienie musi wejść też TUTAJ. Blokada samego podglądu
  // byłaby połowiczna dokładnie tam, gdzie boli najbardziej — ktoś ze starym
  // linkiem mógłby dalej zaakceptować ofertę e-podpisem.
  if (offer.share_revoked_at) return NextResponse.json({ error: SHARE_LINK_REVOKED_MESSAGE }, { status: 410 });

  // Wybór klienta co do pozycji opcjonalnych (runda 2 Modułu 57). Zapisujemy
  // go PRZED akceptacją, żeby faktura i zakres projektu powstały dokładnie
  // z tego, co klient odhaczył — a nie z domyślnego zestawu. Lista id jest
  // filtrowana po `offer_id`, więc nie da się nią ruszyć cudzej oferty.
  const wybrane = Array.isArray(body?.wybrane)
    ? (body.wybrane as unknown[]).filter((v): v is string => typeof v === "string")
    : null;
  if (wybrane) {
    await sql`UPDATE offer_items SET wybrana = false WHERE offer_id = ${offer.id} AND opcjonalna;`;
    if (wybrane.length > 0) {
      await sql`
        UPDATE offer_items SET wybrana = true
        WHERE offer_id = ${offer.id} AND opcjonalna AND id = ANY(${wybrane}::text[]);
      `;
    }
  }

  const items = await sql`SELECT * FROM offer_items WHERE offer_id = ${offer.id} ORDER BY position ASC;`;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  const result = await acceptOffer(offer, items as { nazwa: string; ilosc: number; jednostka: string; cena: number; opcjonalna?: boolean; wybrana?: boolean }[], {
    allowExpired: false,
    acceptedByName: name,
    acceptedIp: ip,
    acceptedUserAgent: userAgent,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, expired: result.expired, powod: result.powod }, { status: result.status });
  }

  // Centrum powiadomień (Moduł 24 + 31) — TYLKO na publicznej trasie, nie w
  // bliźniaczym `offers/[id]/accept` (tam akceptuje sam właściciel, więc wie).
  // To najważniejsze zdarzenie w całym lejku: klient klika e-podpis o dowolnej
  // porze, panel w tle zakłada projekt i szkic faktury — a do Modułu 31
  // dzwonek o tym milczał.
  await notify({
    kind: "offer_accepted",
    title: `Oferta zaakceptowana: ${offer.tytul || "(bez tytułu)"}`,
    body: `${name} zaakceptował(a) ofertę e-podpisem. Panel założył projekt i szkic faktury — zostaje umowa do podpisu.`,
    entity: "offer",
    entityId: offer.id,
    dedupeKey: `offer_accepted:${offer.id}`,
  });

  // Potwierdzenie DLA KLIENTA. Do rundy 3 osoba, która właśnie podpisała
  // ofertę, nie dostawała od nas ani słowa: powiadomienie szło wyłącznie do
  // właściciela. Każde dojrzałe narzędzie odsyła podpisany dokument z powrotem
  // — brak tego maila wyglądał jak zignorowanie klienta w najważniejszym
  // momencie rozmowy. Wysyłka jest „best effort": gdyby padła, akceptacja
  // i tak jest zapisana, więc nie zwracamy błędu.
  if (offer.klient_email) {
    try {
      const url = `${req.nextUrl.origin}/pl/oferta/${token}`;
      await sendEmail({
        to: String(offer.klient_email),
        subject: `Potwierdzenie akceptacji — ${offer.tytul || "oferta"}`,
        text: [
          `Dzień dobry,`,
          ``,
          `potwierdzamy akceptację oferty „${offer.tytul || "oferta"}" (nr ref. ${offerReference(offer)}).`,
          ``,
          `Zaakceptowano: ${name}`,
          ``,
          `Dokument pozostaje dostępny pod tym adresem:`,
          url,
          ``,
          `Kolejny krok po naszej stronie: przygotowanie umowy do podpisu. Odezwiemy się z nią wkrótce.`,
          ``,
          `Pozdrawiamy,`,
          `Leggera Labs`,
        ].join("\n"),
      });
    } catch (err) {
      console.error("[POST /api/offers/public/:token/accept] potwierdzenie dla klienta nie poszło", err);
    }
  }

  return NextResponse.json({ ok: true, acceptedByName: name });
}
