import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema, ensureProjectReviewToken } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/projects/:id/review-link — zapewnia (generuje w locie, jeśli
 * brak) token publicznego formularza opinii i zwraca gotowy link. Admin-only.
 * Idempotentne — bezpieczne do wywołania wielokrotnie (np. przy każdym
 * otwarciu panelu projektu), zawsze zwraca ten sam token. Wzorem
 * app/api/offers/[id]/send, ale bez wysyłki — samo generowanie linku. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureHubSchema();
  const sql = getSql();
  const rows = await sql`SELECT id, review_token FROM projects WHERE id = ${id};`;
  const project = rows[0];
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const token = await ensureProjectReviewToken(sql, id, typeof project.review_token === "string" ? project.review_token : null);
  const url = `${req.nextUrl.origin}/pl/opinia/${token}`;
  return NextResponse.json({ ok: true, url });
}
