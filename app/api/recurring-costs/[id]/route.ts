import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureCostsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { czytajPolaCyklu, type PolaCyklu } from "@/lib/costs";

export const runtime = "nodejs";

/** PATCH /api/recurring-costs/:id — edycja szablonu kosztu cyklicznego.
 *
 * Bramka zapisu (Moduł 63) — ta trasa miała ten sam zestaw cichych podmian co
 * reszta modułu, plus jedną własną: `next_run` szedł do bazy jako
 * `body.next_run.slice(0, 10)`, bez `isPlausibleDateString`. To pułapka
 * `<input type="date">` z CLAUDE.md („0202" zamiast „2026") w polu, które
 * steruje AUTOMATEM — dzienny raport generuje z niego szkice kosztów, więc
 * szablon z rokiem 0202 nie odpala się nigdy i nikt się o tym nie dowiaduje.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  try {
    await ensureCostsSchema();
    const sql = getSql();

    const istniejacy = (await sql`SELECT * FROM recurring_costs WHERE id = ${id};`)[0];
    if (!istniejacy) return NextResponse.json({ error: "not found" }, { status: 404 });

    const wynik = czytajPolaCyklu(body, {
      ...(istniejacy as Record<string, unknown>),
      kwota_netto: Number(istniejacy.kwota_netto),
      next_run: dataISO(istniejacy.next_run) ?? undefined,
    } as Partial<PolaCyklu>);
    if (wynik.blad != null) return NextResponse.json({ error: wynik.blad }, { status: 400 });
    const f = wynik.pola;

    await sql`
      UPDATE recurring_costs SET
        nazwa = ${f.nazwa},
        dostawca_nazwa = ${f.dostawca_nazwa},
        dostawca_nip = ${f.dostawca_nip},
        dostawca_konto = ${f.dostawca_konto},
        kategoria = ${f.kategoria},
        opis = ${f.opis},
        kwota_netto = ${f.kwota_netto},
        vat_stawka = ${f.vat_stawka},
        waluta = ${f.waluta},
        metoda_platnosci = ${f.metoda_platnosci},
        cykl = ${f.cykl},
        next_run = ${f.next_run},
        active = ${f.active},
        updated_at = now()
      WHERE id = ${id};
    `;
    // Kotwica rytmu przestawia się TYLKO wtedy, gdy właściciel naprawdę
    // przesunął termin — ręczna zmiana daty znaczy „od teraz tego dnia", tak
    // samo jak przy przypomnieniach. Bezwarunkowe `kotwica = f.next_run`
    // byłoby usterką: ta trasa przepuszcza KOMPLET pól (`czytajPolaCyklu`
    // z wartościami istniejącymi jako domyślne), więc zwykła zmiana kwoty
    // przy serii „od 31." zapisałaby jako kotwicę bieżący, przycięty termin
    // (28 lutego) i seria zostałaby na 28. do końca życia.
    if ("next_run" in body && dataISO(istniejacy.next_run) !== f.next_run) {
      await sql`UPDATE recurring_costs SET kotwica = ${f.next_run}, updated_at = now() WHERE id = ${id};`;
    }
    if ("project_id" in body) {
      const v = typeof body.project_id === "string" && body.project_id.trim() ? body.project_id : null;
      await sql`UPDATE recurring_costs SET project_id = ${v}, updated_at = now() WHERE id = ${id};`;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/recurring-costs/:id] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu szablonu: ${message}` }, { status: 500 });
  }
}

/** DELETE /api/recurring-costs/:id — usuwa szablon kosztu cyklicznego.
 * Nieistniejący rekord dostaje 404, nie ciche `{"ok":true}` (Moduł 63). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureCostsSchema();
  const sql = getSql();
  const istnieje = await sql`SELECT id FROM recurring_costs WHERE id = ${id};`;
  if (!istnieje[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  await sql`DELETE FROM recurring_costs WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}

/** Data z Postgresa → `YYYY-MM-DD` (patrz bliźniak w app/api/costs/[id]). */
function dataISO(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return s ? s.slice(0, 10) : null;
}
