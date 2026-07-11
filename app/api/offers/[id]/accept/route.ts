import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureOffersSchema, ensureClientsSchema, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { getProjectTemplate, expandProjectTemplate } from "@/lib/projects";
import { isOfferExpired, type Offer } from "@/lib/offers";

export const runtime = "nodejs";

/** POST /api/offers/:id/accept — "akceptuj ofertę": jednym kliknięciem tworzy
 * PROJEKT (opcjonalnie z szablonu, body.template) i FAKTURĘ-szkic z pozycjami
 * skopiowanymi 1:1 z oferty, podpina oba do oferty i ustawia jej status na
 * "Zaakceptowana". Admin-only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await ensureOffersSchema();
  await ensureClientsSchema();
  const sql = getSql();

  const rows = await sql`SELECT * FROM offers WHERE id = ${id};`;
  const offer = rows[0];
  if (!offer) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (offer.status === "Zaakceptowana") {
    return NextResponse.json({ error: "Oferta jest już zaakceptowana." }, { status: 400 });
  }
  // Wygasła oferta wciąż da się zaakceptować, ale świadomie, dopiero po
  // potwierdzeniu (body.confirmExpired) — inaczej łatwo przez pomyłkę
  // "ożywić" ofertę sprzed miesięcy i utworzyć z niej projekt/fakturę.
  if (isOfferExpired(offer as Pick<Offer, "status" | "wazna_do">) && body.confirmExpired !== true) {
    return NextResponse.json(
      { error: "Oferta jest przeterminowana (minęła data ważności).", expired: true },
      { status: 409 }
    );
  }

  const items = await sql`SELECT * FROM offer_items WHERE offer_id = ${id} ORDER BY position ASC;`;
  if (items.length === 0) {
    return NextResponse.json({ error: "Oferta bez pozycji — dodaj co najmniej jedną pozycję." }, { status: 400 });
  }

  const templateId = typeof body.template === "string" && body.template.trim() ? body.template : undefined;
  const template = templateId ? getProjectTemplate(templateId) : undefined;
  const tytulProjektu =
    (typeof offer.tytul === "string" && offer.tytul) || (typeof offer.klient_nazwa === "string" && offer.klient_nazwa) || "Projekt z oferty";
  const leadId = typeof offer.lead_id === "string" ? offer.lead_id : null;
  const clientId = typeof offer.client_id === "string" ? offer.client_id : null;

  const projectId = randomUUID();
  if (template) {
    const exp = expandProjectTemplate(template);
    await sql`
      INSERT INTO projects (id, tytul, opis, status, priorytet, start, termin, lead_id, client_id)
      VALUES (${projectId}, ${tytulProjektu.slice(0, 300)}, ${exp.opis}, 'Pomysł', 'Normalny', ${exp.start}, ${exp.termin}, ${leadId}, ${clientId});
    `;
    let mPos = 0;
    for (const m of exp.milestones) {
      const milestoneId = randomUUID();
      await sql`
        INSERT INTO project_milestones (id, project_id, nazwa, termin, position)
        VALUES (${milestoneId}, ${projectId}, ${m.nazwa.slice(0, 200)}, ${m.termin}, ${mPos});
      `;
      let tPos = 0;
      for (const taskText of m.tasks) {
        await sql`
          INSERT INTO project_tasks (id, project_id, text, position, milestone_id)
          VALUES (${randomUUID()}, ${projectId}, ${taskText.slice(0, 1000)}, ${tPos}, ${milestoneId});
        `;
        tPos += 1;
      }
      mPos += 1;
    }
  } else {
    await sql`
      INSERT INTO projects (id, tytul, status, priorytet, lead_id, client_id)
      VALUES (${projectId}, ${tytulProjektu.slice(0, 300)}, 'Pomysł', 'Normalny', ${leadId}, ${clientId});
    `;
  }

  const invoiceId = randomUUID();
  await sql`
    INSERT INTO invoices (
      id, lead_id, project_id, client_id, klient_nazwa, klient_nip, klient_adres,
      klient_ulica, klient_kod, klient_miasto, klient_kraj
    )
    VALUES (
      ${invoiceId}, ${leadId}, ${projectId}, ${clientId}, ${offer.klient_nazwa}, ${offer.klient_nip}, ${offer.klient_adres},
      ${offer.klient_ulica ?? ""}, ${offer.klient_kod ?? ""}, ${offer.klient_miasto ?? ""}, ${offer.klient_kraj ?? ""}
    );
  `;
  let pos = 0;
  for (const it of items) {
    await sql`
      INSERT INTO invoice_items (id, invoice_id, nazwa, ilosc, jednostka, cena_netto, vat_stawka, position)
      VALUES (${randomUUID()}, ${invoiceId}, ${it.nazwa}, ${it.ilosc}, ${it.jednostka}, ${it.cena}, '23', ${pos});
    `;
    pos += 1;
  }

  // Atomowy "claim": WHERE status != 'Zaakceptowana' gwarantuje, że tylko
  // JEDNO z dwóch niemal równoczesnych żądań (np. podwójny klik) rzeczywiście
  // podepnie swój projekt/fakturę do oferty — Postgres serializuje UPDATE-y
  // na tym samym wierszu, więc przegrany zobaczy 0 zmienionych wierszy.
  const claimed = await sql`
    UPDATE offers SET status = 'Zaakceptowana', project_id = ${projectId}, invoice_id = ${invoiceId}, updated_at = now()
    WHERE id = ${id} AND status != 'Zaakceptowana'
    RETURNING id;
  `;
  if (claimed.length === 0) {
    // Przegraliśmy wyścig — ktoś inny zaakceptował tę ofertę w międzyczasie.
    // Nie zostawiaj osieroconego projektu/faktury utworzonych "na próbę".
    await sql`DELETE FROM invoices WHERE id = ${invoiceId};`;
    await sql`DELETE FROM projects WHERE id = ${projectId};`;
    return NextResponse.json({ error: "Oferta została już zaakceptowana (w innej karcie/kliknięciu)." }, { status: 409 });
  }

  await logClientEvent(sql, clientId, "offer_accepted", `Zaakceptowano ofertę „${tytulProjektu}” — utworzono projekt i fakturę`);

  return NextResponse.json({ ok: true, projectId, invoiceId });
}
