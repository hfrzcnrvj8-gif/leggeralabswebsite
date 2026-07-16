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

export const MAIL_FOLDER_ICON: Record<MailFolder, string> = {
  inbox: "📥",
  sent: "📤",
  trash: "🗑️",
  archive: "🗄️",
};

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

export const MAIL_CATEGORY_ICON: Record<MailCategory, string> = {
  reklama: "📢",
  rachunek: "🧾",
  urzedowe: "🏛️",
  oferta: "✨",
  inne: "💬",
};

export const MAIL_CATEGORY_CLASS: Record<MailCategory, string> = {
  reklama: "bg-[var(--hairline)] text-muted",
  rachunek: "bg-brand-gold/15 text-brand-gold",
  urzedowe: "bg-blue-500/15 text-blue-400",
  oferta: "bg-brand-cyan/15 text-brand-cyan",
  inne: "bg-brand-purple/15 text-brand-purple",
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

/** Retencja treści maili — decyzja właściciela 2026-07-15 (RODO): 24
 * miesiące. Starsze wiadomości kasuje dzienny cron (app/api/leads/notify);
 * oryginały i tak zostają na serwerze az.pl, panel jest tylko roboczą kopią.
 * Wartość MUSI zgadzać się z polityką prywatności — patrz PO_REJESTRACJI.md. */
export const MAIL_RETENTION_MONTHS = 24;
