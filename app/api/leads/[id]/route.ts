import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureLeadsSchema, ensureClientsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { rematchUnassigned } from "@/lib/mailSync";
import { logFieldChanges } from "@/lib/auditLog";

export const runtime = "nodejs";

/** GET /api/leads/:id — a single lead plus its activity log. Admin-only. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureLeadsSchema();
  const sql = getSql();

  const leadRows = await sql`SELECT * FROM leads WHERE id = ${id};`;
  const lead = leadRows[0];
  if (!lead) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const activity = await sql`
    SELECT * FROM lead_activity WHERE lead_id = ${id} ORDER BY created_at DESC;
  `;

  // Audyt zmian (Moduł 23) ma własny endpoint `/changes` — patrz komentarz w
  // api/clients/[id]/route.ts.
  return NextResponse.json({ lead, activity });
}

/** PATCH /api/leads/:id — update one or more fields. Admin-only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  await ensureLeadsSchema();
  const sql = getSql();

  const str = (v: unknown) => (typeof v === "string" ? v : "");

  // Audyt zmian (Moduł 23) — stan sprzed zapisu, jeden SELECT na cały PATCH.
  // Patrz api/clients/[id]/route.ts po pełne uzasadnienie tego kształtu.
  const beforeRows = await sql`SELECT * FROM leads WHERE id = ${id};`;
  const before = (beforeRows[0] ?? {}) as Record<string, unknown>;
  const applied: Record<string, unknown> = {};

  // Moduł 22 — powiązanie z ISTNIEJĄCYM klientem. Kolumna `leads.client_id`
  // istniała od Modułu 12, ale wypełniał ją wyłącznie awans leada
  // (api/leads/[id]/promote), więc jedyną drogą z panelu było „Utwórz
  // klienta" — a to przy kliencie już będącym w bazie tworzy duplikat.
  // `null` = odepnij; pusty string też, bo tak picker sygnalizuje „— brak —".
  if ("client_id" in body) {
    await ensureClientsSchema();
    const clientId = typeof body.client_id === "string" && body.client_id ? body.client_id : null;
    // Świadomie POZA `applied`: log pokazałby surowe id klienta („z c3f8… na
    // a91b…"), co właścicielowi nic nie mówi. Podpięcie klienta widać już na
    // wizytówce jako „→ Karta klienta".
    await sql`UPDATE leads SET client_id = ${clientId}, updated_at = now() WHERE id = ${id};`;
  }

  if ("firma" in body) {
    applied.firma = str(body.firma);
    await sql`UPDATE leads SET firma = ${applied.firma}, updated_at = now() WHERE id = ${id};`;
  }
  if ("osoba_kontaktowa" in body) {
    applied.osoba_kontaktowa = str(body.osoba_kontaktowa);
    await sql`UPDATE leads SET osoba_kontaktowa = ${applied.osoba_kontaktowa}, updated_at = now() WHERE id = ${id};`;
  }
  if ("branza" in body) {
    applied.branza = str(body.branza);
    await sql`UPDATE leads SET branza = ${applied.branza}, updated_at = now() WHERE id = ${id};`;
  }
  if ("kontakt" in body) {
    applied.kontakt = str(body.kontakt);
    await sql`UPDATE leads SET kontakt = ${applied.kontakt}, updated_at = now() WHERE id = ${id};`;
  }
  if ("telefon" in body) {
    applied.telefon = str(body.telefon);
    await sql`UPDATE leads SET telefon = ${applied.telefon}, updated_at = now() WHERE id = ${id};`;
  }
  if ("email" in body) {
    const email = str(body.email);
    applied.email = email;
    await sql`UPDATE leads SET email = ${email}, updated_at = now() WHERE id = ${id};`;
    // Nowy/zmieniony adres — dopnij od razu zaległą korespondencję (04d pkt 1).
    if (email.trim()) {
      await rematchUnassigned().catch((e) => console.error("[leads] rematch poczty nie powiódł się", e));
    }
  }
  if ("www" in body) {
    applied.www = str(body.www);
    await sql`UPDATE leads SET www = ${applied.www}, updated_at = now() WHERE id = ${id};`;
  }
  if ("linkedin_url" in body) {
    applied.linkedin_url = str(body.linkedin_url);
    await sql`UPDATE leads SET linkedin_url = ${applied.linkedin_url}, updated_at = now() WHERE id = ${id};`;
  }
  if ("next_action" in body) {
    applied.next_action = str(body.next_action).slice(0, 500);
    await sql`UPDATE leads SET next_action = ${applied.next_action}, updated_at = now() WHERE id = ${id};`;
  }
  if ("ulica" in body) {
    applied.ulica = str(body.ulica);
    await sql`UPDATE leads SET ulica = ${applied.ulica}, updated_at = now() WHERE id = ${id};`;
  }
  if ("kod" in body) {
    applied.kod = str(body.kod);
    await sql`UPDATE leads SET kod = ${applied.kod}, updated_at = now() WHERE id = ${id};`;
  }
  if ("miasto" in body) {
    applied.miasto = str(body.miasto);
    await sql`UPDATE leads SET miasto = ${applied.miasto}, updated_at = now() WHERE id = ${id};`;
  }
  if ("kraj" in body) {
    applied.kraj = str(body.kraj);
    await sql`UPDATE leads SET kraj = ${applied.kraj}, updated_at = now() WHERE id = ${id};`;
  }
  if ("zrodlo_kategoria" in body) {
    applied.zrodlo_kategoria = str(body.zrodlo_kategoria);
    await sql`UPDATE leads SET zrodlo_kategoria = ${applied.zrodlo_kategoria}, updated_at = now() WHERE id = ${id};`;
  }
  if ("zrodlo" in body) {
    applied.zrodlo = str(body.zrodlo);
    await sql`UPDATE leads SET zrodlo = ${applied.zrodlo}, updated_at = now() WHERE id = ${id};`;
  }
  if ("status" in body) {
    applied.status = str(body.status);
    await sql`UPDATE leads SET status = ${applied.status}, updated_at = now() WHERE id = ${id};`;
  }
  if ("notatki" in body) {
    applied.notatki = str(body.notatki);
    await sql`UPDATE leads SET notatki = ${applied.notatki}, updated_at = now() WHERE id = ${id};`;
  }
  if ("ostatni_kontakt" in body) {
    const raw = body.ostatni_kontakt;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed && !isPlausibleDateString(trimmed)) {
      return NextResponse.json({ error: "invalid ostatni_kontakt" }, { status: 400 });
    }
    applied.ostatni_kontakt = trimmed || null;
    await sql`UPDATE leads SET ostatni_kontakt = ${trimmed || null}, updated_at = now() WHERE id = ${id};`;
  }
  if ("next_followup" in body) {
    const raw = body.next_followup;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed && !isPlausibleDateString(trimmed)) {
      return NextResponse.json({ error: "invalid next_followup" }, { status: 400 });
    }
    applied.next_followup = trimmed || null;
    await sql`UPDATE leads SET next_followup = ${trimmed || null}, updated_at = now() WHERE id = ${id};`;
  }

  await logFieldChanges("lead", id, before, applied);

  return NextResponse.json({ ok: true });
}

/** DELETE /api/leads/:id — remove a lead. Admin-only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureLeadsSchema();
  const sql = getSql();
  await sql`DELETE FROM leads WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
