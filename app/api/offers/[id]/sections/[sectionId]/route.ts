import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureOffersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { blokadaOferty } from "@/lib/blokadaDokumentu";
import { odpowiedzBrakRekordu } from "@/lib/brakRekordu";
import { odczytajZnanyStan, rozjazdStanu, komunikatRozjazdu } from "@/lib/rozjazd";

export const runtime = "nodejs";

/** PATCH /api/offers/:id/sections/:sectionId — edycja bloku treści.
 * `position` przyjmujemy wprost, żeby kolejność dała się zmienić strzałkami
 * bez osobnej trasy „przesuń". */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; sectionId: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, sectionId } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  await ensureOffersSchema();
  const sql = getSql();

  // Treść wysłanej oferty jest zamknięta — patrz lib/blokadaDokumentu.ts.
  const stanOferty = (await sql`SELECT status FROM offers WHERE id = ${id};`)[0];
  if (!stanOferty) return NextResponse.json({ error: "not found" }, { status: 404 });
  const blokadaTresci = blokadaOferty(String(stanOferty.status ?? ""));
  if (blokadaTresci.zablokowane) {
    return NextResponse.json({ error: blokadaTresci.komunikat }, { status: 409 });
  }

  // Blok mógł zniknąć w drugim oknie panelu — patrz lib/brakRekordu.ts. To
  // najdotkliwszy przypadek z całej dziewiątki: tu przepada TREŚĆ pisana
  // minutami, a nie jedno pole.
  // ROZJAZD KART (etap 3) — porównujemy znacznik DOKUMENTU, nie pozycji:
  // rozjazd dotyczy tego, co karta miała na ekranie, a na ekranie jest cała
  // oferta. Czytane PRZED zapisami, bo one ten znacznik ruszają.
  const znanyStan = odczytajZnanyStan(req.headers);
  const przedZapisem = znanyStan
    ? ((await sql`SELECT updated_at FROM offers WHERE id = ${id};`)[0] ?? null)
    : null;

  const istnieje = await sql`SELECT 1 FROM offer_sections WHERE id = ${sectionId} AND offer_id = ${id};`;
  if (istnieje.length === 0) return odpowiedzBrakRekordu("blok treści oferty");

  if ("tytul" in body) {
    const v = typeof body.tytul === "string" ? body.tytul.slice(0, 200) : "";
    await sql`UPDATE offer_sections SET tytul = ${v} WHERE id = ${sectionId} AND offer_id = ${id};`;
  }
  if ("tresc" in body) {
    const v = typeof body.tresc === "string" ? body.tresc.slice(0, 8000) : "";
    await sql`UPDATE offer_sections SET tresc = ${v} WHERE id = ${sectionId} AND offer_id = ${id};`;
  }
  if ("position" in body) {
    const n = Number(body.position);
    await sql`UPDATE offer_sections SET position = ${Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0} WHERE id = ${sectionId} AND offer_id = ${id};`;
  }
  // Zmiana pozycji/bloku to zmiana DOKUMENTU — więc rusza jego znacznik
  // (etap 3). Bez tego wykrywanie rozjazdu dwóch kart byłoby ślepe dokładnie
  // na najczęstszy przypadek: obie karty edytują cenę tej samej pozycji.
  // Retencja ofert (lib/leadRetention.ts) też liczy od `updated_at` i tu jest
  // to poprawne — dokument był ruszany, więc nie jest „bez ruchu".
  await sql`UPDATE offers SET updated_at = now() WHERE id = ${id};`;
  const rozjazd = rozjazdStanu(znanyStan, przedZapisem?.updated_at);
  // Nowy znacznik wraca do przeglądarki, żeby KOLEJNY zapis w tej samej karcie
  // nie wyglądał jak rozjazd. Bez tego drugi zapis z rzędu w jednym oknie
  // zgłaszał „ktoś zmienił to w innym oknie" — bo karta wysyłała znacznik
  // sprzed WŁASNEJ poprzedniej zmiany. Złapane przebiegiem w przeglądarce,
  // nie lekturą. Zapytanie tylko wtedy, gdy nagłówek przyszedł.
  const poZapisie = znanyStan ? ((await sql`SELECT updated_at FROM offers WHERE id = ${id};`)[0] ?? null) : null;
  return NextResponse.json({
    ok: true,
    ...(poZapisie?.updated_at ? { updated_at: poZapisie.updated_at } : {}),
    ...(rozjazd ? { rozjazd: komunikatRozjazdu("oferta") } : {}),
  });
}

/** DELETE /api/offers/:id/sections/:sectionId */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; sectionId: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, sectionId } = await params;
  await ensureOffersSchema();
  const sql = getSql();

  // Ta sama blokada co w PATCH wyżej — patrz audyt Modułu 57 (2026-07-27).
  // Skasowanie bloku treści to zmiana dokumentu tak samo jak jego edycja.
  const stanOferty = (await sql`SELECT status FROM offers WHERE id = ${id};`)[0];
  if (!stanOferty) return NextResponse.json({ error: "not found" }, { status: 404 });
  const blokadaTresci = blokadaOferty(String(stanOferty.status ?? ""));
  if (blokadaTresci.zablokowane) {
    return NextResponse.json({ error: blokadaTresci.komunikat }, { status: 409 });
  }

  await sql`DELETE FROM offer_sections WHERE id = ${sectionId} AND offer_id = ${id};`;
  await sql`UPDATE offers SET updated_at = now() WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
