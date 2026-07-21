// Moduł 4 (docs/plany-modulow/04-skrzynka-mailowa.md) — czysta warstwa poczty:
// typy, stałe i deterministyczne reguły. Świadomie BEZ importu bazy, IMAP-a i
// SMTP, żeby ten plik dało się importować także z komponentów "use client"
// (imapflow/nodemailer są node-only i wysadziłyby bundle przeglądarki).
// Ten sam podział co lib/contact.ts (czysty) vs lib/contactLookup.ts (dotyka
// bazy) — warstwa serwerowa poczty mieszka w lib/mailbox.ts.
//
// Zero AI: dopasowanie do klienta idzie po adresie nadawcy, a "do obsłużenia"
// wynika ze statusu wpisu — nic nie jest zgadywane z treści przez model.

import type { ClientStatus } from "./clients";
import { todayLocalISO, addDaysToISO, warsawWallTimeToUtcISO, warsawNowMinutes } from "./dates";

export const MAIL_DIRECTIONS = ["in", "out"] as const;
export type MailDirection = (typeof MAIL_DIRECTIONS)[number];

/** Realny folder na serwerze IMAP (Etap 2 Modułu 4b, 2026-07-16) —
 * niezależna oś od `kierunek` (in/out) i od `status` (nowy/obsłużony/
 * zignorowany): `folder` mówi GDZIE FIZYCZNIE leży wiadomość na serwerze,
 * `kierunek` czy ją wysłaliśmy czy dostaliśmy, `status` czy wymaga reakcji.
 * Drafts/Junk świadomie pominięte — poza zakresem tej sesji (patrz
 * docs/plany-modulow/04b-poczta-pelny-klient.md → Etap 2). */
export const MAIL_FOLDERS = ["inbox", "sent", "trash", "archive"] as const;
export type MailFolder = (typeof MAIL_FOLDERS)[number];

export const MAIL_FOLDER_LABEL: Record<MailFolder, string> = {
  inbox: "Odebrane",
  sent: "Wysłane",
  trash: "Kosz",
  archive: "Archiwum",
};

/* Ikony folderów: `<MailFolderIcon folder={…} />` w
 * `app/[lang]/admin/icons.tsx` (Moduł 33) — to chrome panelu, nie treść
 * wychodząca, więc wyjątek „w mailach emoji" ich nie dotyczy. Decyzja o
 * odróżnialnej sylwetce Wysłanych (dawniej samolocik ✈️ zamiast drugiej
 * tacki 📤) jest tam utrzymana i opisana. */

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
  /** Realny folder na serwerze IMAP — patrz komentarz przy MAIL_FOLDERS. */
  folder: MailFolder;
  client_id: string | null;
  lead_id: string | null;
  invoice_id: string | null;
  from_addr: string;
  from_name: string;
  to_addr: string;
  /** DW oryginalnej wiadomości (adresy po przecinku) — dociągane przy
   * pobraniu i, dla starszych wiadomości, przez backfillCc() (lib/mailSync.ts).
   * NULL = jeszcze nie sprawdzone (patrz kategoria: to samo rozróżnienie). */
  cc_addr: string | null;
  /** UDW wiadomości WYCHODZĄCEJ napisanej z panelu (adresy po przecinku) —
   * zapisane dla własnego wglądu właściciela, nigdy nie trafia do nagłówków
   * samego maila (patrz sendMail() w lib/mailbox.ts). NULL dla wiadomości
   * przychodzących i tych sprzed wprowadzenia tego pola. */
  bcc_addr: string | null;
  subject: string;
  body_text: string;
  body_html: string;
  message_id: string;
  in_reply_to: string | null;
  refs: string | null;
  status: MailStatus;
  /** null = wiersz sprzed wprowadzenia kategorii; uzupełni go
   * backfillCategories() przy najbliższym syncu (lib/mailSync.ts). */
  kategoria: MailCategory | null;
  /** URL/mailto wyciągnięty z nagłówka `List-Unsubscribe` (Moduł 4e) —
   * NULL = jeszcze nie sprawdzone, "" = nagłówek sprawdzony ale bez sensownego
   * linku, niepusty string = realny link do wypisania. Patrz
   * parseUnsubscribeUrl() niżej. */
  list_unsubscribe_url: string | null;
  /** Flaga "ważne" (Moduł 4e, runda 2) — TYLKO lokalna, nie synchronizuje się
   * z `\Flagged` po IMAP (świadoma decyzja właściciela, patrz lib/db.ts). */
  flagged: boolean;
  /** Wątek rozmowy (Moduł 4, Etap 3) — patrz resolveThreadId()
   * (lib/mailSync.ts) i komentarz przy kolumnie w lib/db.ts. NULL tylko dla
   * wierszy sprzed migracji, zanim backfillThreadIds() je dogoni. */
  thread_id: string | null;
  /** Snooze / Odłóż (Moduł 4, Etap 3) — NULL = nie odłożona. Termin w
   * przyszłości ukrywa wiadomość z "Do odpowiedzi"/"Nieprzypisane"; wraca
   * SAMA (bez crona) w chwili gdy `snooze_until <= now()`, bo widoczność
   * liczy się przy odczycie (patrz lib/db.ts). Zawsze pochodzi z NAZWANEJ
   * opcji (snoozeOptions() niżej) — nigdy z <input type="date">, patrz
   * CLAUDE.md. */
  snooze_until: string | null;
  /** Nudge/Follow-up (Moduł 4f) — ręczne wyciszenie POJEDYNCZEGO
   * przypominacza ("wiem że nie odpowie, przestań przypominać"), wzorem
   * snooze_until. NULL = nie wyciszony. W przeciwieństwie do snooze NIE
   * wraca samo z upływem czasu — jedyny sposób wyzerowania to wysłanie
   * KOLEJNEJ wiadomości w tym wątku (nowy reprezentant wątku ma własne,
   * puste pole), patrz getNudgeThreads() w lib/db.ts. */
  nudge_dismissed_at: string | null;
  received_at: string;
  handled_at: string | null;
};

/** Follow-up nudge (Moduł 4f, 2026-07-16) — "wysłałeś, cisza od N dni". Jeden
 * wpis NA WĄTEK, reprezentowany przez NAJNOWSZĄ wychodzącą wiadomość
 * (kierunek='out', folder='sent') bez ŻADNEJ odpowiedzi (kierunek='in') w
 * tym samym wątku, niezależnie od folderu odpowiedzi. Kształt zwracany przez
 * getNudgeThreads() (lib/db.ts) — WSPÓLNY dla zakładki „Bez odpowiedzi" w
 * panelu i dla dziennego digestu (app/api/leads/notify/route.ts), żeby obie
 * ścieżki zawsze zgadzały się co do tego, co liczy się jako nudge. */
export type NudgeThread = {
  /** Id reprezentatywnej wiadomości WYCHODZĄCEJ — do PATCH /api/mail/[id]
   * (wyciszenie) i otwarcia w podglądzie. */
  id: string;
  thread_id: string;
  to_addr: string;
  subject: string;
  /** Data wysłania reprezentatywnej wiadomości — liczba dni ciszy to
   * daysSinceISO(received_at) z lib/dates.ts. */
  received_at: string;
  client_id: string | null;
  lead_id: string | null;
  client_nazwa: string | null;
  lead_nazwa: string | null;
};

/** Próg dni ciszy zanim wątek trafi do nudge — stała w kodzie (nie
 * ustawienie w UI), zgodnie z resztą panelu (CLAUDE.md). Wartość z
 * oryginalnego briefu (docs/plany-modulow/04f-poczta-nudge.md), potwierdzona
 * z właścicielem przy starcie tej rundy. Zmiana wymaga edycji kodu. */
export const MAIL_NUDGE_DAYS = 5;

/** Screener nowych nadawców (Moduł 4, Etap 3) — status wpisu w `mail_senders`,
 * dołączany przez JOIN przy odczycie (nie zapisany na samej wiadomości), patrz
 * komentarz przy tabeli w lib/db.ts. */
export const MAIL_SENDER_STATUSES = ["pending", "approved", "blocked"] as const;
export type MailSenderStatus = (typeof MAIL_SENDER_STATUSES)[number];

/** Wiadomość + rozwiązane nazwy powiązanych rekordów — kształt zwracany przez
 * GET /api/mail (lista) i GET /api/mail/[id] (podgląd). Nazwy dołącza serwer,
 * żeby lista nie musiała dociągać każdego klienta osobno. */
export type MailMessageWithLinks = MailMessage & {
  /** Czy wiadomość ma załączniki (Faza 8) — denormalizacja pod ikonkę
   * spinacza na liście, żeby nie robić złączenia przy każdym odczycie
   * folderu. Sama LISTA plików przychodzi dopiero z GET /api/mail/[id]. */
  has_attachments?: boolean;
  /** Czy WĄTEK tej wiadomości jest wyciszony (Faza 8). Dołączane przy
   * odczycie listy i profilu — w bazie siedzi na `thread_id`, nie tutaj. */
  muted?: boolean;
  client_nazwa: string | null;
  lead_nazwa: string | null;
  invoice_numer: string | null;
  /** null = nadawca nigdy nie trafił do bramki (znany kontakt, poczta
   * wychodząca, albo wiadomość nie-'oferta') — patrz MAIL_SENDER_STATUSES. */
  sender_status: MailSenderStatus | null;
  /** Status klienta z tabeli `clients`, dołączany przy odczycie (Moduł 4,
   * Etap 3 — VIP). null = brak przypisanego klienta (lead/nieprzypisane/
   * poczta wychodząca). `status === 'Aktywny'` = VIP z automatu —
   * apple-mailowe "VIP bije klasyfikację treści" odtworzone jako:
   * dedykowana zakładka ignorująca `status`/`kategoria` wiadomości, patrz
   * MailDashboard.tsx. */
  client_status: ClientStatus | null;
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

/** Domena adresu (po "@"). */
function domainPart(addr: string): string {
  const a = normalizeEmail(addr);
  const i = a.indexOf("@");
  return i > 0 ? a.slice(i + 1) : "";
}

/** Nagłówki, po których poznajemy maila masowego. To sygnał ZE STANDARDU
 * (RFC 2919/3834 + konwencja `Precedence`), nie zgadywanie z nazwy — każdy
 * porządny newsletter musi dać `List-Unsubscribe`, a autorespondery
 * `Auto-Submitted`. Dlatego sprawdzamy je PRZED nazwą adresu. */
export type MailHeaderHints = {
  listUnsubscribe: boolean;
  precedence: string | null;
  autoSubmitted: string | null;
  /** Wartość linku z `List-Unsubscribe`, patrz parseUnsubscribeUrl() niżej.
   * Osobne od `listUnsubscribe` (bool) — ten sam nagłówek bywa OBECNY, ale
   * bez sensownego URL-a do sparsowania (np. tylko mailto bez adresu). */
  listUnsubscribeUrl: string | null;
};

/** Wyciąga link do wypisania z nagłówka `List-Unsubscribe` (RFC 2369/8058):
 * format `<https://...>, <mailto:...>`, jeden lub oba warianty w nawiasach
 * kątowych, oddzielone przecinkiem. Preferujemy `http(s)://` (otwiera się
 * jednym kliknięciem w przeglądarce), `mailto:` jest fallbackiem. Zwraca
 * null, gdy nagłówek jest pusty/nie do sparsowania — nigdy nie zgadujemy ani
 * nie konstruujemy URL-a samodzielnie. */
export function parseUnsubscribeUrl(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const candidates = [...headerValue.matchAll(/<([^<>]+)>/g)].map((m) => m[1].trim()).filter(Boolean);
  const http = candidates.find((u) => /^https?:\/\//i.test(u));
  if (http) return http;
  return candidates.find((u) => /^mailto:/i.test(u)) || null;
}

/** Adresy automatów. Historia: pierwsza wersja porównywała `startsWith`, przez
 * co przepuściła `jobalerts-noreply@linkedin.com` (właściciel zgłosił
 * 2026-07-15 — "noreply" jest tu na KOŃCU, po myślniku). Dlatego dziś tniemy
 * lokalną część na tokeny po `.`/`-`/`_`/`+` i szukamy dopasowania w każdym z
 * nich, a nie tylko na początku. */
const NOISE_TOKENS = new Set([
  "noreply",
  "donotreply",
  "newsletter",
  "newsletters",
  "mailerdaemon",
  "postmaster",
  "bounce",
  "bounces",
  "notification",
  "notifications",
  "automated",
  "autoconfirm",
  "jobalerts",
  "alerts",
  "mailer",
  "no",
]);

/** Tokeny lokalnej części adresu, ze sklejeniem separatorów: "no-reply" →
 * ["no","reply","noreply"], "jobalerts-noreply" → ["jobalerts","noreply",...].
 * Dzięki temu łapiemy zarówno "no-reply", jak i "noreply" jednym zestawem. */
function localTokens(addr: string): string[] {
  const lp = localPart(addr);
  if (!lp) return [];
  const parts = lp.split(/[.\-_+]/).filter(Boolean);
  return [...parts, parts.join(""), lp.replace(/[.\-_+]/g, "")];
}

/** Czy wiadomość to automat/masówka (a więc: wyciszyć — nie ma do kogo
 * odpisać). Kolejność sygnałów od najpewniejszego: nagłówki standardu →
 * nazwa adresu. Celowo konserwatywne przy nazwie: wątpliwy mail lepiej
 * pokazać jako "nowy" (właściciel odhaczy) niż ukryć realne zapytanie. */
export function isNoiseMail(fromAddr: string, hints?: MailHeaderHints): boolean {
  if (hints) {
    // Newsletter/lista dyskusyjna — RFC 2919/8058.
    if (hints.listUnsubscribe) return true;
    // "bulk"/"list"/"junk" = masówka. "auto_reply" też nie jest rozmową.
    const p = (hints.precedence || "").toLowerCase();
    if (p === "bulk" || p === "list" || p === "junk" || p === "auto_reply") return true;
    // RFC 3834: cokolwiek poza "no" oznacza wiadomość wygenerowaną automatem.
    const a = (hints.autoSubmitted || "").toLowerCase();
    if (a && a !== "no") return true;
  }
  const tokens = localTokens(fromAddr);
  if (tokens.some((t) => NOISE_TOKENS.has(t))) return true;
  // "no" samo w sobie jest zbyt ogólne, ale "no"+"reply" obok siebie już nie.
  return tokens.includes("no") && tokens.includes("reply");
}

/** Zachowane pod starą nazwą — używane tam, gdzie mamy sam adres, bez
 * nagłówków (np. ręczne sprawdzenie w UI). */
export function isNoiseAddress(fromAddr: string): boolean {
  return isNoiseMail(fromAddr);
}

/** Kategoria wiadomości — deterministyczna, po nadawcy/temacie/nagłówkach.
 * ZERO AI (zasada modułu): żaden model nie czyta treści i nie zgaduje typu.
 * Decyzja właściciela 2026-07-15: cztery kategorie + "inne". */
export const MAIL_CATEGORIES = ["reklama", "rachunek", "urzedowe", "oferta", "inne"] as const;
export type MailCategory = (typeof MAIL_CATEGORIES)[number];

export const MAIL_CATEGORY_LABEL: Record<MailCategory, string> = {
  reklama: "Reklama",
  rachunek: "Rachunek",
  urzedowe: "Urzędowe",
  oferta: "Zapytanie",
  inne: "Rozmowa",
};

/* Ikony kategorii: `<MailCategoryIcon kind={…} />` w
 * `app/[lang]/admin/icons.tsx` (Moduł 33) — chipy screenera to chrome panelu. */

export const MAIL_CATEGORY_CLASS: Record<MailCategory, string> = {
  reklama: "bg-[var(--hairline)] text-muted",
  rachunek: "bg-brand-gold/15 text-brand-gold",
  urzedowe: "bg-blue-500/15 text-blue-400",
  oferta: "bg-brand-cyan/15 text-brand-cyan",
  // Świadomie NIE brand-purple — to kolor tagu "Klient" w liście/podglądzie
  // (MailDashboard.tsx/MailDetailPanel.tsx); ten sam kolor dla obu mylił się
  // wizualnie (zgłoszone przez właściciela, 04e runda 4).
  inne: "bg-brand-pink/15 text-brand-pink",
};

/** Domeny spraw urzędowych/bankowych — maile stąd nie mogą ginąć w reklamach.
 * Dopasowanie po SUFIKSIE domeny, żeby łapać też subdomeny
 * (`powiadomienia.mbank.pl`), ale nie dało się podszyć przez
 * `zus.pl.oszust.com`. */
const OFFICIAL_DOMAINS = [
  "zus.pl",
  "gov.pl",
  "podatki.gov.pl",
  "mf.gov.pl",
  "ceidg.gov.pl",
  "biznes.gov.pl",
  "mbank.pl",
  "ing.pl",
  "pkobp.pl",
  "santander.pl",
  "bankmillennium.pl",
  "aliorbank.pl",
  "pekao.com.pl",
  "bnpparibas.pl",
  "revolut.com",
  "wise.com",
];

function isOfficialDomain(fromAddr: string): boolean {
  const d = domainPart(fromAddr);
  if (!d) return false;
  return OFFICIAL_DOMAINS.some((o) => d === o || d.endsWith(`.${o}`));
}

/** Temat wyglądający na dokument księgowy. `\b` przy FV, żeby nie łapać
 * przypadkowych słów zawierających te litery. */
const INVOICE_SUBJECT = /\b(faktura|faktury|fakturę|rachunek|rachunki|invoice|\d*\s*FV[\s/-]|nota\s+ksi[eę]gowa|paragon|duplikat\s+faktury)\b/i;

/**
 * Czy to raport, który panel wysłał SAM DO SIEBIE.
 *
 * Raport dzienny (`/api/leads/notify`) i przypomnienia idą na `NOTIFY_TO`,
 * czyli na tę samą skrzynkę, którą synchronizujemy — wracają więc jako zwykły
 * przychodzący mail ze statusem 'nowy'. A `hub/today` liczy każdy taki mail
 * jako „pocztę do obsługi".
 *
 * Skutek, złapany dopiero 2026-07-21 na telefonie właściciela: **licznik spraw
 * rósł o jeden każdego ranka o 8:00** — za mail, który jest wyłącznie
 * powiadomieniem o tym liczniku. Na dwie pozycje Pulpitu jedną stanowił jego
 * własny raport. Audyt tego nie widział, bo dev-baza nie ma skrzynki IMAP.
 *
 * Rozpoznajemy po OBU warunkach naraz — sam prefiks nie wystarczy, bo klient
 * też może napisać „[Panel] nie działa mi logowanie" i taki mail musi zostać
 * „nowy".
 */
export function isSelfReport(fromAddr: string, subject: string, ownAddr: string): boolean {
  const from = (fromAddr || "").trim().toLowerCase();
  const own = (ownAddr || "").trim().toLowerCase();
  if (!own || !from || from !== own) return false;
  return /^\s*\[panel\]/i.test(subject || "");
}

/**
 * Do jakiej szufladki trafia wiadomość. Kolejność reguł to hierarchia
 * ważności, nie przypadek:
 *  1. urzędowe — ZUS/US/bank mają pierwszeństwo NAWET nad masówką, bo bank
 *     wysyła powiadomienia z `List-Unsubscribe`, a takiego maila nie wolno
 *     wrzucić do "reklama" i uciszyć,
 *  2. rachunek — faktura od dostawcy bywa masówką z automatu, a i tak jest
 *     ważna (pomost do modułu Koszty),
 *  3. reklama — dopiero teraz reszta masówki,
 *  4. oferta — nieznany nadawca, który NIE jest robotem = potencjalny klient,
 *  5. inne — znany klient/lead piszący normalnego maila.
 */
export function classifyMail(params: {
  fromAddr: string;
  subject: string;
  hints?: MailHeaderHints;
  knownContact: boolean;
}): MailCategory {
  if (isOfficialDomain(params.fromAddr)) return "urzedowe";
  if (INVOICE_SUBJECT.test(params.subject || "")) return "rachunek";
  if (isNoiseMail(params.fromAddr, params.hints)) return "reklama";
  if (!params.knownContact) return "oferta";
  return "inne";
}

/** Temat odpowiedzi — dokłada "Re: " tylko jeśli go jeszcze nie ma (także dla
 * wariantów "RE:"/"Odp:"), żeby nie robić "Re: Re: Re:". */
export function replySubject(subject: string): string {
  const s = (subject || "").trim();
  if (!s) return "Re:";
  if (/^(re|odp)\s*:/i.test(s)) return s;
  return `Re: ${s}`;
}

/** Temat przekazania — analogicznie do replySubject(), ale z "Fwd: "
 * ("Fw:"/"Przekaż:" też uznajemy za już-oznaczone, żeby nie dublować przy
 * wielokrotnym przekazywaniu). */
export function forwardSubject(subject: string): string {
  const s = (subject || "").trim();
  if (!s) return "Fwd:";
  if (/^(fwd?|przeka[zż])\s*:/i.test(s)) return s;
  return `Fwd: ${s}`;
}

/** Odwrotność replySubject()/forwardSubject() — zdejmuje WSZYSTKIE prefiksy
 * Re:/Odp:/Fwd:/Fw:/Przekaż: naraz (temat bywa "Odp: Fwd: Temat" po kilku
 * rundach), do dopasowania wątku po temacie w resolveThreadId()
 * (lib/mailSync.ts, fallback gdy References/In-Reply-To nic nie znajdą). */
export function normalizeThreadSubject(subject: string): string {
  let s = (subject || "").trim();
  while (/^(re|odp|fwd?|przeka[zż])\s*:\s*/i.test(s)) {
    s = s.replace(/^(re|odp|fwd?|przeka[zż])\s*:\s*/i, "").trim();
  }
  return s.toLowerCase();
}

/** Rozbija pole "DW"/"Do" wpisane ręcznie (adresy po przecinku/średniku) na
 * listę poprawnych adresów — współdzielone przez odpowiedź/przekazanie/nową
 * wiadomość, żeby nie duplikować tego samego parsowania w każdej trasie. */
export function parseAddressList(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((s) => extractEmailAddress(s))
    .filter(Boolean);
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

/** Zamienia to, co właściciel wpisał, na bezpieczny HTML: escape'uje znaki
 * specjalne (żeby "&lt;" w treści nie stał się tagiem) i zamienia entery na
 * &lt;br /&gt;. Świadomie NIE parsujemy markdownu — właściciel pisze zwykły
 * tekst, a każda "inteligentna" zamiana to niespodzianka w wysłanym mailu.
 * Współdzielone przez odpowiedź/przekazanie/nową wiadomość. */
export function textToHtml(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:22px;color:#141414;white-space:pre-wrap;">${esc}</div>`;
}

/** Blok nagłówka przekazanej wiadomości — wzorem Gmaila/Outlooka
 * ("---------- Wiadomość przekazana ----------"). Współdzielony przez
 * tekstową i HTML-ową wersję maila przekazania. */
function forwardHeaderLines(original: { fromName: string; fromAddr: string; receivedAt: string; subject: string; toAddr: string }): string[] {
  const from = original.fromName ? `${original.fromName} <${original.fromAddr}>` : original.fromAddr;
  const date = new Date(original.receivedAt).toLocaleString("pl-PL", { dateStyle: "long", timeStyle: "short" });
  return [
    `Od: ${from}`,
    `Data: ${date}`,
    `Temat: ${original.subject || "(bez tematu)"}`,
    `Do: ${original.toAddr || "—"}`,
  ];
}

export function forwardHeaderText(original: { fromName: string; fromAddr: string; receivedAt: string; subject: string; toAddr: string }): string {
  return ["---------- Wiadomość przekazana ----------", ...forwardHeaderLines(original), ""].join("\n");
}

/** Wersja HTML nagłówka przekazania + cytowana treść w blockquote (obramowanie
 * po lewej, jak w każdym normalnym kliencie pocztowym) — `quotedHtml` MUSI być
 * już odkażony (sanitizeMailHtml w lib/mailHtml.ts), bo to obcy kod HTML. */
export function forwardHtml(
  original: { fromName: string; fromAddr: string; receivedAt: string; subject: string; toAddr: string },
  quotedHtml: string
): string {
  const lines = forwardHeaderLines(original)
    .map((l) => `<div>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`)
    .join("");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;line-height:20px;color:#4A4A4A;margin-bottom:12px;">---------- Wiadomość przekazana ----------${lines}</div><blockquote style="margin:0;padding-left:12px;border-left:2px solid #E6E3DD;">${quotedHtml}</blockquote>`;
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

/** Załączniki WYCHODZĄCE (Etap 1 Modułu 4b, druga runda) — TYLKO wysyłka, w
 * pamięci serwera na czas jednego żądania, NIGDY zapisywane w Postgresie.
 * Załączniki PRZYCHODZĄCE to osobna sprawa i osobne stałe — patrz niżej
 * (Faza 8, 2026-07-20): w bazie leżą wyłącznie METADANE, treść ściągamy
 * z IMAP na żądanie.
 * Limity dobrane z marginesem pod platformowy pułap treści żądania Vercel
 * Functions (Node.js runtime, ok. 4.5 MB, niekonfigurowalny) — zweryfikuj
 * aktualną wartość przed podnoszeniem tych stałych. */
export const MAIL_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "application/zip",
] as const;

export const MAIL_ATTACHMENT_MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB/plik
export const MAIL_ATTACHMENT_MAX_TOTAL_BYTES = 4 * 1024 * 1024; // 4 MB łącznie

/* ── Załączniki PRZYCHODZĄCE (Faza 8, 2026-07-20) ─────────────────────────
 *
 * Decyzja właściciela: w bazie trzymamy WYŁĄCZNIE metadane (nazwa, typ,
 * rozmiar, numer części MIME), a treść ściągamy z IMAP dopiero przy
 * kliknięciu. Powód jest kosztowy: Neon liczy za rozmiar bazy, skrzynka
 * z PDF-ami puchnie nieodwracalnie, a 99 % załączników nigdy nie zostanie
 * otwartych. Świadomie zaakceptowana cena: brak offline, kilka sekund na
 * otwarcie i to, że załącznik znika razem z mailem skasowanym ze skrzynki.
 *
 * NIE zamieniaj tego na magazyn plików ani base64 bez pytania właściciela —
 * to cofnięcie jego decyzji, nie usprawnienie. */

/** Jeden załącznik przychodzący — sam OPIS, bez bajtów treści. */
export type MailAttachment = {
  id: string;
  message_id: string;
  /** Nazwa pliku po odkażeniu (patrz safeAttachmentFilename). */
  filename: string;
  mime: string;
  size_bytes: number;
  /** Numer części MIME wg IMAP-a ("2", "3.1") — po nim ściągamy treść.
   * Bierze się z BODYSTRUCTURE, NIE z mailparsera (ten go nie zwraca). */
  part_id: string;
};

/** Górny próg pobrania załącznika przez trasę serverless.
 *
 * Odpowiedź funkcji na Vercelu ma platformowy pułap; plik 30 MB przez nią
 * nie przejdzie. Zamiast wiecznego spinnera pokazujemy wprost, że pliku nie
 * da się otworzyć w panelu — jest w skrzynce i zawsze można go wziąć
 * stamtąd. Metadane zapisujemy NIEZALEŻNIE od tego progu: właściciel ma
 * wiedzieć, że załącznik istnieje, nawet gdy go tu nie otworzy. */
export const MAIL_INCOMING_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Odkaża nazwę pliku, zanim trafi do nagłówka `Content-Disposition`.
 *
 * Trzy osobne zagrożenia, każde realne:
 * 1. Znaki ścieżki (`../`, `/`, `\`) — nazwa bywa używana przy zapisie na
 *    dysk po stronie klienta.
 * 2. Znaki sterujące i cudzysłowy — rozbijają sam nagłówek HTTP
 *    (wstrzyknięcie kolejnych pól przez CR/LF).
 * 3. Podwójne rozszerzenie w rodzaju `faktura.pdf.exe` — nazwy NIE
 *    przepisujemy (to byłoby kłamstwo o zawartości), ale nagłówek zawsze
 *    idzie z `attachment`, nigdy `inline`, więc nic się samo nie uruchomi.
 */
export function safeAttachmentFilename(raw: string): string {
  const bezSciezki = (raw || "").replace(/[\\/]+/g, "_");
  const czysta = bezSciezki
    // eslint-disable-next-line no-control-regex -- właśnie o znaki sterujące chodzi
    .replace(/[\x00-\x1f\x7f"]/g, "")
    .replace(/^\.+/, "") // ukrycie pliku i ".." na starcie nazwy
    .trim();
  const przycieta = czysta.slice(0, 200);
  return przycieta || "zalacznik";
}

/** Jeden nadawca masówki na ekranie „Subskrypcje" (Faza 8). */
export type MailSubscription = {
  from_addr: string;
  from_name: string | null;
  /** Adres wypisania z nagłówka List-Unsubscribe. `null` = nadawca nie podał
   * żadnego — wtedy zostaje samo posprzątanie skrzynki. */
  unsubscribe_url: string | null;
  ile: number;
  ostatnia: string;
};

/** Rozmiar po ludzku — do etykiety przy pliku ("2,4 MB"). */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** Retencja treści maili — decyzja właściciela 2026-07-15 (RODO): 24
 * miesiące. Starsze wiadomości kasuje dzienny cron (app/api/leads/notify);
 * oryginały i tak zostają na serwerze az.pl, panel jest tylko roboczą kopią.
 * Wartość MUSI zgadzać się z polityką prywatności — patrz PO_REJESTRACJI.md. */
export const MAIL_RETENTION_MONTHS = 24;

/** Snooze / Odłóż (Moduł 4, Etap 3) — nazwane terminy, NIGDY kalendarz
 * (CLAUDE.md, pułapka <input type="date">). Czysta funkcja opcji dostępnych
 * "teraz" — świadomie parametryzowana `now` (testowalność), domyślnie
 * prawdziwy zegar. Każda opcja niesie GOTOWY docelowy ISO — UI tylko
 * renderuje etykiety i wysyła wybraną wartość, nie liczy nic samo. */
export type SnoozeOptionId = "later_today" | "tomorrow_morning" | "this_weekend" | "next_week";
export type SnoozeOption = { id: SnoozeOptionId; label: string; targetIso: string };

const SNOOZE_LATER_TODAY_CUTOFF_MIN = 16 * 60; // po 16:00 "Później dziś" nie ma sensu

export function snoozeOptions(now: Date = new Date()): SnoozeOption[] {
  const today = todayLocalISO();
  const nowMin = warsawNowMinutes(now);
  const [y, m, d] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Nd..6=Sob

  const options: SnoozeOption[] = [];
  if (nowMin < SNOOZE_LATER_TODAY_CUTOFF_MIN) {
    options.push({ id: "later_today", label: "Później dziś (18:00)", targetIso: warsawWallTimeToUtcISO(today, "18:00") });
  }
  options.push({
    id: "tomorrow_morning",
    label: "Jutro rano (8:00)",
    targetIso: warsawWallTimeToUtcISO(addDaysToISO(today, 1), "8:00"),
  });
  // "Ten weekend" — tylko pon-czw (1-4): w piątek/weekend byłby "za rogiem"
  // albo już minął, myli się z "Jutro".
  if (weekday >= 1 && weekday <= 4) {
    const sat = addDaysToISO(today, 6 - weekday);
    options.push({ id: "this_weekend", label: "Ten weekend (sobota 9:00)", targetIso: warsawWallTimeToUtcISO(sat, "9:00") });
  }
  // Najbliższy poniedziałek ŚCIŚLE po dziś (nawet gdy dziś jest poniedziałek
  // — to ma być odległy termin, nie "za chwilę").
  const daysToNextMonday = ((1 - weekday + 7) % 7) || 7;
  options.push({
    id: "next_week",
    label: "Przyszły tydzień (poniedziałek 8:00)",
    targetIso: warsawWallTimeToUtcISO(addDaysToISO(today, daysToNextMonday), "8:00"),
  });
  return options;
}

/** Jeden nazwany termin wysyłki odłożonej (Faza 8). */
export type SendLaterOption = { id: string; label: string; targetIso: string };

/**
 * Nazwane terminy wysyłki odłożonej — ten sam duch co snoozeOptions() wyżej:
 * właściciel WYBIERA z listy, nigdy nie wpisuje daty ręcznie (pułapka
 * `<input type="date">` z rokiem „0202", CLAUDE.md).
 *
 * Godziny są celowo „ludzkie" (8:00, 9:00), a nie co do minuty — bo i tak
 * nie umiemy obiecać minuty. Cron na Vercelu chodzi raz dziennie, a resztę
 * dowozi ruszanie kolejki przy wejściu w Pocztę (patrz
 * app/api/mail/outbox/run). Deklarowana godzina to NAJWCZEŚNIEJSZY moment
 * wysyłki — UI ma to mówić wprost, patrz opisTerminuWysylki().
 */
export function sendLaterOptions(now: Date = new Date()): SendLaterOption[] {
  const today = todayLocalISO();
  const nowMin = warsawNowMinutes(now);
  const [y, m, d] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Nd..6=Sob

  const options: SendLaterOption[] = [];

  // „Dziś o 17:00" tylko wtedy, gdy realnie jest jeszcze przed 17:00 —
  // inaczej opcja obiecywałaby termin, który już minął.
  if (nowMin < 17 * 60) {
    options.push({ id: "today_afternoon", label: "Dziś po południu (17:00)", targetIso: warsawWallTimeToUtcISO(today, "17:00") });
  }
  options.push({
    id: "tomorrow_morning",
    label: "Jutro rano (8:00)",
    targetIso: warsawWallTimeToUtcISO(addDaysToISO(today, 1), "8:00"),
  });

  // Poniedziałek ŚCIŚLE po dziś — „na początku tygodnia" ma być odległym
  // terminem także wtedy, gdy dziś jest poniedziałek.
  const daysToNextMonday = ((1 - weekday + 7) % 7) || 7;
  options.push({
    id: "next_week",
    label: "Poniedziałek rano (8:00)",
    targetIso: warsawWallTimeToUtcISO(addDaysToISO(today, daysToNextMonday), "8:00"),
  });
  return options;
}

/** Waliduje `snoozeUntil` z PATCH /api/mail/[id] — wartość ZAWSZE pochodzi z
 * jednej z opcji snoozeOptions() (obliczonej przez klienta), nigdy nie jest
 * wpisywana ręcznie — stąd inna walidacja niż isPlausibleDateString() w
 * lib/projects.ts (ta chroni <input type="date"> przed niepełnym rokiem przy
 * utracie fokusu; tu nie ma pola tekstowego). Mimo to sprawdzamy sensowność,
 * bo endpoint jest wywoływalny bezpośrednio. */
export function isPlausibleTimestamp(s: string): boolean {
  const t = Date.parse(s);
  if (Number.isNaN(t)) return false;
  const year = new Date(t).getUTCFullYear();
  return year >= 2000 && year <= 2100;
}
