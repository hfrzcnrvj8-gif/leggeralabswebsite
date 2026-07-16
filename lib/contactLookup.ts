// Wspólne dopasowanie leada/klienta po numerze telefonu — używane zarówno
// przez GET /api/contacts/lookup (Opcja A, ręczna "szybka notatka"), jak i
// przez POST /api/telefonia/webhook (przyszła automatyzacja VoIP), żeby obie
// ścieżki (ręczna i automatyczna) zgadzały się co do tego, komu przypisać
// dany numer. Osobno od lib/contact.ts (który jest "use client"-bezpieczny,
// bez importu bazy) — ten plik dotyka `getSql()`, więc żyje tylko po
// stronie serwera.
import { getSql, ensureLeadsSchema, ensureClientsSchema, ensureLinksSchema } from "./db";
import { lastPhoneDigits } from "./contact";
import { normalizeEmail } from "./mail";

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

/** Moduł 4 (poczta) — odpowiednik findContactsByPhone dla adresu e-mail:
 * komu przypisać przychodzącą wiadomość. Dopasowanie jest w pełni
 * deterministyczne (równość znormalizowanych adresów), bez czytania treści
 * przez AI — zgodnie z zasadą modułu.
 *
 * Klienci przed leadami, bo `app/api/mail/sync` bierze PIERWSZE trafienie:
 * gdy ten sam adres jest i leadem, i klientem (klient powstał z tego leada),
 * mail należy do aktualniejszej relacji. Pusta tablica = kolejka
 * "Nieprzypisane" — nic nie ginie, właściciel przypisze ręcznie albo zrobi
 * z tego leada jednym kliknięciem.
 *
 * Moduł 22: oprócz adresu z kartoteki sprawdzany jest ZAPAMIĘTANY ALIAS
 * (mail_address_links) — adres, który właściciel raz ręcznie przypiął w
 * panelu. Aliasy idą pierwsze: to jawna decyzja człowieka, a nie zbieżność
 * adresów. Dopasowanie zostaje w 100% deterministyczne (równość
 * znormalizowanego adresu), tylko źródeł prawdy jest teraz dwa. */
export async function findContactsByEmail(email: string): Promise<ContactMatch[]> {
  const target = normalizeEmail(email);
  if (!target.includes("@")) return [];

  await ensureLeadsSchema();
  await ensureClientsSchema();
  await ensureLinksSchema();
  const sql = getSql();

  // Porównanie i filtr po stronie SQL (LOWER + TRIM) — adresów jest tyle co
  // leadów/klientów, więc nie ma po co ciągnąć całej tabeli do Node'a jak
  // przy telefonach (tam wymusza to dopasowanie po ostatnich 9 cyfrach).
  const [leads, clients, aliases] = await Promise.all([
    sql`SELECT id, firma AS nazwa FROM leads WHERE LOWER(TRIM(email)) = ${target};` as unknown as Promise<
      { id: string; nazwa: string }[]
    >,
    sql`SELECT id, nazwa FROM clients WHERE LOWER(TRIM(email)) = ${target};` as unknown as Promise<
      { id: string; nazwa: string }[]
    >,
    sql`
      SELECT a.client_id, a.lead_id, c.nazwa AS client_nazwa, l.firma AS lead_nazwa
      FROM mail_address_links a
      LEFT JOIN clients c ON c.id = a.client_id
      LEFT JOIN leads l ON l.id = a.lead_id
      WHERE a.email = ${target};
    ` as unknown as Promise<
      { client_id: string | null; lead_id: string | null; client_nazwa: string | null; lead_nazwa: string | null }[]
    >,
  ]);

  const fromAliases: ContactMatch[] = aliases.flatMap((a): ContactMatch[] => {
    if (a.client_id && a.client_nazwa !== null) return [{ type: "client" as const, id: a.client_id, nazwa: a.client_nazwa }];
    if (a.lead_id && a.lead_nazwa !== null) return [{ type: "lead" as const, id: a.lead_id, nazwa: a.lead_nazwa }];
    return [];
  });

  const all = [
    ...fromAliases,
    ...clients.map((c) => ({ type: "client" as const, id: c.id, nazwa: c.nazwa })),
    ...leads.map((l) => ({ type: "lead" as const, id: l.id, nazwa: l.nazwa })),
  ];

  // Alias wskazujący na ten sam rekord co kartoteka nie może zdublować
  // pozycji — mail/sync bierze pierwsze trafienie, ale quick-log pokazuje
  // właścicielowi CAŁĄ listę do wyboru.
  const seen = new Set<string>();
  return all.filter((m) => {
    const key = `${m.type}:${m.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Moduł 22 — zapamiętaj „ten adres to ten klient/lead", żeby kolejne
 * wiadomości z niego dopasowywały się same (patrz findContactsByEmail).
 * Wywoływane WYŁĄCZNIE po jawnej zgodzie właściciela w panelu — nigdy
 * automatycznie z synchronizacji poczty. */
export async function rememberAddressLink(
  email: string,
  match: { type: "client" | "lead"; id: string }
): Promise<void> {
  const target = normalizeEmail(email);
  if (!target.includes("@")) return;

  await ensureLinksSchema();
  const sql = getSql();
  const clientId = match.type === "client" ? match.id : null;
  const leadId = match.type === "lead" ? match.id : null;

  await sql`
    INSERT INTO mail_address_links (email, client_id, lead_id)
    VALUES (${target}, ${clientId}, ${leadId})
    ON CONFLICT (email) DO UPDATE SET client_id = EXCLUDED.client_id, lead_id = EXCLUDED.lead_id, created_at = now();
  `;
}

/** Ile innych wiadomości z tego adresu czeka dziś nieprzypisanych — liczba
 * do pytania „przypiąć też pozostałe N?". Liczy tylko przychodzące i tylko
 * bez powiązania, bo tylko takie zmieni masowe przypięcie. */
export async function countUnassignedFromAddress(email: string, exceptMailId: string): Promise<number> {
  const target = normalizeEmail(email);
  if (!target.includes("@")) return 0;

  const sql = getSql();
  const rows = (await sql`
    SELECT COUNT(*)::int AS n FROM mail_messages
    WHERE LOWER(TRIM(from_addr)) = ${target}
      AND id != ${exceptMailId}
      AND client_id IS NULL AND lead_id IS NULL
      AND kierunek = 'in';
  `) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}
