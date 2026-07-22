import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema, ensureClientsSchema } from "@/lib/db";
import { SHARE_LINK_REVOKED_MESSAGE } from "@/lib/shareLinks";

export const runtime = "nodejs";

/** GET /api/projects/review/public/:token — dane dla publicznego formularza
 * opinii (bez logowania — token pełni rolę hasła-w-linku, wzorem
 * app/api/offers/public/[token]). Zwraca tylko to, co formularz potrzebuje:
 * tytuł projektu, nazwę klienta (do powitania) i ewentualny stan już
 * zebranej opinii (żeby pokazać "dziękujemy" zamiast formularza ponownie). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await ensureHubSchema();
  await ensureClientsSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM projects WHERE review_token = ${token};`;
  const project = rows[0];
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  // 410 Gone, nie 404 (Moduł 40) — formularz istnieje, dostęp odebrany.
  if (project.review_revoked_at) return NextResponse.json({ error: SHARE_LINK_REVOKED_MESSAGE }, { status: 410 });

  let clientNazwa: string | null = null;
  if (typeof project.client_id === "string") {
    const clientRows = await sql`SELECT nazwa FROM clients WHERE id = ${project.client_id};`;
    clientNazwa = typeof clientRows[0]?.nazwa === "string" ? clientRows[0].nazwa : null;
  }

  return NextResponse.json({
    project: {
      tytul: project.tytul,
      client_nazwa: clientNazwa,
      review_submitted_at: project.review_submitted_at,
      review_rating_jakosc: project.review_rating_jakosc,
      review_rating_terminowosc: project.review_rating_terminowosc,
      review_rating_komunikacja: project.review_rating_komunikacja,
      review_comment: project.review_comment,
      review_consent_case_study: project.review_consent_case_study,
      jezyk: project.jezyk,
    },
  });
}
