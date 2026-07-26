import { NextRequest, NextResponse } from "next/server";
import {
  getSql,
  ensureLeadsSchema,
  ensureHubSchema,
  ensureClientsSchema,
  ensureOffersSchema,
  ensureInvoicesSchema,
  ensureContractsSchema,
  ensureMailSchema,
  ensureSearchSchema,
} from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import type { Lead } from "@/lib/leads";
import type { Project } from "@/lib/projects";
import type { Note } from "@/lib/notes";
import type { HubEvent } from "@/lib/events";
import type { Client } from "@/lib/clients";
import { zapytanieTsquery, pierwszeSlowo, type TrafienieTresci } from "@/lib/szukaj";

export const runtime = "nodejs";

/** Moduł 31 — dokumenty w palecie. Świadomie wąskie SELECT-y (nie `*`):
 * paleta pokazuje jedną linijkę na wynik, a faktury/oferty ciągną za sobą
 * komplet pól nabywcy, których nikt tu nie użyje. */
type SearchOffer = { id: string; tytul: string; status: string; klient_nazwa: string };
type SearchInvoice = { id: string; numer: string | null; status: string; klient_nazwa: string };
type SearchContract = { id: string; typ: "umowa" | "nda"; status: string; klient_nazwa: string };

/** GET /api/search?q=... — globalne wyszukiwanie do palety poleceń (Cmd+K).
 * Admin-only. Zwraca DWIE rzeczy naraz, bo to dwa różne pytania:
 *
 *  - **po NAZWIE** (`ILIKE`) — leady, klienci, projekty, notatki, wydarzenia
 *    i dokumenty (oferty, faktury, umowy/NDA). Fragment w środku wyrazu
 *    (`%nord%`) łapie tylko to.
 *  - **po TREŚCI** (`tresc`, Moduł 56) — rozmowy, maile, notatki, opisy,
 *    przez prawdziwy indeks pełnotekstowy Postgresa. Odpowiada na pytanie
 *    „gdzie o tym pisaliśmy", na które nazwa rekordu nie odpowie.
 *
 * Jedno bez drugiego zabrałoby połowę odpowiedzi — patrz `szukajWTresci`.
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
    return NextResponse.json({ leads: [], clients: [], projects: [], notes: [], events: [], offers: [], invoices: [], contracts: [], tresc: [] });
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
    // `email` i `osoba_kontaktowa` w dopasowaniu (2026-07-19): bez nich
    // wpisanie adresu albo imienia osoby kontaktowej NIC nie znajdowało —
    // wyszło przy podpowiadaniu adresatów w apce, ale dotyczy tak samo
    // palety Cmd+K w panelu. `telefon` świadomie pominięty: numery bywają
    // zapisane w pięciu formatach i `ILIKE` i tak by ich nie złapał.
    sql`SELECT * FROM leads WHERE firma ILIKE ${like} OR branza ILIKE ${like} OR email ILIKE ${like} OR osoba_kontaktowa ILIKE ${like} LIMIT 6;` as unknown as Promise<Lead[]>,
    sql`SELECT * FROM clients WHERE nazwa ILIKE ${like} OR branza ILIKE ${like} OR email ILIKE ${like} OR osoba_kontaktowa ILIKE ${like} LIMIT 6;` as unknown as Promise<Client[]>,
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

  const tresc = await szukajWTresci(q);

  return NextResponse.json({ leads, clients, projects, notes, events, offers, invoices, contracts, tresc });
}

/**
 * Wyszukiwanie po TREŚCI (Moduł 56) — rozmowy, maile, notatki, opisy.
 *
 * Osobna funkcja obok `ILIKE` wyżej, a nie zamiast: to dwa różne pytania.
 * Powyżej pytamy „który rekord tak się NAZYWA", tutaj „gdzie o tym PISALIŚMY".
 * Zastąpienie jednego drugim zabrałoby połowę odpowiedzi — pełnotekstowy
 * indeks nie znajdzie fragmentu nazwy w środku wyrazu (`ILIKE '%nord%'`
 * znajdzie „Nordwind", `nord:*` też, ale `wind:*` już nie).
 *
 * JEDNO zapytanie na wszystkie źródła (`UNION ALL`), bo `neon()` płaci osobną
 * rundę HTTP za każde — dziewięć zapytań to dziewięć wypraw do bazy.
 *
 * Wpisy powstałe z maila są pomijane w historii klienta (`mail_message_id IS
 * NULL`): ta sama treść wróciłaby drugi raz z `mail_messages`. To ten sam
 * duplikat, który scalaliśmy na osi czasu klienta.
 */
async function szukajWTresci(q: string): Promise<TrafienieTresci[]> {
  const zapytanie = zapytanieTsquery(q);
  if (!zapytanie) return [];

  await ensureMailSchema();
  await ensureSearchSchema();
  const sql = getSql();
  const slowo = pierwszeSlowo(q);

  const rows = (await sql`
    WITH z AS (SELECT to_tsquery('simple', szukaj_norm(${zapytanie})) AS zap)
    SELECT * FROM (
      SELECT 'lead' AS rodzaj, l.id, l.firma AS tytul,
             szukaj_fragment(l.notatki, ${slowo}) AS fragment,
             l.created_at AS data, ts_rank(l.szukaj, z.zap) AS ranga
        FROM leads l, z WHERE l.szukaj @@ z.zap
      UNION ALL
      SELECT 'klient', c.id, c.nazwa, szukaj_fragment(c.notatki, ${slowo}), c.created_at, ts_rank(c.szukaj, z.zap)
        FROM clients c, z WHERE c.szukaj @@ z.zap
      UNION ALL
      SELECT 'rozmowa-lead', a.lead_id, l.firma, szukaj_fragment(a.text, ${slowo}), a.created_at, ts_rank(a.szukaj, z.zap)
        FROM lead_activity a JOIN leads l ON l.id = a.lead_id, z WHERE a.szukaj @@ z.zap
      UNION ALL
      SELECT 'rozmowa-klient', a.client_id, c.nazwa, szukaj_fragment(a.text, ${slowo}), a.created_at, ts_rank(a.szukaj, z.zap)
        FROM client_activity a JOIN clients c ON c.id = a.client_id, z
        WHERE a.szukaj @@ z.zap AND a.mail_message_id IS NULL
      UNION ALL
      SELECT 'zdarzenie-klient', e.client_id, c.nazwa, szukaj_fragment(e.text, ${slowo}), e.created_at, ts_rank(e.szukaj, z.zap)
        FROM client_events e JOIN clients c ON c.id = e.client_id, z WHERE e.szukaj @@ z.zap
      UNION ALL
      SELECT 'rozmowa-projekt', a.project_id, p.tytul, szukaj_fragment(a.text, ${slowo}), a.created_at, ts_rank(a.szukaj, z.zap)
        FROM project_activity a JOIN projects p ON p.id = a.project_id, z WHERE a.szukaj @@ z.zap
      UNION ALL
      SELECT 'mail', m.id, COALESCE(NULLIF(m.subject, ''), '(bez tematu)'),
             szukaj_fragment(m.body_text, ${slowo}), m.received_at, ts_rank(m.szukaj, z.zap)
        FROM mail_messages m, z WHERE m.szukaj @@ z.zap
      UNION ALL
      SELECT 'notatka', n.id, COALESCE(NULLIF(n.tytul, ''), '(bez tytułu)'),
             szukaj_fragment(n.tresc, ${slowo}), n.created_at, ts_rank(n.szukaj, z.zap)
        FROM notes n, z WHERE n.szukaj @@ z.zap
      UNION ALL
      SELECT 'projekt', p.id, p.tytul, szukaj_fragment(p.opis, ${slowo}), p.created_at, ts_rank(p.szukaj, z.zap)
        FROM projects p, z WHERE p.szukaj @@ z.zap
    ) t
    -- Najpierw trafność, potem świeżość: przy tej samej trafności nowsza
    -- rozmowa jest niemal zawsze tą, o którą chodziło.
    ORDER BY ranga DESC, data DESC
    LIMIT 20;
  `) as unknown as (TrafienieTresci & { ranga: number })[];

  return rows.map(({ rodzaj, id, tytul, fragment, data }) => ({
    rodzaj,
    id,
    tytul,
    fragment: (fragment ?? "").trim(),
    data,
  }));
}
