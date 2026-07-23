import {
  getSql,
  ensureLeadsSchema,
  ensureHubSchema,
  ensureInvoicesSchema,
  ensureOffersSchema,
  ensureContractsSchema,
  ensureClientsSchema,
} from "./db";
import { LEADS_RETENTION_MONTHS } from "./leads";

/**
 * Retencja leadów (RODO, Audyt 2) — TYLKO serwer (ciągnie `lib/db`).
 *
 * Usuwa leady, które NIGDY nie stały się realną relacją biznesową i od
 * `LEADS_RETENTION_MONTHS` miesięcy nie mają śladu kontaktu. „Nigdy nie stał
 * się" celowo jest szeroki i zachowawczy — pomijamy leada, który ma choć jeden
 * z: powiązanego klienta, fakturę, ofertę, umowę, projekt. Usunięcie jest
 * nieodwracalne, więc przy wątpliwości TRZYMAMY (fałszywe zatrzymanie kosztuje
 * miejsce, fałszywe usunięcie kosztuje dane).
 *
 * Podstawa czasu to `ostatni_kontakt` (a gdy pusty — `created_at`), ŚWIADOMIE
 * bez `updated_at`. Liczymy od realnego kontaktu, nie od dowolnej edycji karty:
 * inaczej zmiana statusu czy notatki resetowałaby zegar RODO i pozwalała trzymać
 * dane bez końca przez samo „dotykanie" rekordu. Aktywne relacje chronią i tak
 * wykluczenia poniżej (klient/faktura/oferta/umowa/projekt), nie świeżość edycji.
 *
 * Kasując leada, jawnie kasujemy też jego `field_changes` (ten log nie ma FK,
 * więc kaskada bazy go nie ruszy — patrz deleteFieldChanges w lib/auditLog.ts).
 * `lead_activity` i `mail_address_links` znikają kaskadą FK; `mail_messages`
 * dostają lead_id → NULL (mają własną retencję 24 mies.).
 */
export async function purgeStaleLeads(): Promise<{ purged: number }> {
  // Wszystkie tabele, które dotyka zapytanie NOT EXISTS, muszą istnieć —
  // ensure* są idempotentne i bramkowane (schemaUpToDate), więc to tanie.
  await ensureLeadsSchema();
  await ensureHubSchema();
  await ensureInvoicesSchema();
  await ensureOffersSchema();
  await ensureContractsSchema();
  await ensureClientsSchema();
  const sql = getSql();

  const martwe = (await sql`
    SELECT l.id
    FROM leads l
    WHERE l.client_id IS NULL
      AND COALESCE(l.ostatni_kontakt::timestamptz, l.created_at)
            < now() - (${LEADS_RETENTION_MONTHS} || ' months')::interval
      AND NOT EXISTS (SELECT 1 FROM clients c   WHERE c.lead_id = l.id)
      AND NOT EXISTS (SELECT 1 FROM invoices i  WHERE i.lead_id = l.id)
      AND NOT EXISTS (SELECT 1 FROM offers o    WHERE o.lead_id = l.id)
      AND NOT EXISTS (SELECT 1 FROM contracts k WHERE k.lead_id = l.id)
      AND NOT EXISTS (SELECT 1 FROM projects p  WHERE p.lead_id = l.id);
  `) as unknown as { id: string }[];

  if (martwe.length === 0) return { purged: 0 };
  const ids = martwe.map((r) => r.id);

  // Audyt zmian nie ma FK do leada — skasuj go razem z osobą, inaczej zostają
  // surowe stare/nowe e-maile i telefony (RODO).
  await sql`DELETE FROM field_changes WHERE entity = 'lead' AND entity_id = ANY(${ids});`;
  await sql`DELETE FROM leads WHERE id = ANY(${ids});`;

  return { purged: ids.length };
}
