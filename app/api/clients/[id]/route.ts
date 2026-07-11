import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureClientsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { CLIENT_STATUSES } from "@/lib/clients";

export const runtime = "nodejs";

/** GET /api/clients/:id — klient + JEDEN scalony chronologiczny feed
 * ("pełna historia akcji": ręczne notatki + historia z leada sprzed awansu
 * na klienta + zdarzenia systemowe jak wysłanie oferty/wystawienie
 * faktury/wpłata) + powiązane oferty/faktury/projekty (szybkie linki do
 * aktualnego stanu). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureClientsSchema();
  const sql = getSql();

  const rows = await sql`SELECT * FROM clients WHERE id = ${id};`;
  const client = rows[0];
  if (!client) return NextResponse.json({ error: "not found" }, { status: 404 });
  const leadId = typeof client.lead_id === "string" ? client.lead_id : null;

  const [clientActivity, leadActivity, events, offers, invoices, projects] = await Promise.all([
    sql`SELECT id, text, created_at FROM client_activity WHERE client_id = ${id};`,
    leadId
      ? (sql`SELECT id, text, created_at FROM lead_activity WHERE lead_id = ${leadId};` as unknown as Promise<
          { id: string; text: string; created_at: string }[]
        >)
      : Promise.resolve([] as { id: string; text: string; created_at: string }[]),
    sql`SELECT id, kind, text, amount, created_at FROM client_events WHERE client_id = ${id};`,
    sql`SELECT id, tytul, status, wazna_do, created_at FROM offers WHERE client_id = ${id} ORDER BY created_at DESC;`,
    sql`SELECT id, numer, status, typ_dokumentu, created_at FROM invoices WHERE client_id = ${id} ORDER BY created_at DESC;`,
    sql`SELECT id, tytul, status, termin, created_at FROM projects WHERE client_id = ${id} ORDER BY created_at DESC;`,
  ]);

  // Scalony feed — trzy różne źródła, wspólny kształt, posortowane
  // chronologicznie (najnowsze pierwsze). `source: "lead"` oznacza wpisy
  // sprzed awansu na klienta (dociągnięte z leada, z którego powstał) —
  // UI pokazuje je z osobnym tagiem, żeby było jasne skąd się wzięły.
  const feed = [
    ...clientActivity.map((a) => ({
      id: a.id,
      created_at: a.created_at as string,
      kind: "note" as const,
      text: a.text as string,
      amount: null as number | null,
      source: "client" as const,
    })),
    ...leadActivity.map((a) => ({
      id: a.id,
      created_at: a.created_at,
      kind: "note" as const,
      text: a.text,
      amount: null as number | null,
      source: "lead" as const,
    })),
    ...events.map((e) => ({
      id: e.id as string,
      created_at: e.created_at as string,
      kind: e.kind as string,
      text: e.text as string,
      amount: e.amount != null ? Number(e.amount) : null,
      source: "system" as const,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ client, feed, offers, invoices, projects });
}

/** PATCH /api/clients/:id — aktualizacja pól karty klienta. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  await ensureClientsSchema();
  const sql = getSql();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const dateOrNull = (v: unknown): string | null | undefined => {
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    if (!t) return null;
    return isPlausibleDateString(t) ? t : undefined;
  };

  if ("nazwa" in body) await sql`UPDATE clients SET nazwa = ${str(body.nazwa, 300)}, updated_at = now() WHERE id = ${id};`;
  if ("nip" in body) await sql`UPDATE clients SET nip = ${str(body.nip, 30)}, updated_at = now() WHERE id = ${id};`;
  if ("ulica" in body) await sql`UPDATE clients SET ulica = ${str(body.ulica, 300)}, updated_at = now() WHERE id = ${id};`;
  if ("kod" in body) await sql`UPDATE clients SET kod = ${str(body.kod, 20)}, updated_at = now() WHERE id = ${id};`;
  if ("miasto" in body) await sql`UPDATE clients SET miasto = ${str(body.miasto, 200)}, updated_at = now() WHERE id = ${id};`;
  if ("kraj" in body) await sql`UPDATE clients SET kraj = ${str(body.kraj, 100)}, updated_at = now() WHERE id = ${id};`;
  if ("email" in body) await sql`UPDATE clients SET email = ${str(body.email, 200)}, updated_at = now() WHERE id = ${id};`;
  if ("telefon" in body) await sql`UPDATE clients SET telefon = ${str(body.telefon, 100)}, updated_at = now() WHERE id = ${id};`;
  if ("www" in body) await sql`UPDATE clients SET www = ${str(body.www, 200)}, updated_at = now() WHERE id = ${id};`;
  if ("branza" in body) await sql`UPDATE clients SET branza = ${str(body.branza, 200)}, updated_at = now() WHERE id = ${id};`;
  if ("notatki" in body) await sql`UPDATE clients SET notatki = ${str(body.notatki, 4000)}, updated_at = now() WHERE id = ${id};`;
  if ("status" in body) {
    const v = typeof body.status === "string" && (CLIENT_STATUSES as readonly string[]).includes(body.status) ? body.status : "Prospekt";
    await sql`UPDATE clients SET status = ${v}, updated_at = now() WHERE id = ${id};`;
  }
  if ("ostatni_kontakt" in body) {
    const v = dateOrNull(body.ostatni_kontakt);
    if (v === undefined) return NextResponse.json({ error: "invalid ostatni_kontakt" }, { status: 400 });
    await sql`UPDATE clients SET ostatni_kontakt = ${v}, updated_at = now() WHERE id = ${id};`;
  }
  if ("next_followup" in body) {
    const v = dateOrNull(body.next_followup);
    if (v === undefined) return NextResponse.json({ error: "invalid next_followup" }, { status: 400 });
    await sql`UPDATE clients SET next_followup = ${v}, updated_at = now() WHERE id = ${id};`;
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/clients/:id — usuwa klienta. Powiązane leady/oferty/faktury/
 * projekty NIE są usuwane, tylko odpinane (client_id -> NULL, ON DELETE SET
 * NULL) — to już osobne, samodzielne byty, jak przy usuwaniu leada z oferty. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureClientsSchema();
  const sql = getSql();
  await sql`DELETE FROM clients WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
