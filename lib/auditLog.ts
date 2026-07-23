import { randomUUID } from "node:crypto";
import { getSql, ensureAuditSchema } from "./db";
import type { AuditEntity, FieldChange } from "./audit";

/**
 * Zapis i odczyt audytu zmian pól (Moduł 23) — warstwa bazodanowa, TYLKO
 * serwer.
 *
 * Świadomie osobno od `lib/audit.ts`: tamten plik (typy, etykiety pól) jest
 * importowany przez komponent kliencki `FieldChangesTab.tsx`, a ten ciągnie
 * `lib/db` → `node:async_hooks`, którego Turbopack nie umie wpakować do
 * bundla przeglądarki — build wywala się wtedy na „chunking context does not
 * support external modules". Ten sam podział co mailSync.ts/contactLookup.ts
 * (serwer) obok lib/mail.ts/lib/clients.ts (współdzielone).
 */

/** Górny limit tego, co w ogóle trafia do logu — równy najdłuższemu polu,
 * jakie PATCH-e przyjmują (`notatki`, 4000 znaków). Zabezpieczenie przed
 * wpisem, który sam waży więcej niż rekord, którego dotyczy. */
const MAX_STORED = 4000;

/**
 * Sprowadza wartość z bazy i z żądania do wspólnej postaci, żeby porównanie
 * nie produkowało fałszywych zmian.
 *
 * Trzy pułapki, które to załatwia:
 * - `null` (baza) vs `""` (puste pole w formularzu) to ta sama „brak wartości";
 * - kolumny DATE wracają jako `Date` z PGlite, a jako `"2026-07-17"` z neon()
 *   — bez tego każdy zapis daty wyglądałby na zmianę;
 * - białe znaki na końcach, których właściciel nie widzi na ekranie.
 */
function normalize(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/**
 * Zapisuje w logu te pola, które FAKTYCZNIE się zmieniły.
 *
 * `before` to wiersz sprzed zapisu (cały, prosto z `SELECT *`), `after` —
 * tylko pola, które PATCH właśnie ustawił, w wartościach już po walidacji.
 * Porównujemy wyłącznie klucze z `after`, więc reszta wiersza jest ignorowana.
 *
 * Zapis jest jednym `INSERT`-em (neon() = jedno żądanie HTTP na zapytanie —
 * pętla po polach kosztowałaby tyle rund, ile pól). Błąd logowania świadomie
 * NIE wywala PATCH-a: audyt jest zapisem pobocznym, a utrata wpisu w logu jest
 * mniej szkodliwa niż nieudany zapis danych, o którym właściciel myśli, że się
 * udał.
 */
export async function logFieldChanges(
  entity: AuditEntity,
  entityId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Promise<void> {
  const changed = Object.entries(after).flatMap(([field, rawNew]) => {
    const oldValue = normalize(before[field]);
    const newValue = normalize(rawNew);
    if (oldValue === newValue) return [];
    return [{ field, oldValue: oldValue.slice(0, MAX_STORED), newValue: newValue.slice(0, MAX_STORED) }];
  });
  if (changed.length === 0) return;

  try {
    await ensureAuditSchema();
    const sql = getSql();
    // Tablice rozbite na kolumny + UNNEST — jeden przelot zamiast N.
    await sql`
      INSERT INTO field_changes (id, entity, entity_id, field, old_value, new_value)
      SELECT * FROM UNNEST(
        ${changed.map(() => randomUUID())}::text[],
        ${changed.map(() => entity)}::text[],
        ${changed.map(() => entityId)}::text[],
        ${changed.map((c) => c.field)}::text[],
        ${changed.map((c) => c.oldValue)}::text[],
        ${changed.map((c) => c.newValue)}::text[]
      );
    `;
  } catch (e) {
    console.error(`[audit] nie udało się zapisać zmian ${entity}/${entityId}`, e);
  }
}

/**
 * Kasuje CAŁĄ historię zmian jednego rekordu (RODO, Audyt 2). `field_changes`
 * nie ma klucza obcego do leada/klienta (świadomie — audytuje też byty bez
 * własnej tabeli), więc usunięcie osoby NIE zabiera jej wpisów z tego logu:
 * zostawałyby tu surowe stare/nowe adresy e-mail i telefony usuniętej osoby,
 * bezterminowo. Dlatego każda ścieżka usuwająca leada/klienta woła to jawnie
 * (DELETE w route'ach + purgeStaleLeads). Sprawdzone uruchomieniem:
 * przed naprawą wiersz `email: … → …` przeżywał skasowanie klienta.
 */
export async function deleteFieldChanges(entity: AuditEntity, entityId: string): Promise<void> {
  await ensureAuditSchema();
  const sql = getSql();
  await sql`DELETE FROM field_changes WHERE entity = ${entity} AND entity_id = ${entityId};`;
}

/** Log zmian jednego rekordu, od najnowszej. Limit odcina historię starszą
 * niż kilkaset zmian — profil i tak jej nie pokaże, a zapytanie ma zostać
 * tanie. */
export async function loadFieldChanges(entity: AuditEntity, entityId: string): Promise<FieldChange[]> {
  await ensureAuditSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, field, old_value, new_value, created_at
    FROM field_changes
    WHERE entity = ${entity} AND entity_id = ${entityId}
    ORDER BY created_at DESC
    LIMIT 300;
  `;
  return rows as unknown as FieldChange[];
}
