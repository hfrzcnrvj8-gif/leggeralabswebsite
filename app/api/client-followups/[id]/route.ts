import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureFollowupsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** PATCH /api/client-followups/:id — oznacza jeden zaplanowany kontakt
 * nurture jako obsłużony (`done_at = now()`). Wywoływane z przycisku
 * "Obsłużone" na Pulpicie (DashboardHome.tsx) — patrz Moduł 2. */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureFollowupsSchema();
  const sql = getSql();
  await sql`UPDATE client_followups SET done_at = now() WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
