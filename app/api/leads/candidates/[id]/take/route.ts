import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureLeadHunterSchema, ensureLeadsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { uzasadnienie, type Sygnal } from "@/lib/leadHunter";
import { todayLocalISO } from "@/lib/dates";
import { blokPierwszegoKontaktu } from "@/lib/hunterOutreach";

export const runtime = "nodejs";

type Kandydat = {
  id: string;
  hunt_id: string | null;
  nazwa: string;
  nip: string;
  regon: string;
  branza: string;
  ulica: string;
  kod: string;
  miasto: string;
  telefon: string;
  email: string;
  www: string;
  ocena: string;
  punkty: number;
  sygnaly: Sygnal[] | string;
  stan: string;
  lead_id: string | null;
  polowanie: string | null;
};

/**
 * POST /api/leads/candidates/:id/take — „Weź". Dopiero TU powstaje lead.
 *
 * To jest sedno decyzji architektonicznej Modułu 52: automat nigdy nie dopisuje
 * wiersza do `leads`. Powód jest twardy i świeży — przy Module 51 jedna wartość
 * wpisana „na sztywno" przy tworzeniu leada cicho wykrzywiła dwa wskaźniki
 * lejka. Automat sypiący 200 zimnych rekordów zepsułby WSZYSTKIE wskaźniki
 * konwersji, i to bez żadnego objawu awarii.
 *
 * `zrodlo_kategoria` = „Automatyczne wyszukiwanie" (istniejąca pozycja
 * SOURCE_CATEGORIES — nie dokładamy nowej), `zrodlo` = nazwa polowania +
 * ocena, żeby „konwersja per źródło" ze Statystyk umiała odróżnić łowcę od
 * starego generatora z mapy.
 *
 * Idempotentne: powtórne „Weź" (dwa kliknięcia, telefon offline) nie tworzy
 * drugiego leada, tylko zwraca ten sam.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  await ensureLeadsSchema();
  await ensureLeadHunterSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT c.*, h.nazwa AS polowanie FROM lead_candidates c
    LEFT JOIN lead_hunts h ON h.id = c.hunt_id WHERE c.id = ${id};
  `) as unknown as Kandydat[];
  const k = rows[0];
  if (!k) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (k.stan === "wziety" && k.lead_id) {
    const istniejacy = await sql`SELECT * FROM leads WHERE id = ${k.lead_id};`;
    if (istniejacy[0]) return NextResponse.json({ lead: istniejacy[0], juzByl: true });
  }

  // `sygnaly` wraca z Postgresa jako obiekt (JSONB), ale z PGlite bywa
  // stringiem — jedna z tych różnic, które przechodzą przez `tsc` i wywalają
  // się dopiero na danych.
  const sygnaly: Sygnal[] = Array.isArray(k.sygnaly)
    ? k.sygnaly
    : (JSON.parse(typeof k.sygnaly === "string" ? k.sygnaly : "[]") as Sygnal[]);

  const notatka = [
    `Znaleziony przez Łowcę leadów — ocena ${k.ocena} (${k.punkty} pkt).`,
    k.nip ? `NIP: ${k.nip}` : "",
    "",
    "Dlaczego trafił do skrzynki:",
    uzasadnienie(sygnaly),
    "",
    // Firma nie podała nam swoich danych — wzięliśmy je z rejestru, więc przy
    // pierwszym kontakcie mamy obowiązek powiedzieć skąd (art. 14 RODO).
    // Klauzula ląduje na karcie leada, bo tylko tam właściciel na pewno ją
    // zobaczy, zanim zacznie pisać — z panelu, z telefonu czy z własnej poczty.
    blokPierwszegoKontaktu(),
  ]
    .filter((l) => l !== null)
    .join("\n")
    .trim();

  // ── Dlaczego przyjęty kandydat dostaje TERMIN, a nie tylko status ──
  //
  // `isOverdue()` (lib/leads.ts) zapala „wymaga działania dziś" tylko dla
  // statusu „Nowe zgłoszenie ze strony", dla ustawionej daty przypomnienia
  // albo dla ciszy po „Napisano". Lead w „Do kontaktu" BEZ daty nie pojawia
  // się więc nigdy: ani na Pulpicie, ani w porannym mailu, ani w filtrze
  // „wymaga działania" w apce.
  //
  // Bez tej daty łowca tylko przesuwałby problem o jeden krok: zamiast stosu
  // zimnych rekordów w rejestrze robiłby stos cichych rekordów, o których nic
  // nie przypomina. „Weź" znaczy „zamierzam się odezwać", więc termin to
  // DZIŚ — a `next_action` mówi PO CO, bo samo „kiedy" bez „po co" gubi
  // kontekst po tygodniu (to reguła z Modułu 1).
  const dzis = todayLocalISO();
  const naCo = `pierwszy kontakt — kandydat łowcy, ocena ${k.ocena}`;

  const leadId = randomUUID();
  await sql`
    INSERT INTO leads (id, firma, branza, telefon, email, www, ulica, kod, miasto, zrodlo_kategoria, zrodlo, status, notatki, next_followup, next_action)
    VALUES (
      ${leadId}, ${k.nazwa.slice(0, 300)}, ${k.branza}, ${k.telefon}, ${k.email}, ${k.www},
      ${k.ulica}, ${k.kod}, ${k.miasto},
      'Automatyczne wyszukiwanie',
      ${`${k.polowanie ?? "Łowca leadów"} · ocena ${k.ocena}`.slice(0, 200)},
      'Do kontaktu', ${notatka}, ${dzis}, ${naCo}
    );
  `;

  // Ślad na osi leada — skąd się wziął i czym się wyróżnił. Bez tego po
  // miesiącu zostaje sama nazwa firmy bez kontekstu.
  await sql`
    INSERT INTO lead_activity (id, lead_id, text)
    VALUES (${randomUUID()}, ${leadId}, ${`Przyjęty ze skrzynki Łowcy leadów (polowanie: ${k.polowanie ?? "—"}, ocena ${k.ocena}, ${k.punkty} pkt).`});
  `;

  await sql`
    UPDATE lead_candidates SET stan = 'wziety', lead_id = ${leadId}, updated_at = now() WHERE id = ${id};
  `;
  if (k.hunt_id) {
    await sql`UPDATE lead_hunts SET przyjetych = przyjetych + 1 WHERE id = ${k.hunt_id};`;
  }

  const lead = await sql`SELECT * FROM leads WHERE id = ${leadId};`;
  return NextResponse.json({ lead: lead[0] });
}
