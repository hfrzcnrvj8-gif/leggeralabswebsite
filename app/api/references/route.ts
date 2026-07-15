import { NextResponse } from "next/server";
import { getSql, ensureHubSchema, ensureClientsSchema } from "@/lib/db";

export const runtime = "nodejs";

/** GET /api/references — opinie z jawną zgodą na case study/referencję
 * (Moduł 15), do publicznej strony /[lang]/references. Świadomie brak
 * isAuthed() — dane są już z definicji publiczne (klient zgodził się na ich
 * wykorzystanie marketingowe), wzorem innych publicznych GET-ów (np.
 * app/api/offers/public/[token]). Nigdy nie zwraca opinii bez
 * review_consent_case_study = true, niezależnie od tego, czy opinia w ogóle
 * istnieje. */
export async function GET() {
  await ensureHubSchema();
  await ensureClientsSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT p.tytul, p.review_rating_jakosc, p.review_rating_terminowosc, p.review_rating_komunikacja,
      p.review_comment, p.review_consent_name, c.nazwa AS client_nazwa, c.branza
    FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE p.review_consent_case_study = true AND p.review_submitted_at IS NOT NULL
    ORDER BY p.review_submitted_at DESC;
  `;
  return NextResponse.json({ reviews: rows });
}
