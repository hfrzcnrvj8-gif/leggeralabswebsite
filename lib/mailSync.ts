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
import { fetchNewMessages, fetchHintsByUids, isMailboxConfigured, type FetchedMessage } from "./mailbox";
import { classifyMail, isNoiseMail, mailSummaryLine, MAIL_RETENTION_MONTHS, type MailHeaderHints } from "./mail";
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

  // Najpierw dociągnij kategorie wiadomościom sprzed ich wprowadzenia —
  // samo-naprawiające się, więc właściciel nie musi nic klikać ani wiedzieć,
  // że coś było do nadrobienia.
  await backfillCategories().catch((e) => {
    // Backfill to porządki, nie powód, żeby nie pobrać nowej poczty.
    console.error("[mailSync] backfill kategorii nie powiódł się", e);
  });

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

/**
 * Przelicza kategorie wiadomości, które ich nie mają (`kategoria IS NULL`)
 * albo zostały zaklasyfikowane bez nagłówków (`list_unsubscribe IS NULL`).
 *
 * Dlaczego nie wystarczy sam adres: pierwsza wersja tak właśnie robiła i
 * właściciel od razu zobaczył skutek — maile z Calendly wylądowały w
 * "Zapytaniach", bo nie mają "noreply" w adresie. Dopiero `List-Unsubscribe`
 * mówi wprost "to masówka". Dedup po `message_id` nie pozwala pobrać takiej
 * wiadomości ponownie w całości, więc dociągamy ze skrzynki SAME nagłówki po
 * UID-zie (tanie) i klasyfikujemy z pełnym sygnałem.
 *
 * Gdy skrzynka jest niedostępna (albo lokalnie, gdzie jej nie ma), lecimy
 * dalej na samym adresie — lepiej dać przybliżoną szufladkę niż żadną.
 *
 * Status podnosimy TYLKO z 'nowy' → 'zignorowany'. Wiadomości, które
 * właściciel już odhaczył albo wyciszył ręcznie, zostają nietknięte — jego
 * decyzja jest ważniejsza niż reguła.
 */
export async function backfillCategories(): Promise<{ updated: number }> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, uid, from_addr, subject, client_id, lead_id, status, kategoria,
           list_unsubscribe, precedence, auto_submitted
    FROM mail_messages
    WHERE kierunek = 'in' AND (kategoria IS NULL OR list_unsubscribe IS NULL)
    LIMIT 300;
  `) as unknown as {
    id: string;
    uid: number | null;
    from_addr: string;
    subject: string;
    client_id: string | null;
    lead_id: string | null;
    status: string;
    kategoria: string | null;
    list_unsubscribe: boolean | null;
    precedence: string | null;
    auto_submitted: string | null;
  }[];
  if (rows.length === 0) return { updated: 0 };

  // Dociągnij brakujące nagłówki jednym połączeniem IMAP (nie po jednym na
  // wiadomość). Bez skrzynki po prostu ich nie będzie.
  let hintsByUid = new Map<number, MailHeaderHints>();
  const missing = rows.filter((r) => r.list_unsubscribe === null && r.uid != null).map((r) => r.uid as number);
  if (missing.length > 0 && isMailboxConfigured()) {
    hintsByUid = await fetchHintsByUids(missing).catch((e) => {
      console.error("[mailSync] nie udało się dociągnąć nagłówków — klasyfikuję po adresie", e);
      return new Map();
    });
  }

  let updated = 0;
  for (const r of rows) {
    const fetched = r.uid != null ? hintsByUid.get(r.uid) : undefined;
    const hints =
      fetched ??
      (r.list_unsubscribe !== null
        ? { listUnsubscribe: r.list_unsubscribe, precedence: r.precedence, autoSubmitted: r.auto_submitted }
        : undefined);

    const kategoria = classifyMail({
      fromAddr: r.from_addr,
      subject: r.subject,
      hints,
      knownContact: Boolean(r.client_id || r.lead_id),
    });
    const newStatus = kategoria === "reklama" && r.status === "nowy" ? "zignorowany" : r.status;

    await sql`
      UPDATE mail_messages
      SET kategoria = ${kategoria},
          status = ${newStatus},
          list_unsubscribe = ${hints ? hints.listUnsubscribe : r.list_unsubscribe},
          precedence = ${hints ? hints.precedence : r.precedence},
          auto_submitted = ${hints ? hints.autoSubmitted : r.auto_submitted}
      WHERE id = ${r.id};
    `;
    updated++;
  }
  return { updated };
}

type SaveOutcome = "matched" | "unassigned" | "ignored" | "duplicate";

/** Zapisz jedną przychodzącą wiadomość + (gdy dopasowana) wpis na osi
 * kontaktu klienta/leada. */
async function saveIncoming(sql: ReturnType<typeof getSql>, msg: FetchedMessage): Promise<SaveOutcome> {
  const noise = isNoiseMail(msg.fromAddr, msg.hints);

  // Dopasowanie liczymy PRZED kategoryzacją, bo "czy znamy nadawcę" jest
  // jedną z jej przesłanek (nieznany człowiek = potencjalne zapytanie).
  // Automatu nie dopinamy do nikogo, nawet gdyby adres pasował — nie ma
  // sensu brudzić osi kontaktu klienta jego własnym newsletterem.
  const match = noise ? undefined : (await findContactsByEmail(msg.fromAddr))[0];
  const clientId = match?.type === "client" ? match.id : null;
  const leadId = match?.type === "lead" ? match.id : null;

  const kategoria = classifyMail({
    fromAddr: msg.fromAddr,
    subject: msg.subject,
    hints: msg.hints,
    knownContact: Boolean(match),
  });

  // "Reklama" nie ma do kogo odpisać → od razu poza listę "do odpowiedzi".
  // Uwaga: NIE używamy tu `noise`, tylko kategorii — bank czy faktura potrafią
  // przyjść z nagłówkami masówki, a te muszą zostać "nowe" (patrz kolejność
  // reguł w classifyMail).
  const status = kategoria === "reklama" ? "zignorowany" : "nowy";

  const id = randomUUID();
  const inserted = (await sql`
    INSERT INTO mail_messages (
      id, uid, kierunek, client_id, lead_id, from_addr, from_name, to_addr,
      subject, body_text, body_html, message_id, in_reply_to, refs, status, kategoria,
      list_unsubscribe, precedence, auto_submitted, received_at
    ) VALUES (
      ${id}, ${msg.uid}, 'in', ${clientId}, ${leadId}, ${msg.fromAddr}, ${msg.fromName}, ${msg.toAddr},
      ${msg.subject}, ${msg.bodyText}, ${msg.bodyHtml}, ${msg.messageId}, ${msg.inReplyTo}, ${msg.refs},
      ${status}, ${kategoria},
      ${msg.hints.listUnsubscribe}, ${msg.hints.precedence}, ${msg.hints.autoSubmitted},
      ${msg.receivedAt.toISOString()}
    )
    ON CONFLICT (message_id) DO NOTHING
    RETURNING id;
  `) as unknown as { id: string }[];

  // Pusty RETURNING = ON CONFLICT zadziałał, czyli znaliśmy już tę wiadomość.
  if (inserted.length === 0) return "duplicate";
  if (kategoria === "reklama") return "ignored";
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
