// Moduł 4 — warstwa serwerowa poczty: rozmowa z realną skrzynką az.pl przez
// IMAP (odczyt) i SMTP (wysyłka). Tylko server-side (imapflow/nodemailer to
// TCP, nie Edge) — czyste typy i reguły mieszkają w lib/mail.ts, który wolno
// importować z UI. Ten sam podział co lib/contact.ts vs lib/contactLookup.ts.
//
// Świadomie CIENKA warstwa: łączy się, czyta/wysyła, rozłącza. Dopasowanie do
// klienta, dedup i zapis do bazy robi wołający (app/api/mail/sync), żeby ten
// plik dało się przetestować w oderwaniu od bazy — i żeby dev bez dostępu do
// skrzynki mógł go po prostu nie wołać.
import { randomUUID } from "node:crypto";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { extractEmailAddress, parseUnsubscribeUrl, safeAttachmentFilename, type MailHeaderHints } from "./mail";
import { parseCalendarReply, type CalendarReply } from "./eventInvites";
import { SIGNATURE_IMAGES } from "./mailSignature";
import { siteUrl } from "./site";

/** Jedna sparsowana wiadomość — surowa, jeszcze nie dopasowana do klienta. */
export type FetchedMessage = {
  uid: number;
  fromAddr: string;
  fromName: string;
  toAddr: string;
  /** DW — adresy po przecinku, "" gdy brak. Potrzebne do "Odpowiedz wszystkim" */
  ccAddr: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  messageId: string;
  inReplyTo: string | null;
  refs: string | null;
  receivedAt: Date;
  /** Sygnały ze standardowych nagłówków: czy to masówka/automat. Patrz
   * isNoiseMail() w lib/mail.ts — pewniejsze niż zgadywanie z nazwy adresu. */
  hints: MailHeaderHints;
  /** Załączniki — SAM OPIS, bez bajtów (Faza 8). Treść ściągamy z IMAP
   * dopiero na żądanie, patrz downloadAttachmentPart() niżej. */
  attachments: ParsedAttachmentMeta[];
  /** Odpowiedź na nasze zaproszenie („Przyjmuję/Odrzucam" kliknięte przez
   * klienta), jeśli ten mail ją niesie. Wyjątek od reguły „bez bajtów" wyżej
   * i to świadomy: część `text/calendar` waży setki bajtów, a jej treść jest
   * CAŁYM sensem takiej wiadomości — odkładanie odczytu „na żądanie"
   * znaczyłoby, że status uczestnika nie zmienia się, dopóki właściciel sam
   * nie otworzy maila. Do bazy trafia sam wynik, nie plik. */
  calendarReply: CalendarReply | null;
};

/** Opis jednego załącznika odczytany z BODYSTRUCTURE. */
export type ParsedAttachmentMeta = {
  /** Numer części MIME wg RFC 3501 ("2", "3.1") — klucz do pobrania treści. */
  partId: string;
  filename: string;
  mime: string;
  sizeBytes: number;
};

export type MailboxConfig = {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  user: string;
  pass: string;
};

/** Czy skrzynka jest w ogóle skonfigurowana. Pozwala UI/cronowi zachować się
 * spokojnie ("poczta nieskonfigurowana") zamiast wywalać błędem — lokalnie i
 * do czasu, aż właściciel poda dane z panelu az.pl, tych zmiennych NIE ma. */
export function isMailboxConfigured(): boolean {
  return Boolean(process.env.MAIL_IMAP_HOST && process.env.MAIL_USER && process.env.MAIL_PASS);
}

/** Konfiguracja z env Vercela. Rzuca czytelnym błędem po polsku, gdy czegoś
 * brakuje — właściciel nie czyta kodu, więc komunikat musi mówić wprost,
 * którą zmienną dodać. Hasło NIGDY nie opuszcza serwera (nie trafia do
 * żadnej odpowiedzi API). */
export function mailboxConfig(): MailboxConfig {
  const imapHost = process.env.MAIL_IMAP_HOST;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;
  if (!imapHost || !user || !pass) {
    throw new Error(
      "Skrzynka pocztowa nie jest skonfigurowana — dodaj w zmiennych środowiskowych Vercela: MAIL_IMAP_HOST, MAIL_USER, MAIL_PASS (oraz opcjonalnie MAIL_IMAP_PORT, MAIL_SMTP_HOST, MAIL_SMTP_PORT). Wartości znajdziesz w panelu az.pl."
    );
  }
  return {
    imapHost,
    imapPort: Number(process.env.MAIL_IMAP_PORT || 993),
    // Domyślnie ten sam host co IMAP — u większości hostingów (w tym az.pl)
    // to jedna maszyna; MAIL_SMTP_HOST pozwala rozdzielić, gdyby było inaczej.
    smtpHost: process.env.MAIL_SMTP_HOST || imapHost,
    smtpPort: Number(process.env.MAIL_SMTP_PORT || 465),
    user,
    pass,
  };
}

/** Adres, którym się przedstawiamy przy wysyłce. Domyślnie "Leggera Labs
 * <login skrzynki>" — bez tego odbiorca widział surowy adres (np.
 * "kontakt@leggeralabs.pl") zamiast nazwy firmy w nagłówku From (zgłoszone
 * 2026-07-16). Wzorzec jak `RESEND_FROM` w lib/email.ts. MAIL_FROM pozwala
 * nadpisać całość (np. inną nazwą wyświetlaną), gdyby zaszła taka potrzeba. */
export function mailFrom(cfg: MailboxConfig): string {
  return process.env.MAIL_FROM || `Leggera Labs <${cfg.user}>`;
}

/** Nasz własny, stabilny klucz dla folderów specjalnego użycia — niezależny
 * od tego, jak dokładnie nazywa się/gdzie leży folder na danym serwerze
 * (patrz `mail_folders.role` w lib/db.ts, Etap 2 Modułu 4b). Drafts/Junk
 * świadomie pominięte — poza zakresem tej sesji. */
export type MailFolderRole = "sent" | "trash" | "archive";

const SPECIAL_USE_FLAG: Record<MailFolderRole, string> = {
  sent: "\\Sent",
  trash: "\\Trash",
  archive: "\\Archive",
};

/** Nazwy do zgadywania, gdy serwer NIE zgłasza RFC 6154 (SPECIAL-USE) —
 * fallback, nie pierwsza strategia. Lista "sent" to dokładnie ta, którą
 * dotąd `appendToSent()` miała zaszytą na sztywno. */
const FOLDER_NAME_FALLBACKS: Record<MailFolderRole, string[]> = {
  sent: ["Sent", "INBOX.Sent", "Sent Items", "Wysłane", "INBOX.Wysłane"],
  trash: ["Trash", "INBOX.Trash", "Kosz", "INBOX.Kosz", "Deleted Items", "Deleted Messages"],
  archive: ["Archive", "INBOX.Archive", "Archiwum", "INBOX.Archiwum", "All Mail"],
};

export type DiscoveredFolder = { path: string; specialUse: string | null };

/**
 * Znajduje realne ścieżki folderów specjalnego użycia na serwerze IMAP —
 * NAJPIERW special-use (RFC 6154: `client.list()` zwraca pole `specialUse`,
 * gdy serwer je wspiera), DOPIERO POTEM zgadywanie po nazwie jako fallback —
 * nazwa bywa różna zależnie od serwera/locale ("Sent" vs "INBOX.Sent" vs
 * "Wysłane"), a special-use jest jednoznaczne. Rola, której nie udało się
 * znaleźć ani jednym, ani drugim sposobem, dostaje `null` — wołający
 * (mailSync/moveMessage) ma się z tym obejść spokojnie (ta zakładka po
 * prostu nie istnieje na tym koncie, zamiast się wywalać).
 */
export async function discoverMailFolders(client: ImapFlow): Promise<Record<MailFolderRole, DiscoveredFolder | null>> {
  const out: Record<MailFolderRole, DiscoveredFolder | null> = { sent: null, trash: null, archive: null };

  let list: Awaited<ReturnType<ImapFlow["list"]>>;
  try {
    list = await client.list();
  } catch (e) {
    console.error("[mailbox] discoverMailFolders: LIST nie powiodło się", e);
    return out;
  }

  for (const role of Object.keys(out) as MailFolderRole[]) {
    const flagged = list.find((m) => m.specialUse === SPECIAL_USE_FLAG[role]);
    if (flagged) {
      out[role] = { path: flagged.path, specialUse: flagged.specialUse ?? null };
      continue;
    }
    const byName = list.find((m) => FOLDER_NAME_FALLBACKS[role].includes(m.path));
    if (byName) out[role] = { path: byName.path, specialUse: null };
  }
  return out;
}

/** Jak discoverMailFolders(), ale zarządza własnym połączeniem — do użycia
 * przez wołających spoza tego pliku (np. lib/mailSync.ts), którzy zgodnie z
 * zasadą tego modułu ("cienka warstwa: łączy się, czyta/wysyła, rozłącza")
 * nie powinni sami trzymać sesji IMAP. */
export async function discoverMailFoldersOnce(): Promise<Record<MailFolderRole, DiscoveredFolder | null>> {
  const cfg = mailboxConfig();
  const client = await connectImap(cfg);
  try {
    return await discoverMailFolders(client);
  } finally {
    await client.logout().catch(() => {});
  }
}

/** Zwraca bieżący najwyższy UID i UIDVALIDITY folderu BEZ pobierania jego
 * zawartości (tania komenda STATUS, nie SELECT+FETCH) — używane do
 * wyznaczenia punktu startowego kursora dla NOWO odkrytego folderu
 * (Sent/Trash/Archive): "od teraz", nie od zera (decyzja właściciela
 * 2026-07-16 — bez ściągania historii, patrz mail_folders w lib/db.ts). */
export async function getFolderCursorStart(imapPath: string): Promise<{ highestUid: number; uidValidity: number | null }> {
  const cfg = mailboxConfig();
  const client = await connectImap(cfg);
  try {
    const status = await client.status(imapPath, { uidNext: true, uidValidity: true });
    const uidNext = status.uidNext ?? 1;
    return {
      highestUid: Math.max(0, uidNext - 1),
      uidValidity: status.uidValidity != null ? Number(status.uidValidity) : null,
    };
  } finally {
    await client.logout().catch(() => {});
  }
}

async function connectImap(cfg: MailboxConfig): Promise<ImapFlow> {
  const client = new ImapFlow({
    host: cfg.imapHost,
    port: cfg.imapPort,
    secure: cfg.imapPort === 993,
    auth: { user: cfg.user, pass: cfg.pass },
    // imapflow domyślnie loguje bardzo gadatliwie do stdout — na Vercelu to
    // tylko szum w logach (i ryzyko wycieku nagłówków), więc wyciszamy.
    logger: false,
  });
  await client.connect();
  return client;
}

/**
 * Pobiera wiadomości z DOWOLNEGO folderu (`imapPath`) o UID większym niż
 * `sinceUid` — Etap 2 Modułu 4b (2026-07-16) uogólnił to z hardkodowanego
 * INBOX-a, żeby ta sama funkcja obsłużyła też Sent/Trash/Archive z własnymi
 * kursorami per-folder (`mail_folders`, lib/db.ts).
 *
 * Zwraca też `uidValidity` — wołający MUSI porównać ją z zapisaną wcześniej i
 * przy zmianie zresetować `last_seen_uid` do 0 (serwer przenumerował
 * skrzynkę; stare UID-y wskazują wtedy inne wiadomości). Dedup po
 * `message_id` sprawia, że ponowne przeczytanie całości jest bezpieczne.
 *
 * `limit` chroni pierwszy sync (skrzynka z tysiącami maili) przed przekroczeniem
 * czasu funkcji serverless — bierzemy najnowsze wiadomości, resztę dociągną
 * kolejne przebiegi.
 */
/** Węzeł drzewa MIME tak, jak zwraca go imapflow w `bodyStructure`. Własny
 * typ, bo eksportowany typ imapflow nie obejmuje wszystkich pól, których
 * tu używamy. */
type BodyNode = {
  part?: string;
  type?: string;
  parameters?: Record<string, string>;
  dispositionParameters?: Record<string, string>;
  disposition?: string;
  id?: string;
  size?: number;
  childNodes?: BodyNode[];
};

/**
 * Wyciąga z BODYSTRUCTURE listę PRAWDZIWYCH załączników.
 *
 * **Dlaczego z BODYSTRUCTURE, a nie z mailparsera.** `simpleParser` zwraca
 * załączniki razem z treścią, ale NIE podaje numeru części MIME — a bez
 * niego nie da się później ściągnąć pliku z serwera na żądanie. Numer części
 * jest wyłącznie w BODYSTRUCTURE. Przy okazji jest to tańsze: całą decyzję
 * podejmujemy na strukturze, nie na bajtach.
 *
 * **Inline vs prawdziwy załącznik.** Newslettery wkładają obrazki jako części
 * z `Content-ID` i odwołują się do nich z HTML-a (`cid:`). To NIE są
 * załączniki dla właściciela — pokazanie ich zrobiłoby z każdego newslettera
 * „mail z 14 załącznikami". Odrzucamy je po `disposition: inline` + obecności
 * `id`. Odrzucamy też części bez nazwy pliku — to sama treść wiadomości.
 */
/**
 * Szuka w sparsowanej wiadomości odpowiedzi na zaproszenie. mailparser wkłada
 * każdą część inną niż text/plain i text/html do `attachments` — a odpowiedź
 * kalendarzowa to właśnie taka część (`text/calendar; method=REPLY`), zwykle
 * pod nazwą `invite.ics`. Sprawdzamy TYP, nie nazwę pliku: Outlook nazywa ją
 * `meeting.ics`, Apple Mail nie nazywa jej wcale.
 *
 * Zwraca `null` przy każdej wątpliwości — to ścieżka syncu, która ma milczeć
 * i przepuścić maila dalej, a nie wywalić całe pobieranie poczty przez jeden
 * dziwny załącznik.
 */
function extractCalendarReply(
  attachments: { contentType?: string; content?: unknown }[] | undefined
): CalendarReply | null {
  for (const a of attachments ?? []) {
    if (!(a.contentType || "").toLowerCase().startsWith("text/calendar")) continue;
    const content = a.content;
    if (!Buffer.isBuffer(content)) continue;
    try {
      const reply = parseCalendarReply(content.toString("utf8"));
      if (reply) return reply;
    } catch (e) {
      console.error("[mailbox] nie udało się odczytać odpowiedzi na zaproszenie", e);
    }
  }
  return null;
}

export function extractAttachmentMeta(root: BodyNode | undefined): ParsedAttachmentMeta[] {
  const out: ParsedAttachmentMeta[] = [];
  if (!root) return out;

  const walk = (node: BodyNode) => {
    for (const child of node.childNodes ?? []) walk(child);

    // Kontenery (multipart/*) same w sobie nie są plikiem.
    const mime = (node.type || "").toLowerCase();
    if (!node.part || mime.startsWith("multipart/")) return;

    const disposition = (node.disposition || "").toLowerCase();
    const filenameRaw = node.dispositionParameters?.filename || node.parameters?.name || "";

    // Obrazek osadzony w treści — należy do HTML-a, nie do listy plików.
    if (disposition === "inline" && node.id) return;
    // Bez nazwy i bez jawnego `attachment` to po prostu treść wiadomości.
    if (!filenameRaw && disposition !== "attachment") return;

    out.push({
      partId: node.part,
      filename: safeAttachmentFilename(filenameRaw || `zalacznik-${node.part}`),
      mime: mime || "application/octet-stream",
      sizeBytes: typeof node.size === "number" ? node.size : 0,
    });
  };

  walk(root);
  // Kolejność części MIME = kolejność, w jakiej nadawca je dołączył.
  out.sort((a, b) => a.partId.localeCompare(b.partId, undefined, { numeric: true }));
  return out;
}

/**
 * Ściąga treść JEDNEJ części MIME — sedno decyzji „na żądanie z IMAP".
 *
 * Wołane dopiero, gdy właściciel stuknie w konkretny plik. Zwraca `null`,
 * gdy serwer nie zna już tej wiadomości (mail skasowany ze skrzynki innym
 * klientem) — to normalny scenariusz przy tym sposobie trzymania danych,
 * a nie awaria, więc wołający zamienia go na czytelny komunikat.
 */
export async function downloadAttachmentPart(
  imapPath: string,
  uid: number,
  partId: string
): Promise<{ content: Buffer; mime: string | null } | null> {
  const cfg = mailboxConfig();
  const client = await connectImap(cfg);
  try {
    const lock = await client.getMailboxLock(imapPath);
    try {
      const res = await client.download(String(uid), partId, { uid: true });
      if (!res?.content) return null;

      const chunks: Buffer[] = [];
      for await (const chunk of res.content) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const meta = res.meta as { contentType?: string } | undefined;
      return { content: Buffer.concat(chunks), mime: meta?.contentType ?? null };
    } finally {
      lock.release();
    }
  } catch (e) {
    console.error(`[mailbox] nie udało się pobrać części ${partId} wiadomości uid=${uid} z ${imapPath}`, e);
    return null;
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function fetchMessagesInFolder(
  imapPath: string,
  sinceUid: number,
  limit = 50
): Promise<{ messages: FetchedMessage[]; uidValidity: number | null; highestUid: number }> {
  const cfg = mailboxConfig();
  const client = await connectImap(cfg);
  const messages: FetchedMessage[] = [];
  let uidValidity: number | null = null;
  let highestUid = sinceUid;

  try {
    const lock = await client.getMailboxLock(imapPath);
    try {
      const box = client.mailbox;
      if (box && typeof box !== "boolean") {
        uidValidity = box.uidValidity != null ? Number(box.uidValidity) : null;
      }

      // Tania kontrola PRZED kosztownym FETCH-em: `uidNext - 1` to UID
      // OSTATNIEJ wiadomości, jaka kiedykolwiek istniała w tym folderze. Gdy
      // to nie jest większe niż nasz kursor, w folderze NAPRAWDĘ nie ma nic
      // nowego. Bez tej kontroli zakres `${sinceUid+1}:*` i tak dopasowałby
      // OSTATNIĄ wiadomość (IMAP-owe "*" zawsze coś dopasowuje, nawet gdy nie
      // jest nowa — patrz komentarz niżej) i ściągnęlibyśmy jej PEŁNĄ treść
      // (source) na darmo przy KAŻDYM syncu, dla KAŻDEGO folderu — zauważalne
      // spowolnienie zgłoszone przez właściciela 2026-07-16 po wprowadzeniu
      // wielu folderów (Etap 2), szczególnie dotkliwe przy dużych mailach
      // (załączniki) siedzących na końcu Archiwum/Kosza.
      const uidNext = box && typeof box !== "boolean" ? box.uidNext : undefined;
      if (uidNext != null && uidNext - 1 <= sinceUid) {
        return { messages: [], uidValidity, highestUid: sinceUid };
      }

      // `${from}:*` to zakres UID-ów wg RFC 3501. Uwaga na pułapkę: gdy w
      // skrzynce nie ma nic nowego, serwer i tak zwraca ostatnią wiadomość
      // (bo "*" zawsze coś dopasowuje) — dlatego niżej jawnie odfiltrowujemy
      // uid <= sinceUid, zamiast ufać zakresowi.
      const range = `${sinceUid + 1}:*`;
      const collected: { uid: number; source: Buffer; bodyStructure?: BodyNode }[] = [];

      // `bodyStructure` dokładamy do TEGO SAMEGO fetcha, co treść — drugie
      // przejście po skrzynce tylko dla struktury byłoby kolejnym pełnym
      // obiegiem IMAP-a przy każdym syncu.
      for await (const msg of client.fetch(range, { uid: true, source: true, bodyStructure: true }, { uid: true })) {
        if (msg.uid <= sinceUid) continue;
        if (msg.source) {
          collected.push({
            uid: msg.uid,
            source: msg.source as Buffer,
            bodyStructure: msg.bodyStructure as BodyNode | undefined,
          });
        }
      }

      // Najnowsze najpierw, przytnij do limitu — przy pierwszym syncu dużej
      // skrzynki chcemy świeże rozmowy, nie archiwum sprzed lat.
      collected.sort((a, b) => b.uid - a.uid);
      const slice = collected.slice(0, limit);

      for (const item of slice) {
        const parsed = await simpleParser(item.source);
        const fromEntry = parsed.from?.value?.[0];
        const toText = parsed.to
          ? Array.isArray(parsed.to)
            ? parsed.to.map((t) => t.text).join(", ")
            : parsed.to.text
          : "";

        // DW — bierzemy `.address` z KAŻDEGO wpisu (nie łączony `.text`),
        // żeby jeden przecinek w nazwie ("Kowalski, Jan") nie rozjechał
        // parsowania na dwa fałszywe adresy.
        const ccEntries = parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc.flatMap((c) => c.value) : parsed.cc.value) : [];
        const ccAddr = ccEntries
          .map((e) => extractEmailAddress(e.address || ""))
          .filter(Boolean)
          .join(", ");

        // Bez Message-ID nie da się deduplikować ani wątkować — syntetyzujemy
        // stabilny zastępczy z UID-a skrzynki (ten sam mail da ten sam klucz
        // przy powtórnym syncu, więc dedup dalej działa).
        const messageId = (parsed.messageId || "").trim() || `<uid-${item.uid}@panel.local>`;

        const refsRaw = parsed.references;
        const refs = Array.isArray(refsRaw) ? refsRaw.join(" ") : refsRaw || null;

        // mailparser trzyma nagłówki w Mapie po nazwach pisanych małymi
        // literami. Wartość bywa stringiem albo obiektem (List-Unsubscribe) —
        // dla nas liczy się wyłącznie SAMA OBECNOŚĆ tego nagłówka.
        const header = (name: string): string | null => {
          const v = parsed.headers?.get(name);
          if (v == null) return null;
          return typeof v === "string" ? v : String((v as { value?: unknown }).value ?? v);
        };
        const hints = {
          listUnsubscribe: parsed.headers?.has("list-unsubscribe") ?? false,
          precedence: header("precedence"),
          autoSubmitted: header("auto-submitted"),
          listUnsubscribeUrl: parseUnsubscribeUrl(header("list-unsubscribe")),
        };

        messages.push({
          uid: item.uid,
          fromAddr: extractEmailAddress(fromEntry?.address || parsed.from?.text || ""),
          fromName: (fromEntry?.name || "").trim(),
          toAddr: extractEmailAddress(toText),
          ccAddr,
          subject: (parsed.subject || "").trim(),
          bodyText: (parsed.text || "").trim(),
          bodyHtml: typeof parsed.html === "string" ? parsed.html : "",
          messageId,
          inReplyTo: (parsed.inReplyTo || "").trim() || null,
          refs,
          receivedAt: parsed.date || new Date(),
          hints,
          attachments: extractAttachmentMeta(item.bodyStructure),
          calendarReply: extractCalendarReply(parsed.attachments),
        });
      }

      // Kursor przesuwamy o WSZYSTKIE przeczytane UID-y (nie tylko te w
      // `slice`), bo pominięte to celowo odrzucone archiwum — inaczej każdy
      // kolejny sync czytałby je od nowa w nieskończoność.
      for (const item of collected) {
        if (item.uid > highestUid) highestUid = item.uid;
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {
      // Rozłączenie potrafi rzucić, gdy serwer już zamknął socket — to nie
      // jest błąd syncu, wiadomości mamy już pobrane.
    });
  }

  return { messages, uidValidity, highestUid };
}

/**
 * Dociąga SAME NAGŁÓWKI dla podanych UID-ów — bez treści, więc jest tanie.
 *
 * Po co: wiadomości pobrane, zanim zaczęliśmy czytać nagłówki masówki, mają
 * je puste, a bez nich nie da się ich poprawnie zaklasyfikować (Calendly/n8n
 * nie mają "noreply" w adresie — właściciel zgłosił to 2026-07-15). Dedup po
 * `message_id` nie pozwala pobrać ich ponownie w całości, więc dociągamy
 * wyłącznie brakujący fragment.
 *
 * Zwraca mapę uid → hints. UID-y, których serwer już nie zna (skasowane w
 * Outlooku), po prostu nie trafiają do mapy — wołający zostawia je w spokoju.
 */
export async function fetchHintsByUids(uids: number[]): Promise<Map<number, MailHeaderHints>> {
  const out = new Map<number, MailHeaderHints>();
  if (uids.length === 0) return out;

  const cfg = mailboxConfig();
  const client = await connectImap(cfg);
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      // `headers: [...]` ściąga wskazane pola zamiast całej wiadomości.
      for await (const msg of client.fetch(
        uids,
        { uid: true, headers: ["list-unsubscribe", "precedence", "auto-submitted"] },
        { uid: true }
      )) {
        const raw = msg.headers?.toString("utf8") ?? "";
        const pick = (name: string): string | null => {
          const m = raw.match(new RegExp(`^${name}:\\s*(.+)$`, "im"));
          return m ? m[1].trim() : null;
        };
        out.set(msg.uid, {
          listUnsubscribe: /^list-unsubscribe:/im.test(raw),
          precedence: pick("precedence"),
          autoSubmitted: pick("auto-submitted"),
          listUnsubscribeUrl: parseUnsubscribeUrl(pick("list-unsubscribe")),
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return out;
}

/**
 * Dociąga SAM nagłówek `Cc` dla podanych UID-ów — analogicznie do
 * fetchHintsByUids(), dla wiadomości pobranych PRZED wprowadzeniem kolumny
 * `cc_addr` (2026-07-15, Etap 1 Modułu 4b). Bez tego "Odpowiedz wszystkim"
 * na starej korespondencji nie miałoby skąd wziąć adresów DW — dedup po
 * `message_id` nie pozwala pobrać ich ponownie w całości.
 *
 * Zwraca "" (nie brak wpisu) dla wiadomości bez DW, żeby wołający mógł
 * odróżnić "sprawdzone, pusto" od "jeszcze nie sprawdzone" (NULL w bazie).
 */
export async function fetchCcByUids(uids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (uids.length === 0) return out;

  const cfg = mailboxConfig();
  const client = await connectImap(cfg);
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      for await (const msg of client.fetch(uids, { uid: true, envelope: true }, { uid: true })) {
        const cc = (msg.envelope?.cc ?? [])
          .map((a) => extractEmailAddress(a.address || ""))
          .filter(Boolean)
          .join(", ");
        out.set(msg.uid, cc);
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return out;
}

/**
 * Wysyła pocztę przez SMTP az.pl — odpowiedź, przekazanie albo zupełnie nową
 * wiadomość. `inReplyTo`/`references` (nagłówki wątku RFC 5322) są opcjonalne:
 * podane przy odpowiedzi (żeby wpadła w ten sam wątek w Outlooku), pominięte
 * przy przekazaniu/nowej wiadomości (to świadomie NOWY wątek — tak samo robi
 * Gmail/Outlook z "Fwd:"). Zwraca Message-ID wysłanej wiadomości (zapisujemy
 * go, żeby dedup nie wciągnął naszej własnej wiadomości drugi raz jako
 * "przychodzącej", gdyby kopia wróciła do INBOX-a) ORAZ jej surową treść dla
 * appendToSent().
 *
 * Wiadomość składamy sami (MailComposer) zamiast zdać się na sendMail()
 * nodemailera, bo `info` z nodemailera nie oddaje surowej treści, a bez niej
 * nie da się dopisać kopii do "Sent". Efekt uboczny jest pożądany: do "Sent"
 * trafia DOKŁADNIE to, co poszło do odbiorcy, bajt w bajt — nie rekonstrukcja.
 */
export async function sendMail(params: {
  to: string[];
  cc?: string[];
  /** UDW — TYLKO koperta SMTP, NIGDY przekazywane do MailComposer poniżej:
   * MailComposer zapisałby nagłówek `Bcc:` wprost do surowego MIME (patrz
   * node_modules/nodemailer/lib/mail-composer), a to ten sam `raw`, który
   * ląduje w folderze Sent przez appendToSent() — każdy klient czytający
   * kopię z Sent zobaczyłby wtedy adresy UDW. Prawidłowe miejsce na Bcc jest
   * WYŁĄCZNIE koperta transportera, niżej. */
  bcc?: string[];
  subject: string;
  text: string;
  /** Wersja HTML (z podpisem). Gdy podana, mail leci jako multipart:
   * text/plain + text/html — pominięcie części tekstowej podbija punktację
   * spamową i psuje odbiór w klientach tekstowych. */
  html?: string;
  /** Obrazki osadzone (podpis) — dołączane jako `cid:`, nie zdalne linki. */
  inlineImages?: { cid: string; filename: string; content: Buffer }[];
  /** Załączniki wychodzące wskazane przez właściciela (druga runda Etapu 1
   * Modułu 4b) — TYLKO w pamięci, nigdy nie trafiają do Postgresa (patrz
   * MAIL_ATTACHMENT_* w lib/mail.ts). */
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
  /** Zaproszenie na spotkanie (2026-07-22). Świadomie NIE zwykły załącznik:
   * `icalEvent` każe MailComposerowi wstawić treść jako część
   * `text/calendar; method=REQUEST` obok tekstu i HTML-a — i dopiero to
   * sprawia, że Gmail/Outlook/Apple Mail rysują przyciski „Przyjmuję /
   * Może / Odrzucam". Ten sam plik doczepiony jako `attachments` byłby dla
   * nich zwykłym plikiem do pobrania. */
  icalEvent?: { method: "REQUEST" | "CANCEL"; filename: string; content: string };
  inReplyTo?: string | null;
  references?: string | null;
}): Promise<{ messageId: string; raw: string }> {
  const cfg = mailboxConfig();
  const from = mailFrom(cfg);

  // Message-ID nadajemy sami, żeby znać go PRZED wysyłką i zapisać przy
  // wiadomości (dedup + wątkowanie kolejnych odpowiedzi). Domena z adresu
  // nadawcy, żeby nagłówek był zgodny z tym, czym się przedstawiamy.
  const domain = from.split("@")[1]?.replace(/>$/, "").trim() || "localhost";
  const messageId = `<${randomUUID()}@${domain}>`;

  const allAttachments = [
    ...(params.inlineImages ?? []).map((i) => ({
      cid: i.cid,
      filename: i.filename,
      content: i.content,
      contentDisposition: "inline" as const,
    })),
    ...(params.attachments ?? []).map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
      contentDisposition: "attachment" as const,
    })),
  ];

  const raw = (
    await new MailComposer({
      from,
      to: params.to,
      ...(params.cc && params.cc.length > 0 ? { cc: params.cc } : {}),
      subject: params.subject,
      text: params.text,
      ...(params.html ? { html: params.html } : {}),
      // `cid` + `contentDisposition: "inline"` sprawia, że obrazek jest
      // częścią wiadomości (a nie załącznikiem do pobrania) i nie podlega
      // blokadzie zdalnych obrazków. Prawdziwe załączniki mają
      // `contentDisposition: "attachment"` — jedna tablica, dwa rodzaje.
      ...(allAttachments.length > 0 ? { attachments: allAttachments } : {}),
      ...(params.icalEvent
        ? {
            icalEvent: {
              method: params.icalEvent.method,
              filename: params.icalEvent.filename,
              content: params.icalEvent.content,
            },
          }
        : {}),
      messageId,
      ...(params.inReplyTo ? { inReplyTo: params.inReplyTo } : {}),
      ...(params.references ? { references: params.references } : {}),
    })
      .compile()
      .build()
  ).toString();

  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpPort === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  // `raw` + jawna koperta: wysyłamy dokładnie tę treść, którą złożyliśmy
  // wyżej (sendMail nie przepisuje wtedy nagłówków po swojemu). Koperta musi
  // zawierać też DW/UDW — inaczej ci odbiorcy nie dostaną poczty, mimo że
  // (dla DW) nagłówek Cc by ją zapowiadał.
  await transporter.sendMail({
    envelope: {
      from: extractEmailAddress(from) || from,
      to: [...params.to, ...(params.cc ?? []), ...(params.bcc ?? [])],
    },
    raw,
  });

  return { messageId, raw };
}

/**
 * Pobiera obrazki podpisu z naszej własnej domeny, żeby dołączyć je do maila
 * jako `cid:`.
 *
 * Dlaczego przez HTTP, a nie z dysku: pliki z `public/` nie trafiają do
 * funkcji serverless na Vercelu — `fs.readFile` działałby lokalnie i wywalił
 * się na produkcji. Adres bierzemy z `siteUrl` (lib/site.ts).
 *
 * Awaria pobierania NIE jest błędem: zwracamy pustą listę, mail leci bez
 * ozdób, a podpis i tak jest kompletny, bo wszystkie dane kontaktowe są w nim
 * tekstem (patrz lib/mailSignature.ts). Lepiej wysłać maila bez zdjęcia niż
 * nie wysłać go wcale.
 */
export async function fetchSignatureImages(): Promise<{ cid: string; filename: string; content: Buffer }[]> {
  const out: { cid: string; filename: string; content: Buffer }[] = [];
  for (const img of SIGNATURE_IMAGES) {
    try {
      const res = await fetch(`${siteUrl}${img.url}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      out.push({ cid: img.cid, filename: img.filename, content: Buffer.from(await res.arrayBuffer()) });
    } catch (e) {
      console.error(`[mailbox] nie udało się pobrać obrazka podpisu ${img.url} — wysyłam bez niego`, e);
    }
  }
  return out;
}

/**
 * Dopisuje wysłaną wiadomość do folderu "Sent" przez IMAP APPEND, żeby
 * odpowiedź wysłana z panelu była widoczna także w Outlooku. Bez tego SMTP
 * wyśle maila, ale w "Wysłanych" nie będzie po nim śladu.
 *
 * Nazwa folderu bywa różna zależnie od serwera/języka ("Sent", "Sent Items",
 * "Wysłane") — próbujemy po kolei i odpuszczamy po cichu, jeśli żaden nie
 * istnieje: mail JUŻ poleciał do klienta, więc brak kopii w Sent nie może
 * wywrócić całej operacji. Wołający loguje ostrzeżenie.
 */
export async function appendToSent(raw: string): Promise<boolean> {
  if (!raw) return false;
  const cfg = mailboxConfig();
  const client = await connectImap(cfg);
  try {
    // discoverMailFolders() sprawdza special-use PRZED zgadywaniem nazw —
    // pewniejsze niż zgadywanie po locale. Gdyby z jakiegoś powodu odkryta
    // ścieżka jednak zawiodła (np. serwer zgłosił specialUse dla folderu,
    // do którego akurat nie da się dopisać), dalej próbujemy pełną listę
    // nazw jako siatkę bezpieczeństwa — dokładnie jak dotychczas.
    const discovered = await discoverMailFolders(client);
    const candidates: string[] = [];
    if (discovered.sent) candidates.push(discovered.sent.path);
    for (const name of FOLDER_NAME_FALLBACKS.sent) {
      if (!candidates.includes(name)) candidates.push(name);
    }

    for (const path of candidates) {
      try {
        await client.append(path, Buffer.from(raw), ["\\Seen"]);
        return true;
      } catch {
        // Ten folder nie istnieje — próbujemy kolejny.
      }
    }
    return false;
  } finally {
    await client.logout().catch(() => {});
  }
}

/**
 * Przenosi wiadomość między folderami przez natywne IMAP MOVE (RFC 6851) —
 * atomowe: serwer sam usuwa ją z folderu źródłowego, nie trzeba osobno
 * EXPUNGE'ować. Używane do "Usuń" (→ Trash) i "Archiwizuj" (→ Archive) w UI
 * — Etap 2 Modułu 4b (2026-07-16), zgodnie z zasadą projektu o
 * nieodwracalnych operacjach: to ZAWSZE MOVE, NIGDY `\Deleted`+EXPUNGE.
 *
 * ⚠️ Jeśli serwer NIE zgłasza capability `MOVE`, imapflow emuluje je przez
 * COPY + STORE `\Deleted` + EXPUNGE — a zwykły EXPUNGE bez UIDPLUS kasuje
 * WSZYSTKIE wiadomości oznaczone `\Deleted` w danej skrzynce, nie tylko tę
 * jedną. Logujemy capabilities przy każdym wywołaniu, żeby to ryzyko było
 * widoczne w `vercel logs` PRZED tym, jak się zmaterializuje na produkcji —
 * nie da się tego zweryfikować z tej sesji (brak dostępu do az.pl).
 */
export async function moveMessage(sourcePath: string, uid: number, destPath: string): Promise<void> {
  const cfg = mailboxConfig();
  const client = await connectImap(cfg);
  try {
    if (!client.capabilities.has("MOVE")) {
      console.warn(
        `[mailbox] moveMessage: serwer NIE zgłasza capability MOVE — imapflow przejdzie na COPY+STORE+EXPUNGE (ryzyko: EXPUNGE kasuje WSZYSTKIE wiadomości oznaczone \\Deleted w folderze, nie tylko tę). UIDPLUS: ${client.capabilities.has("UIDPLUS")}`
      );
    }
    const lock = await client.getMailboxLock(sourcePath);
    try {
      await client.messageMove(uid, destPath, { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}
