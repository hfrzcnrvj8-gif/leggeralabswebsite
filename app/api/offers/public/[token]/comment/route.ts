import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOffersSchema, logClientEvent } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { notify } from "@/lib/notificationLog";
import { SHARE_LINK_REVOKED_MESSAGE } from "@/lib/shareLinks";

export const runtime = "nodejs";

/** POST /api/offers/public/:token/comment — „poproszę o zmianę".
 *
 * Tania wersja negocjacji w dokumencie (u konkurencji: komentarze/redlining).
 * Klient, który chce czegoś inaczej, do rundy 3 musiał wyjść z oferty i napisać
 * maila — czyli w najgorszym możliwym momencie zostawał sam.
 *
 * Świadomie BEZ isAuthed() — jak reszta publicznych tras oferty; token pełni
 * rolę hasła-w-linku. I świadomie bez zapisu treści do osobnej tabeli: prośba
 * ląduje w mailu do właściciela i na osi czasu klienta, czyli tam, gdzie i tak
 * czyta się historię rozmowy. Nowa tabela „komentarzy", której nic nie
 * odhacza, byłaby drugą skrzynką odbiorczą.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const tresc = typeof body?.tresc === "string" ? body.tresc.trim().slice(0, 4000) : "";
  const kto = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
  if (!tresc) return NextResponse.json({ error: "Napisz, co chcesz zmienić." }, { status: 400 });

  await ensureOffersSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM offers WHERE share_token = ${token} AND status != 'Szkic';`;
  const offer = rows[0];
  if (!offer) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (offer.share_revoked_at) return NextResponse.json({ error: SHARE_LINK_REVOKED_MESSAGE }, { status: 410 });

  const tytul = String(offer.tytul || "(bez tytułu)");
  const podpis = kto || String(offer.klient_nazwa || "klient");

  await notify({
    kind: "offer_change_requested",
    title: `Prośba o zmianę w ofercie: ${tytul}`,
    body: `${podpis}: ${tresc.slice(0, 200)}`,
    entity: "offer",
    entityId: String(offer.id),
    // Każda prośba to osobne zdanie do przeczytania — klucz z czasem, żeby
    // druga (np. po Twojej poprawce) nie zniknęła jako „duplikat pierwszej".
    dedupeKey: `offer_change_requested:${offer.id}:${tresc.slice(0, 40)}`,
  });

  await logClientEvent(
    sql,
    typeof offer.client_id === "string" ? offer.client_id : null,
    "offer_change_requested",
    `Klient prosi o zmianę w ofercie „${tytul}” — ${tresc.slice(0, 500)}`,
    null,
    String(offer.id)
  );

  // Mail do WŁAŚCICIELA (nie do klienta) — adres bierzemy z ustawień firmy,
  // tak samo jak dzienny raport. Gdyby go nie było, zostaje dzwonek i oś czasu.
  try {
    const settings = (await sql`SELECT email FROM company_settings WHERE id = 'default';`)[0];
    const doKogo = typeof settings?.email === "string" ? settings.email : process.env.RESEND_FROM;
    if (doKogo) {
      await sendEmail({
        to: doKogo,
        subject: `Prośba o zmianę w ofercie: ${tytul}`,
        text: [`${podpis} prosi o zmianę w ofercie „${tytul}":`, ``, tresc, ``, `Oferta: ${req.nextUrl.origin}/pl/admin/offers/${offer.id}`].join("\n"),
      });
    }
  } catch (err) {
    console.error("[POST /api/offers/public/:token/comment] mail do właściciela nie poszedł", err);
  }

  return NextResponse.json({ ok: true });
}
