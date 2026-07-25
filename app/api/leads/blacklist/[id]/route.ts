import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureLeadHunterSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * DELETE /api/leads/blacklist/:id — zdejmuje firmę z czarnej listy.
 *
 * **Co to naprawdę robi, a czego NIE robi.** Zdjęcie z listy nie przywraca
 * kandydata do skrzynki — ten wiersz mógł już zostać skasowany przez retencję
 * (30 dni). Znaczy dokładnie tyle: „łowca ma prawo znaleźć tę firmę ponownie".
 * Wróci przy którymś z kolejnych przebiegów, o ile dalej spełnia kryteria
 * polowania.
 *
 * `przywrocKandydata` (parametr `?kandydat=1`) dodatkowo cofa stan kandydata
 * z „odrzucony" na „nowy", jeśli wiersz jeszcze istnieje — to jest ścieżka
 * „Cofnij" tuż po pomyłkowym machnięciu palcem, gdzie czekanie na kolejne
 * polowanie byłoby absurdem.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureLeadHunterSchema();
  const sql = getSql();

  const rows = (await sql`SELECT nip, nazwa_norm FROM lead_blacklist WHERE id = ${id};`) as unknown as
    { nip: string; nazwa_norm: string }[];
  const wpis = rows[0];
  if (!wpis) return NextResponse.json({ error: "not found" }, { status: 404 });

  await sql`DELETE FROM lead_blacklist WHERE id = ${id};`;

  let przywrocony = false;
  if (new URL(req.url).searchParams.get("kandydat") === "1") {
    // Dopasowanie po NIP-ie, a gdy go brak — po znormalizowanej nazwie.
    // Dokładnie ta sama para kluczy, po której czarna lista odsiewa w E1,
    // więc „cofnij" trafia w to samo, co przed chwilą odrzuciło.
    const wynik = (await sql`
      UPDATE lead_candidates SET stan = 'nowy', powod_odrzucenia = '', updated_at = now()
      WHERE stan = 'odrzucony'
        AND ((${wpis.nip} <> '' AND nip = ${wpis.nip}) OR (${wpis.nip} = '' AND nazwa_norm = ${wpis.nazwa_norm}))
      RETURNING id;
    `) as unknown as { id: string }[];
    przywrocony = wynik.length > 0;
  }

  return NextResponse.json({ ok: true, przywrocony });
}
