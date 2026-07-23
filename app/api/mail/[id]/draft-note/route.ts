import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailSchema } from "@/lib/db";
import { ollamaGenerate } from "@/lib/ollama";
import { NOTE_DRAFT_MODEL, NOTE_DRAFT_SYSTEM, buildNoteDraftPrompt, cleanNoteDraftText, type MailDraftClientContext } from "@/lib/note-draft";

export const runtime = "nodejs";
// Ten sam model tekstowy (27b) co szkic odpowiedzi (Moduł 7) — ten sam limit.
export const maxDuration = 60;

const DRAFT_TIMEOUT_MS = 45_000;

/** POST /api/mail/:id/draft-note — generuje PROPOZYCJĘ treści notatki do CRM
 * na podstawie treści maila, modelem tekstowym przez Ollamę. Nigdy nic nie
 * zapisuje — właściciel widzi szkic w modalu (MailDetailPanel), poprawia i
 * zapisuje ręcznie przez istniejący POST /api/notes (patrz CLAUDE.md,
 * docs/plany-modulow/50-ai-szkic-notatki.md). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureMailSchema();
  const sql = getSql();

  const rows = await sql`
    SELECT m.subject, m.body_text, m.client_id, m.lead_id,
           c.nazwa AS client_nazwa, c.branza AS client_branza, c.status AS client_status,
           l.firma AS lead_nazwa, l.branza AS lead_branza, l.status AS lead_status
    FROM mail_messages m
    LEFT JOIN clients c ON c.id = m.client_id
    LEFT JOIN leads l ON l.id = m.lead_id
    WHERE m.id = ${id};
  `;
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  let client: MailDraftClientContext | null = null;
  if (row.client_id) {
    const noteRows = await sql`SELECT text FROM client_activity WHERE client_id = ${row.client_id} ORDER BY created_at DESC LIMIT 1;`;
    client = {
      nazwa: String(row.client_nazwa || ""),
      branza: String(row.client_branza || ""),
      status: String(row.client_status || ""),
      ostatniaNotatka: noteRows[0]?.text ? String(noteRows[0].text) : null,
    };
  } else if (row.lead_id) {
    const noteRows = await sql`SELECT text FROM lead_activity WHERE lead_id = ${row.lead_id} ORDER BY created_at DESC LIMIT 1;`;
    client = {
      nazwa: String(row.lead_nazwa || ""),
      branza: String(row.lead_branza || ""),
      status: String(row.lead_status || ""),
      ostatniaNotatka: noteRows[0]?.text ? String(noteRows[0].text) : null,
    };
  }

  const prompt = buildNoteDraftPrompt({
    subject: String(row.subject || ""),
    bodyText: String(row.body_text || ""),
    client,
  });

  const raw = await ollamaGenerate({
    model: NOTE_DRAFT_MODEL,
    prompt,
    system: NOTE_DRAFT_SYSTEM,
    timeoutMs: DRAFT_TIMEOUT_MS,
  });

  if (raw == null) {
    return NextResponse.json({ error: "Model AI chwilowo niedostępny — dodaj notatkę ręcznie." }, { status: 503 });
  }

  return NextResponse.json({ draft: cleanNoteDraftText(raw) });
}
