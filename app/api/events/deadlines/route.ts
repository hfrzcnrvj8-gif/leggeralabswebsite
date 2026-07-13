import { NextRequest, NextResponse } from "next/server";
import {
  getSql,
  ensureLeadsSchema,
  ensureHubSchema,
  ensureInvoicesSchema,
  ensureClientsSchema,
} from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { todayLocalISO } from "@/lib/dates";

export const runtime = "nodejs";

/** Rodzaj terminu wyliczonego (a nie ręcznie wpisanego) — do kolorowania i
 * linkowania w kalendarzu. */
export type DeadlineKind = "invoice" | "project" | "milestone" | "lead" | "client";

export type Deadline = {
  /** Stabilny, syntetyczny id — kalendarz nie zapisuje ani nie usuwa tych
   * pozycji, ale React potrzebuje klucza. */
  id: string;
  data: string; // YYYY-MM-DD
  tytul: string;
  kind: DeadlineKind;
  /** Dokąd prowadzi kliknięcie (podstrona modułu). */
  href: string;
};

/**
 * GET /api/events/deadlines?month=YYYY-MM — WYLICZONE terminy z innych modułów
 * (płatności faktur, terminy projektów, kamienie milowe, przypomnienia o
 * kontakcie), żeby kalendarz pokazywał realne „co mnie czeka", a nie tylko
 * ręcznie wpisane wydarzenia. Wyłącznie do odczytu — te pozycje żyją w swoich
 * modułach, kalendarz je tylko nakłada. Admin-only.
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureLeadsSchema();
  await ensureHubSchema();
  await ensureInvoicesSchema();
  await ensureClientsSchema();
  const sql = getSql();

  const month = req.nextUrl.searchParams.get("month");
  const prefix = month && /^\d{4}-\d{2}$/.test(month) ? month : todayLocalISO().slice(0, 7);

  const [invoices, projects, milestones, leads, clients] = await Promise.all([
    // Nieopłacone faktury z terminem płatności w tym miesiącu (bez proform,
    // bez szkiców/anulowanych/opłaconych).
    sql`
      SELECT id, numer, klient_nazwa, termin_platnosci
      FROM invoices
      WHERE status IN ('Wystawiona', 'Po terminie') AND typ_dokumentu != 'proforma'
        AND termin_platnosci IS NOT NULL
        AND to_char(termin_platnosci, 'YYYY-MM') = ${prefix};
    ` as unknown as Promise<{ id: string; numer: string | null; klient_nazwa: string; termin_platnosci: string }[]>,
    // Terminy projektów jeszcze niewdrożonych.
    sql`
      SELECT id, tytul, termin FROM projects
      WHERE status != 'Wdrożone' AND termin IS NOT NULL
        AND to_char(termin, 'YYYY-MM') = ${prefix};
    ` as unknown as Promise<{ id: string; tytul: string; termin: string }[]>,
    // Kamienie milowe z terminem w tym miesiącu, projekt niewdrożony, kamień
    // jeszcze nieukończony (ma niezrobione zadanie ALBO w ogóle nie ma zadań).
    sql`
      SELECT m.id, m.nazwa, m.termin, m.project_id, p.tytul AS projekt
      FROM project_milestones m
      JOIN projects p ON p.id = m.project_id
      WHERE p.status != 'Wdrożone' AND m.termin IS NOT NULL
        AND to_char(m.termin, 'YYYY-MM') = ${prefix}
        AND (
          EXISTS (SELECT 1 FROM project_tasks t WHERE t.milestone_id = m.id AND t.done = false)
          OR NOT EXISTS (SELECT 1 FROM project_tasks t WHERE t.milestone_id = m.id)
        );
    ` as unknown as Promise<{ id: string; nazwa: string; termin: string; project_id: string; projekt: string }[]>,
    // Przypomnienia o kontakcie z leadem (otwartym).
    sql`
      SELECT id, firma, next_followup FROM leads
      WHERE next_followup IS NOT NULL
        AND status NOT IN ('Zamknięte - sukces', 'Odrzucone / brak zainteresowania')
        AND to_char(next_followup, 'YYYY-MM') = ${prefix};
    ` as unknown as Promise<{ id: string; firma: string; next_followup: string }[]>,
    // Przypomnienia o kontakcie z klientem.
    sql`
      SELECT id, nazwa, next_followup FROM clients
      WHERE next_followup IS NOT NULL
        AND to_char(next_followup, 'YYYY-MM') = ${prefix};
    ` as unknown as Promise<{ id: string; nazwa: string; next_followup: string }[]>,
  ]);

  const deadlines: Deadline[] = [
    ...invoices.map((i) => ({
      id: `inv-${i.id}`,
      data: String(i.termin_platnosci).slice(0, 10),
      tytul: `Płatność — ${i.numer ?? (i.klient_nazwa || "faktura")}`,
      kind: "invoice" as const,
      href: `/admin/invoices/${i.id}`,
    })),
    ...projects.map((p) => ({
      id: `prj-${p.id}`,
      data: String(p.termin).slice(0, 10),
      tytul: `Termin projektu — ${p.tytul}`,
      kind: "project" as const,
      href: `/admin/projects/${p.id}`,
    })),
    ...milestones.map((m) => ({
      id: `mst-${m.id}`,
      data: String(m.termin).slice(0, 10),
      tytul: `Kamień — ${m.nazwa} (${m.projekt})`,
      kind: "milestone" as const,
      href: `/admin/projects/${m.project_id}`,
    })),
    ...leads.map((l) => ({
      id: `led-${l.id}`,
      data: String(l.next_followup).slice(0, 10),
      tytul: `Przypomnienie (lead) — ${l.firma}`,
      kind: "lead" as const,
      href: `/admin/leads/${l.id}`,
    })),
    ...clients.map((c) => ({
      id: `cli-${c.id}`,
      data: String(c.next_followup).slice(0, 10),
      tytul: `Przypomnienie (klient) — ${c.nazwa}`,
      kind: "client" as const,
      href: `/admin/clients/${c.id}`,
    })),
  ];

  return NextResponse.json({ deadlines });
}
