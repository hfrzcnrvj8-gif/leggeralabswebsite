// Moduł 4 — sedno poczty: co się dzieje z pobraną wiadomością.
// Osobno od lib/mailbox.ts (rozmowa z serwerem IMAP) i od route'ów, żeby tę
// samą funkcję mogły wołać dwa wejścia: POST /api/mail/sync (otwarcie
// zakładki) i dzienny cron (app/api/leads/notify) — bez HTTP-owego skoku po
// samym sobie.
//
// Zero AI: komu przypisać maila wynika z równości adresu (findContactsByEmail),
// a czy jest "do obsłużenia" — ze statusu. Treść nie jest przez nic czytana.
import { randomUUID } from "node:crypto";
import { getSql, ensureMailSchema } from "./db";
import { findContactsByEmail } from "./contactLookup";
import { fetchNewMessages, type FetchedMessage } from "./mailbox";
import { isNoiseAddress, mailSummaryLine, MAIL_RETENTION_MONTHS } from "./mail";
import { todayLocalISO } from "./dates";

export type SyncResult = {
  fetched: number;
  saved: number;
  matched: number;
  unassigned: number;
  ignored: number;
};

type MailState = { last_seen_uid: number; uid_validity: string | number | null };

/**
 * Pobierz nowe wiadomości, dopasuj do klienta/leada, zapisz.
 *
 * Idempotentne dzięki `message_id UNIQUE` — podwójny sync (otwarcie widoku +
 * cron) nie zdubluje niczego. Dlatego reset UID-ów przy zmianie UIDVALIDITY
 * jest bezpieczny: najwyżej przeczytamy skrzynkę ponownie, a INSERT-y się
 * odbiją.
 */
export async function syncMailbox(): Promise<SyncResult> {
  await ensureMailSchema();
  const sql = getSql();

  const stateRows = (await sql`SELECT last_seen_uid, uid_validity FROM mail_state WHERE id = 'default';`) as unknown as MailState[];
  const state = stateRows[0] ?? { last_seen_uid: 0, uid_validity: null };

  let sinceUid = Number(state.last_seen_uid) || 0;

  let batch: Awaited<ReturnType<typeof fetchNewMessages>>;
  try {
    batch = await fetchNewMessages(sinceUid);
  } catch (e) {
    // Zapisz powód, żeby zakładka Poczta mogła pokazać "ostatni sync nie
    // wyszedł, bo ..." zamiast milczeć.
    const msg = e instanceof Error ? e.message : String(e);
    await sql`UPDATE mail_state SET last_error = ${msg.slice(0, 500)}, last_sync_at = now() WHERE id = 'default';`;
    throw e;
  }

  // Serwer przenumerował skrzynkę (odtworzenie z backupu, migracja) — stare
  // UID-y wskazują teraz inne wiadomości, więc kursor jest bezwartościowy.
  // Czytamy od zera; dedup po message_id chroni przed duplikatami.
  const prevValidity = state.uid_validity != null ? Number(state.uid_validity) : null;
  if (batch.uidValidity != null && prevValidity != null && batch.uidValidity !== prevValidity) {
    console.warn(`[mailSync] UIDVALIDITY zmieniła się (${prevValidity} → ${batch.uidValidity}) — czytam skrzynkę od nowa.`);
    sinceUid = 0;
    batch = await fetchNewMessages(0);
  }

  let saved = 0;
  let matched = 0;
  let unassigned = 0;
  let ignored = 0;

  for (const msg of batch.messages) {
    try {
      const outcome = await saveIncoming(sql, msg);
      if (outcome === "duplicate") continue;
      saved++;
      if (outcome === "ignored") ignored++;
      else if (outcome === "matched") matched++;
      else unassigned++;
    } catch (e) {
      // Jedna felerna wiadomość nie może zatrzymać całego syncu — ten sam
      // wzorzec "łykaj błędy per-item", co w cronie przy przypomnieniach.
      console.error("[mailSync] nie udało się zapisać wiadomości", msg.messageId, e);
    }
  }

  await sql`
    UPDATE mail_state
    SET last_seen_uid = ${Math.max(batch.highestUid, sinceUid)},
        uid_validity = ${batch.uidValidity},
        last_sync_at = now(),
        last_error = NULL
    WHERE id = 'default';
  `;

  return { fetched: batch.messages.length, saved, matched, unassigned, ignored };
}

type SaveOutcome = "matched" | "unassigned" | "ignored" | "duplicate";

/** Zapisz jedną przychodzącą wiadomość + (gdy dopasowana) wpis na osi
 * kontaktu klienta/leada. */
async function saveIncoming(sql: ReturnType<typeof getSql>, msg: FetchedMessage): Promise<SaveOutcome> {
  const noise = isNoiseAddress(msg.fromAddr);
  // Newsletter/no-reply zapisujemy, ale od razu jako "zignorowany" — nie ma
  // do kogo odpisać, więc nie ma czego szukać na liście "do odpowiedzi"
  // (wyciszenie szumu, decyzja właściciela 2026-07-15).
  const status = noise ? "zignorowany" : "nowy";

  // Automat nie jest kontaktem z człowiekiem — nie dopinamy go do klienta i
  // nie brudzimy nim osi kontaktu, nawet gdyby adres pasował.
  const match = noise ? undefined : (await findContactsByEmail(msg.fromAddr))[0];
  const clientId = match?.type === "client" ? match.id : null;
  const leadId = match?.type === "lead" ? match.id : null;

  const id = randomUUID();
  const inserted = (await sql`
    INSERT INTO mail_messages (
      id, uid, kierunek, client_id, lead_id, from_addr, from_name, to_addr,
      subject, body_text, body_html, message_id, in_reply_to, refs, status, received_at
    ) VALUES (
      ${id}, ${msg.uid}, 'in', ${clientId}, ${leadId}, ${msg.fromAddr}, ${msg.fromName}, ${msg.toAddr},
      ${msg.subject}, ${msg.bodyText}, ${msg.bodyHtml}, ${msg.messageId}, ${msg.inReplyTo}, ${msg.refs},
      ${status}, ${msg.receivedAt.toISOString()}
    )
    ON CONFLICT (message_id) DO NOTHING
    RETURNING id;
  `) as unknown as { id: string }[];

  // Pusty RETURNING = ON CONFLICT zadziałał, czyli znaliśmy już tę wiadomość.
  if (inserted.length === 0) return "duplicate";
  if (noise) return "ignored";
  if (!match) return "unassigned";

  await logMailOnTimeline(sql, {
    mailId: id,
    match,
    text: mailSummaryLine(msg.subject, msg.bodyText),
    kierunek: "przychodzacy",
  });

  return "matched";
}

/**
 * Dopisz mail do osi kontaktu leada/klienta jako kanał "email".
 *
 * Świadomie `client_activity`/`lead_activity`, a NIE `client_events`
 * (decyzja 2026-07-15, brief pkt "Aktualizacja kontekstu"): mail to kontakt z
 * człowiekiem — jak telefon z Modułu 3 — więc ma kanał, kierunek i wpada w tę
 * samą regułę "czeka na odpowiedź", a nie jest zdarzeniem systemowym typu
 * "wystawiono fakturę". Precedens: POST /api/telefonia/webhook zapisuje tu
 * automatycznie dokładnie tak samo.
 *
 * Wpis to tylko SKRÓT (temat + pierwsza linia) — pełna treść zostaje w
 * `mail_messages`, a `mail_message_id` linkuje oś wprost do niej.
 */
export async function logMailOnTimeline(
  sql: ReturnType<typeof getSql>,
  params: {
    mailId: string;
    match: { type: "lead" | "client"; id: string };
    text: string;
    kierunek: "przychodzacy" | "wychodzacy";
  }
): Promise<void> {
  const activityId = randomUUID();
  const today = todayLocalISO();

  if (params.match.type === "lead") {
    await sql`
      INSERT INTO lead_activity (id, lead_id, text, kanal, kierunek, mail_message_id)
      VALUES (${activityId}, ${params.match.id}, ${params.text}, 'email', ${params.kierunek}, ${params.mailId});
    `;
    await sql`UPDATE leads SET ostatni_kontakt = ${today}, ostatni_kanal = 'email', updated_at = now() WHERE id = ${params.match.id};`;
  } else {
    await sql`
      INSERT INTO client_activity (id, client_id, text, kanal, kierunek, mail_message_id)
      VALUES (${activityId}, ${params.match.id}, ${params.text}, 'email', ${params.kierunek}, ${params.mailId});
    `;
    await sql`UPDATE clients SET ostatni_kontakt = ${today}, ostatni_kanal = 'email', updated_at = now() WHERE id = ${params.match.id};`;
  }
}

/**
 * Retencja (RODO) — usuń treści starsze niż MAIL_RETENTION_MONTHS (24 mies.,
 * decyzja właściciela 2026-07-15). Wołane z dziennego crona.
 *
 * Kasujemy CAŁE wiersze, nie tylko treść: sam nagłówek bez ciała nie jest już
 * do niczego potrzebny, a "nie zapisuj więcej, niż trzeba" jest tu regułą.
 * Wpisy na osi kontaktu zostają (mail_message_id ma ON DELETE SET NULL) —
 * historia relacji się nie zapada, traci tylko link do pełnej treści.
 * Oryginały i tak leżą na serwerze az.pl; panel jest roboczą kopią.
 */
export async function purgeOldMail(): Promise<{ purged: number }> {
  await ensureMailSchema();
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM mail_messages
    WHERE received_at < now() - (${MAIL_RETENTION_MONTHS} || ' months')::interval
    RETURNING id;
  `) as unknown as { id: string }[];
  return { purged: rows.length };
}
