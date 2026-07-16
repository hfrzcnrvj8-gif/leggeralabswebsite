import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailSchema, getNudgeThreads } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/mail/nudge — wątki „wysłałeś, cisza od N dni" (Moduł 4f). Osobny
 * endpoint, NIE filtr na /api/mail?folder=sent: wymaga agregacji NA
 * POZIOMIE WĄTKU w poprzek dwóch folderów (Wysłane + gdziekolwiek leży
 * ewentualna odpowiedź), czego generyczna lista jednego folderu nie robi.
 * Patrz getNudgeThreads() w lib/db.ts — ta sama funkcja zasila dzienny
 * digest (app/api/leads/notify/route.ts).
 */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await ensureMailSchema();
  const sql = getSql();
  const threads = await getNudgeThreads(sql);

  return NextResponse.json({ threads });
}
