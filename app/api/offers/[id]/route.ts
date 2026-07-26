import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOffersSchema, ensureContractsSchema, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { OFFER_LANGS, isOfferStatus, isOfferCurrency, isOfferRejectReason, rejectReasonLabel } from "@/lib/offers";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
function numItems(rows: Row[]): Row[] {
  return rows.map((r) => ({ ...r, ilosc: Number(r.ilosc), cena: Number(r.cena) }));
}

/** GET /api/offers/:id — oferta + pozycje + umowa wygenerowana z tej oferty
 * (jeśli już istnieje).
 *
 * `contract` dokładamy TUTAJ, a nie osobnym żądaniem z przeglądarki, bo bez
 * niego karta oferty nie wiedziała, że umowa już jest: przycisk zawsze mówił
 * „Wygeneruj umowę", a serwer po cichu oddawał istniejącą (dedupe w
 * POST /api/contracts). Idempotencja bez widocznego śladu to połowa roboty —
 * patrz to samo ustalenie przy NDA na leadzie (Moduł 51). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureOffersSchema();
  await ensureContractsSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM offers WHERE id = ${id};`;
  const offer = rows[0];
  if (!offer) return NextResponse.json({ error: "not found" }, { status: 404 });
  const items = await sql`SELECT * FROM offer_items WHERE offer_id = ${id} ORDER BY position ASC;`;
  const contracts = await sql`
    SELECT id, status, typ FROM contracts
    WHERE offer_id = ${id} AND typ = 'umowa'
    ORDER BY created_at ASC LIMIT 1;
  `;
  return NextResponse.json({ offer, items: numItems(items), contract: contracts[0] ?? null });
}

/** PATCH /api/offers/:id — aktualizacja pól nagłówka oferty. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  try {
    await ensureOffersSchema();
    const sql = getSql();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
    const dateOrNull = (v: unknown): string | null | undefined => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      if (!t) return null;
      return isPlausibleDateString(t) ? t : undefined;
    };

    if ("tytul" in body) await sql`UPDATE offers SET tytul = ${str(body.tytul, 300)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_nazwa" in body) await sql`UPDATE offers SET klient_nazwa = ${str(body.klient_nazwa, 300)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_nip" in body) await sql`UPDATE offers SET klient_nip = ${str(body.klient_nip, 30)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_adres" in body) await sql`UPDATE offers SET klient_adres = ${str(body.klient_adres, 500)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_ulica" in body) await sql`UPDATE offers SET klient_ulica = ${str(body.klient_ulica, 300)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_kod" in body) await sql`UPDATE offers SET klient_kod = ${str(body.klient_kod, 20)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_miasto" in body) await sql`UPDATE offers SET klient_miasto = ${str(body.klient_miasto, 200)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_kraj" in body) await sql`UPDATE offers SET klient_kraj = ${str(body.klient_kraj, 100)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_email" in body) await sql`UPDATE offers SET klient_email = ${str(body.klient_email, 200)}, updated_at = now() WHERE id = ${id};`;
    if ("client_id" in body) {
      const cid = typeof body.client_id === "string" && body.client_id.trim() ? body.client_id : null;
      await sql`UPDATE offers SET client_id = ${cid}, updated_at = now() WHERE id = ${id};`;
    }
    if ("uwagi" in body) await sql`UPDATE offers SET uwagi = ${str(body.uwagi, 2000)}, updated_at = now() WHERE id = ${id};`;
    if ("waluta" in body) {
      if (!isOfferCurrency(body.waluta)) return NextResponse.json({ error: "invalid waluta" }, { status: 400 });
      await sql`UPDATE offers SET waluta = ${body.waluta}, updated_at = now() WHERE id = ${id};`;
    }
    if ("status" in body) {
      // Walidacja wobec OFFER_STATUSES: wcześniej przechodził tu DOWOLNY
      // string do 40 znaków, więc literówka („Wyslana") wypadała naraz ze
      // wszystkich liczników — z filtra, z koloru pigułki i z ważonego
      // pipeline'u (fallback wagi = 1 zawyżałby prognozę).
      if (!isOfferStatus(body.status)) return NextResponse.json({ error: "invalid status" }, { status: 400 });
      const nowy = body.status;
      const przed = (await sql`SELECT status, tytul, client_id FROM offers WHERE id = ${id};`)[0];
      if (!przed) return NextResponse.json({ error: "not found" }, { status: 404 });
      const poprzedni = String(przed.status ?? "");
      const clientId = typeof przed.client_id === "string" ? przed.client_id : null;
      const tytul = String(przed.tytul || "(bez tytułu)");

      if (nowy === "Odrzucona") {
        const powod = isOfferRejectReason(body.powod_odrzucenia) ? body.powod_odrzucenia : "";
        const komentarz = str(body.komentarz_odrzucenia, 500);
        await sql`
          UPDATE offers SET status = ${nowy}, powod_odrzucenia = ${powod},
            komentarz_odrzucenia = ${komentarz}, odrzucona_at = now(), updated_at = now()
          WHERE id = ${id};
        `;
        if (poprzedni !== nowy) {
          const dlaczego = rejectReasonLabel(powod, komentarz);
          await logClientEvent(
            sql,
            clientId,
            "offer_rejected",
            `Odrzucono ofertę „${tytul}”${dlaczego ? ` — ${dlaczego}` : ""}`,
            null,
            id
          );
        }
      } else {
        // Wyjście z „Odrzucona" sprząta powód — inaczej ofercie wróconej do
        // gry zostawałby na karcie nieaktualny napis „Za drogo".
        await sql`
          UPDATE offers SET status = ${nowy}, updated_at = now(),
            powod_odrzucenia = '', komentarz_odrzucenia = '', odrzucona_at = NULL
          WHERE id = ${id};
        `;
        if (nowy === "Wygasła" && poprzedni !== nowy) {
          await logClientEvent(sql, clientId, "offer_expired", `Oferta „${tytul}” wygasła bez decyzji`, null, id);
        }
      }
    }
    if ("jezyk" in body) {
      const v = typeof body.jezyk === "string" && (OFFER_LANGS as string[]).includes(body.jezyk) ? body.jezyk : "pl";
      await sql`UPDATE offers SET jezyk = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("lead_id" in body) {
      const v = typeof body.lead_id === "string" && body.lead_id.trim() ? body.lead_id : null;
      await sql`UPDATE offers SET lead_id = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("wazna_do" in body) {
      const v = dateOrNull(body.wazna_do);
      if (v === undefined) return NextResponse.json({ error: "invalid wazna_do" }, { status: 400 });
      await sql`UPDATE offers SET wazna_do = ${v}, updated_at = now() WHERE id = ${id};`;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/offers/:id] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu oferty: ${message}` }, { status: 500 });
  }
}

/** DELETE /api/offers/:id — usuwa ofertę (kaskadowo pozycje). Projekt/faktura
 * utworzone przy akceptacji NIE są usuwane — to już osobne, samodzielne byty. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureOffersSchema();
  const sql = getSql();
  await sql`DELETE FROM offers WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
