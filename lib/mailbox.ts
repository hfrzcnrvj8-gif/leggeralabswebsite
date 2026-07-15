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
import { extractEmailAddress } from "./mail";

/** Jedna sparsowana wiadomość — surowa, jeszcze nie dopasowana do klienta. */
export type FetchedMessage = {
  uid: number;
  fromAddr: string;
  fromName: string;
  toAddr: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  messageId: string;
  inReplyTo: string | null;
  refs: string | null;
  receivedAt: Date;
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

/** Adres, którym się przedstawiamy przy wysyłce. Domyślnie login skrzynki
 * (u az.pl login == adres), MAIL_FROM pozwala nadpisać wyświetlaną nazwę. */
export function mailFrom(cfg: MailboxConfig): string {
  return process.env.MAIL_FROM || cfg.user;
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
 * Pobiera wiadomości z INBOX o UID większym niż `sinceUid`.
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
export async function fetchNewMessages(
  sinceUid: number,
  limit = 50
): Promise<{ messages: FetchedMessage[]; uidValidity: number | null; highestUid: number }> {
  const cfg = mailboxConfig();
  const client = await connectImap(cfg);
  const messages: FetchedMessage[] = [];
  let uidValidity: number | null = null;
  let highestUid = sinceUid;

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const box = client.mailbox;
      if (box && typeof box !== "boolean") {
        uidValidity = box.uidValidity != null ? Number(box.uidValidity) : null;
      }

      // `${from}:*` to zakres UID-ów wg RFC 3501. Uwaga na pułapkę: gdy w
      // skrzynce nie ma nic nowego, serwer i tak zwraca ostatnią wiadomość
      // (bo "*" zawsze coś dopasowuje) — dlatego niżej jawnie odfiltrowujemy
      // uid <= sinceUid, zamiast ufać zakresowi.
      const range = `${sinceUid + 1}:*`;
      const collected: { uid: number; source: Buffer }[] = [];

      for await (const msg of client.fetch(range, { uid: true, source: true }, { uid: true })) {
        if (msg.uid <= sinceUid) continue;
        if (msg.source) collected.push({ uid: msg.uid, source: msg.source as Buffer });
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

        // Bez Message-ID nie da się deduplikować ani wątkować — syntetyzujemy
        // stabilny zastępczy z UID-a skrzynki (ten sam mail da ten sam klucz
        // przy powtórnym syncu, więc dedup dalej działa).
        const messageId = (parsed.messageId || "").trim() || `<uid-${item.uid}@panel.local>`;

        const refsRaw = parsed.references;
        const refs = Array.isArray(refsRaw) ? refsRaw.join(" ") : refsRaw || null;

        messages.push({
          uid: item.uid,
          fromAddr: extractEmailAddress(fromEntry?.address || parsed.from?.text || ""),
          fromName: (fromEntry?.name || "").trim(),
          toAddr: extractEmailAddress(toText),
          subject: (parsed.subject || "").trim(),
          bodyText: (parsed.text || "").trim(),
          bodyHtml: typeof parsed.html === "string" ? parsed.html : "",
          messageId,
          inReplyTo: (parsed.inReplyTo || "").trim() || null,
          refs,
          receivedAt: parsed.date || new Date(),
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
 * Wysyła odpowiedź przez SMTP az.pl z nagłówkami wątku (In-Reply-To/
 * References) — dzięki nim odpowiedź wpada w ten sam wątek w Outlooku, a nie
 * zakłada nowego. Zwraca Message-ID wysłanej wiadomości (zapisujemy go, żeby
 * dedup nie wciągnął naszej własnej odpowiedzi drugi raz jako "przychodzącej",
 * gdyby kopia wróciła do INBOX-a) ORAZ jej surową treść dla appendToSent().
 *
 * Wiadomość składamy sami (MailComposer) zamiast zdać się na sendMail(), bo
 * `info` z nodemailera nie oddaje surowej treści, a bez niej nie da się
 * dopisać kopii do "Sent". Efekt uboczny jest pożądany: do "Sent" trafia
 * DOKŁADNIE to, co poszło do klienta, bajt w bajt — nie rekonstrukcja.
 */
export async function sendReply(params: {
  to: string;
  subject: string;
  text: string;
  inReplyTo: string | null;
  references: string | null;
}): Promise<{ messageId: string; raw: string }> {
  const cfg = mailboxConfig();
  const from = mailFrom(cfg);

  // Message-ID nadajemy sami, żeby znać go PRZED wysyłką i zapisać przy
  // wiadomości (dedup + wątkowanie kolejnych odpowiedzi). Domena z adresu
  // nadawcy, żeby nagłówek był zgodny z tym, czym się przedstawiamy.
  const domain = from.split("@")[1]?.replace(/>$/, "").trim() || "localhost";
  const messageId = `<${randomUUID()}@${domain}>`;

  const raw = (
    await new MailComposer({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
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
  // wyżej (sendMail nie przepisuje wtedy nagłówków po swojemu).
  await transporter.sendMail({
    envelope: { from: extractEmailAddress(from) || from, to: [params.to] },
    raw,
  });

  return { messageId, raw };
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
    // Serwer zwykle sam oznacza właściwy folder flagą \Sent — to pewniejsze
    // niż zgadywanie nazwy po locale.
    const candidates: string[] = [];
    try {
      const list = await client.list();
      const flagged = list.find((m) => m.specialUse === "\\Sent");
      if (flagged) candidates.push(flagged.path);
    } catch {
      // Brak LIST-a nie przekreśla APPEND-a — lecimy na nazwach niżej.
    }
    candidates.push("Sent", "INBOX.Sent", "Sent Items", "Wysłane", "INBOX.Wysłane");

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
