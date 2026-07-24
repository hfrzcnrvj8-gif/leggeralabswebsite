import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { NOTE_ATTACHMENT_MIME_TYPES, NOTE_ATTACHMENT_MAX_BYTES } from "@/lib/notes";

export const runtime = "nodejs";

/** GET /api/notes/:id/attachment — serwuje odręczny rysunek (Apple Pencil,
 * apka iPad) zapisany przy notatce. Admin-only, jak przy kosztach — to nie
 * publiczny link. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureHubSchema();
  const sql = getSql();
  const rows = await sql`SELECT nazwa, typ, dane FROM note_attachments WHERE note_id = ${id};`;
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  const buf = Buffer.from(String(row.dane), "base64");
  const nazwa = String(row.nazwa || "rysunek.png").replace(/["\r\n]/g, "");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": String(row.typ || "image/png"),
      "Content-Disposition": `inline; filename="${nazwa}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

/** POST /api/notes/:id/attachment — upload rysunku (multipart/form-data,
 * pole "file"). Jeden rysunek na notatkę — nadpisuje poprzedni (ON CONFLICT),
 * wzorem `POST /api/costs/:id/attachment`. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureHubSchema();
  const sql = getSql();

  const existing = await sql`SELECT id FROM notes WHERE id = ${id};`;
  if (!existing[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Brak pliku." }, { status: 400 });
  if (!(NOTE_ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "Dozwolone pliki: PNG, JPG." }, { status: 400 });
  }
  if (file.size > NOTE_ATTACHMENT_MAX_BYTES) {
    return NextResponse.json({ error: `Plik za duży (max ${Math.round(NOTE_ATTACHMENT_MAX_BYTES / 1024 / 1024)} MB).` }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");
  const nazwa = file.name.slice(0, 300);
  await sql`
    INSERT INTO note_attachments (id, note_id, nazwa, typ, dane)
    VALUES (${randomUUID()}, ${id}, ${nazwa}, ${file.type}, ${base64})
    ON CONFLICT (note_id) DO UPDATE SET nazwa = EXCLUDED.nazwa, typ = EXCLUDED.typ, dane = EXCLUDED.dane, created_at = now();
  `;
  await sql`UPDATE notes SET has_attachment = true, updated_at = now() WHERE id = ${id};`;
  return NextResponse.json({ ok: true, nazwa, typ: file.type });
}

/** DELETE /api/notes/:id/attachment — usuwa rysunek (notatka zostaje). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureHubSchema();
  const sql = getSql();
  await sql`DELETE FROM note_attachments WHERE note_id = ${id};`;
  await sql`UPDATE notes SET has_attachment = false, updated_at = now() WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
