import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailSchema } from "@/lib/db";
import { ollamaGenerate } from "@/lib/ollama";
import { SUMMARY_MODEL, SUMMARY_SYSTEM, buildSummaryPrompt, cleanSummaryText, type ThreadSummaryMessage } from "@/lib/mail-summary";

export const runtime = "nodejs";
// Wątek bywa kilkanaście wiadomości — więcej tekstu do przetworzenia niż
// pojedynczy szkic odpowiedzi (Moduł 7, maxDuration=60), stąd wyższy limit.
export const maxDuration = 90;

const SUMMARY_TIMEOUT_MS = 75_000;

/** POST /api/mail/:id/summarize-thread — streszcza CAŁY wątek (macierzysta
 * wiadomość + wszystkie siostry po thread_id) modelem tekstowym przez
 * Ollamę. Tylko czytanie: niczego nie wysyła, niczego nie zapisuje — patrz
 * CLAUDE.md, docs/plany-modulow/49-ai-podsumowanie-watku.md. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureMailSchema();
  const sql = getSql();

  const rows = await sql`SELECT thread_id FROM mail_messages WHERE id = ${id};`;
  const mail = rows[0];
  if (!mail) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!mail.thread_id) {
    return NextResponse.json({ error: "Ta wiadomość nie ma jeszcze przypisanego wątku." }, { status: 422 });
  }

  const threadRows = (await sql`
    SELECT from_name, from_addr, kierunek, received_at, body_text
    FROM mail_messages
    WHERE thread_id = ${mail.thread_id}
    ORDER BY received_at ASC;
  `) as unknown as { from_name: string; from_addr: string; kierunek: string; received_at: string; body_text: string }[];

  if (threadRows.length < 2) {
    return NextResponse.json({ error: "Wątek ma tylko jedną wiadomość — nie ma czego streszczać." }, { status: 422 });
  }

  const messages: ThreadSummaryMessage[] = threadRows.map((r) => ({
    fromName: r.from_name || r.from_addr || "",
    kierunek: r.kierunek,
    receivedAt: r.received_at,
    bodyText: r.body_text || "",
  }));

  const raw = await ollamaGenerate({
    model: SUMMARY_MODEL,
    prompt: buildSummaryPrompt(messages),
    system: SUMMARY_SYSTEM,
    timeoutMs: SUMMARY_TIMEOUT_MS,
  });

  if (raw == null) {
    return NextResponse.json({ error: "Model AI chwilowo niedostępny — przeczytaj wątek ręcznie." }, { status: 503 });
  }

  return NextResponse.json({ summary: cleanSummaryText(raw) });
}
