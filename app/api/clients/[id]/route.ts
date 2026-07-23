import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureClientsSchema, ensureContractsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { CLIENT_STATUSES } from "@/lib/clients";
import { rematchUnassigned } from "@/lib/mailSync";
import { logFieldChanges, deleteFieldChanges } from "@/lib/auditLog";

export const runtime = "nodejs";

/** GET /api/clients/:id — klient + JEDEN scalony chronologiczny feed
 * ("pełna historia akcji": ręczne notatki + historia z leada sprzed awansu
 * na klienta + zdarzenia systemowe jak wysłanie oferty/wystawienie
 * faktury/wpłata) + powiązane oferty/faktury/projekty (szybkie linki do
 * aktualnego stanu). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureClientsSchema();
  const sql = getSql();

  const rows = await sql`SELECT * FROM clients WHERE id = ${id};`;
  const client = rows[0];
  if (!client) return NextResponse.json({ error: "not found" }, { status: 404 });
  const leadId = typeof client.lead_id === "string" ? client.lead_id : null;

  type RawActivity = {
    id: string;
    text: string;
    kanal: string | null;
    kierunek: string | null;
    wynik: string | null;
    czas_trwania_sek: number | null;
    mail_message_id: string | null;
    created_at: string;
  };
  // Moduł 31 — umowy dociągane tym samym `Promise.all` co reszta. Oś czasu
  // klienta umowy widziała od Modułu 11 (client_events: contract_created/sent/
  // signed), ale sekcja "Powiązane" ich nie znała, więc nie dało się z karty
  // klienta sprawdzić, czy papier w ogóle jest podpisany — a to warunek startu
  // jego projektów (bramka w api/projects/[id]).
  await ensureContractsSchema();
  const [clientActivity, leadActivity, events, offers, invoices, projects, contracts, mail] = await Promise.all([
    sql`SELECT id, text, kanal, kierunek, wynik, czas_trwania_sek, mail_message_id, created_at FROM client_activity WHERE client_id = ${id};` as unknown as Promise<RawActivity[]>,
    leadId
      ? (sql`SELECT id, text, kanal, kierunek, wynik, czas_trwania_sek, mail_message_id, created_at FROM lead_activity WHERE lead_id = ${leadId};` as unknown as Promise<RawActivity[]>)
      : Promise.resolve([] as RawActivity[]),
    sql`SELECT id, kind, text, amount, related_id, created_at FROM client_events WHERE client_id = ${id};`,
    sql`SELECT id, tytul, status, wazna_do, created_at FROM offers WHERE client_id = ${id} ORDER BY created_at DESC;`,
    sql`SELECT id, numer, status, typ_dokumentu, created_at FROM invoices WHERE client_id = ${id} ORDER BY created_at DESC;`,
    sql`SELECT id, tytul, status, termin, created_at FROM projects WHERE client_id = ${id} ORDER BY created_at DESC;`,
    sql`SELECT id, typ, status, project_id, accepted_at, created_at FROM contracts WHERE client_id = ${id} ORDER BY created_at DESC;`,
    // Kartoteka korespondencji (04d pkt 2) — osobny rejestr obok scalonego
    // feedu, na wyraźną prośbę właściciela (nadpisuje wcześniejszą decyzję z
    // 04-skrzynka-mailowa.md o braku osobnej sekcji).
    sql`SELECT id, subject, kierunek, status, received_at FROM mail_messages WHERE client_id = ${id} ORDER BY received_at DESC LIMIT 100;`,
  ]);
  // Audyt zmian (Moduł 23) świadomie NIE jest tutaj — ma własny endpoint
  // `/changes`, dociągany dopiero po otwarciu zakładki. Dwa powody: profil nie
  // płaci zapytania za log, którego zwykle nikt nie otworzy, a log zostaje
  // aktualny po edycji pola w wizytówce (inaczej pokazywałby stan sprzed
  // zmiany aż do przeładowania całego profilu).

  // Scalony feed — trzy różne źródła, wspólny kształt, posortowane
  // chronologicznie (najnowsze pierwsze). `source: "lead"` oznacza wpisy
  // sprzed awansu na klienta (dociągnięte z leada, z którego powstał) —
  // UI pokazuje je z osobnym tagiem, żeby było jasne skąd się wzięły.
  const feed = [
    ...clientActivity.map((a) => ({
      id: a.id,
      created_at: a.created_at,
      kind: "note" as const,
      text: a.text,
      amount: null as number | null,
      kanal: a.kanal ?? null,
      kierunek: a.kierunek ?? null,
      wynik: a.wynik ?? null,
      czas_trwania_sek: a.czas_trwania_sek ?? null,
      related_id: null as string | null,
      mail_message_id: a.mail_message_id ?? null,
      source: "client" as const,
    })),
    ...leadActivity.map((a) => ({
      id: a.id,
      created_at: a.created_at,
      kind: "note" as const,
      text: a.text,
      amount: null as number | null,
      kanal: a.kanal ?? null,
      kierunek: a.kierunek ?? null,
      wynik: a.wynik ?? null,
      czas_trwania_sek: a.czas_trwania_sek ?? null,
      related_id: null as string | null,
      mail_message_id: a.mail_message_id ?? null,
      source: "lead" as const,
    })),
    ...events.map((e) => ({
      id: e.id as string,
      created_at: e.created_at as string,
      kind: e.kind as string,
      text: e.text as string,
      amount: e.amount != null ? Number(e.amount) : null,
      kanal: null as string | null,
      kierunek: null as string | null,
      wynik: null as string | null,
      czas_trwania_sek: null as number | null,
      related_id: (e.related_id as string | null) ?? null,
      mail_message_id: null as string | null,
      source: "system" as const,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ client, feed, offers, invoices, projects, contracts, mail });
}

/** PATCH /api/clients/:id — aktualizacja pól karty klienta. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  await ensureClientsSchema();
  const sql = getSql();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const dateOrNull = (v: unknown): string | null | undefined => {
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    if (!t) return null;
    return isPlausibleDateString(t) ? t : undefined;
  };

  // Audyt zmian (Moduł 23) — stan sprzed zapisu, do porównania „z czego na co".
  // Jeden SELECT na cały PATCH, nie na pole: neon() płaci rundę HTTP za każde
  // zapytanie. Brak wiersza = klient skasowany w międzyczasie; UPDATE-y niżej
  // i tak nic nie trafią, a log zostaje pusty zamiast zmyślać starą wartość.
  const beforeRows = await sql`SELECT * FROM clients WHERE id = ${id};`;
  const before = (beforeRows[0] ?? {}) as Record<string, unknown>;
  // Co realnie ustawiamy — zbierane po walidacji, żeby log nie zapisał
  // wartości, której baza nie przyjęła.
  const applied: Record<string, unknown> = {};

  if ("nazwa" in body) {
    applied.nazwa = str(body.nazwa, 300);
    await sql`UPDATE clients SET nazwa = ${applied.nazwa}, updated_at = now() WHERE id = ${id};`;
  }
  if ("nip" in body) {
    applied.nip = str(body.nip, 30);
    await sql`UPDATE clients SET nip = ${applied.nip}, updated_at = now() WHERE id = ${id};`;
  }
  if ("ulica" in body) {
    applied.ulica = str(body.ulica, 300);
    await sql`UPDATE clients SET ulica = ${applied.ulica}, updated_at = now() WHERE id = ${id};`;
  }
  if ("kod" in body) {
    applied.kod = str(body.kod, 20);
    await sql`UPDATE clients SET kod = ${applied.kod}, updated_at = now() WHERE id = ${id};`;
  }
  if ("miasto" in body) {
    applied.miasto = str(body.miasto, 200);
    await sql`UPDATE clients SET miasto = ${applied.miasto}, updated_at = now() WHERE id = ${id};`;
  }
  if ("kraj" in body) {
    applied.kraj = str(body.kraj, 100);
    await sql`UPDATE clients SET kraj = ${applied.kraj}, updated_at = now() WHERE id = ${id};`;
  }
  if ("email" in body) {
    const email = str(body.email, 200);
    applied.email = email;
    await sql`UPDATE clients SET email = ${email}, updated_at = now() WHERE id = ${id};`;
    // Nowy/zmieniony adres — dopnij od razu zaległą korespondencję (04d pkt 1).
    if (email.trim()) {
      await rematchUnassigned().catch((e) => console.error("[clients] rematch poczty nie powiódł się", e));
    }
  }
  if ("telefon" in body) {
    applied.telefon = str(body.telefon, 100);
    await sql`UPDATE clients SET telefon = ${applied.telefon}, updated_at = now() WHERE id = ${id};`;
  }
  if ("www" in body) {
    applied.www = str(body.www, 200);
    await sql`UPDATE clients SET www = ${applied.www}, updated_at = now() WHERE id = ${id};`;
  }
  if ("linkedin_url" in body) {
    applied.linkedin_url = str(body.linkedin_url, 300);
    await sql`UPDATE clients SET linkedin_url = ${applied.linkedin_url}, updated_at = now() WHERE id = ${id};`;
  }
  if ("next_action" in body) {
    applied.next_action = str(body.next_action, 500);
    await sql`UPDATE clients SET next_action = ${applied.next_action}, updated_at = now() WHERE id = ${id};`;
  }
  if ("branza" in body) {
    applied.branza = str(body.branza, 200);
    await sql`UPDATE clients SET branza = ${applied.branza}, updated_at = now() WHERE id = ${id};`;
  }
  if ("notatki" in body) {
    applied.notatki = str(body.notatki, 4000);
    await sql`UPDATE clients SET notatki = ${applied.notatki}, updated_at = now() WHERE id = ${id};`;
  }
  if ("status" in body) {
    const v = typeof body.status === "string" && (CLIENT_STATUSES as readonly string[]).includes(body.status) ? body.status : "Prospekt";
    applied.status = v;
    await sql`UPDATE clients SET status = ${v}, updated_at = now() WHERE id = ${id};`;
  }
  if ("ostatni_kontakt" in body) {
    const v = dateOrNull(body.ostatni_kontakt);
    if (v === undefined) return NextResponse.json({ error: "invalid ostatni_kontakt" }, { status: 400 });
    applied.ostatni_kontakt = v;
    await sql`UPDATE clients SET ostatni_kontakt = ${v}, updated_at = now() WHERE id = ${id};`;
  }
  if ("next_followup" in body) {
    const v = dateOrNull(body.next_followup);
    if (v === undefined) return NextResponse.json({ error: "invalid next_followup" }, { status: 400 });
    applied.next_followup = v;
    await sql`UPDATE clients SET next_followup = ${v}, updated_at = now() WHERE id = ${id};`;
  }

  await logFieldChanges("client", id, before, applied);

  return NextResponse.json({ ok: true });
}

/** DELETE /api/clients/:id — usuwa klienta. Powiązane leady/oferty/faktury/
 * projekty NIE są usuwane, tylko odpinane (client_id -> NULL, ON DELETE SET
 * NULL) — to już osobne, samodzielne byty, jak przy usuwaniu leada z oferty.
 * Faktury/umowy zostają z migawką danych (obowiązek podatkowy 5 lat).
 * Audyt zmian kasujemy jawnie — nie ma FK, więc kaskada bazy by go nie ruszyła
 * i zostałyby surowe stare/nowe e-maile klienta (RODO, Audyt 2). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureClientsSchema();
  const sql = getSql();
  await sql`DELETE FROM clients WHERE id = ${id};`;
  await deleteFieldChanges("client", id);
  return NextResponse.json({ ok: true });
}
