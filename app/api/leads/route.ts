import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureLeadsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { rematchUnassigned } from "@/lib/mailSync";

export const runtime = "nodejs";

/** GET /api/leads — list all leads. Requires an authenticated admin session. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureLeadsSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM leads ORDER BY created_at DESC;`;
  return NextResponse.json({ leads: rows });
}

/**
 * POST /api/leads — create a lead. Intentionally public (no auth) so the
 * public contact form on the marketing site can call it directly. Only
 * ever writes the same kind of data a visitor already submits through that
 * form, so the lack of auth here is a deliberate, low-risk trade-off.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const firma = typeof body?.firma === "string" ? body.firma.trim() : "";
  if (!firma) {
    return NextResponse.json({ error: "firma is required" }, { status: 400 });
  }

  await ensureLeadsSchema();
  const sql = getSql();

  const str = (v: unknown, max: number) =>
    typeof v === "string" ? v.slice(0, max) : "";

  const id = randomUUID();
  const osobaKontaktowa = str(body?.osoba_kontaktowa, 200);
  const branza = str(body?.branza, 200);
  // `kontakt` accepted for backward compatibility with older callers; new
  // writers should use the split telefon/email/www fields instead.
  const kontakt = str(body?.kontakt, 300);
  const telefon = str(body?.telefon, 100);
  const email = str(body?.email, 200);
  const www = str(body?.www, 200);
  const ulica = str(body?.ulica, 300);
  const kod = str(body?.kod, 20);
  const miasto = str(body?.miasto, 200);
  const kraj = str(body?.kraj, 100);
  const zrodloKategoria = str(body?.zrodlo_kategoria, 100);
  const zrodlo = str(body?.zrodlo, 200);
  const status = str(body?.status, 100) || "Do kontaktu";
  const notatki = str(body?.notatki, 4000);
  const rawDate = body?.ostatni_kontakt;
  const ostatniKontakt =
    typeof rawDate === "string" && rawDate.trim() ? rawDate : null;

  await sql`
    INSERT INTO leads (id, firma, osoba_kontaktowa, branza, kontakt, telefon, email, www, ulica, kod, miasto, kraj, zrodlo_kategoria, zrodlo, status, ostatni_kontakt, notatki)
    VALUES (${id}, ${firma.slice(0, 300)}, ${osobaKontaktowa}, ${branza}, ${kontakt}, ${telefon}, ${email}, ${www}, ${ulica}, ${kod}, ${miasto}, ${kraj}, ${zrodloKategoria}, ${zrodlo}, ${status}, ${ostatniKontakt}, ${notatki});
  `;

  // Lead dostał adres — dopnij mu od razu korespondencję, która przyszła
  // zanim istniał (04d pkt 1), zamiast czekać na kolejny sync poczty.
  if (email.trim()) {
    await rematchUnassigned().catch((e) => console.error("[leads] rematch poczty nie powiódł się", e));
  }

  return NextResponse.json({ ok: true, id });
}
