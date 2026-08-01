import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureCostsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { czytajPolaCyklu, DOMYSLNA_WALUTA, isWaluta } from "@/lib/costs";
import { todayISO } from "@/lib/recurring";

export const runtime = "nodejs";

/** Odporność po stronie ODCZYTU — bramka zapisu nie naprawia tego, co już
 * siedzi w bazie. Nieznana waluta czyta się jako PLN, bo dokładnie to znaczyły
 * wszystkie szablony sprzed Modułu 63 (a `formatMoney` na nieznanym kodzie
 * rzuca i wywala cały ekran, nie jeden wiersz). */
function parseRow(r: Record<string, unknown>): Record<string, unknown> {
  return {
    ...r,
    kwota_netto: Number(r.kwota_netto),
    waluta: isWaluta(r.waluta) ? String(r.waluta).trim() : DOMYSLNA_WALUTA,
  };
}

/** GET /api/recurring-costs — lista szablonów kosztów cyklicznych. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureCostsSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM recurring_costs ORDER BY active DESC, next_run ASC;`;
  return NextResponse.json({ recurring: rows.map(parseRow) });
}

/** POST /api/recurring-costs — nowy szablon kosztu cyklicznego. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await ensureCostsSchema();
    const sql = getSql();

    // Bramka zapisu (Moduł 63). Wcześniej `next_run` szedł do bazy surowym
    // `slice(0, 10)`: sonda zapisała tędy rok „0202" w polu sterującym
    // automatem, który generuje szkice kosztów.
    const wynik = czytajPolaCyklu(body, { next_run: todayISO() });
    if (wynik.blad != null) return NextResponse.json({ error: wynik.blad }, { status: 400 });
    const f = wynik.pola;

    const id = randomUUID();
    await sql`
      INSERT INTO recurring_costs (id, nazwa, dostawca_nazwa, dostawca_nip, dostawca_konto,
        kategoria, opis, kwota_netto, vat_stawka, waluta, metoda_platnosci, cykl, next_run, active)
      VALUES (${id}, ${f.nazwa}, ${f.dostawca_nazwa}, ${f.dostawca_nip}, ${f.dostawca_konto},
        ${f.kategoria}, ${f.opis}, ${f.kwota_netto}, ${f.vat_stawka}, ${f.waluta},
        ${f.metoda_platnosci}, ${f.cykl}, ${f.next_run}, ${f.active});
    `;
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[POST /api/recurring-costs] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu szablonu: ${message}` }, { status: 500 });
  }
}
