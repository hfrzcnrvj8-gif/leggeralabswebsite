// Moduł 4 (docs/plany-modulow/04-skrzynka-mailowa.md) — czysta warstwa poczty:
// typy, stałe i deterministyczne reguły. Świadomie BEZ importu bazy, IMAP-a i
// SMTP, żeby ten plik dało się importować także z komponentów "use client"
// (imapflow/nodemailer są node-only i wysadziłyby bundle przeglądarki).
// Ten sam podział co lib/contact.ts (czysty) vs lib/contactLookup.ts (dotyka
// bazy) — warstwa serwerowa poczty mieszka w lib/mailbox.ts.
//
// Zero AI: dopasowanie do klienta idzie po adresie nadawcy, a "do obsłużenia"
// wynika ze statusu wpisu — nic nie jest zgadywane z treści przez model.

export const MAIL_DIRECTIONS = ["in", "out"] as const;
export type MailDirection = (typeof MAIL_DIRECTIONS)[number];

/** Status wiadomości przychodzącej. "nowy" = wymaga reakcji (ląduje na
 * Pulpicie), "obsłużony" = odpisane albo ręcznie odhaczone, "zignorowany" =
 * wyciszony szum (newsletter/no-reply), patrz isNoiseAddress(). Wychodzące
 * zawsze zapisujemy jako "obsłużony" — własna odpowiedź nie jest zadaniem. */
export const MAIL_STATUSES = ["nowy", "obsłużony", "zignorowany"] as const;
export type MailStatus = (typeof MAIL_STATUSES)[number];

export const MAIL_STATUS_LABEL: Record<MailStatus, string> = {
  nowy: "Do odpowiedzi",
  obsłużony: "Obsłużony",
  zignorowany: "Zignorowany",
};

export const MAIL_STATUS_CLASS: Record<MailStatus, string> = {
  nowy: "bg-brand-gold/15 text-brand-gold",
  obsłużony: "bg-emerald-500/15 text-emerald-400",
  zignorowany: "bg-[var(--hairline)] text-muted",
};

export type MailMessage = {
  id: string;
  uid: number | null;
  kierunek: MailDirection;
  client_id: string | null;
  lead_id: string | null;
  invoice_id: string | null;
  from_addr: string;
  from_name: string;
  to_addr: string;
  subject: string;
  body_text: string;
  body_html: string;
  message_id: string;
  in_reply_to: string | null;
  refs: string | null;
  status: MailStatus;
  received_at: string;
  handled_at: string | null;
};

/** Wiadomość + rozwiązane nazwy powiązanych rekordów — kształt zwracany przez
 * GET /api/mail (lista) i GET /api/mail/[id] (podgląd). Nazwy dołącza serwer,
 * żeby lista nie musiała dociągać każdego klienta osobno. */
export type MailMessageWithLinks = MailMessage & {
  client_nazwa: string | null;
  lead_nazwa: string | null;
  invoice_numer: string | null;
};

/** Normalizacja adresu do porównań i dedupu: małe litery, bez białych znaków.
 * Świadomie NIE ruszamy kropek ani "+tagów" (to legalna część adresu u wielu
 * dostawców i dwa różne adresy mogą należeć do dwóch różnych osób) — lepiej
 * nie dopasować i wrzucić do "Nieprzypisane", niż przypisać maila do złego
 * klienta. */
export function normalizeEmail(addr: string): string {
  return (addr || "").trim().toLowerCase();
}

/** Wyciąga sam adres z nagłówka typu `Jan Kowalski <jan@firma.pl>` albo
 * `jan@firma.pl`. Zwraca "" gdy w środku nie ma nic, co wygląda na adres —
 * wtedy wiadomość i tak trafi do "Nieprzypisane", nic nie ginie. */
export function extractEmailAddress(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  const angled = s.match(/<([^<>]+)>/);
  const candidate = angled ? angled[1] : s;
  const m = candidate.match(/[^\s<>,;"']+@[^\s<>,;"']+\.[^\s<>,;"']+/);
  return m ? normalizeEmail(m[0]) : "";
}

/** Lokalna część adresu przed "@" — do reguł szumu poniżej. */
function localPart(addr: string): string {
  const a = normalizeEmail(addr);
  const i = a.indexOf("@");
  return i > 0 ? a.slice(0, i) : a;
}

/** Adresy, które z definicji nie są rozmową z człowiekiem — nie ma do kogo
 * odpisać, więc nie mają czego szukać na liście "do odpowiedzi". Świadomie
 * lista dopasowań na lokalnej części adresu, nie czytanie treści przez AI
 * (zasada modułu). Decyzja właściciela 2026-07-15: wyciszenie szumu wchodzi
 * do pierwszej wersji, żeby lista "do obsłużenia" miała tylko realne rozmowy. */
const NOISE_LOCAL_PARTS = [
  "no-reply",
  "noreply",
  "no_reply",
  "donotreply",
  "do-not-reply",
  "newsletter",
  "mailer-daemon",
  "postmaster",
  "bounce",
  "bounces",
  "notifications",
  "notification",
  "automated",
  "auto-confirm",
];

/** Czy adres wygląda na automat/newsletter (a więc: wyciszyć). Reguła jest
 * celowo konserwatywna — dopasowuje tylko jednoznaczne wzorce w lokalnej
 * części adresu. Wątpliwy mail lepiej pokazać jako "nowy" (właściciel go
 * odhaczy) niż ukryć realne zapytanie od klienta. */
export function isNoiseAddress(fromAddr: string): boolean {
  const lp = localPart(fromAddr);
  if (!lp) return false;
  return NOISE_LOCAL_PARTS.some((n) => lp === n || lp.startsWith(`${n}+`) || lp.startsWith(`${n}-`) || lp.startsWith(`${n}.`));
}

/** Temat odpowiedzi — dokłada "Re: " tylko jeśli go jeszcze nie ma (także dla
 * wariantów "RE:"/"Odp:"), żeby nie robić "Re: Re: Re:". */
export function replySubject(subject: string): string {
  const s = (subject || "").trim();
  if (!s) return "Re:";
  if (/^(re|odp)\s*:/i.test(s)) return s;
  return `Re: ${s}`;
}

/** Nagłówek `References` odpowiedzi wg RFC 5322: dotychczasowy łańcuch +
 * Message-ID wiadomości, na którą odpisujemy. To ono sprawia, że odpowiedź
 * wpada w ten sam wątek w Outlooku/Gmailu, zamiast zakładać nowy. */
export function buildReferences(original: { message_id: string; refs: string | null }): string {
  const prev = (original.refs || "").trim();
  const id = (original.message_id || "").trim();
  if (!id) return prev;
  if (!prev) return id;
  return `${prev} ${id}`;
}

/** Skrót treści na oś kontaktu klienta (wpis w client_activity to tylko
 * podsumowanie — pełny mail zostaje w mail_messages i jest linkowany). */
export function mailSummaryLine(subject: string, bodyText: string, maxLen = 160): string {
  const subj = (subject || "").trim() || "(bez tematu)";
  const firstLine = (bodyText || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  const base = firstLine ? `${subj} — ${firstLine}` : subj;
  return base.length > maxLen ? `${base.slice(0, maxLen - 1)}…` : base;
}

/** Retencja treści maili — decyzja właściciela 2026-07-15 (RODO): 24
 * miesiące. Starsze wiadomości kasuje dzienny cron (app/api/leads/notify);
 * oryginały i tak zostają na serwerze az.pl, panel jest tylko roboczą kopią.
 * Wartość MUSI zgadzać się z polityką prywatności — patrz PO_REJESTRACJI.md. */
export const MAIL_RETENTION_MONTHS = 24;
