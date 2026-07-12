import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOffersSchema, ensureClientsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { acceptOffer } from "@/lib/offerAccept";
import type { Offer } from "@/lib/offers";

export const runtime = "nodejs";

/** POST /api/offers/:id/accept — "akceptuj ofertę" z panelu (admin-only).
 * Cienki wrapper nad wspólną lib/offerAccept.ts (dzieloną z publiczną
 * ścieżką e-podpisu klienta, Faza I) — brak accepted_by_name oznacza, że to
 * właściciel kliknął "Akceptuj" w panelu, nie że klient podpisał się sam. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await ensureOffersSchema();
  await ensureClientsSchema();
  const sql = getSql();

  const rows = await sql`SELECT * FROM offers WHERE id = ${id};`;
  const offer = rows[0] as Offer | undefined;
  if (!offer) return NextResponse.json({ error: "not found" }, { status: 404 });

  const items = await sql`SELECT * FROM offer_items WHERE offer_id = ${id} ORDER BY position ASC;`;

  const result = await acceptOffer(sql, offer, items as { nazwa: string; ilosc: number; jednostka: string; cena: number }[], {
    template: typeof body.template === "string" ? body.template : undefined,
    allowExpired: body.confirmExpired === true,
    acceptedByName: null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, expired: result.expired }, { status: result.status });
  }
  return NextResponse.json({ ok: true, projectId: result.projectId, invoiceId: result.invoiceId });
}
