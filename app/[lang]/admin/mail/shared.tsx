"use client";

// Wzorem app/[lang]/admin/clients/shared.tsx — typy i czysta logika żyją w
// lib/mail.ts, tu tylko re-eksport dla komponentów klienckich + StatusTag
// specyficzny dla poczty.
//
// UWAGA: importujemy WYŁĄCZNIE z lib/mail.ts, nigdy z lib/mailbox.ts ani
// lib/mailSync.ts — tamte ciągną imapflow/nodemailer/bazę i wysadziłyby
// bundle przeglądarki.
export {
  type MailMessage,
  type MailMessageWithLinks,
  type MailStatus,
  type MailDirection,
  MAIL_STATUSES,
  MAIL_STATUS_LABEL,
  MAIL_STATUS_CLASS,
  MAIL_RETENTION_MONTHS,
  replySubject,
  extractEmailAddress,
} from "@/lib/mail";

export { CONTACT_CHANNEL_ICON, CONTACT_CHANNEL_CLASS } from "@/lib/contact";

import { MAIL_STATUS_CLASS, MAIL_STATUS_LABEL, type MailStatus } from "@/lib/mail";

/** Odznaka statusu wiadomości — ten sam kształt co StatusTag w innych
 * modułach (pigułka z kolorem z palety marki). */
export function MailStatusTag({ status }: { status: MailStatus }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] ${MAIL_STATUS_CLASS[status]}`}>
      {MAIL_STATUS_LABEL[status]}
    </span>
  );
}
