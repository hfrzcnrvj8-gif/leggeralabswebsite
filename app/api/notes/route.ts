import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema, ensureLinksSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/notes — list all notes, pinned first then newest. Admin-only.
 *
 * Zwraca też archiwalne — podziałem na zakładki zajmuje się matchesTab() w
 * UI. Lista notatek firmy jednoosobowej to rekordy liczone w setkach, więc
 * stronicowanie po stronie bazy byłoby na wyrost. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureHubSchema();
  await ensureLinksSchema();
  const sql = getSql();
  // JOIN-y dokładają tytuł projektu i datę wydarzenia, żeby plakietka „przekuto
  // w…" mogła powiedzieć KTÓRY projekt / NA KIEDY termin. Alternatywą było N
  // żądań z karty — dla listy notatek bez sensu.
  // `log_text` = wpisy z logu sklejone w jeden string, wyłącznie po to, żeby
  // wyszukiwarka je widziała (Moduł 26). Dotąd „Szukaj…" patrzyło tylko w
  // tytuł i treść, więc słowo zapisane we wpisie logu było nieznajdowalne.
  // Sklejamy w bazie, a nie N-toma żądaniami z karty — log i tak wisi przy
  // notatce, a to jedno podzapytanie na całą listę.
  const rows = await sql`
    SELECT n.*, p.tytul AS project_tytul, e.data AS event_data, m.subject AS source_mail_subject,
      COALESCE((SELECT string_agg(a.text, ' ') FROM notes_activity a WHERE a.note_id = n.id), '') AS log_text
    FROM notes n
    LEFT JOIN projects p ON p.id = n.project_id
    LEFT JOIN events e ON e.id = n.event_id
    LEFT JOIN mail_messages m ON m.id = n.source_mail_id
    ORDER BY n.pinned DESC, n.updated_at DESC;
  `;
  return NextResponse.json({ notes: rows });
}

/** POST /api/notes — create a note. Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const tresc = typeof body?.tresc === "string" ? body.tresc.trim() : "";
  const tytul = typeof body?.tytul === "string" ? body.tytul.trim() : "";
  if (!tresc && !tytul) {
    return NextResponse.json({ error: "tytul or tresc is required" }, { status: 400 });
  }

  await ensureHubSchema();
  await ensureLinksSchema();
  const sql = getSql();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const id = randomUUID();
  const tagi = str(body?.tagi, 500);
  const clientId = typeof body?.client_id === "string" && body.client_id.trim() ? body.client_id : null;
  const leadId = typeof body?.lead_id === "string" && body.lead_id.trim() ? body.lead_id : null;
  // Moduł 50 — ślad pochodzenia dla notatek zapisanych ze „Szkicu notatki"
  // przy mailu. Puste dla notatek dodanych ręcznie, jak dziś.
  const sourceMailId = typeof body?.source_mail_id === "string" && body.source_mail_id.trim() ? body.source_mail_id : null;

  await sql`
    INSERT INTO notes (id, tytul, tresc, tagi, client_id, lead_id, source_mail_id)
    VALUES (${id}, ${tytul.slice(0, 300)}, ${tresc.slice(0, 8000)}, ${tagi}, ${clientId}, ${leadId}, ${sourceMailId});
  `;

  return NextResponse.json({ ok: true, id });
}
