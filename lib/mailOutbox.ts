// Faza 8 (2026-07-20) — wysyłka odłożona („wyślij o 8:00").
//
// Osobno od route'ów, bo tę samą funkcję wołają DWA wejścia: cron
// (app/api/mail/outbox/run) i ręczne „wyślij teraz" z panelu. Ten sam podział
// co lib/mailSync.ts wobec /api/mail/sync.
//
// Zero AI: o tym, co i kiedy poleci, decyduje wyłącznie data wpisana przez
// właściciela i porównanie jej z zegarem.
import { randomUUID } from "node:crypto";
import { getSql, ensureMailOutboxSchema } from "./db";
import { mailSummaryLine, textToHtml } from "./mail";
import { findContactsByEmail } from "./contactLookup";
import { appendToSent, fetchSignatureImages, isMailboxConfigured, sendMail } from "./mailbox";
import { logMailOnTimeline } from "./mailSync";
import { signatureHtml, signatureText } from "./mailSignature";
import { getBookingUrl } from "./site";
import { i18n, type Locale } from "@/i18n/config";

export type OutboxRow = {
  id: string;
  to_addr: string;
  cc_addr: string;
  bcc_addr: string;
  subject: string;
  body_text: string;
  in_reply_to: string | null;
  refs: string | null;
  jezyk: string;
  send_at: string;
  /** 'sending' to stan PRZEJŚCIOWY — wiersz zaklepany przez przebieg, który
   * właśnie go wysyła. Widoczny w kolejce jako „wysyłanie…". */
  status: "queued" | "sending" | "sent" | "failed" | "cancelled";
  error: string | null;
  warnings: string | null;
  sent_at: string | null;
  created_at: string;
};

/** Ile najwyżej wiadomości bierze jeden przebieg crona.
 *
 * Wysyłka to pełne łączenie SMTP + APPEND do Sent — kilka sekund na sztukę.
 * Bez tego ogranicznika kolejka, która z jakiegoś powodu urosła, przekroczyłaby
 * czas funkcji i NIE wysłałaby nic, zamiast wysłać choć część. Reszta poczeka
 * na kolejny przebieg. */
const MAX_NA_PRZEBIEG = 5;

/**
 * Wysyła JEDNĄ wiadomość z kolejki i odnotowuje wynik.
 *
 * **Kolejność jest tu regułą bezpieczeństwa, nie stylem.** Wysyłka jest
 * nieodwracalna, więc idzie pierwsza; wszystko po niej (kopia w Sent, wiersz
 * w panelu, wpis na oś kontaktu) degraduje do ostrzeżenia. Ta sama zasada, co
 * w /api/mail/compose i /api/mail/[id]/reply.
 *
 * **Pod żadnym pozorem nie ponawiamy po ostrzeżeniu** — mail już poleciał,
 * a ponowienie wysłałoby go drugi raz do klienta. Status 'sent' ustawiamy
 * NATYCHMIAST po udanym SMTP, jeszcze przed zapisami pobocznymi, żeby wyjątek
 * w którymkolwiek z nich nie zostawił wiersza w 'queued' — taki wiersz cron
 * wziąłby ponownie przy następnym przebiegu.
 */
export async function sendQueuedMail(row: OutboxRow): Promise<{ ok: boolean; warnings: string[] }> {
  const sql = getSql();
  const to = row.to_addr.split(",").map((s) => s.trim()).filter(Boolean);
  const cc = row.cc_addr.split(",").map((s) => s.trim()).filter(Boolean);
  const bcc = row.bcc_addr.split(",").map((s) => s.trim()).filter(Boolean);

  if (to.length === 0) {
    await sql`UPDATE mail_outbox SET status = 'failed', error = 'Brak adresu odbiorcy.' WHERE id = ${row.id};`;
    return { ok: false, warnings: [] };
  }

  const podpis = (i18n.locales as readonly string[]).includes(row.jezyk) ? (row.jezyk as Locale) : null;
  const bookingUrl = podpis ? getBookingUrl(podpis) : "";
  const fullText = podpis ? `${row.body_text}\n\n${signatureText(podpis, bookingUrl)}` : row.body_text;
  const fullHtml = podpis ? `${textToHtml(row.body_text)}<br />${signatureHtml(podpis, bookingUrl)}` : undefined;
  const inlineImages = podpis ? await fetchSignatureImages() : [];

  let sent: { messageId: string; raw: string };
  try {
    sent = await sendMail({
      to,
      cc,
      bcc,
      subject: row.subject,
      text: fullText,
      html: fullHtml,
      inlineImages,
      inReplyTo: row.in_reply_to,
      references: row.refs,
    });
  } catch (e) {
    // Nieudana wysyłka ZOSTAJE w kolejce ze statusem 'failed' — z widocznym
    // powodem. Cichy powrót do 'queued' zapętliłby próby przy stale
    // niedziałającej skrzynce; właściciel ma zobaczyć, że coś nie poszło,
    // i zdecydować sam.
    const message = e instanceof Error ? e.message : "Nieznany błąd wysyłki.";
    console.error(`[mailOutbox] wysyłka ${row.id} nie powiodła się`, e);
    await sql`UPDATE mail_outbox SET status = 'failed', error = ${message} WHERE id = ${row.id};`;
    return { ok: false, warnings: [] };
  }

  // Od tego miejsca mail JUŻ poleciał.
  await sql`UPDATE mail_outbox SET status = 'sent', sent_at = now(), error = NULL WHERE id = ${row.id};`;

  const warnings: string[] = [];

  const appended = await appendToSent(sent.raw).catch((e) => {
    console.error(`[mailOutbox] APPEND do Sent nie powiódł się (${row.id})`, e);
    return false;
  });
  if (!appended) {
    warnings.push("Wiadomość wysłana, ale nie udało się dopisać kopii do folderu Sent.");
  }

  try {
    const match = (await findContactsByEmail(to[0]))[0];
    const clientId = match?.type === "client" ? match.id : null;
    const leadId = match?.type === "lead" ? match.id : null;
    const mailId = randomUUID();

    // Odłożona ODPOWIEDŹ zostaje w wątku oryginału; odłożona nowa wiadomość
    // zakłada własny (self-rooted) — dokładnie jak przy wysyłce od ręki.
    const threadId = row.refs?.split(/\s+/)[0] || row.in_reply_to || sent.messageId;

    await sql`
      INSERT INTO mail_messages (
        id, kierunek, folder, client_id, lead_id, from_addr, to_addr, cc_addr, bcc_addr,
        subject, body_text, message_id, in_reply_to, refs, thread_id, status, received_at, handled_at
      ) VALUES (
        ${mailId}, 'out', 'sent', ${clientId}, ${leadId},
        '', ${to.join(", ")}, ${cc.join(", ")}, ${bcc.join(", ")}, ${row.subject}, ${row.body_text},
        ${sent.messageId}, ${row.in_reply_to}, ${row.refs}, ${threadId},
        'obsłużony', now(), now()
      )
      ON CONFLICT (message_id) DO NOTHING;
    `;

    if (match) {
      await logMailOnTimeline(sql, {
        mailId,
        match,
        text: mailSummaryLine(row.subject, row.body_text),
        kierunek: "wychodzacy",
      });
    }
  } catch (e) {
    console.error(`[mailOutbox] zapis wysłanej wiadomości ${row.id} nie powiódł się`, e);
    warnings.push("Wiadomość wysłana, ale nie udało się zapisać jej w panelu.");
  }

  if (warnings.length > 0) {
    await sql`UPDATE mail_outbox SET warnings = ${warnings.join(" ")} WHERE id = ${row.id};`;
  }

  return { ok: true, warnings };
}

/**
 * Wysyła wszystko, czego termin już minął. Woła to cron.
 *
 * `send_at <= now()` (nie równość) — przebieg, który z jakiegokolwiek powodu
 * się nie odbył, ma nadrobić zaległości przy następnym, a nie zostawić maila
 * w kolejce na zawsze.
 */
export async function runDueOutbox(): Promise<{ wyslane: number; nieudane: number }> {
  if (!isMailboxConfigured()) return { wyslane: 0, nieudane: 0 };

  await ensureMailOutboxSchema();
  const sql = getSql();

  // ZAKLEPUJEMY wiersze jednym atomowym UPDATE-em, zamiast najpierw je
  // wybierać, a potem wysyłać. Bez tego dwa nakładające się przebiegi crona
  // (albo cron + ręczne „wyślij teraz") pobrałyby ten sam wiersz i wysłały
  // maila DWA RAZY do klienta — a tego nie da się cofnąć.
  //
  // `FOR UPDATE SKIP LOCKED` sprawia, że drugi przebieg nie czeka na pierwszy,
  // tylko po prostu bierze inne wiersze albo nic.
  const due = (await sql`
    UPDATE mail_outbox SET status = 'sending'
    WHERE id IN (
      SELECT id FROM mail_outbox
      WHERE status = 'queued' AND send_at <= now()
      ORDER BY send_at ASC
      LIMIT ${MAX_NA_PRZEBIEG}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
  `) as unknown as OutboxRow[];

  let wyslane = 0;
  let nieudane = 0;
  for (const row of due) {
    const res = await sendQueuedMail(row);
    if (res.ok) wyslane++;
    else nieudane++;
  }

  return { wyslane, nieudane };
}
