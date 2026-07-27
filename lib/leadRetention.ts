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

/* --------------------------- dowód e-podpisu (audyt Modułu 57, 2026-07-27) -- */

/**
 * Po ilu miesiącach od podpisu czyścimy TECHNICZNĄ metryczkę e-podpisu.
 *
 * Sześć lat = ogólny termin przedawnienia roszczeń majątkowych z umowy
 * (decyzja właściciela 2026-07-27, po audycie Modułu 57). Do tego czasu adres
 * IP i przeglądarka mogą się przydać jako dowód, że oświadczenie woli złożyła
 * ta osoba; po nim nie mają już do czego służyć, a dalsze trzymanie ich jest
 * gromadzeniem danych bez celu.
 *
 * Ta wartość MUSI zgadzać się z polityką prywatności — jeśli zmienisz jedno,
 * zmień drugie (patrz docs/DO-PRAWNIKA-I-TLUMACZA.md).
 */
export const ESIGN_PROOF_RETENTION_MONTHS = 72;

/**
 * Czyści `accepted_ip` i `accepted_user_agent` na ofertach i umowach
 * podpisanych dawniej niż `ESIGN_PROOF_RETENTION_MONTHS`.
 *
 * **Czyścimy metryczkę, NIE podpis.** `accepted_by_name` i `accepted_at`
 * zostają — to jest treść dokumentu, drukowana pod nim jako „Zaakceptowano
 * przez … dnia …". Usunięcie ich zostawiłoby podpisany dokument z pustą
 * rubryką podpisu, czyli zniszczyłoby dowód zamiast go ograniczyć. Znikają
 * wyłącznie dwie dane techniczne, których na dokumencie nigdy nie było
 * (`CONTRACT_PUBLIC_FIELDS` i `OFFER_PUBLIC_FIELDS` ich nie wypuszczają —
 * Audyt 1, ustalenie 5).
 *
 * Świadomie bez `updated_at = now()`: czyszczenie retencyjne nie jest edycją
 * dokumentu i nie ma podbijać go na listach „ostatnio zmienione".
 */
export async function purgeStareDowodyPodpisu(): Promise<{ oferty: number; umowy: number }> {
  await ensureOffersSchema();
  await ensureContractsSchema();
  const sql = getSql();
  const okno = `${ESIGN_PROOF_RETENTION_MONTHS} months`;

  const oferty = (await sql`
    UPDATE offers SET accepted_ip = NULL, accepted_user_agent = NULL
    WHERE accepted_at IS NOT NULL
      AND accepted_at < now() - ${okno}::interval
      AND (accepted_ip IS NOT NULL OR accepted_user_agent IS NOT NULL)
    RETURNING id;
  `) as unknown as { id: string }[];

  const umowy = (await sql`
    UPDATE contracts SET accepted_ip = NULL, accepted_user_agent = NULL
    WHERE accepted_at IS NOT NULL
      AND accepted_at < now() - ${okno}::interval
      AND (accepted_ip IS NOT NULL OR accepted_user_agent IS NOT NULL)
    RETURNING id;
  `) as unknown as { id: string }[];

  return { oferty: oferty.length, umowy: umowy.length };
}

/* --------------------------------- retencja ofert (audyt Modułu 57, luka) -- */

/**
 * Po ilu miesiącach znikają PRZEGRANE oferty.
 *
 * Ta luka wyszła przy domykaniu wniosków audytu Modułu 57: leady znikają po
 * 24 miesiącach, poczta po 24, dowód e-podpisu po 6 latach — a sama oferta
 * z nazwą firmy, NIP-em, adresem, e-mailem i MIGAWKĄ tych danych leżała
 * bezterminowo. Faktury mają swój bezterminowy byt uzasadniony pięcioletnim
 * obowiązkiem podatkowym; oferta nie podlega żadnemu.
 *
 * 24 miesiące — ta sama liczba co `LEADS_RETENTION_MONTHS` i retencja poczty,
 * świadomie. Odrzucona oferta to zamknięta rozmowa handlowa z tym samym
 * leadem, o którym mówi tamten przepis; dwie różne liczby na to samo znaczyłyby
 * dwa różne zdania w polityce prywatności i pierwszą okazję do rozjazdu.
 *
 * Ta wartość MUSI zgadzać się z polityką prywatności — patrz
 * `docs/DO-PRAWNIKA-I-TLUMACZA.md`.
 */
export const OFFERS_RETENTION_MONTHS = 24;

/**
 * Usuwa oferty, z których nic nie wynikło i od `OFFERS_RETENTION_MONTHS`
 * miesięcy nic się przy nich nie dzieje.
 *
 * **Co NIE jest usuwane** — lista jest szeroka i zachowawcza, dokładnie jak
 * przy `purgeStaleLeads`, bo usunięcie jest nieodwracalne:
 *
 *  - oferty ZAAKCEPTOWANE — z nich powstał projekt i faktura, więc dokument
 *    jest podkładką pod rozliczenie objęte obowiązkiem podatkowym;
 *  - oferty wciąż OTWARTE (szkic, wysłana) — nikt ich nie zamknął, więc trwają;
 *  - oferty z `project_id` lub `invoice_id` — coś z nich wynikło, choćby
 *    status mówił inaczej (np. ktoś ręcznie przestawił zamkniętą ofertę);
 *  - oferty, na które wskazuje UMOWA (`contracts.offer_id`) — umowa żyje
 *    dłużej i przy sporze musi mieć czym się podeprzeć;
 *  - oferty, które mają WERSJE POTOMNE (`parent_offer_id`) — usunięcie
 *    matki zerwałoby historię tej samej rozmowy handlowej. Znikną razem,
 *    gdy najmłodsza wersja też się zestarzeje.
 *
 * Zegar liczymy od `updated_at`, nie od `created_at`: interesuje nas, kiedy
 * przy ofercie ostatnio cokolwiek się działo. Świadomie inaczej niż przy
 * leadach — tam `updated_at` odpadło, bo dowolne dotknięcie karty resetowałoby
 * zegar RODO, ale oferty po zamknięciu nikt już nie dotyka, a jedyne, co je
 * podbija, to realna zmiana statusu.
 *
 * Pozycje, sekcje i migawka lecą razem z wierszem (`ON DELETE CASCADE` +
 * kolumna JSONB). Jawnie kasujemy wpisy z osi czasu klienta, które na tę
 * ofertę wskazywały: `client_events.related_id` nie ma klucza obcego, więc
 * baza sama by ich nie ruszyła, a oś czasu zostałaby z linkami donikąd.
 */
export async function purgeStareOferty(): Promise<{ purged: number }> {
  await ensureOffersSchema();
  await ensureContractsSchema();
  const sql = getSql();

  const martwe = (await sql`
    SELECT o.id
    FROM offers o
    WHERE o.status IN ('Odrzucona', 'Wygasła')
      AND o.project_id IS NULL
      AND o.invoice_id IS NULL
      AND o.updated_at < now() - (${OFFERS_RETENTION_MONTHS} || ' months')::interval
      AND NOT EXISTS (SELECT 1 FROM contracts k WHERE k.offer_id = o.id)
      AND NOT EXISTS (SELECT 1 FROM offers w WHERE w.parent_offer_id = o.id);
  `) as unknown as { id: string }[];

  if (martwe.length === 0) return { purged: 0 };
  const ids = martwe.map((r) => r.id);

  await sql`DELETE FROM client_events WHERE related_id = ANY(${ids});`;
  await sql`DELETE FROM offers WHERE id = ANY(${ids});`;

  return { purged: ids.length };
}
