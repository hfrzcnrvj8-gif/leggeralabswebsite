import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureCostsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { ATTACHMENT_MIME_TYPES, ATTACHMENT_MAX_BYTES } from "@/lib/costs";

export const runtime = "nodejs";

/** GET /api/costs/:id/attachment — serwuje zapisany skan/PDF (inline, żeby
 * przeglądarka mogła go podejrzeć zamiast wymuszać pobranie). Admin-only —
 * to nie publiczny link jak przy fakturach, załącznik kosztu nie ma po co
 * być dostępny bez logowania. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureCostsSchema();
  const sql = getSql();
  const rows = await sql`SELECT zalacznik_nazwa, zalacznik_typ, zalacznik_dane FROM costs WHERE id = ${id};`;
  const row = rows[0];
  if (!row || !row.zalacznik_dane) return NextResponse.json({ error: "not found" }, { status: 404 });
  const buf = Buffer.from(String(row.zalacznik_dane), "base64");
  const nazwa = String(row.zalacznik_nazwa || "zalacznik").replace(/["\r\n]/g, "");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": String(row.zalacznik_typ || "application/octet-stream"),
      "Content-Disposition": `inline; filename="${nazwa}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

/** POST /api/costs/:id/attachment — upload skanu/PDF (multipart/form-data,
 * pole "file"). Zapisany jako base64 wprost w wierszu kosztu — patrz komentarz
 * przy migracji w lib/db.ts (createCostsSchema). Nadpisuje poprzedni
 * załącznik, jeśli był. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureCostsSchema();
  const sql = getSql();

  const existing = await sql`SELECT id FROM costs WHERE id = ${id};`;
  if (!existing[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Brak pliku." }, { status: 400 });
  if (!(ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "Dozwolone pliki: PDF, JPG, PNG, WEBP." }, { status: 400 });
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return NextResponse.json({ error: `Plik za duży (max ${Math.round(ATTACHMENT_MAX_BYTES / 1024 / 1024)} MB).` }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");
  const nazwa = file.name.slice(0, 300);
  await sql`
    UPDATE costs SET zalacznik_nazwa = ${nazwa}, zalacznik_typ = ${file.type}, zalacznik_dane = ${base64}, updated_at = now()
    WHERE id = ${id};
  `;
  return NextResponse.json({ ok: true, zalacznik_nazwa: nazwa, zalacznik_typ: file.type });
}

/** DELETE /api/costs/:id/attachment — usuwa załącznik (koszt zostaje). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureCostsSchema();
  const sql = getSql();
  await sql`UPDATE costs SET zalacznik_nazwa = '', zalacznik_typ = '', zalacznik_dane = NULL, updated_at = now() WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
