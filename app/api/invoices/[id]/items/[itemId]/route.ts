import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { blokadaFaktury } from "@/lib/blokadaDokumentu";
import { VAT_RATES } from "@/lib/invoices";
import { odczytajZnanyStan, rozjazdStanu, komunikatRozjazdu } from "@/lib/rozjazd";

export const runtime = "nodejs";

/** Blokada wystawionej faktury dla tras pozycji — patrz lib/blokadaDokumentu.ts.
 *
 * Audyt Modułu 57 (2026-07-27) złapał tu najcięższą dziurę całej rundy blokad:
 * `PATCH /api/invoices/:id` odmawiał zmiany nagłówka wystawionej faktury, ale
 * trzy trasy pozycji obok przyjmowały wszystko. Sonda na fakturze „FV 5/2026"
 * skasowała pozycję za 1 000 zł i wstawiła w to miejsce 9 999 zł — numer
 * fiskalny został ten sam. To dokładnie to, przed czym blokada miała chronić,
 * i dokładnie ta klasa błędu, którą widać tylko per UCHWYT HTTP, nie per plik.
 *
 * Przy okazji zapytania są zawężane do `invoice_id` z adresu (wcześniej szły
 * po samym `id` pozycji) — bez tego blokadę dałoby się ominąć, podając w
 * ścieżce numer dowolnej faktury-szkicu. */
async function odmowaGdyWystawiona(
  sql: ReturnType<typeof getSql>,
  invoiceId: string,
  itemId: string
): Promise<NextResponse | null> {
  const wiersz = (await sql`
    SELECT i.numer FROM invoice_items it
    JOIN invoices i ON i.id = it.invoice_id
    WHERE it.id = ${itemId} AND it.invoice_id = ${invoiceId};
  `)[0];
  if (!wiersz) return NextResponse.json({ error: "not found" }, { status: 404 });
  const blokada = blokadaFaktury(wiersz.numer as string | null);
  return blokada.zablokowane ? NextResponse.json({ error: blokada.komunikat }, { status: 409 }) : null;
}

/** PATCH /api/invoices/:id/items/:itemId — edytuj pozycję faktury. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, itemId } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  await ensureInvoicesSchema();
  const sql = getSql();

  const odmowa = await odmowaGdyWystawiona(sql, id, itemId);
  if (odmowa) return odmowa;

  // ROZJAZD KART (etap 3) — porównujemy znacznik DOKUMENTU, nie pozycji:
  // rozjazd dotyczy tego, co karta miała na ekranie, a na ekranie jest cała
  // faktura. Czytane PRZED zapisami, bo one ten znacznik ruszają.
  const znanyStan = odczytajZnanyStan(req.headers);
  const przedZapisem = znanyStan
    ? ((await sql`SELECT updated_at FROM invoices WHERE id = ${id};`)[0] ?? null)
    : null;

  if ("nazwa" in body) await sql`UPDATE invoice_items SET nazwa = ${typeof body.nazwa === "string" ? body.nazwa.slice(0, 500) : ""} WHERE id = ${itemId} AND invoice_id = ${id};`;
  if ("jednostka" in body) await sql`UPDATE invoice_items SET jednostka = ${typeof body.jednostka === "string" ? body.jednostka.slice(0, 20) : "szt."} WHERE id = ${itemId} AND invoice_id = ${id};`;
  if ("ilosc" in body) {
    const n = Number(body.ilosc);
    await sql`UPDATE invoice_items SET ilosc = ${Number.isFinite(n) && n >= 0 ? n : 0} WHERE id = ${itemId} AND invoice_id = ${id};`;
  }
  if ("cena_netto" in body) {
    const n = Number(body.cena_netto);
    await sql`UPDATE invoice_items SET cena_netto = ${Number.isFinite(n) ? n : 0} WHERE id = ${itemId} AND invoice_id = ${id};`;
  }
  if ("vat_stawka" in body) {
    const v = typeof body.vat_stawka === "string" && (VAT_RATES as readonly string[]).includes(body.vat_stawka) ? body.vat_stawka : "23";
    await sql`UPDATE invoice_items SET vat_stawka = ${v} WHERE id = ${itemId} AND invoice_id = ${id};`;
  }
  if ("rabat_procent" in body) {
    const n = Number(body.rabat_procent);
    const clamped = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
    await sql`UPDATE invoice_items SET rabat_procent = ${clamped} WHERE id = ${itemId} AND invoice_id = ${id};`;
  }
  // Zmiana pozycji/bloku to zmiana DOKUMENTU — więc rusza jego znacznik
  // (etap 3). Bez tego wykrywanie rozjazdu dwóch kart byłoby ślepe dokładnie
  // na najczęstszy przypadek: obie karty edytują cenę tej samej pozycji.
  // Retencja ofert (lib/leadRetention.ts) też liczy od `updated_at` i tu jest
  // to poprawne — dokument był ruszany, więc nie jest „bez ruchu".
  await sql`UPDATE invoices SET updated_at = now() WHERE id = ${id};`;
  const rozjazd = rozjazdStanu(znanyStan, przedZapisem?.updated_at);
  // Nowy znacznik wraca do przeglądarki, żeby KOLEJNY zapis w tej samej karcie
  // nie wyglądał jak rozjazd. Bez tego drugi zapis z rzędu w jednym oknie
  // zgłaszał „ktoś zmienił to w innym oknie" — bo karta wysyłała znacznik
  // sprzed WŁASNEJ poprzedniej zmiany. Złapane przebiegiem w przeglądarce,
  // nie lekturą. Zapytanie tylko wtedy, gdy nagłówek przyszedł.
  const poZapisie = znanyStan ? ((await sql`SELECT updated_at FROM invoices WHERE id = ${id};`)[0] ?? null) : null;
  return NextResponse.json({
    ok: true,
    ...(poZapisie?.updated_at ? { updated_at: poZapisie.updated_at } : {}),
    ...(rozjazd ? { rozjazd: komunikatRozjazdu("faktura") } : {}),
  });
}

/** DELETE /api/invoices/:id/items/:itemId — usuń pozycję. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, itemId } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();

  const odmowa = await odmowaGdyWystawiona(sql, id, itemId);
  if (odmowa) return odmowa;

  await sql`DELETE FROM invoice_items WHERE id = ${itemId} AND invoice_id = ${id};`;
  await sql`UPDATE invoices SET updated_at = now() WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
