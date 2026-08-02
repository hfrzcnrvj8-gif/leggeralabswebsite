import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema, ensureClientsSchema, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import type { DocLang } from "@/lib/documents";
import { sprawdzMailPrzedWysylka, odmowaBramki, mimoOstrzezen } from "@/lib/bramkaWysylki";
import { odczytajPotwierdzenie, odmowaPotwierdzenia } from "@/lib/nieodwracalne";

export const runtime = "nodejs";

const SUBJECT: Record<DocLang, (tytul: string) => string> = {
  pl: (tytul) => `Podsumowanie i prośba o opinię — ${tytul}`,
  en: (tytul) => `Project summary and feedback request — ${tytul}`,
  de: (tytul) => `Projektzusammenfassung und Bitte um Bewertung — ${tytul}`,
};

/** POST /api/projects/:id/request-review — wysyła klientowi mailem szkic
 * podsumowania projektu + link do publicznego formularza opinii. Admin-only.
 * Treść (`body`) to tekst zredagowany/zaakceptowany przez właściciela w
 * panelu (buildProjectClosingSummary to tylko punkt startowy) — panel nigdy
 * nie wysyła niczego bez tego jawnego kliknięcia. Wzorem
 * app/api/offers/[id]/send. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { body?: unknown } | null;
  const text = typeof body?.body === "string" ? body.body.trim() : "";

  try {
    await ensureHubSchema();
    await ensureClientsSchema();
    const sql = getSql();
    const rows = await sql`SELECT * FROM projects WHERE id = ${id};`;
    const project = rows[0];
    if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
    // Moduł 40 — nie wysyłamy prośby o opinię linkiem, który sami
    // unieważniliśmy (przycisk w panelu też jest wtedy wyłączony, ale to
    // ochrona po stronie interfejsu, a nie zasada).
    if (project.review_revoked_at) {
      return NextResponse.json(
        { error: "Link do formularza opinii jest unieważniony — wygeneruj nowy przed wysyłką." },
        { status: 409 }
      );
    }

    const clientId = typeof project.client_id === "string" ? project.client_id : null;
    if (!clientId) return NextResponse.json({ error: "Projekt nie ma podpiętego klienta." }, { status: 400 });
    const clientRows = await sql`SELECT email, nazwa FROM clients WHERE id = ${clientId};`;
    const clientRow = clientRows[0];
    if (!clientRow?.email) {
      return NextResponse.json({ error: "Brak adresu e-mail klienta — uzupełnij go w karcie klienta." }, { status: 400 });
    }

    // BRAMKA WYSYŁKI (Faza 2) — najpoważniejsze znalezisko całego przejścia
    // (A1): stąd wyszedł do klienta mail podpisany dosłownie „[Twoje imię]",
    // a niżej stało „[uzupełnij, jeśli jest plan na kolejne kroki]". Jedno
    // kliknięcie, kod 200, żadnego ostrzeżenia. Ta trasa sprawdzała wyłącznie,
    // czy treść jest niepusta.
    //
    // Sprawdzenie stoi TUTAJ, nie tylko w panelu: mail wychodzi z trasy.
    const bramka = sprawdzMailPrzedWysylka({ tresc: text, statusProjektu: String(project.status ?? "") });
    const odmowa = odmowaBramki(bramka, mimoOstrzezen(body));
    if (odmowa) return NextResponse.json({ error: odmowa.error, bramka: odmowa.bramka }, { status: odmowa.status });

    // POTWIERDZENIE (Faza 4) — PO bramce: najpierw „czy to wolno wysłać”,
    // dopiero potem „czy na pewno teraz”. Odwrotna kolejność kazałaby
    // potwierdzać wysyłkę dokumentu, który i tak nie ma prawa wyjść.
    const odmowaPotw = odmowaPotwierdzenia("opinia-popros", odczytajPotwierdzenie(req.headers));
    if (odmowaPotw) {
      return NextResponse.json({ error: odmowaPotw.error, potwierdzenie: odmowaPotw.potwierdzenie }, { status: odmowaPotw.status });
    }

    const tytul = typeof project.tytul === "string" && project.tytul ? project.tytul : "projekt";
    const lang = ((project.jezyk as string) in SUBJECT ? project.jezyk : "pl") as DocLang;
    await sendEmail({
      to: String(clientRow.email),
      subject: SUBJECT[lang](tytul),
      text,
    });

    await sql`UPDATE projects SET review_requested_at = now(), updated_at = now() WHERE id = ${id};`;
    await logClientEvent(sql, clientId, "review_requested", `Wysłano podsumowanie i prośbę o opinię — „${tytul}”`, null, id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/projects/:id/request-review] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd wysyłki: ${message}` }, { status: 500 });
  }
}
