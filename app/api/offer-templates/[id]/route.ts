import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOfferTemplatesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import type { OfferTemplateItem } from "@/lib/offerTemplates";

export const runtime = "nodejs";

/** PATCH /api/offer-templates/:id — edycja szablonu oferty. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  try {
    await ensureOfferTemplatesSchema();
    const sql = getSql();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

    if ("nazwa" in body) await sql`UPDATE offer_templates SET nazwa = ${str(body.nazwa, 200)}, updated_at = now() WHERE id = ${id};`;
    if ("opis" in body) await sql`UPDATE offer_templates SET opis = ${str(body.opis, 500)}, updated_at = now() WHERE id = ${id};`;
    if ("uwagi" in body) await sql`UPDATE offer_templates SET uwagi = ${str(body.uwagi, 4000)}, updated_at = now() WHERE id = ${id};`;
    if ("pozycje" in body && Array.isArray(body.pozycje)) {
      const pozycje: OfferTemplateItem[] = body.pozycje.map((it: Record<string, unknown>) => ({
        nazwa: str(it?.nazwa, 500),
        ilosc: Number.isFinite(Number(it?.ilosc)) ? Number(it.ilosc) : 1,
        jednostka: str(it?.jednostka, 20) || "szt.",
        cena: Number.isFinite(Number(it?.cena)) ? Number(it.cena) : 0,
      }));
      await sql`UPDATE offer_templates SET pozycje = ${JSON.stringify(pozycje)}, updated_at = now() WHERE id = ${id};`;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/offer-templates/:id] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu szablonu: ${message}` }, { status: 500 });
  }
}

/** DELETE /api/offer-templates/:id — usuwa szablon oferty. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureOfferTemplatesSchema();
  const sql = getSql();
  await sql`DELETE FROM offer_templates WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
