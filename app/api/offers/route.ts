import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureOffersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/offers — lista ofert z sumą kwoty (do listy). Admin-only. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureOffersSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT o.*, COALESCE(t.kwota, 0)::float8 AS kwota
    FROM offers o
    LEFT JOIN (
      SELECT offer_id, SUM(ilosc * cena) AS kwota
      FROM offer_items GROUP BY offer_id
    ) t ON t.offer_id = o.id
    ORDER BY o.created_at DESC;
  `;
  return NextResponse.json({ offers: rows });
}

/** POST /api/offers — nowa oferta (szkic). Może wejść z leada (kopiujemy
 * nazwę firmy jako dane klienta). Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  await ensureOffersSchema();
  const sql = getSql();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

  const id = randomUUID();
  const leadId = typeof body?.lead_id === "string" && body.lead_id.trim() ? body.lead_id : null;

  let tytul = str(body?.tytul, 300);
  let klientNazwa = str(body?.klient_nazwa, 300);
  if (leadId && (!tytul || !klientNazwa)) {
    const lead = await sql`SELECT firma FROM leads WHERE id = ${leadId};`;
    const firma = typeof lead[0]?.firma === "string" ? lead[0].firma : "";
    if (!klientNazwa) klientNazwa = firma;
    if (!tytul) tytul = firma ? `Oferta — ${firma}` : "";
  }

  await sql`
    INSERT INTO offers (id, tytul, lead_id, klient_nazwa)
    VALUES (${id}, ${tytul}, ${leadId}, ${klientNazwa});
  `;
  return NextResponse.json({ ok: true, id });
}
