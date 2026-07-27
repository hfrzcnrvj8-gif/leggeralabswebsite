import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureContractsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/contracts/:id/podpis-nasz — odnotowanie podpisu po NASZEJ stronie.
 * DELETE cofa go (dopóki druga strona nie podpisała).
 *
 * **Dlaczego to osobna rzecz od `accept`.** `accept` mówi „druga strona
 * podpisała" i zamyka dokument. To tutaj mówi „ja podpisałem" — i samo w sobie
 * niczego nie zamyka. Do 2026-07-27 dokument miał tylko jedną rubrykę podpisu
 * (klienta), a nasza była domyślna i pusta: przy sporze wyglądało to jak
 * jednostronne oświadczenie, mimo że umowa jest dwustronna. Wszystkie narzędzia
 * do e-podpisu (DocuSign, Dropbox Sign) prowadzą obie strony; kolejność bywa
 * różna, więc nie wymuszamy jej — pilnujemy tylko, żeby dokument PODPISANY
 * przez drugą stronę miał już naszą stronę odnotowaną albo dał się ją dopisać.
 *
 * **Bez IP i user-agenta.** To nie jest podpis złożony przez internet przez
 * osobę, której nie widzimy — to odnotowanie własnego podpisu we własnym
 * panelu. Zapisywanie sobie samemu metryczki technicznej niczego nie dowodzi,
 * a dokłada dane do retencji.
 *
 * Imię bierzemy z ustawień firmy (`company_settings`), a nie z ciała żądania:
 * podpisującym po naszej stronie jest zawsze właściciel, a jedno źródło nazwy
 * oszczędza rozjazd między dokumentem a stopką maila. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureContractsSchema();
  const sql = getSql();

  const contract = (await sql`SELECT id, typ, status FROM contracts WHERE id = ${id};`)[0];
  if (!contract) return NextResponse.json({ error: "not found" }, { status: 404 });

  const ust = (await sql`SELECT nazwa, osoba_podpisujaca FROM company_settings WHERE id = 'default';`)[0];
  const osoba =
    (typeof ust?.osoba_podpisujaca === "string" && ust.osoba_podpisujaca.trim()) ||
    (typeof ust?.nazwa === "string" && ust.nazwa.trim()) ||
    "Leggera Labs";

  await sql`UPDATE contracts SET podpis_nasz_at = now(), podpis_nasz_osoba = ${osoba}, updated_at = now() WHERE id = ${id};`;
  return NextResponse.json({ ok: true, osoba });
}

/** Cofnięcie własnego podpisu — możliwe TYLKO dopóki druga strona nie
 * podpisała. Po jej podpisie dokument jest zamknięty w całości i cofanie
 * czegokolwiek w nim byłoby cichą zmianą treści (patrz lib/blokadaDokumentu). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureContractsSchema();
  const sql = getSql();

  const contract = (await sql`SELECT status, accepted_at FROM contracts WHERE id = ${id};`)[0];
  if (!contract) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (contract.status === "Podpisana" || contract.accepted_at) {
    return NextResponse.json(
      { error: "Druga strona już podpisała — dokumentu nie zmieniamy. Zmiana wymaga aneksu." },
      { status: 409 }
    );
  }

  await sql`UPDATE contracts SET podpis_nasz_at = NULL, podpis_nasz_osoba = NULL, updated_at = now() WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
