import { randomUUID } from "node:crypto";
import { getSql, ensureNotificationsSchema } from "./db";
import {
  NOTIFICATIONS_LIMIT,
  NOTIFICATIONS_RETENTION_DAYS,
  type Notification,
  type NotificationEntity,
  type NotificationKind,
} from "./notifications";

/**
 * Centrum powiadomień (Moduł 24) — zapis i odczyt kroniki zdarzeń. TYLKO
 * serwer.
 *
 * Świadomie osobno od `lib/notifications.ts` (typy, etykiety), bo tamten plik
 * importuje kliencki dzwonek, a ten ciągnie `lib/db` → `node:async_hooks` →
 * build w bundlu przeglądarki. Pełne uzasadnienie w nagłówku
 * `lib/notifications.ts`.
 */

export type NewNotification = {
  kind: NotificationKind;
  title: string;
  body?: string;
  entity?: NotificationEntity;
  entityId?: string;
  /**
   * Klucz zdarzenia — bez niego nie da się nic zapisać (kolumna NOT NULL).
   * Ma opisywać ZDARZENIE, nie moment: `invoice_paid:<id>` (faktura opłaca się
   * raz), `invoice_reminder:<id>:<poziom>` (każdy poziom eskalacji raz),
   * `mail_nudge:<threadId>` (o ciszy w wątku mówimy jeden raz, mimo że cron
   * widzi ją co rano). Patrz komentarz przy tabeli w `lib/db.ts`.
   */
  dedupeKey: string;
};

/** Górny limit tego, co w ogóle trafia do kroniki — temat maila potrafi być
 * absurdalnie długi, a popover ma ~340 px szerokości. Ten sam wzorzec co
 * `MAX_STORED` w `lib/auditLog.ts`. */
const MAX_TITLE = 200;
const MAX_BODY = 500;

/**
 * Dopisuje zdarzenie do kroniki. Zwraca `true`, gdy wpis faktycznie powstał
 * (`false` = ten sam `dedupe_key` już był, czyli cron zobaczył to zdarzenie
 * kolejnego dnia).
 *
 * Błąd zapisu świadomie NIE wywala wywołującego, tylko ląduje w konsoli — ta
 * sama decyzja co przy `logFieldChanges()` w `lib/auditLog.ts`, ale tutaj waży
 * jeszcze więcej: hooki wiszą przy zapisie leada z formularza na stronie i
 * przy rejestrowaniu wpłaty. Utrata powiadomienia jest przykra; utrata
 * ZGŁOSZENIA KLIENTA, bo nie udało się zapisać powiadomienia o nim, byłaby
 * absurdem. Kronika jest zapisem pobocznym i ma się tak zachowywać.
 */
export async function notify(n: NewNotification): Promise<boolean> {
  try {
    await ensureNotificationsSchema();
    const sql = getSql();
    const rows = (await sql`
      INSERT INTO notifications (id, kind, title, body, entity, entity_id, dedupe_key)
      VALUES (
        ${randomUUID()}, ${n.kind}, ${n.title.slice(0, MAX_TITLE)}, ${(n.body ?? "").slice(0, MAX_BODY)},
        ${n.entity ?? null}, ${n.entityId ?? null}, ${n.dedupeKey}
      )
      ON CONFLICT (dedupe_key) DO NOTHING
      RETURNING id;
    `) as unknown as { id: string }[];
    return rows.length > 0;
  } catch (e) {
    console.error(`[notifications] nie udało się zapisać zdarzenia ${n.dedupeKey}`, e);
    return false;
  }
}

/** Kronika od najnowszej + licznik nieprzeczytanych. Jedno wejście dla
 * dzwonka, żeby popover nie robił dwóch rund do bazy (neon() = jedno żądanie
 * HTTP na zapytanie). */
export async function loadNotifications(): Promise<{ notifications: Notification[]; unread: number }> {
  await ensureNotificationsSchema();
  const sql = getSql();
  const [rows, counts] = await Promise.all([
    sql`
      SELECT id, kind, title, body, entity, entity_id, read_at, created_at
      FROM notifications
      ORDER BY created_at DESC
      LIMIT ${NOTIFICATIONS_LIMIT};
    `,
    sql`SELECT COUNT(*)::int AS unread FROM notifications WHERE read_at IS NULL;`,
  ]);
  return {
    notifications: rows as unknown as Notification[],
    unread: Number((counts as unknown as { unread: number }[])[0]?.unread ?? 0),
  };
}

/** Oznacza jedno powiadomienie jako przeczytane. `read_at` nie jest nadpisywane
 * przy powtórnym kliknięciu — moment pierwszego przeczytania jest tym, co
 * kiedyś ma decydować, czy budzić telefon (push, Moduł 5). */
export async function markNotificationRead(id: string): Promise<void> {
  await ensureNotificationsSchema();
  const sql = getSql();
  await sql`UPDATE notifications SET read_at = now() WHERE id = ${id} AND read_at IS NULL;`;
}

/** „Oznacz wszystkie jako przeczytane" — gasi licznik, ale NIE kasuje wpisów
 * (decyzja właściciela: przeczytane zostają widoczne w historii przez 30 dni). */
export async function markAllNotificationsRead(): Promise<void> {
  await ensureNotificationsSchema();
  const sql = getSql();
  await sql`UPDATE notifications SET read_at = now() WHERE read_at IS NULL;`;
}

/** Retencja kroniki — woła ją dzienny cron. Kasuje po dacie, NIE po statusie
 * przeczytania: wpis sprzed 30 dni jest nieaktualny niezależnie od tego, czy
 * właściciel go zauważył (ta sama filozofia co retencja poczty). */
export async function purgeOldNotifications(): Promise<{ purged: number }> {
  await ensureNotificationsSchema();
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM notifications
    WHERE created_at < now() - (${NOTIFICATIONS_RETENTION_DAYS} || ' days')::interval
    RETURNING id;
  `) as unknown as { id: string }[];
  return { purged: rows.length };
}
