import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema, ensureOffersSchema, ensureClientsSchema, ensureHubSchema, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { matchClientForOrphan, type MatchCandidate } from "@/lib/links";

export const runtime = "nodejs";

/** Moduł 30 — „powiązanie wstecz" dla rekordów, które powstały bez klienta.
 *
 * Istnieje, bo naprawa przecieków `client_id` (POST /api/invoices, duplikaty,
 * korekty) działa tylko na PRZYSZŁE rekordy. Na produkcji leżą już oferty,
 * faktury i projekty, które klienta nigdy nie dostały — a Claude nie ma
 * dostępu do produkcyjnej bazy (CLAUDE.md), więc jednorazowy skrypt SQL
 * odpada. Zamiast tego panel wylicza PROPOZYCJE, a właściciel zatwierdza
 * każdą osobno (GET niżej niczego nie zapisuje).
 *
 * Projekty świadomie bez własnej migawki nazwy klienta (nie mają pól
 * `klient_*`) — dopasowujemy je po ofercie/fakturze, która już na nie
 * wskazuje, a jeśli takiej nie ma, projekt po prostu nie trafia na listę.
 * Zgadywanie klienta z tytułu projektu byłoby dopasowaniem rozmytym, czyli
 * dokładnie tym, czego ten panel nie robi.
 */

type OrphanRow = {
  rodzaj: "offer" | "invoice";
  id: string;
  etykieta: string;
  klient_nazwa: string;
  klient_nip: string;
  propozycja: { clientId: string; clientNazwa: string; pewnosc: "nip" | "nazwa" } | null;
};

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureOffersSchema();
  await ensureInvoicesSchema();
  await ensureClientsSchema();
  const sql = getSql();

  const clients = (await sql`SELECT id, nazwa, nip FROM clients ORDER BY nazwa ASC;`) as MatchCandidate[];

  const offers = await sql`
    SELECT id, tytul, klient_nazwa, klient_nip FROM offers
    WHERE client_id IS NULL ORDER BY created_at DESC;
  `;
  const invoices = await sql`
    SELECT id, numer, klient_nazwa, klient_nip FROM invoices
    WHERE client_id IS NULL ORDER BY created_at DESC;
  `;

  const rows: OrphanRow[] = [];
  for (const o of offers) {
    const doc = { id: String(o.id), klient_nazwa: String(o.klient_nazwa ?? ""), klient_nip: String(o.klient_nip ?? "") };
    rows.push({
      rodzaj: "offer",
      id: doc.id,
      etykieta: String(o.tytul || "(bez tytułu)"),
      klient_nazwa: doc.klient_nazwa,
      klient_nip: doc.klient_nip,
      propozycja: matchClientForOrphan(doc, clients),
    });
  }
  for (const i of invoices) {
    const doc = { id: String(i.id), klient_nazwa: String(i.klient_nazwa ?? ""), klient_nip: String(i.klient_nip ?? "") };
    rows.push({
      rodzaj: "invoice",
      id: doc.id,
      etykieta: String(i.numer || "(szkic)"),
      klient_nazwa: doc.klient_nazwa,
      klient_nip: doc.klient_nip,
      propozycja: matchClientForOrphan(doc, clients),
    });
  }

  return NextResponse.json({ orphans: rows, clients });
}

/** POST — zatwierdzenie JEDNEGO powiązania, wprost kliknięte przez
 * właściciela. Świadomie bez trybu „powiąż wszystkie": lista bierze się z
 * dopasowania po nazwie/NIP-ie, a hurtowe zatwierdzenie zamieniłoby ludzką
 * decyzję w klepnięcie jednego guzika — czyli dokładnie to, przed czym ten
 * moduł ma chronić. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const rodzaj = body?.rodzaj;
  const id = typeof body?.id === "string" ? body.id : null;
  const clientId = typeof body?.client_id === "string" && body.client_id.trim() ? body.client_id : null;
  if (!id || !clientId || (rodzaj !== "offer" && rodzaj !== "invoice")) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  await ensureOffersSchema();
  await ensureInvoicesSchema();
  await ensureClientsSchema();
  await ensureHubSchema();
  const sql = getSql();

  const client = (await sql`SELECT nazwa FROM clients WHERE id = ${clientId};`)[0];
  if (!client) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (rodzaj === "offer") {
    await sql`UPDATE offers SET client_id = ${clientId}, updated_at = now() WHERE id = ${id} AND client_id IS NULL;`;
    const offer = (await sql`SELECT tytul, project_id, invoice_id FROM offers WHERE id = ${id};`)[0];
    await logClientEvent(sql, clientId, "offer_created", `Powiązano wstecz ofertę „${offer?.tytul || "(bez tytułu)"}”`, null, id);

    // Projekt i faktura z tej oferty odziedziczyły jej brak klienta
    // (lib/offerAccept.ts przepisuje client_id Z OFERTY) — więc naprawa samej
    // oferty zostawiłaby je osierocone, a to na projekcie wisi kontakt
    // retencyjny. Uwaga: to OFERTA trzyma wskaźniki (project_id/invoice_id),
    // nie odwrotnie. `AND client_id IS NULL` pilnuje, żeby nigdy nie nadpisać
    // istniejącego powiązania cudzym.
    if (typeof offer?.project_id === "string") {
      await sql`UPDATE projects SET client_id = ${clientId}, updated_at = now() WHERE id = ${offer.project_id} AND client_id IS NULL;`;
    }
    if (typeof offer?.invoice_id === "string") {
      await sql`UPDATE invoices SET client_id = ${clientId}, updated_at = now() WHERE id = ${offer.invoice_id} AND client_id IS NULL;`;
    }
  } else {
    await sql`UPDATE invoices SET client_id = ${clientId}, updated_at = now() WHERE id = ${id} AND client_id IS NULL;`;
    const inv = (await sql`SELECT numer FROM invoices WHERE id = ${id};`)[0];
    await logClientEvent(sql, clientId, "invoice_issued", `Powiązano wstecz fakturę ${inv?.numer || "(szkic)"}`, null, id);
  }

  return NextResponse.json({ ok: true });
}
