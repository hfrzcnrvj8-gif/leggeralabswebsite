import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureLeadsSchema, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import type { Lead } from "@/lib/leads";
import type { Project } from "@/lib/projects";
import type { Note } from "@/lib/notes";
import type { HubEvent } from "@/lib/events";

export const runtime = "nodejs";

/** GET /api/search?q=... — globalne wyszukiwanie po leadach, projektach,
 * notatkach i wydarzeniach naraz, do globalnej palety poleceń (Cmd+K).
 * Admin-only. Proste ILIKE zamiast pełnotekstowego indeksu — wystarczające
 * przy skali jednoosobowej firmy (dziesiątki/setki rekordów, nie miliony). */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ leads: [], projects: [], notes: [], events: [] });
  }

  await ensureLeadsSchema();
  await ensureHubSchema();
  const sql = getSql();
  const like = `%${q}%`;

  const [leads, projects, notes, events] = await Promise.all([
    sql`SELECT * FROM leads WHERE firma ILIKE ${like} OR branza ILIKE ${like} LIMIT 6;` as unknown as Promise<Lead[]>,
    sql`SELECT * FROM projects WHERE tytul ILIKE ${like} OR opis ILIKE ${like} LIMIT 6;` as unknown as Promise<Project[]>,
    sql`SELECT * FROM notes WHERE tytul ILIKE ${like} OR tresc ILIKE ${like} OR tagi ILIKE ${like} LIMIT 6;` as unknown as Promise<Note[]>,
    sql`SELECT * FROM events WHERE tytul ILIKE ${like} OR opis ILIKE ${like} LIMIT 6;` as unknown as Promise<HubEvent[]>,
  ]);

  return NextResponse.json({ leads, projects, notes, events });
}
