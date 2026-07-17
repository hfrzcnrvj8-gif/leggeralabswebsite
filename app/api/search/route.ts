import { NextRequest, NextResponse } from "next/server";
import {
  getSql,
  ensureLeadsSchema,
  ensureHubSchema,
  ensureClientsSchema,
  ensureOffersSchema,
  ensureInvoicesSchema,
  ensureContractsSchema,
} from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import type { Lead } from "@/lib/leads";
import type { Project } from "@/lib/projects";
import type { Note } from "@/lib/notes";
import type { HubEvent } from "@/lib/events";
import type { Client } from "@/lib/clients";

export const runtime = "nodejs";

/** Moduł 31 — dokumenty w palecie. Świadomie wąskie SELECT-y (nie `*`):
 * paleta pokazuje jedną linijkę na wynik, a faktury/oferty ciągną za sobą
 * komplet pól nabywcy, których nikt tu nie użyje. */
type SearchOffer = { id: string; tytul: string; status: string; klient_nazwa: string };
type SearchInvoice = { id: string; numer: string | null; status: string; klient_nazwa: string };
type SearchContract = { id: string; typ: "umowa" | "nda"; status: string; klient_nazwa: string };

/** GET /api/search?q=... — globalne wyszukiwanie po leadach, klientach,
 * projektach, notatkach, wydarzeniach oraz dokumentach (oferty, faktury,
 * umowy/NDA) naraz, do globalnej palety poleceń (Cmd+K). Admin-only. Proste
 * ILIKE zamiast pełnotekstowego indeksu — wystarczające przy skali
 * jednoosobowej firmy (dziesiątki/setki rekordów, nie miliony).
 *
 * Moduł 31 — dokumenty doszły całą trójką. Luka była wspólna (paleta znała
 * tylko CRM, żadnego dokumentu), a szukanie po nazwie klienta ma sens dla
 * każdego z nich tak samo. */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ leads: [], clients: [], projects: [], notes: [], events: [], offers: [], invoices: [], contracts: [] });
  }

  await ensureLeadsSchema();
  await ensureHubSchema();
  await ensureClientsSchema();
  await ensureOffersSchema();
  await ensureInvoicesSchema();
  await ensureContractsSchema();
  const sql = getSql();
  const like = `%${q}%`;

  const [leads, clients, projects, notes, events, offers, invoices, contracts] = await Promise.all([
    sql`SELECT * FROM leads WHERE firma ILIKE ${like} OR branza ILIKE ${like} LIMIT 6;` as unknown as Promise<Lead[]>,
    sql`SELECT * FROM clients WHERE nazwa ILIKE ${like} OR branza ILIKE ${like} LIMIT 6;` as unknown as Promise<Client[]>,
    sql`SELECT * FROM projects WHERE tytul ILIKE ${like} OR opis ILIKE ${like} LIMIT 6;` as unknown as Promise<Project[]>,
    sql`SELECT * FROM notes WHERE tytul ILIKE ${like} OR tresc ILIKE ${like} OR tagi ILIKE ${like} LIMIT 6;` as unknown as Promise<Note[]>,
    sql`SELECT * FROM events WHERE tytul ILIKE ${like} OR opis ILIKE ${like} LIMIT 6;` as unknown as Promise<HubEvent[]>,
    sql`SELECT id, tytul, status, klient_nazwa FROM offers WHERE tytul ILIKE ${like} OR klient_nazwa ILIKE ${like} LIMIT 6;` as unknown as Promise<
      SearchOffer[]
    >,
    // Faktura szukana też po numerze — to jedyny sensowny uchwyt, gdy szukasz
    // konkretnego dokumentu ("FV/2026/07/3"), a nie wszystkiego dla klienta.
    sql`SELECT id, numer, status, klient_nazwa FROM invoices WHERE numer ILIKE ${like} OR klient_nazwa ILIKE ${like} LIMIT 6;` as unknown as Promise<
      SearchInvoice[]
    >,
    sql`SELECT id, typ, status, klient_nazwa FROM contracts WHERE klient_nazwa ILIKE ${like} OR zakres_prac ILIKE ${like} LIMIT 6;` as unknown as Promise<
      SearchContract[]
    >,
  ]);

  return NextResponse.json({ leads, clients, projects, notes, events, offers, invoices, contracts });
}
