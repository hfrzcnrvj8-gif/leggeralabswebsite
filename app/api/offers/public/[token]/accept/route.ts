import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOffersSchema, ensureClientsSchema } from "@/lib/db";
import { acceptOffer } from "@/lib/offerAccept";
import { notify } from "@/lib/notificationLog";
import { SHARE_LINK_REVOKED_MESSAGE } from "@/lib/shareLinks";
import type { Offer } from "@/lib/offers";

export const runtime = "nodejs";

/** POST /api/offers/public/:token/accept — e-podpis klienta (Faza I).
 * Świadomie brak isAuthed() — token pełni rolę hasła-w-linku, wzorem
 * publicznego GET obok. W przeciwieństwie do adminowej ścieżki NIGDY nie
 * omija wygaśnięcia oferty (brak odpowiednika confirmExpired) — klient nie
 * może samodzielnie "ożywić" starej oferty jednym kliknięciem. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
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

  const items = await sql`SELECT * FROM offer_items WHERE offer_id = ${offer.id} ORDER BY position ASC;`;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  const result = await acceptOffer(offer, items as { nazwa: string; ilosc: number; jednostka: string; cena: number }[], {
    allowExpired: false,
    acceptedByName: name,
    acceptedIp: ip,
    acceptedUserAgent: userAgent,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, expired: result.expired }, { status: result.status });
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

  return NextResponse.json({ ok: true, acceptedByName: name });
}
