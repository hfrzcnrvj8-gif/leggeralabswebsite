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
  type MailCategory,
  type MailFolder,
  type MailSenderStatus,
  MAIL_STATUSES,
  MAIL_STATUS_LABEL,
  MAIL_STATUS_CLASS,
  MAIL_CATEGORIES,
  MAIL_CATEGORY_LABEL,
  MAIL_CATEGORY_ICON,
  MAIL_CATEGORY_CLASS,
  MAIL_FOLDERS,
  MAIL_FOLDER_LABEL,
  MAIL_FOLDER_ICON,
  MAIL_RETENTION_MONTHS,
  replySubject,
  forwardSubject,
  extractEmailAddress,
} from "@/lib/mail";

export { CONTACT_CHANNEL_ICON, CONTACT_CHANNEL_CLASS } from "@/lib/contact";

// Podpisy — tylko stałe (nazwy języków). Sam generator HTML-a
// (signatureHtml) zostaje po stronie serwera: nie ma po co wysyłać do
// przeglądarki kodu, który i tak składa maila w API.
export { SIGNATURE_LANGS, SIGNATURE_LANG_LABEL } from "@/lib/mailSignature";
export type { Locale as SignatureLang } from "@/i18n/config";

import {
  MAIL_STATUS_CLASS,
  MAIL_STATUS_LABEL,
  MAIL_CATEGORY_CLASS,
  MAIL_CATEGORY_ICON,
  MAIL_CATEGORY_LABEL,
  type MailCategory,
  type MailStatus,
} from "@/lib/mail";

/** Odznaka statusu wiadomości — ten sam kształt co StatusTag w innych
 * modułach (pigułka z kolorem z palety marki). */
export function MailStatusTag({ status }: { status: MailStatus }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] ${MAIL_STATUS_CLASS[status]}`}>
      {MAIL_STATUS_LABEL[status]}
    </span>
  );
}

/** Odznaka kategorii (reklama/rachunek/urzędowe/zapytanie/rozmowa). Kategorię
 * wylicza deterministycznie classifyMail() w lib/mail.ts — bez AI. */
export function MailCategoryTag({ kategoria }: { kategoria: MailCategory | string }) {
  const k = (MAIL_CATEGORY_LABEL as Record<string, string>)[kategoria] ? (kategoria as MailCategory) : "inne";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${MAIL_CATEGORY_CLASS[k]}`}>
      <span aria-hidden>{MAIL_CATEGORY_ICON[k]}</span>
      {MAIL_CATEGORY_LABEL[k]}
    </span>
  );
}
