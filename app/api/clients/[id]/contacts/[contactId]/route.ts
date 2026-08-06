import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureClientsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { rematchUnassigned } from "@/lib/mailSync";
import { odczytajPolaOsoby, synchronizujMigawke, odbierzPozostalymGlowna } from "@/lib/clientContacts";
import { odpowiedzBrakRekordu } from "@/lib/brakRekordu";

export const runtime = "nodejs";

/** PATCH /api/clients/:id/contacts/:contactId — edycja osoby.
 *
 * Cały komplet pól naraz (formularz, nie edycja pojedynczego pola jak przy
 * kliencie) — dlatego jeden UPDATE, nie gałąź na pole. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, contactId } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const pola = odczytajPolaOsoby(body);
  if (!pola.imie) return NextResponse.json({ error: "brak imienia" }, { status: 400 });

  await ensureClientsSchema();
  const sql = getSql();

  // Osoba mogła zniknąć w drugim oknie panelu — patrz lib/brakRekordu.ts.
  // Bez tego `odbierzPozostalymGlowna` niżej odbierało rolę głównej WSZYSTKIM
  // pozostałym osobom na rzecz osoby, której już nie ma — czyli firma zostawała
  // bez osoby głównej i z pustą migawką powitania w mailach.
  const istnieje = await sql`SELECT 1 FROM client_contacts WHERE id = ${contactId} AND client_id = ${id};`;
  if (istnieje.length === 0) return odpowiedzBrakRekordu("osoba kontaktowa");

  // `glowna` przyjmujemy tylko wtedy, gdy klucz jest w żądaniu — brak klucza
  // znaczy „nie ruszaj", a nie „odbierz rolę".
  const zmieniaGlowna = typeof body.glowna === "boolean";
  const glowna = body.glowna === true;
  if (zmieniaGlowna && glowna) await odbierzPozostalymGlowna(sql, id, contactId);

  if (zmieniaGlowna) {
    await sql`
      UPDATE client_contacts
      SET imie = ${pola.imie}, rola = ${pola.rola}, telefon = ${pola.telefon},
          email = ${pola.email}, notatka = ${pola.notatka}, glowna = ${glowna}, updated_at = now()
      WHERE id = ${contactId} AND client_id = ${id};
    `;
  } else {
    await sql`
      UPDATE client_contacts
      SET imie = ${pola.imie}, rola = ${pola.rola}, telefon = ${pola.telefon},
          email = ${pola.email}, notatka = ${pola.notatka}, updated_at = now()
      WHERE id = ${contactId} AND client_id = ${id};
    `;
  }

  // Bezwarunkowo: zmiana imienia osoby, która JUŻ była główna, też musi
  // przepisać migawkę, a nie tylko przełączenie roli.
  await synchronizujMigawke(sql, id);

  if (pola.email) {
    await rematchUnassigned().catch((e) => console.error("[clients] rematch poczty nie powiódł się", e));
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/clients/:id/contacts/:contactId — usunięcie osoby.
 *
 * Gdy odchodzi osoba główna, rola NIE przeskakuje na kogoś innego sama:
 * migawka idzie na pusto i właściciel wskazuje następcę. Zgadywanie, kto teraz
 * wita w mailach, jest gorsze niż puste powitanie („Cześć,"). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, contactId } = await params;
  await ensureClientsSchema();
  const sql = getSql();
  await sql`DELETE FROM client_contacts WHERE id = ${contactId} AND client_id = ${id};`;
  await synchronizujMigawke(sql, id);
  return NextResponse.json({ ok: true });
}
