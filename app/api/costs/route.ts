import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureCostsSchema, ensureLinksSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { costBrutto, czytajPolaKosztu, normalizeCostRow } from "@/lib/costs";

export const runtime = "nodejs";

/** GET /api/costs — lista kosztów z nazwą podpiętego projektu (do listy). Admin-only. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureCostsSchema();
  // `costs.client_id` / `costs.lead_id` zakłada `ensureLinksSchema()`, nie
  // `ensureCostsSchema()` — a niżej je SELECT-ujemy. Bez tej linii lista
  // kosztów zwraca 500 (42703) na każdej bazie, na której migracja „links"
  // jeszcze nie poszła. Sąsiedni `[id]/route.ts` robił to poprawnie od
  // początku; ta trasa została pominięta (złapane audytem Fazy 13.4).
  await ensureLinksSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT c.id, c.dostawca_nazwa, c.dostawca_nip, c.kategoria, c.opis, c.data_wydatku,
      c.kwota_netto, c.vat_stawka, c.kwota_brutto, c.waluta, c.kurs_pln,
      c.status, c.termin_platnosci, c.data_platnosci, c.project_id,
      c.created_at, c.updated_at, c.zalacznik_nazwa, c.zalacznik_typ, c.ksef_numer, c.ksef_tryb,
      c.metoda_platnosci, c.dostawca_konto, c.numer_faktury, c.data_wplywu,
      c.vat_odliczenie_procent, c.duplikat_potwierdzony,
      c.client_id, c.lead_id,
      p.tytul AS project_tytul,
      cl.nazwa AS client_nazwa,
      l.firma AS lead_firma
    FROM costs c
    LEFT JOIN projects p ON p.id = c.project_id
    LEFT JOIN clients cl ON cl.id = c.client_id
    LEFT JOIN leads l ON l.id = c.lead_id
    ORDER BY c.data_wydatku DESC, c.created_at DESC;
  `;
  // `normalizeCostRow` zamiast ręcznego `Number(...)` na dwóch polach:
  // odporność po stronie ODCZYTU jest osobna od bramki zapisu, bo bramka nie
  // naprawia tego, co już siedzi w bazie (Moduł 63). Wiersz ze śmieciem
  // w walucie wywalałby CAŁĄ listę — `formatMoney` na nieznanym kodzie rzuca
  // `RangeError`, a rzucający formater leci do error boundary całego ekranu.
  return NextResponse.json({ costs: rows.map((r) => normalizeCostRow(r as Record<string, unknown>)) });
}

/** POST /api/costs — nowy koszt (draft, dane uzupełniane potem PATCH-em). Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await ensureCostsSchema();
  const sql = getSql();

  // Bramka zapisu (Moduł 63) — do 2026-08-01 ta trasa podmieniała śmieć na
  // wartość domyślną i odpowiadała `{"ok":true}`: sonda przepchnęła tędy
  // kategorię „CO-TO-JEST", stawkę „999" i kwotę 9e15.
  const wynik = czytajPolaKosztu(body);
  if (wynik.blad != null) return NextResponse.json({ error: wynik.blad }, { status: 400 });
  const f = wynik.pola;

  const id = randomUUID();
  const projectId = typeof body.project_id === "string" && body.project_id.trim() ? body.project_id : null;
  const kwotaBrutto = costBrutto(f.kwota_netto, f.vat_stawka);

  await sql`
    INSERT INTO costs (id, dostawca_nazwa, dostawca_nip, dostawca_konto, numer_faktury,
      kategoria, opis, kwota_netto, vat_stawka, kwota_brutto, waluta, kurs_pln,
      status, metoda_platnosci, vat_odliczenie_procent,
      data_wydatku, data_wplywu, termin_platnosci, data_platnosci, project_id)
    VALUES (${id}, ${f.dostawca_nazwa}, ${f.dostawca_nip}, ${f.dostawca_konto}, ${f.numer_faktury},
      ${f.kategoria}, ${f.opis}, ${f.kwota_netto}, ${f.vat_stawka}, ${kwotaBrutto}, ${f.waluta}, ${f.kurs_pln},
      ${f.status}, ${f.metoda_platnosci}, ${f.vat_odliczenie_procent},
      COALESCE(${f.data_wydatku}::date, CURRENT_DATE), ${f.data_wplywu}, ${f.termin_platnosci},
      ${f.data_platnosci}, ${projectId});
  `;
  return NextResponse.json({ ok: true, id });
}
