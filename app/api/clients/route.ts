import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureClientsSchema, ensureHubSchema, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { CLIENT_STATUSES } from "@/lib/clients";
import { rematchUnassigned } from "@/lib/mailSync";

export const runtime = "nodejs";

/** GET /api/clients — lista klientów. Admin-only. Dociąga `avg_rating`
 * (Moduł 15) — średnią z opinii zebranych po wszystkich projektach danego
 * klienta, do odznaki ★ w Kanban/liście (KanbanBoard.tsx/TableView.tsx). */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureClientsSchema();
  await ensureHubSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT c.*, r.avg_rating
    FROM clients c
    LEFT JOIN (
      SELECT client_id, AVG((review_rating_jakosc + review_rating_terminowosc + review_rating_komunikacja) / 3.0)::float8 AS avg_rating
      FROM projects
      WHERE review_submitted_at IS NOT NULL AND client_id IS NOT NULL
      GROUP BY client_id
    ) r ON r.client_id = c.id
    ORDER BY c.created_at DESC;
  `;
  return NextResponse.json({ clients: rows });
}

/** POST /api/clients — ręczne utworzenie klienta (np. z przycisku "Utwórz
 * klienta" na leadzie, albo bezpośrednio z modułu Klienci gdy rozmowa
 * zaczęła się poza rejestrem leadów, np. polecenie już "gotowego" kontaktu). */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await ensureClientsSchema();
  const sql = getSql();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

  const id = randomUUID();
  const leadId = typeof body.lead_id === "string" && body.lead_id.trim() ? body.lead_id : null;
  const status = typeof body.status === "string" && (CLIENT_STATUSES as readonly string[]).includes(body.status) ? body.status : "Prospekt";

  // Jeśli tworzone z leada — skopiuj jego dane jako punkt startowy.
  //
  // Do 2026-07-26 ta trasa przepisywała z leada TYLKO firmę, branżę, telefon,
  // e-mail i www — a osoba kontaktowa, LinkedIn, adres, źródło i notatki
  // ginęły. Dokładnie ten przeciek Moduł 12 naprawił w `api/offers` i
  // `leads/[id]/promote`, tę trasę pomijając. Efekt widać było dopiero
  // w mailu retencyjnym, który witał „Cześć," zamiast imieniem.
  let nazwa = str(body.nazwa, 300);
  let branza = str(body.branza, 200);
  let telefon = str(body.telefon, 100);
  let email = str(body.email, 200);
  let www = str(body.www, 200);
  let ulica = str(body.ulica, 300);
  let kod = str(body.kod, 20);
  let miasto = str(body.miasto, 200);
  let kraj = str(body.kraj, 100);
  // Osoba kontaktowa przyjmowana od 2026-07-26. Wcześniej nie było jak jej
  // podać ani poprawić — apka miała nawet pole w formularzu „Nowy klient",
  // które po cichu wyrzucała, bo serwer i tak by jej nie przyjął.
  let osobaKontaktowa = str(body.osoba_kontaktowa, 200);
  let linkedin = str(body.linkedin_url, 300);
  let zrodlo = str(body.zrodlo, 300);
  let zrodloKategoria = str(body.zrodlo_kategoria, 100);
  let notatki = str(body.notatki, 4000);
  if (leadId) {
    const lead = (await sql`
      SELECT firma, branza, telefon, email, www, ulica, kod, miasto, kraj,
        osoba_kontaktowa, linkedin_url, zrodlo, zrodlo_kategoria, notatki
      FROM leads WHERE id = ${leadId};
    `)[0];
    if (lead) {
      const zLeada = (v: unknown) => (typeof v === "string" ? v : "");
      if (!nazwa) nazwa = zLeada(lead.firma);
      branza = branza || zLeada(lead.branza);
      telefon = telefon || zLeada(lead.telefon);
      email = email || zLeada(lead.email);
      www = www || zLeada(lead.www);
      ulica = ulica || zLeada(lead.ulica);
      kod = kod || zLeada(lead.kod);
      miasto = miasto || zLeada(lead.miasto);
      kraj = kraj || zLeada(lead.kraj);
      osobaKontaktowa = osobaKontaktowa || zLeada(lead.osoba_kontaktowa);
      linkedin = linkedin || zLeada(lead.linkedin_url);
      zrodlo = zrodlo || zLeada(lead.zrodlo);
      zrodloKategoria = zrodloKategoria || zLeada(lead.zrodlo_kategoria);
      notatki = notatki || zLeada(lead.notatki);
    }
  }

  await sql`
    INSERT INTO clients (
      id, nazwa, nip, ulica, kod, miasto, kraj, email, telefon, www, branza, status, lead_id,
      osoba_kontaktowa, linkedin_url, zrodlo, zrodlo_kategoria, notatki
    )
    VALUES (
      ${id}, ${nazwa}, ${str(body.nip, 30)}, ${ulica}, ${kod},
      ${miasto}, ${kraj}, ${email}, ${telefon}, ${www}, ${branza}, ${status}, ${leadId},
      ${osobaKontaktowa}, ${linkedin}, ${zrodlo}, ${zrodloKategoria}, ${notatki}
    );
  `;
  if (leadId) {
    await sql`UPDATE leads SET client_id = ${id}, updated_at = now() WHERE id = ${leadId};`;
  }
  // Oś czasu klienta zaczyna się od momentu jego powstania — tak samo robią
  // `leads/[id]/promote`, `api/offers` i „zrób klienta z maila". Ta jedna
  // trasa tego nie robiła, więc klient dodany ręcznie miał pustą historię
  // i nie dało się z niej odczytać nawet tego, KIEDY się pojawił.
  await logClientEvent(
    sql,
    id,
    "client_created",
    leadId ? "Utworzony z leada" : "Dodany ręcznie do rejestru klientów"
  );

  // Klient dostał adres — dopnij mu od razu korespondencję, która przyszła
  // zanim istniał (04d pkt 1), zamiast czekać na kolejny sync poczty.
  if (email.trim()) {
    await rematchUnassigned().catch((e) => console.error("[clients] rematch poczty nie powiódł się", e));
  }

  return NextResponse.json({ ok: true, id });
}
