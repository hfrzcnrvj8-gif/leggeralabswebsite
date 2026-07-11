import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOffersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { OFFER_LANGS } from "@/lib/offers";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
function numItems(rows: Row[]): Row[] {
  return rows.map((r) => ({ ...r, ilosc: Number(r.ilosc), cena: Number(r.cena) }));
}

/** GET /api/offers/:id — oferta + pozycje. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureOffersSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM offers WHERE id = ${id};`;
  const offer = rows[0];
  if (!offer) return NextResponse.json({ error: "not found" }, { status: 404 });
  const items = await sql`SELECT * FROM offer_items WHERE offer_id = ${id} ORDER BY position ASC;`;
  return NextResponse.json({ offer, items: numItems(items) });
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
    if ("uwagi" in body) await sql`UPDATE offers SET uwagi = ${str(body.uwagi, 2000)}, updated_at = now() WHERE id = ${id};`;
    if ("status" in body) await sql`UPDATE offers SET status = ${str(body.status, 40)}, updated_at = now() WHERE id = ${id};`;
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
