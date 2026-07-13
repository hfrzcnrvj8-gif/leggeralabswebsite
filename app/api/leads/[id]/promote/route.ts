import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureClientsSchema, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/leads/:id/promote — ręczne "Utwórz klienta" na leadzie, dla
 * sytuacji gdy realna rozmowa już trwa, zanim jest gotowa oferta (druga,
 * automatyczna ścieżka to utworzenie pierwszej oferty — patrz
 * app/api/offers/route.ts POST). Idempotentne: jeśli lead ma już client_id,
 * po prostu zwraca istniejącego klienta zamiast tworzyć duplikat. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureClientsSchema();
  const sql = getSql();

  const leadRows = await sql`SELECT * FROM leads WHERE id = ${id};`;
  const lead = leadRows[0];
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (lead.client_id) return NextResponse.json({ ok: true, id: lead.client_id, alreadyExisted: true });

  const clientId = randomUUID();
  await sql`
    INSERT INTO clients (id, nazwa, branza, telefon, email, www, ulica, kod, miasto, kraj, lead_id)
    VALUES (${clientId}, ${lead.firma}, ${lead.branza}, ${lead.telefon}, ${lead.email}, ${lead.www}, ${lead.ulica}, ${lead.kod}, ${lead.miasto}, ${lead.kraj}, ${id});
  `;
  await sql`UPDATE leads SET client_id = ${clientId}, updated_at = now() WHERE id = ${id};`;
  await logClientEvent(sql, clientId, "client_created", "Ręcznie utworzony z leada");

  return NextResponse.json({ ok: true, id: clientId });
}
