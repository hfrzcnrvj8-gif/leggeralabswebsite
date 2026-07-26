// Osoby kontaktowe przy kliencie — warstwa serwerowa (Moduł 54, krok 4).
//
// Osobno od `lib/clients.ts` z tego samego powodu, co `auditLog.ts` obok
// `audit.ts`: tamten plik jest importowany przez komponenty klienckie, a ten
// ciąga `lib/db` → `node:async_hooks`, którego Turbopack nie wpakuje do bundla
// przeglądarki. Typy i etykiety zostają w `lib/clients.ts`.
import { randomUUID } from "node:crypto";
import type { getSql } from "./db";

type Sql = ReturnType<typeof getSql>;

const POLA = {
  imie: 200,
  rola: 200,
  telefon: 100,
  email: 200,
  notatka: 1000,
} as const;

export type PolaOsoby = { [K in keyof typeof POLA]: string };

/** Sprowadza ciało żądania do pól osoby, przycięte do limitów kolumn.
 * Brak klucza = pusty string: formularz zawsze przysyła komplet. */
export function odczytajPolaOsoby(body: Record<string, unknown>): PolaOsoby {
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  return {
    imie: str(body.imie, POLA.imie),
    rola: str(body.rola, POLA.rola),
    telefon: str(body.telefon, POLA.telefon),
    email: str(body.email, POLA.email),
    notatka: str(body.notatka, POLA.notatka),
  };
}

/**
 * Przepisuje imię osoby głównej do `clients.osoba_kontaktowa`.
 *
 * JEDYNE miejsce, w którym ta migawka powstaje — dróg zapisu jest kilka
 * (dodanie, edycja, usunięcie, przełączenie roli) i rozjechałyby się.
 *
 * Gdy głównej nie ma, migawka idzie na pusto: pole pamiętające osobę usuniętą
 * z kartoteki witałoby jej imieniem w mailu retencyjnym jeszcze długo po tym,
 * jak przestała tam pracować.
 */
export async function synchronizujMigawke(sql: Sql, clientId: string): Promise<void> {
  const rows = (await sql`
    SELECT imie FROM client_contacts WHERE client_id = ${clientId} AND glowna LIMIT 1;
  `) as unknown as { imie: string }[];
  const imie = rows[0]?.imie ?? "";
  await sql`UPDATE clients SET osoba_kontaktowa = ${imie}, updated_at = now() WHERE id = ${clientId};`;
}

/**
 * Zdejmuje rolę głównej wszystkim poza `exceptId`.
 *
 * Baza pilnuje unikalności częściowym indeksem (`client_contacts_glowna_idx`),
 * więc bez tego ustawienie drugiej osoby główną kończyłoby się BŁĘDEM zapisu
 * zamiast przełączeniem — a właściciel chce przełączyć, nie dowiedzieć się
 * o kolizji.
 */
export async function odbierzPozostalymGlowna(sql: Sql, clientId: string, exceptId: string): Promise<void> {
  await sql`
    UPDATE client_contacts SET glowna = false, updated_at = now()
    WHERE client_id = ${clientId} AND id <> ${exceptId} AND glowna;
  `;
}

/**
 * Zakłada pierwszą osobę na podstawie migawki `clients.osoba_kontaktowa`.
 *
 * Wołane po KAŻDYM utworzeniu klienta — jest na to CZTERY drogi
 * (`api/clients` POST, `leads/[id]/promote`, `api/offers` POST,
 * `mail/[id]/create-client`) i wszystkie przepisują imię osoby z leada albo
 * z maila wprost do kolumny, nic nie wiedząc o liście osób.
 *
 * Bez tego klient założony PO wdrożeniu Modułu 54 miałby imię w migawce
 * i pustą listę osób — lista kłamiąca pustką (ustalenie A1) w normalnym
 * przepływie, nie w rzadkim przypadku brzegowym. Jednorazowa migracja
 * w `lib/db.ts` załatwia tylko rekordy sprzed wdrożenia.
 *
 * Idempotentne i ciche: sieje wyłącznie wtedy, gdy imię jest, a lista pusta.
 * Błąd nie może wywrócić tworzenia klienta — brak wiersza na liście osób jest
 * mniej szkodliwy niż nieudane założenie klienta, o którym właściciel myśli,
 * że się udało.
 */
export async function zasiejOsobeZMigawki(sql: Sql, clientId: string, imie: string): Promise<void> {
  const czyste = imie.trim();
  if (!czyste) return;
  try {
    await sql`
      INSERT INTO client_contacts (id, client_id, imie, telefon, email, glowna)
      SELECT ${randomUUID()}, c.id, ${czyste.slice(0, 200)}, c.telefon, c.email, true
      FROM clients c
      WHERE c.id = ${clientId}
        AND NOT EXISTS (SELECT 1 FROM client_contacts k WHERE k.client_id = c.id);
    `;
  } catch (e) {
    console.error("[clients] nie udało się założyć pierwszej osoby kontaktowej", e);
  }
}

/** Osoby jednego klienta. Główna pierwsza, reszta alfabetycznie: to ona wita
 * w mailach, więc ma stać na górze. */
export async function osobyKlienta(sql: Sql, clientId: string) {
  return sql`
    SELECT id, client_id, imie, rola, telefon, email, notatka, glowna, created_at
    FROM client_contacts WHERE client_id = ${clientId}
    ORDER BY glowna DESC, imie ASC;
  `;
}
