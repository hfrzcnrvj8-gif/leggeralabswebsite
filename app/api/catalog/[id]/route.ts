import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { type CatalogItem } from "@/lib/invoices";
import { czytajPolaKatalogu, normalizeCatalogRow } from "@/lib/catalog";

export const runtime = "nodejs";

/** GET /api/catalog/:id — jedna pozycja katalogu. Admin-only.
 *
 * Powstało dla ADRESU REKORDU (`/admin/catalog/<id>`, Moduł 59, paczka E) —
 * dotąd komponent katalogu istniał wyłącznie jako wiersz listy i nie dało się
 * do niego odesłać linkiem. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM service_catalog WHERE id = ${id};`;
  if (!rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ item: normalizeCatalogRow(rows[0] as Record<string, unknown>) as CatalogItem });
}

/** PATCH /api/catalog/:id — edytuj pozycję katalogu. Admin-only. Zwraca całą
 * odświeżoną listę (jak POST), żeby UI nie musiał scalać ręcznie.
 *
 * Aktualizacja jest CZĘŚCIOWA naprawdę: pole, którego nie ma w ciele żądania,
 * zostaje takie, jakie było (patrz `czytajPolaKatalogu`). Do Modułu 62 ta
 * trasa zachowywała się jak `PUT` i po cichu kasowała wszystko, czego nie
 * przysłano. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  await ensureInvoicesSchema();
  const sql = getSql();
  const existing = await sql`SELECT * FROM service_catalog WHERE id = ${id};`;
  if (!existing[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const wynik = czytajPolaKatalogu(body, normalizeCatalogRow(existing[0] as Record<string, unknown>));
  if (wynik.blad != null) return NextResponse.json({ error: wynik.blad }, { status: 400 });
  const f = wynik.pola;

  await sql`
    UPDATE service_catalog SET
      nazwa = ${f.nazwa},
      cena_netto = ${f.cena_netto},
      waluta = ${f.waluta},
      vat_stawka = ${f.vat_stawka},
      jednostka = ${f.jednostka},
      kategoria = ${f.kategoria},
      cena_min = ${f.cena_min},
      cena_max = ${f.cena_max},
      koszt_zakupu = ${f.koszt_zakupu},
      dostawca = ${f.dostawca},
      opis = ${f.opis}
    WHERE id = ${id};
  `;
  const rows = await sql`SELECT * FROM service_catalog ORDER BY nazwa ASC;`;
  return NextResponse.json({
    ok: true,
    items: rows.map((r) => normalizeCatalogRow(r as Record<string, unknown>)) as CatalogItem[],
  });
}

/** DELETE /api/catalog/:id — usuń pozycję z katalogu (nie rusza faktur/ofert,
 * które z niej korzystały — pozycje dokumentów to niezależne kopie). Admin-only.
 *
 * Nieistniejący rekord dostaje 404, a nie ciche `{"ok":true}`: kasowanie
 * czegoś, czego nie ma, wygląda w UI identycznie jak kasowanie udane, więc
 * błąd (zdublowana zakładka, stary link) nie miał jak się pokazać. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();
  const istnieje = await sql`SELECT id FROM service_catalog WHERE id = ${id};`;
  if (!istnieje[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  await sql`DELETE FROM service_catalog WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
