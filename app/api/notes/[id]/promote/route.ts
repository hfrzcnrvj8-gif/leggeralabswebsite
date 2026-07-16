import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema, ensureLinksSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { DEFAULT_ONBOARDING_ITEMS } from "@/lib/projects";

export const runtime = "nodejs";

/**
 * POST /api/notes/:id/promote — „Przekuj w projekt". Admin-only.
 *
 * Moduł 26 pkt 1 — naprawa realnego błędu. Dotąd robił to klient: POST
 * /api/projects + router.push, bez zapisania ŚLADU. Notatka nie wiedziała, że
 * projekt powstał, więc każde kolejne kliknięcie tworzyło kolejny projekt (N
 * kliknięć = N projektów).
 *
 * Idempotencja siedzi TUTAJ, nie w stanie przycisku: `notes.project_id` jest
 * jedynym źródłem prawdy, a UI tylko go odczytuje. Dzięki temu podwójny klik,
 * dwie otwarte karty czy odświeżenie w złym momencie nie potrafią zrobić
 * duplikatu — przycisk to zabezpieczenie wygody, nie poprawności.
 *
 * Zwraca 200 z `existing: true`, gdy projekt już był — to nie jest błąd, tylko
 * „już zrobione", a UI ma po prostu otworzyć istniejący projekt.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureHubSchema();
  await ensureLinksSchema();
  const sql = getSql();

  const rows = (await sql`SELECT * FROM notes WHERE id = ${id};`) as unknown as {
    tytul: string;
    tresc: string;
    client_id: string | null;
    lead_id: string | null;
    project_id: string | null;
  }[];
  const note = rows[0];
  if (!note) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Projekt już istnieje. Kolumna ma ON DELETE SET NULL, więc niepusta wartość
  // znaczy, że projekt naprawdę tam jest — skasowany wyzerowałby ją sam i
  // notatkę dałoby się przekuć ponownie.
  if (note.project_id) {
    return NextResponse.json({ ok: true, id: note.project_id, existing: true });
  }

  const projectId = randomUUID();
  await sql`
    INSERT INTO projects (id, tytul, opis, status, priorytet, lead_id, client_id)
    VALUES (
      ${projectId},
      ${(note.tytul || "Bez tytułu").slice(0, 300)},
      ${note.tresc.slice(0, 4000)},
      'Pomysł',
      'Normalny',
      ${note.lead_id},
      ${note.client_id}
    );
  `;

  // Ta sama checklista, którą dostaje projekt zakładany z listy projektów
  // (Moduł 14) — projekt z notatki nie ma powodu być uboższy.
  let pos = 0;
  for (const tekst of DEFAULT_ONBOARDING_ITEMS) {
    await sql`
      INSERT INTO project_onboarding_items (id, project_id, tekst, position)
      VALUES (${randomUUID()}, ${projectId}, ${tekst}, ${pos});
    `;
    pos += 1;
  }

  await sql`UPDATE notes SET project_id = ${projectId} WHERE id = ${id};`;
  await sql`
    INSERT INTO notes_activity (id, note_id, text)
    VALUES (${randomUUID()}, ${id}, 'Przekuto w projekt.');
  `;

  return NextResponse.json({ ok: true, id: projectId, existing: false });
}
