import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema, ensureLinksSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/notes/:id — single note. Admin-only.
 *
 * Zasila podstronę `/admin/notes/[id]` (Moduł 26) — ta ładuje jeden rekord po
 * bezpośrednim linku, zamiast ciągnąć całą listę i szukać w niej. */
export async function GET(
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
  const rows = await sql`
    SELECT n.*, p.tytul AS project_tytul, e.data AS event_data, m.subject AS source_mail_subject
    FROM notes n
    LEFT JOIN projects p ON p.id = n.project_id
    LEFT JOIN events e ON e.id = n.event_id
    LEFT JOIN mail_messages m ON m.id = n.source_mail_id
    WHERE n.id = ${id};
  `;
  if (!rows[0]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ note: rows[0] });
}

/** PATCH /api/notes/:id — update fields. Admin-only. */
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

  await ensureHubSchema();
  await ensureLinksSchema();
  const sql = getSql();
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const ref = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

  if ("tytul" in body) {
    await sql`UPDATE notes SET tytul = ${str(body.tytul)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("tresc" in body) {
    await sql`UPDATE notes SET tresc = ${str(body.tresc)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("tagi" in body) {
    await sql`UPDATE notes SET tagi = ${str(body.tagi)}, updated_at = now() WHERE id = ${id};`;
  }

  // Powiązania (Moduł 26). Klient i lead przychodzą razem, jednym obiektem z
  // linkValueFor() — który już zastosował wyłączność — więc ustawiamy oba
  // naraz zamiast per-pole. Bez `updated_at = now()`: zmiana powiązania to
  // porządkowanie, nie praca nad treścią, a sort listy idzie po updated_at —
  // przypięcie klienta nie powinno wypychać notatki na górę.
  if ("client_id" in body || "lead_id" in body) {
    await sql`
      UPDATE notes SET client_id = ${ref(body.client_id)}, lead_id = ${ref(body.lead_id)}
      WHERE id = ${id};
    `;
  }

  if ("pinned" in body) {
    await sql`UPDATE notes SET pinned = ${body.pinned === true} WHERE id = ${id};`;
  }

  // `archived: true/false` w API → znacznik czasu w bazie. Klient nie zna się
  // na zegarze serwera, a data archiwizacji to informacja („kiedy zeszło z
  // biurka"), nie parametr od wołającego.
  if ("archived" in body) {
    await sql`UPDATE notes SET archived_at = ${body.archived === true ? new Date().toISOString() : null} WHERE id = ${id};`;
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/notes/:id — remove a note. Admin-only.
 *
 * Zostaje mimo archiwum (decyzja właściciela 2026-07-17: „oba, archiwum
 * główne, usuwanie w tle") — w UI dostępne dopiero z zakładki Archiwum. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureHubSchema();
  const sql = getSql();
  await sql`DELETE FROM notes WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
