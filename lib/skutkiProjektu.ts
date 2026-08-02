/**
 * Skutki zmiany statusu projektu — jedno miejsce dla wszystkich dróg.
 *
 * ── Po co osobny plik ─────────────────────────────────────────────────────
 * Zamknięcie projektu („Wdrożone") to nie jest jeden `UPDATE`. To trzy rzeczy
 * naraz: wpis na osi klienta, zaplanowanie dwóch kontaktów kontrolnych
 * (nurture, Moduł 2) i — od Fazy 3 — zdjęcie propozycji, która o to zamknięcie
 * prosiła. Do Fazy 3 cały ten komplet siedział WEWNĄTRZ `PATCH
 * /api/projects/:id`, więc każda inna droga do „Wdrożone" robiła połowę
 * roboty w ciszy.
 *
 * A dróg jest teraz dwie: ręczna zmiana statusu w panelu i zatwierdzenie
 * propozycji „opinia przyszła — zamknąć projekt?" (`lib/propozycje.ts`).
 * Ten sam precedens co `lib/offerAccept.ts` (dwie drogi akceptacji oferty)
 * i `projektPoPodpisieUmowy` (dwie drogi podpisu): skutek zdarzenia nie może
 * zależeć od tego, kto kliknął.
 *
 * ── Czego tu NIE ma ───────────────────────────────────────────────────────
 * Samego `UPDATE projects SET status`. Zapis zostaje po stronie wołającego —
 * trasa PATCH pisze go razem z resztą pól jednego żądania, a wykonanie
 * propozycji robi to zapisem warunkowym („claim"), żeby nie zamknąć projektu,
 * który w międzyczasie zamknął ktoś inny. Ta funkcja odpowiada wyłącznie na
 * pytanie „co jeszcze musi się stać, skoro status się zmienił".
 */

import { randomUUID } from "node:crypto";
import { ensureFollowupsSchema, logClientEvent, type Sql } from "./db";
import { CLOSED_PROJECT_STATUSES } from "./projects";
import { NURTURE_OFFSETS } from "./clients";
import { todayLocalISO } from "./dates";
import { addDaysISO } from "./documents";

/**
 * Dopina wszystko, co wynika ze zmiany statusu projektu na `nowyStatus`.
 * Wołać PO zapisaniu samego statusu.
 *
 * Idempotentne po `project_id`: nurture nie planuje się drugi raz, gdy status
 * wraca do „Wdrożone" po korekcie.
 */
export async function skutkiZmianyStatusuProjektu(
  sql: Sql,
  projekt: { id: string; tytul: string; clientId: string | null },
  nowyStatus: string
): Promise<void> {
  await logClientEvent(
    sql,
    projekt.clientId,
    "project_status_changed",
    `Projekt „${projekt.tytul}” → ${nowyStatus}`,
    null,
    projekt.id
  );

  // Nurture automatyczny (Moduł 2): przy wejściu w status zamknięty planujemy
  // klientowi dwa przyszłe kontakty (14/90 dni), bez klikania.
  if (projekt.clientId && CLOSED_PROJECT_STATUSES.has(nowyStatus)) {
    await ensureFollowupsSchema();
    const existing = await sql`
      SELECT 1 FROM client_followups WHERE project_id = ${projekt.id} LIMIT 1;
    `;
    if (existing.length === 0) {
      const today = todayLocalISO();
      for (const offset of NURTURE_OFFSETS) {
        await sql`
          INSERT INTO client_followups (id, client_id, project_id, due_date, powod)
          VALUES (${randomUUID()}, ${projekt.clientId}, ${projekt.id}, ${addDaysISO(today, offset.days)}, ${offset.powod});
        `;
      }
      await logClientEvent(sql, projekt.clientId, "nurture_scheduled", "Zaplanowano kontakt kontrolny (14 i 90 dni)");
    }
  }
}
