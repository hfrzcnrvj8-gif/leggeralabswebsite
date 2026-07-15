import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { PROJECT_REVIEW_CONSENT_TEXT } from "@/lib/projects";
import type { DocLang } from "@/lib/documents";

export const runtime = "nodejs";

function rating(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

/** POST /api/projects/:id/review — właściciel wpisuje opinię ręcznie w
 * panelu (np. zebraną telefonicznie/na spotkaniu), zamiast/obok publicznego
 * formularza (app/api/projects/review/public). Admin-only, w przeciwieństwie
 * do publicznego submit BEZ ograniczenia "tylko raz" — właściciel może
 * świadomie poprawić literówkę we wcześniej wpisanej opinii. Zdarzenie na
 * osi klienta logowane tylko przy PIERWSZYM zapisie (żeby korekta nie
 * dublowała wpisu). Zgoda na case study zapisana tą drogą nie ma dowodu
 * IP/user-agent (nie ma przeglądarki klienta w tej ścieżce) — to świadomy,
 * niższy standard dowodowy niż e-podpis z publicznego formularza. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  const jakosc = rating(body.jakosc);
  const terminowosc = rating(body.terminowosc);
  const komunikacja = rating(body.komunikacja);
  if (jakosc == null || terminowosc == null || komunikacja == null) {
    return NextResponse.json({ error: "Uzupełnij wszystkie trzy oceny (1-5)." }, { status: 400 });
  }
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 4000) : "";
  const consentCaseStudy = body.consentCaseStudy === true;
  const consentName = typeof body.consentName === "string" ? body.consentName.trim().slice(0, 200) : "";
  if (consentCaseStudy && !consentName) {
    return NextResponse.json({ error: "Podaj imię i nazwisko osoby, która wyraziła zgodę." }, { status: 400 });
  }

  await ensureHubSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM projects WHERE id = ${id};`;
  const project = rows[0];
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const wasSubmitted = Boolean(project.review_submitted_at);
  const lang = (["pl", "en", "de"] as string[]).includes(project.jezyk as string) ? (project.jezyk as DocLang) : "pl";

  await sql`
    UPDATE projects SET
      review_rating_jakosc = ${jakosc},
      review_rating_terminowosc = ${terminowosc},
      review_rating_komunikacja = ${komunikacja},
      review_comment = ${comment},
      review_submitted_at = COALESCE(review_submitted_at, now()),
      review_consent_case_study = ${consentCaseStudy},
      review_consent_text = ${consentCaseStudy ? PROJECT_REVIEW_CONSENT_TEXT[lang] : null},
      review_consent_name = ${consentCaseStudy ? consentName : null},
      updated_at = now()
    WHERE id = ${id};
  `;

  if (!wasSubmitted) {
    const clientId = typeof project.client_id === "string" ? project.client_id : null;
    const avg = ((jakosc + terminowosc + komunikacja) / 3).toFixed(1);
    const tytul = typeof project.tytul === "string" && project.tytul ? project.tytul : "projekt";
    await logClientEvent(
      sql,
      clientId,
      "review_collected",
      `Zebrano opinię o „${tytul}” (wpisana ręcznie) — średnia ocena ${avg}/5${consentCaseStudy ? ", zgoda na referencję" : ""}`,
      null,
      id
    );
  }

  return NextResponse.json({ ok: true });
}
