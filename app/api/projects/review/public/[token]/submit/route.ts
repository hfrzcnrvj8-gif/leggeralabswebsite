import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema, ensureClientsSchema, logClientEvent } from "@/lib/db";
import { PROJECT_REVIEW_CONSENT_TEXT } from "@/lib/projects";
import { notify } from "@/lib/notificationLog";
import { SHARE_LINK_REVOKED_MESSAGE } from "@/lib/shareLinks";
import type { DocLang } from "@/lib/documents";

export const runtime = "nodejs";

function rating(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

const ERRORS: Record<DocLang, { ratings: string; consentName: string; alreadySubmitted: string }> = {
  pl: {
    ratings: "Uzupełnij wszystkie trzy oceny (1-5).",
    consentName: "Podaj imię i nazwisko, żeby potwierdzić zgodę.",
    alreadySubmitted: "Opinia została już zapisana.",
  },
  en: {
    ratings: "Please fill in all three ratings (1-5).",
    consentName: "Please enter your full name to confirm consent.",
    alreadySubmitted: "This feedback has already been submitted.",
  },
  de: {
    ratings: "Bitte füllen Sie alle drei Bewertungen aus (1-5).",
    consentName: "Bitte geben Sie Ihren Namen ein, um die Einwilligung zu bestätigen.",
    alreadySubmitted: "Die Bewertung wurde bereits gespeichert.",
  },
};

/** POST /api/projects/review/public/:token/submit — klient zapisuje opinię
 * (trzy wymiary 1-5 + komentarz) i opcjonalnie zgodę na referencję/case
 * study. Świadomie brak isAuthed() — token jest hasłem-w-linku, wzorem
 * app/api/offers/public/[token]/accept. "Claim"-style UPDATE (WHERE
 * review_submitted_at IS NULL) chroni przed podwójnym zapisem, tym samym
 * wzorem co akceptacja oferty/umowy. Zgoda wymaga wpisanego imienia i
 * nazwiska jako dowodu złożenia oświadczenia (jak e-podpis oferty) —
 * checkboxem samym w sobie nie da się tego udowodnić. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  await ensureHubSchema();
  await ensureClientsSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM projects WHERE review_token = ${token};`;
  const project = rows[0];
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Moduł 40 — unieważnienie musi blokować także ZAPIS opinii, nie tylko
  // wczytanie formularza.
  if (project.review_revoked_at) return NextResponse.json({ error: SHARE_LINK_REVOKED_MESSAGE }, { status: 410 });
  const lang = ((project.jezyk as string) in ERRORS ? project.jezyk : "pl") as DocLang;
  const t = ERRORS[lang];

  const jakosc = rating(body.jakosc);
  const terminowosc = rating(body.terminowosc);
  const komunikacja = rating(body.komunikacja);
  if (jakosc == null || terminowosc == null || komunikacja == null) {
    return NextResponse.json({ error: t.ratings }, { status: 400 });
  }
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 4000) : "";
  const consentCaseStudy = body.consentCaseStudy === true;
  const consentName = typeof body.consentName === "string" ? body.consentName.trim().slice(0, 200) : "";
  if (consentCaseStudy && !consentName) {
    return NextResponse.json({ error: t.consentName }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  const claimed = await sql`
    UPDATE projects SET
      review_rating_jakosc = ${jakosc},
      review_rating_terminowosc = ${terminowosc},
      review_rating_komunikacja = ${komunikacja},
      review_comment = ${comment},
      review_submitted_at = now(),
      review_consent_case_study = ${consentCaseStudy},
      review_consent_text = ${consentCaseStudy ? PROJECT_REVIEW_CONSENT_TEXT[lang] : null},
      review_consent_name = ${consentCaseStudy ? consentName : null},
      review_consent_ip = ${ip},
      review_consent_user_agent = ${userAgent},
      updated_at = now()
    WHERE id = ${project.id} AND review_submitted_at IS NULL
    RETURNING id;
  `;
  if (claimed.length === 0) return NextResponse.json({ error: t.alreadySubmitted }, { status: 409 });

  const clientId = typeof project.client_id === "string" ? project.client_id : null;
  const avg = ((jakosc + terminowosc + komunikacja) / 3).toFixed(1);
  const tytul = typeof project.tytul === "string" && project.tytul ? project.tytul : "projekt";
  await logClientEvent(
    sql,
    clientId,
    "review_collected",
    `Zebrano opinię o „${tytul}” — średnia ocena ${avg}/5${consentCaseStudy ? ", zgoda na referencję" : ""}`,
    null,
    project.id
  );

  // Centrum powiadomień (Moduł 24 + 31) — tylko tutaj; bliźniak
  // `projects/[id]/review` to opinia wpisywana ręcznie przez właściciela.
  await notify({
    kind: "review_collected",
    title: `Wpłynęła opinia: ${tytul}`,
    body: `Średnia ocena ${avg}/5${consentCaseStudy ? ", ze zgodą na referencję" : ""}.`,
    entity: "project",
    entityId: String(project.id),
    dedupeKey: `review_collected:${project.id}`,
  });

  return NextResponse.json({ ok: true });
}
