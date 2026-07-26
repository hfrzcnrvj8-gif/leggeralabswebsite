import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureClientsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { rematchUnassigned } from "@/lib/mailSync";
import { odczytajPolaOsoby, synchronizujMigawke, odbierzPozostalymGlowna, osobyKlienta } from "@/lib/clientContacts";

export const runtime = "nodejs";

/**
 * Osoby kontaktowe przy kliencie (Moduł 54, krok 4).
 *
 * Lista zastępuje w interfejsie pole `clients.osoba_kontaktowa`, ale kolumna
 * zostaje jako migawka osoby głównej — czyta ją dwanaście miejsc w panelu
 * i apce (powitanie w mailu retencyjnym, wiersz listy, wyszukiwarka, eksport
 * CSV, wiadomości projektowe). Przepisywaniem migawki zajmuje się
 * `synchronizujMigawke` w `lib/clientContacts.ts`.
 */

/** GET /api/clients/:id/contacts */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureClientsSchema();
  const contacts = await osobyKlienta(getSql(), id);
  return NextResponse.json({ contacts });
}

/** POST /api/clients/:id/contacts — nowa osoba. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const pola = odczytajPolaOsoby(body);
  if (!pola.imie) return NextResponse.json({ error: "brak imienia" }, { status: 400 });

  await ensureClientsSchema();
  const sql = getSql();

  // Pierwsza osoba przy firmie zostaje główną z automatu — inaczej klient
  // dostałby listę osób i PUSTĄ migawkę, czyli mail retencyjny witający
  // „Cześć," mimo że osoba jest wpisana.
  const ilu = (await sql`SELECT COUNT(*)::int AS n FROM client_contacts WHERE client_id = ${id};`) as unknown as {
    n: number;
  }[];
  const glowna = body.glowna === true || (ilu[0]?.n ?? 0) === 0;

  const osobaId = randomUUID();
  if (glowna) await odbierzPozostalymGlowna(sql, id, osobaId);
  await sql`
    INSERT INTO client_contacts (id, client_id, imie, rola, telefon, email, notatka, glowna)
    VALUES (${osobaId}, ${id}, ${pola.imie}, ${pola.rola}, ${pola.telefon}, ${pola.email}, ${pola.notatka}, ${glowna});
  `;
  if (glowna) await synchronizujMigawke(sql, id);

  // Nowy adres w kartotece — dopnij od razu korespondencję, która przyszła,
  // zanim ta osoba w niej była (ta sama ścieżka, co przy adresie firmowym).
  if (pola.email) {
    await rematchUnassigned().catch((e) => console.error("[clients] rematch poczty nie powiódł się", e));
  }

  return NextResponse.json({ ok: true, id: osobaId });
}
