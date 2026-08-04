import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureFollowupsSchema, ensureHubSchema, ensureClientsSchema, logZdarzenieDokumentu, odnotujWyslanaWiadomosc } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { NURTURE_OFFSETS } from "@/lib/clients";
import type { DocLang } from "@/lib/documents";
import { sprawdzMailPrzedWysylka, odmowaBramki, mimoOstrzezen } from "@/lib/bramkaWysylki";
import { odczytajPotwierdzenie, odmowaPotwierdzenia } from "@/lib/nieodwracalne";

export const runtime = "nodejs";

const KNOWN_LANGS: DocLang[] = ["pl", "en", "de"];

const SUBJECT: Record<DocLang, (days: 14 | 90, tytul: string) => string> = {
  pl: (days, tytul) => (days === 14 ? `Jak działa wdrożenie — ${tytul}?` : `Kolejny krok po „${tytul}”?`),
  en: (days, tytul) => (days === 14 ? `How's the ${tytul} rollout going?` : `What's next after ${tytul}?`),
  de: (days, tytul) => (days === 14 ? `Wie läuft die Umsetzung von ${tytul}?` : `Was kommt nach ${tytul}?`),
};

/** POST /api/client-followups/:id/send — wysyła klientowi mailem edytowany
 * szkic kontaktu retencyjnego (Moduł 17) i oznacza kontakt jako obsłużony
 * (`done_at = now()`). Admin-only. Treść (`body`) to tekst zaakceptowany
 * przez właściciela w panelu — panel nigdy nie wysyła niczego bez tego
 * jawnego kliknięcia. Wzorem app/api/projects/[id]/request-review. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const payload = (await req.json().catch(() => null)) as { body?: unknown } | null;
  const text = typeof payload?.body === "string" ? payload.body.trim() : "";

  // BRAMKA WYSYŁKI (Faza 2) — piąta trasa, którą przejście „na sucho" ominęło,
  // a która ma dokładnie tę samą wadę co `request-review` (znalezisko A1):
  // szkic kontaktu kontrolnego też kończył się na „[Twoje imię]", a jedyne
  // sprawdzenie brzmiało „czy treść jest niepusta". Bramka nie może obowiązywać
  // tylko tam, gdzie akurat zajrzałem.
  const bramka = sprawdzMailPrzedWysylka({ tresc: text });
  const odmowa = odmowaBramki(bramka, mimoOstrzezen(payload));
  if (odmowa) return NextResponse.json({ error: odmowa.error, bramka: odmowa.bramka }, { status: odmowa.status });

  // POTWIERDZENIE (Faza 4) — PO bramce: najpierw „czy to wolno wysłać”,
  // dopiero potem „czy na pewno teraz”. Odwrotna kolejność kazałaby
  // potwierdzać wysyłkę dokumentu, który i tak nie ma prawa wyjść.
  const odmowaPotw = odmowaPotwierdzenia("kontakt-kontrolny-wyslij", odczytajPotwierdzenie(req.headers));
  if (odmowaPotw) {
    return NextResponse.json({ error: odmowaPotw.error, potwierdzenie: odmowaPotw.potwierdzenie }, { status: odmowaPotw.status });
  }

  try {
    await ensureFollowupsSchema();
    await ensureHubSchema();
    await ensureClientsSchema();
    const sql = getSql();

    const followupRows = await sql`SELECT * FROM client_followups WHERE id = ${id};`;
    const followup = followupRows[0];
    if (!followup) return NextResponse.json({ error: "not found" }, { status: 404 });

    const clientRows = await sql`SELECT email FROM clients WHERE id = ${followup.client_id};`;
    const client = clientRows[0];
    if (!client?.email) {
      return NextResponse.json({ error: "Brak adresu e-mail klienta — uzupełnij go w karcie klienta." }, { status: 400 });
    }

    const projectId = typeof followup.project_id === "string" ? followup.project_id : null;
    let tytul = "projekt";
    let lang: DocLang = "pl";
    if (projectId) {
      const projectRows = await sql`SELECT tytul, jezyk FROM projects WHERE id = ${projectId};`;
      const project = projectRows[0];
      if (project?.tytul) tytul = String(project.tytul);
      if (project?.jezyk && KNOWN_LANGS.includes(project.jezyk)) lang = project.jezyk as DocLang;
    }
    const days = (NURTURE_OFFSETS.find((o) => o.powod === followup.powod)?.days ?? 90) as 14 | 90;

    await sendEmail({ to: String(client.email), subject: SUBJECT[lang](days, tytul), text });

    await sql`UPDATE client_followups SET done_at = now() WHERE id = ${id};`;
    // `client_followups` nie ma `lead_id` — kontakt kontrolny z definicji
    // dotyczy KLIENTA po zamkniętym projekcie, więc cel ma tylko jedną stronę.
    const cel = { clientId: typeof followup.client_id === "string" ? followup.client_id : null, leadId: null };
    await logZdarzenieDokumentu(
      sql,
      cel,
      "nurture_contact_sent",
      `Wysłano kontakt kontrolny (${days} dni) — „${tytul}”`,
      null,
      projectId
    );
    // B3 — kontakt kontrolny to wiadomość, która poszła do klienta.
    await odnotujWyslanaWiadomosc(sql, cel);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/client-followups/:id/send] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd wysyłki: ${message}` }, { status: 500 });
  }
}
