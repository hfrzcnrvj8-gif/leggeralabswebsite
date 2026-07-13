// Wspólne dopasowanie leada/klienta po numerze telefonu — używane zarówno
// przez GET /api/contacts/lookup (Opcja A, ręczna "szybka notatka"), jak i
// przez POST /api/telefonia/webhook (przyszła automatyzacja VoIP), żeby obie
// ścieżki (ręczna i automatyczna) zgadzały się co do tego, komu przypisać
// dany numer. Osobno od lib/contact.ts (który jest "use client"-bezpieczny,
// bez importu bazy) — ten plik dotyka `getSql()`, więc żyje tylko po
// stronie serwera.
import { getSql, ensureLeadsSchema, ensureClientsSchema } from "./db";
import { lastPhoneDigits } from "./contact";

export type ContactMatch = { type: "lead" | "client"; id: string; nazwa: string };

/** Zwraca wszystkich leadów/klientów, których zapisany numer kończy się
 * tymi samymi 9 cyframi co `telefon` (niezależnie od formatu zapisu:
 * spacje, myślniki, prefiks +48/48/0). Puste dla numeru krótszego niż 6
 * cyfr — zbyt niejednoznaczne, żeby cokolwiek dopasować. Klienci pierwsi
 * (zwykle bardziej aktualna relacja niż lead, z którego powstali). */
export async function findContactsByPhone(telefon: string): Promise<ContactMatch[]> {
  const target = lastPhoneDigits(telefon);
  if (target.length < 6) return [];

  await ensureLeadsSchema();
  await ensureClientsSchema();
  const sql = getSql();

  const [leads, clients] = await Promise.all([
    sql`SELECT id, firma AS nazwa, telefon FROM leads WHERE telefon != '';` as unknown as Promise<
      { id: string; nazwa: string; telefon: string }[]
    >,
    sql`SELECT id, nazwa, telefon FROM clients WHERE telefon != '';` as unknown as Promise<
      { id: string; nazwa: string; telefon: string }[]
    >,
  ]);

  return [
    ...clients.filter((c) => lastPhoneDigits(c.telefon) === target).map((c) => ({ type: "client" as const, id: c.id, nazwa: c.nazwa })),
    ...leads.filter((l) => lastPhoneDigits(l.telefon) === target).map((l) => ({ type: "lead" as const, id: l.id, nazwa: l.nazwa })),
  ];
}
