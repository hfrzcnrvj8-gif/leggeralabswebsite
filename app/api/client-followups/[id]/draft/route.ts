import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureFollowupsSchema, ensureHubSchema, ensureClientsSchema, ensureProjectReviewToken } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { buildNurtureMessage, NURTURE_OFFSETS } from "@/lib/clients";
import type { DocLang } from "@/lib/documents";

export const runtime = "nodejs";

const KNOWN_LANGS: DocLang[] = ["pl", "en", "de"];

/** GET /api/client-followups/:id/draft — generuje (bez zapisu — poza
 * `ensureProjectReviewToken`, idempotentnym) szkic wiadomości retencyjnej
 * (Moduł 17) do przejrzenia/edycji w panelu przed wysyłką. Admin-only. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureFollowupsSchema();
  await ensureHubSchema();
  await ensureClientsSchema();
  const sql = getSql();

  const followupRows = await sql`SELECT * FROM client_followups WHERE id = ${id};`;
  const followup = followupRows[0];
  if (!followup) return NextResponse.json({ error: "not found" }, { status: 404 });

  const days = (NURTURE_OFFSETS.find((o) => o.powod === followup.powod)?.days ?? 90) as 14 | 90;

  const clientRows = await sql`SELECT nazwa, osoba_kontaktowa, email FROM clients WHERE id = ${followup.client_id};`;
  const client = clientRows[0] ?? null;

  const projectId = typeof followup.project_id === "string" ? followup.project_id : null;
  let tytul = "projekt";
  let lang: DocLang = "pl";
  let reviewInfo: { url: string; submitted: boolean } | null = null;

  if (projectId) {
    const projectRows = await sql`
      SELECT tytul, jezyk, review_token, review_revoked_at, review_submitted_at FROM projects WHERE id = ${projectId};
    `;
    const project = projectRows[0];
    if (project?.tytul) tytul = String(project.tytul);
    if (project?.jezyk && KNOWN_LANGS.includes(project.jezyk)) lang = project.jezyk as DocLang;

    // Link do opinii pomijamy, jeśli właściciel go unieważnił (Moduł 40) —
    // szkic z martwym linkiem byłby gorszy niż szkic bez linku, a
    // ensureProjectReviewToken() i tak oddałby ten sam, martwy token.
    if (days === 14 && !project?.review_revoked_at) {
      const token = await ensureProjectReviewToken(
        sql,
        projectId,
        typeof project?.review_token === "string" ? project.review_token : null
      );
      reviewInfo = { url: `${req.nextUrl.origin}/pl/opinia/${token}`, submitted: Boolean(project?.review_submitted_at) };
    }
  }

  const text = buildNurtureMessage(
    days,
    { tytul },
    client ? { nazwa: client.nazwa, osoba_kontaktowa: client.osoba_kontaktowa } : null,
    reviewInfo,
    lang
  );

  return NextResponse.json({ text, days, clientEmail: client?.email ?? null });
}
