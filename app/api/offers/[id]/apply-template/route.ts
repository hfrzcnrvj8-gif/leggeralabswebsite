import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureOffersSchema, ensureOfferTemplatesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/offers/:id/apply-template — wstawia pozycje i uwagi szablonu do
 * istniejącej oferty (dopisuje pozycje na końcu, uwagi doklejane pod
 * istniejącą treścią, jeśli już coś tam było). Czysta kopia — po wstawieniu
 * wszystko jest zwykłą, w pełni edytowalną pozycją oferty, bez powiązania z
 * szablonem. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const templateId = typeof body.template_id === "string" ? body.template_id : "";
  if (!templateId) return NextResponse.json({ error: "missing template_id" }, { status: 400 });

  try {
    await ensureOffersSchema();
    await ensureOfferTemplatesSchema();
    const sql = getSql();

    const offerRows = await sql`SELECT id, uwagi FROM offers WHERE id = ${id};`;
    const offer = offerRows[0];
    if (!offer) return NextResponse.json({ error: "not found" }, { status: 404 });

    const templateRows = await sql`SELECT * FROM offer_templates WHERE id = ${templateId};`;
    const template = templateRows[0];
    if (!template) return NextResponse.json({ error: "template not found" }, { status: 404 });

    const pozycje = (typeof template.pozycje === "string" ? JSON.parse(template.pozycje) : template.pozycje) as {
      nazwa: string;
      ilosc: number;
      jednostka: string;
      cena: number;
    }[];

    const posRows = await sql`SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM offer_items WHERE offer_id = ${id};`;
    let pos = Number(posRows[0]?.pos ?? 0);
    for (const it of pozycje) {
      await sql`
        INSERT INTO offer_items (id, offer_id, nazwa, ilosc, jednostka, cena, position)
        VALUES (${randomUUID()}, ${id}, ${it.nazwa}, ${it.ilosc}, ${it.jednostka}, ${it.cena}, ${pos});
      `;
      pos += 1;
    }

    const templateUwagi = typeof template.uwagi === "string" ? template.uwagi : "";
    if (templateUwagi.trim()) {
      const existing = typeof offer.uwagi === "string" ? offer.uwagi : "";
      const nextUwagi = existing.trim() ? `${existing}\n\n${templateUwagi}` : templateUwagi;
      await sql`UPDATE offers SET uwagi = ${nextUwagi}, updated_at = now() WHERE id = ${id};`;
    }

    const items = await sql`SELECT * FROM offer_items WHERE offer_id = ${id} ORDER BY position ASC;`;
    const offerAfter = await sql`SELECT * FROM offers WHERE id = ${id};`;
    return NextResponse.json({
      ok: true,
      items: items.map((r) => ({ ...r, ilosc: Number(r.ilosc), cena: Number(r.cena) })),
      offer: offerAfter[0],
    });
  } catch (err) {
    console.error("[POST /api/offers/:id/apply-template] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd wstawiania szablonu: ${message}` }, { status: 500 });
  }
}
