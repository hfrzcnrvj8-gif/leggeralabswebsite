import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureClientsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { CLIENT_STATUSES } from "@/lib/clients";

export const runtime = "nodejs";

/** GET /api/clients — lista klientów. Admin-only. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureClientsSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM clients ORDER BY created_at DESC;`;
  return NextResponse.json({ clients: rows });
}

/** POST /api/clients — ręczne utworzenie klienta (np. z przycisku "Utwórz
 * klienta" na leadzie, albo bezpośrednio z modułu Klienci gdy rozmowa
 * zaczęła się poza rejestrem leadów, np. polecenie już "gotowego" kontaktu). */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await ensureClientsSchema();
  const sql = getSql();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

  const id = randomUUID();
  const leadId = typeof body.lead_id === "string" && body.lead_id.trim() ? body.lead_id : null;
  const status = typeof body.status === "string" && (CLIENT_STATUSES as readonly string[]).includes(body.status) ? body.status : "Prospekt";

  // Jeśli tworzone z leada — skopiuj jego dane jako punkt startowy.
  let nazwa = str(body.nazwa, 300);
  let branza = str(body.branza, 200);
  let telefon = str(body.telefon, 100);
  let email = str(body.email, 200);
  let www = str(body.www, 200);
  if (leadId && !nazwa) {
    const lead = await sql`SELECT firma, branza, telefon, email, www FROM leads WHERE id = ${leadId};`;
    if (lead[0]) {
      nazwa = String(lead[0].firma ?? "");
      branza = branza || String(lead[0].branza ?? "");
      telefon = telefon || String(lead[0].telefon ?? "");
      email = email || String(lead[0].email ?? "");
      www = www || String(lead[0].www ?? "");
    }
  }

  await sql`
    INSERT INTO clients (id, nazwa, nip, ulica, kod, miasto, kraj, email, telefon, www, branza, status, lead_id)
    VALUES (
      ${id}, ${nazwa}, ${str(body.nip, 30)}, ${str(body.ulica, 300)}, ${str(body.kod, 20)},
      ${str(body.miasto, 200)}, ${str(body.kraj, 100)}, ${email}, ${telefon}, ${www}, ${branza}, ${status}, ${leadId}
    );
  `;
  if (leadId) {
    await sql`UPDATE leads SET client_id = ${id}, updated_at = now() WHERE id = ${leadId};`;
  }

  return NextResponse.json({ ok: true, id });
}
