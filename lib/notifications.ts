/**
 * Centrum powiadomień (Moduł 24) — typy, etykiety i mapowanie na adresy.
 * Czysta logika, BEZ importu `lib/db`.
 *
 * Świadomie osobno od `lib/notificationLog.ts` (zapis/odczyt z bazy): ten plik
 * importuje kliencki dzwonek w sidebarze, a `lib/db` ciągnie `node:async_hooks`,
 * którego Turbopack nie umie wpakować do bundla przeglądarki — build wywala
 * się wtedy na „chunking context does not support external modules", a `tsc`
 * tego NIE łapie. Ten sam podział co `lib/audit.ts` ↔ `lib/auditLog.ts`
 * (Moduł 23) i `lib/mail.ts` ↔ `lib/mailSync.ts`.
 */

/** Rodzaj zdarzenia. Kolejność = kolejność w tym pliku niżej (etykiety/emoji),
 * nie ma znaczenia dla bazy — `kind` jest tam zwykłym tekstem, dokładnie po to,
 * żeby dołożenie kolejnego rodzaju nie wymagało migracji. */
export type NotificationKind =
  | "lead_new"
  | "mail_new"
  | "mail_nudge"
  | "invoice_paid"
  | "invoice_reminder"
  | "invoice_dunning"
  | "recurring_invoice"
  | "recurring_cost"
  // Moduł 31 — trzy zdarzenia z lejka, o których panel dotąd milczał. Klient
  // akceptował ofertę e-podpisem w nocy i dzwonek nie drgnął: dowiadywałeś się
  // dopiero wchodząc na Oferty. Wszystkie trzy są KRONIKĄ w rozumieniu Modułu
  // 24 (zdarzenie w punkcie w czasie, wywołane z zewnątrz, nie do odhaczenia),
  // a nie drugą listą "do zrobienia" — potwierdzone przez właściciela
  // 2026-07-17.
  | "offer_accepted"
  | "contract_signed"
  | "review_collected"
  // 2026-07-22 — klient odpowiedział na zaproszenie na spotkanie. Kronika,
  // nie zadanie: to zdarzenie z zewnątrz, w punkcie w czasie, nie do
  // odhaczenia. Bez encji — wydarzenie nie ma własnej podstrony, więc
  // kliknięcie prowadzi donikąd i lepiej nie obiecywać, że prowadzi.
  | "invite_response";

/** Encja, do której prowadzi kliknięcie. Tekst, nie enum — patrz `lib/db.ts`. */
export type NotificationEntity = "lead" | "mail" | "invoice" | "cost" | "client" | "offer" | "contract" | "project";

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  entity: NotificationEntity | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

/** Ile wpisów w ogóle pokazuje popover. Historia sięga 30 dni (cron kasuje
 * starsze, patrz `purgeOldNotifications`), ale nawet w rekordowym tygodniu nikt
 * nie przewinie stu wpisów — a zapytanie ma zostać tanie. */
export const NOTIFICATIONS_LIMIT = 50;

/** Po ilu dniach kronika zapomina. Decyzja właściciela 2026-07-17: 30 dni to
 * dość, żeby wrócić po urlopie i zobaczyć, co się działo, a tabela nie rośnie
 * w nieskończoność. Przeczytane zostają widoczne do końca tego okna — dzwonek
 * jest kroniką, nie skrzynką, więc „przeczytane" wygasza, a nie kasuje. */
export const NOTIFICATIONS_RETENTION_DAYS = 30;

/* Ikona per rodzaj: `<NotificationIcon kind={…} />` w
 * `app/[lang]/admin/icons.tsx` (Moduł 33). Świadomie NIE tutaj — ten plik
 * importuje kliencki dzwonek i ma zostać tak chudy, jak się da (patrz
 * ostrzeżenie w nagłówku o bundlowaniu). */

/** Adres, pod który prowadzi kliknięcie w powiadomienie — albo `null`, gdy
 * wpis nie ma dokąd prowadzić.
 *
 * Koszty świadomie lądują na liście, nie na podstronie rekordu: `/admin/costs`
 * jako jedyny moduł w panelu nie ma `[id]/page.tsx` (patrz drzewo tras), więc
 * `/costs/<id>` byłoby po prostu 404. Gdy Koszty kiedyś dostaną podstronę, to
 * jest jedyne miejsce do zmiany. */
export function notificationHref(n: Pick<Notification, "entity" | "entity_id">, base: string): string | null {
  if (!n.entity) return null;
  if (n.entity === "cost") return `${base}/costs`;
  if (!n.entity_id) return null;
  const segment: Record<Exclude<NotificationEntity, "cost">, string> = {
    lead: "leads",
    mail: "mail",
    invoice: "invoices",
    client: "clients",
    // Moduł 31 — wszystkie trzy mają `[id]/page.tsx`, więc prowadzą na rekord
    // (inaczej niż koszty wyżej).
    offer: "offers",
    contract: "contracts",
    project: "projects",
  };
  return `${base}/${segment[n.entity]}/${n.entity_id}`;
}

/**
 * „2 godz. temu" — wiek wpisu w skrócie, po polsku.
 *
 * Świadomie własne, a nie `formatPlDate()` z `lib/projects.ts`: tamto formatuje
 * DZIEŃ („17.07.2026"), a w kronice zdarzeń liczy się „ile czasu minęło" —
 * data dzienna przy trzech mailach z tego samego popołudnia nie odróżnia ich od
 * siebie. Dla wpisów starszych niż tydzień schodzimy jednak do daty dziennej,
 * bo „13 dni temu" nikomu nic nie mówi.
 *
 * Wejściem jest `created_at` z bazy, czyli TIMESTAMPTZ — tu wyjątkowo `new
 * Date()` jest na miejscu (porównujemy MOMENTY, nie dni kalendarzowe, więc
 * ostrzeżenie z CLAUDE.md o `todayLocalISO()` nie dotyczy tego przypadku).
 */
export function notificationAge(createdAt: string, now: number = Date.now()): string {
  const minutes = Math.floor((now - new Date(createdAt).getTime()) / 60000);
  if (minutes < 1) return "przed chwilą";
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "wczoraj";
  if (days < 7) return `${days} dni temu`;
  const d = new Date(createdAt);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
