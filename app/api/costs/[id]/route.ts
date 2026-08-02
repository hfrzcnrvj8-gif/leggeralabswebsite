import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureCostsSchema, ensureLinksSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { odczytajPotwierdzenie, odmowaPotwierdzenia } from "@/lib/nieodwracalne";
import { todayLocalISO } from "@/lib/dates";
import { costBrutto, czytajPolaKosztu, normalizeCostRow, type PolaKosztu } from "@/lib/costs";

export const runtime = "nodejs";

/** Data z Postgresa → `YYYY-MM-DD`. Sterownik oddaje kolumnę DATE raz jako
 * `Date`, raz jako znacznik ze spacją zamiast `T` (patrz `parsePgTimestamp`) —
 * a bramka zapisu porównuje ze wzorcem `YYYY-MM-DD`. Bez tego przy PATCH-u
 * jednego pola bramka odbiłaby WŁASNĄ, poprawną datę zapisaną minutę wcześniej
 * jako „nie jest poprawną datą". */
function dataISO(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return s ? s.slice(0, 10) : null;
}

/** GET /api/costs/:id — pojedynczy koszt. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureCostsSchema();
  // client_id/lead_id żyją w schemacie "links" (Moduł 22), nie w "costs" —
  // bez tego SELECT niżej wywala się na nieistniejącej kolumnie.
  await ensureLinksSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, dostawca_nazwa, dostawca_nip, kategoria, opis, data_wydatku,
      kwota_netto, vat_stawka, kwota_brutto, waluta, kurs_pln,
      status, termin_platnosci, data_platnosci, project_id,
      client_id, lead_id,
      created_at, updated_at, zalacznik_nazwa, zalacznik_typ, ksef_numer, ksef_tryb,
      metoda_platnosci, dostawca_konto, numer_faktury, data_wplywu,
      vat_odliczenie_procent, duplikat_potwierdzony
    FROM costs WHERE id = ${id};
  `;
  const cost = rows[0];
  if (!cost) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ cost: normalizeCostRow(cost as Record<string, unknown>) });
}

/** PATCH /api/costs/:id — aktualizacja pól kosztu. Zmiana kwoty netto lub
 * stawki VAT przelicza brutto; zmiana statusu na "Opłacony" ustawia
 * data_platnosci na dziś, jeśli jeszcze nie ma daty. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  try {
    await ensureCostsSchema();
    const sql = getSql();

    // BRAMKA ZAPISU (Moduł 63). Do 2026-08-01 ta trasa rozstrzygała każde pole
    // z palca i podmieniała śmieć na wartość domyślną. Najgorzej wypadało
    // `vat_odliczenie_procent`: koszt oznaczony świadomie jako „0% —
    // reprezentacja" po `PATCH {"vat_odliczenie_procent":999}` wracał na
    // „100% — pełne odliczenie" i odpowiadał `{"ok":true}` (zmierzone sondą).
    //
    // Częściowość zostaje NAPRAWDĘ częściowa — pola nieobecnego w ciele
    // żądania bramka bierze z rekordu istniejącego. Sonda potwierdziła, że
    // stary `PATCH` kosztu był pod tym względem poprawny (w odróżnieniu od
    // Katalogu, który cicho kasował nieprzysłane pola); test to pilnuje.
    const istniejacy = (await sql`
      SELECT dostawca_nazwa, dostawca_nip, dostawca_konto, numer_faktury, kategoria, opis,
        kwota_netto, vat_stawka, waluta, kurs_pln, status, metoda_platnosci,
        vat_odliczenie_procent, data_wydatku, data_wplywu, termin_platnosci, data_platnosci
      FROM costs WHERE id = ${id};
    `)[0];
    if (!istniejacy) return NextResponse.json({ error: "not found" }, { status: 404 });

    const poprzedni = normalizeCostRow(istniejacy as Record<string, unknown>) as Partial<PolaKosztu>;
    const wynik = czytajPolaKosztu(body, {
      ...poprzedni,
      // Daty wracają z Postgresa jako obiekty/znaczniki — do bramki mają iść
      // jako `YYYY-MM-DD`, inaczej `isPlausibleDateString` odbija własną,
      // poprawną wartość zapisaną minutę wcześniej.
      data_wydatku: dataISO(istniejacy.data_wydatku),
      data_wplywu: dataISO(istniejacy.data_wplywu),
      termin_platnosci: dataISO(istniejacy.termin_platnosci),
      data_platnosci: dataISO(istniejacy.data_platnosci),
    });
    if (wynik.blad != null) return NextResponse.json({ error: wynik.blad }, { status: 400 });
    const f = wynik.pola;

    // Zmiana statusu na „Opłacony" stempluje datę zapłaty, o ile właściciel
    // nie podał własnej — zachowanie sprzed tego modułu, świadomie zostaje.
    const dataPlatnosci =
      f.status === "Opłacony" && !f.data_platnosci ? todayLocalISO() : f.data_platnosci;

    await sql`
      UPDATE costs SET
        dostawca_nazwa = ${f.dostawca_nazwa},
        dostawca_nip = ${f.dostawca_nip},
        dostawca_konto = ${f.dostawca_konto},
        numer_faktury = ${f.numer_faktury},
        kategoria = ${f.kategoria},
        opis = ${f.opis},
        kwota_netto = ${f.kwota_netto},
        vat_stawka = ${f.vat_stawka},
        kwota_brutto = ${costBrutto(f.kwota_netto, f.vat_stawka)},
        waluta = ${f.waluta},
        kurs_pln = ${f.kurs_pln},
        status = ${f.status},
        metoda_platnosci = ${f.metoda_platnosci},
        vat_odliczenie_procent = ${f.vat_odliczenie_procent},
        data_wydatku = ${f.data_wydatku},
        data_wplywu = ${f.data_wplywu},
        termin_platnosci = ${f.termin_platnosci},
        data_platnosci = ${dataPlatnosci},
        updated_at = now()
      WHERE id = ${id};
    `;

    if ("duplikat_potwierdzony" in body) await sql`UPDATE costs SET duplikat_potwierdzony = ${Boolean(body.duplikat_potwierdzony)}, updated_at = now() WHERE id = ${id};`;
    if ("project_id" in body) {
      const v = typeof body.project_id === "string" && body.project_id.trim() ? body.project_id : null;
      await sql`UPDATE costs SET project_id = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    // Moduł 22 — klient/lead wprost na koszcie. Dotąd dało się go wywnioskować
    // TYLKO pośrednio, przez projekt: koszt „na rzecz" klienta, ale bez
    // projektu (np. licencja kupiona pod jedno wdrożenie) nie miał tego gdzie
    // zapisać. Relacja wyłączna — patrz linkValueFor() w lib/links.ts.
    if ("client_id" in body || "lead_id" in body) {
      await ensureLinksSchema();
      const c = typeof body.client_id === "string" && body.client_id.trim() ? body.client_id : null;
      const l = typeof body.lead_id === "string" && body.lead_id.trim() ? body.lead_id : null;
      await sql`UPDATE costs SET client_id = ${c}, lead_id = ${l}, updated_at = now() WHERE id = ${id};`;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/costs/:id] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu kosztu: ${message}` }, { status: 500 });
  }
}

/** DELETE /api/costs/:id — koszt można zawsze usunąć (to nie dokument
 * księgowy z numeracją jak faktura wystawiona).
 *
 * Nieistniejący rekord dostaje 404, a nie ciche `{"ok":true}` (Moduł 63, za
 * Katalogiem): kasowanie czegoś, czego nie ma, wygląda w UI identycznie jak
 * kasowanie udane, więc błąd — zdublowana zakładka, stary link, wyścig apki
 * z panelem — nie miał jak się pokazać. Załącznik siedzi w kolumnach tego
 * samego wiersza (`zalacznik_dane`), więc znika razem z nim; sonda
 * potwierdziła, że osieroconych plików nie ma. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  // POTWIERDZENIE (Faza 4) — usunięcie rekordu głównego jest nieodwracalne.
  const odmowaPotw = odmowaPotwierdzenia("koszt-usun", odczytajPotwierdzenie(req.headers));
  if (odmowaPotw) {
    return NextResponse.json({ error: odmowaPotw.error, potwierdzenie: odmowaPotw.potwierdzenie }, { status: odmowaPotw.status });
  }
  await ensureCostsSchema();
  const sql = getSql();
  const istnieje = await sql`SELECT id FROM costs WHERE id = ${id};`;
  if (!istnieje[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  await sql`DELETE FROM costs WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
