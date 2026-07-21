// Moduł 4 — sedno poczty: co się dzieje z pobraną wiadomością.
// Osobno od lib/mailbox.ts (rozmowa z serwerem IMAP) i od route'ów, żeby tę
// samą funkcję mogły wołać dwa wejścia: POST /api/mail/sync (otwarcie
// zakładki) i dzienny cron (app/api/leads/notify) — bez HTTP-owego skoku po
// samym sobie.
//
// Zero AI: komu przypisać maila wynika z równości adresu (findContactsByEmail),
// a czy jest "do obsłużenia" — ze statusu. Treść nie jest przez nic czytana.
import { randomUUID } from "node:crypto";
import { getSql, ensureMailSchema, ensureMailFoldersSchema } from "./db";
import { findContactsByEmail } from "./contactLookup";
import { notify } from "./notificationLog";
import {
  fetchMessagesInFolder,
  fetchHintsByUids,
  fetchCcByUids,
  isMailboxConfigured,
  mailboxConfig,
  discoverMailFoldersOnce,
  getFolderCursorStart,
  type FetchedMessage,
  type MailFolderRole,
  type DiscoveredFolder,
  type ParsedAttachmentMeta,
} from "./mailbox";
import {
  classifyMail,
  isNoiseMail,
  isSelfReport,
  mailSummaryLine,
  extractEmailAddress,
  normalizeThreadSubject,
  MAIL_RETENTION_MONTHS,
  type MailHeaderHints,
} from "./mail";
import { todayLocalISO } from "./dates";

export type SyncResult = {
  fetched: number;
  saved: number;
  matched: number;
  unassigned: number;
  ignored: number;
};

/** Role kursora w `mail_folders` — 'inbox' zawsze istnieje (migrowana z
 * `mail_state`), reszta powstaje przy pierwszym udanym discovery. */
type FolderRole = "inbox" | MailFolderRole;

type FolderCursorRow = {
  id: string;
  role: FolderRole;
  imap_path: string;
  uidvalidity: string | number | bigint | null;
  last_seen_uid: number;
};

/** Okno czasowe fallbacku po temacie w resolveThreadId() niżej — dopasowanie
 * "ten sam temat + nakładający się uczestnik" tylko w obrębie tylu dni,
 * zgodnie z briefem Etapu 3 (docs/plany-modulow/04b-poczta-pelny-klient.md). */
const THREAD_SUBJECT_WINDOW_DAYS = 30;

type ThreadCandidate = {
  message_id: string;
  thread_id: string;
  subject: string;
  from_addr: string;
  to_addr: string;
  cc_addr: string | null;
  received_at: string | Date;
};

/** Kontekst wątkowania dla JEDNEGO przebiegu syncMailbox() — ładowany RAZ
 * (loadThreadContext), mutowany w locie po każdym zapisie
 * (registerThreadedRow), żeby kolejne wiadomości w TYM SAMYM syncu (także w
 * innych folderach — foldery lecą równolegle, ale JS jest jednowątkowy, więc
 * mutacja między await-ami jest bezpieczna) widziały już rozstrzygnięte
 * wątki, zamiast odpytywać bazę przy każdej wiadomości z osobna. */
type ThreadContext = {
  /** message_id → thread_id, BEZ ograniczenia czasowego — References/
   * In-Reply-To mogą wskazywać wiadomość sprzed lat, a to tylko dwie lekkie
   * kolumny tekstowe, tanie nawet przy tysiącach wierszy. */
  byMessageId: Map<string, string>;
  /** Kandydaci do dopasowania po temacie — ograniczeni do okna czasowego
   * (patrz THREAD_SUBJECT_WINDOW_DAYS), więc payload nie rośnie z wiekiem
   * skrzynki. */
  subjectCandidates: ThreadCandidate[];
};

async function loadThreadContext(sql: ReturnType<typeof getSql>): Promise<ThreadContext> {
  const exact = (await sql`
    SELECT message_id, thread_id FROM mail_messages WHERE thread_id IS NOT NULL;
  `) as unknown as { message_id: string; thread_id: string }[];
  const subjectRows = (await sql`
    SELECT message_id, thread_id, subject, from_addr, to_addr, cc_addr, received_at
    FROM mail_messages
    WHERE thread_id IS NOT NULL AND received_at > now() - interval '35 days';
  `) as unknown as ThreadCandidate[];
  return {
    byMessageId: new Map(exact.map((r) => [r.message_id, r.thread_id])),
    subjectCandidates: subjectRows,
  };
}

/** Adresy uczestników (from/to/cc, pole "to"/"cc" bywa listą po przecinku) do
 * porównania "czy te dwie wiadomości mają wspólnego rozmówcę". */
function participantAddrs(...raw: (string | null | undefined)[]): Set<string> {
  const out = new Set<string>();
  for (const r of raw) {
    for (const a of (r || "").split(",")) {
      const e = extractEmailAddress(a);
      if (e) out.add(e);
    }
  }
  return out;
}

/**
 * JWZ-lite: dopasuj wiadomość do istniejącego wątku.
 * 1. Łańcuch References/In-Reply-To — jeśli którykolwiek message-id jest już
 *    w bazie z przypisanym wątkiem, przejmij go (najpewniejszy sygnał, ZERO
 *    zgadywania — to dokładnie to, co Message-ID/References mówią wprost).
 * 2. Fallback: znormalizowany temat + nakładający się uczestnik w oknie
 *    THREAD_SUBJECT_WINDOW_DAYS dni — dla wiadomości bez nagłówków wątku
 *    (stare maile sprzed konwencji, albo klienci nie zawsze je wysyłają).
 * 3. Inaczej: wiadomość jest korzeniem WŁASNEGO nowego wątku.
 *
 * ⚠️ Znane ograniczenie: krok 3 NIE jest samo-naprawiający się jak
 * kategoria/cc_addr — patrz komentarz przy kolumnie w lib/db.ts.
 */
function resolveThreadId(
  msg: {
    message_id: string;
    inReplyTo: string | null;
    refs: string | null;
    subject: string;
    fromAddr: string;
    toAddr: string;
    ccAddr: string;
    receivedAt: Date;
  },
  ctx: ThreadContext
): string {
  const chain = [...(msg.inReplyTo ? [msg.inReplyTo] : []), ...(msg.refs ? msg.refs.split(/\s+/).filter(Boolean) : [])];
  for (const rid of chain) {
    const found = ctx.byMessageId.get(rid);
    if (found) return found;
  }

  const subj = normalizeThreadSubject(msg.subject);
  if (subj) {
    const mine = participantAddrs(msg.fromAddr, msg.toAddr, msg.ccAddr);
    const cutoff = msg.receivedAt.getTime() - THREAD_SUBJECT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    let best: ThreadCandidate | null = null;
    for (const cand of ctx.subjectCandidates) {
      if (normalizeThreadSubject(cand.subject) !== subj) continue;
      if (new Date(cand.received_at).getTime() < cutoff) continue;
      const theirs = participantAddrs(cand.from_addr, cand.to_addr, cand.cc_addr);
      if (![...mine].some((a) => theirs.has(a))) continue;
      if (!best || new Date(cand.received_at) > new Date(best.received_at)) best = cand;
    }
    if (best) return best.thread_id;
  }

  return msg.message_id;
}

/** Rejestruje świeżo zapisaną/rozstrzygniętą wiadomość w kontekście — patrz
 * komentarz przy ThreadContext wyżej. */
function registerThreadedRow(
  ctx: ThreadContext,
  row: { message_id: string; thread_id: string; subject: string; from_addr: string; to_addr: string; cc_addr: string | null; received_at: string | Date }
): void {
  ctx.byMessageId.set(row.message_id, row.thread_id);
  ctx.subjectCandidates.push(row);
}

/**
 * Dociąga `thread_id` historycznym wiadomościom sprzed wprowadzenia
 * wątkowania (Moduł 4, Etap 3). Ten sam wzorzec co backfillCategories()/
 * backfillCc(): `WHERE thread_id IS NULL LIMIT 300`, pętla w JS, UPDATE per
 * wiersz — ale `ORDER BY received_at ASC` jest tu KLUCZOWE (w odróżnieniu od
 * tamtych): starsze wiadomości w tej samej paczce muszą rozstrzygnąć się
 * PRZED nowszymi, które mogą się do nich odwoływać przez References.
 */
export async function backfillThreadIds(): Promise<{ updated: number }> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, message_id, in_reply_to, refs, subject, from_addr, to_addr, cc_addr, received_at
    FROM mail_messages
    WHERE thread_id IS NULL
    ORDER BY received_at ASC
    LIMIT 300;
  `) as unknown as {
    id: string;
    message_id: string;
    in_reply_to: string | null;
    refs: string | null;
    subject: string;
    from_addr: string;
    to_addr: string;
    cc_addr: string | null;
    received_at: string;
  }[];
  if (rows.length === 0) return { updated: 0 };

  const ctx = await loadThreadContext(sql);
  let updated = 0;
  for (const r of rows) {
    const threadId = resolveThreadId(
      {
        message_id: r.message_id,
        inReplyTo: r.in_reply_to,
        refs: r.refs,
        subject: r.subject,
        fromAddr: r.from_addr,
        toAddr: r.to_addr,
        ccAddr: r.cc_addr || "",
        receivedAt: new Date(r.received_at),
      },
      ctx
    );
    await sql`UPDATE mail_messages SET thread_id = ${threadId} WHERE id = ${r.id};`;
    registerThreadedRow(ctx, {
      message_id: r.message_id,
      thread_id: threadId,
      subject: r.subject,
      from_addr: r.from_addr,
      to_addr: r.to_addr,
      cc_addr: r.cc_addr,
      received_at: r.received_at,
    });
    updated++;
  }
  return { updated };
}

/**
 * Pobierz nowe wiadomości ze WSZYSTKICH znanych folderów (Odebrane +, jeśli
 * odkryte, Wysłane/Kosz/Archiwum), dopasuj do klienta/leada, zapisz.
 *
 * Etap 2 Modułu 4b (2026-07-16) — dotąd ta funkcja czytała wyłącznie INBOX
 * z jednym globalnym kursorem w `mail_state`; teraz każdy folder ma własny
 * kursor w `mail_folders` (lib/db.ts) i własną, dopasowaną do jego natury
 * logikę zapisu (patrz saveIncoming/saveOutgoingFromServer/saveArchivedOrTrashed
 * niżej).
 *
 * Idempotentne dzięki `message_id UNIQUE` — podwójny sync (otwarcie widoku +
 * cron) nie zdubluje niczego. Dlatego reset UID-ów przy zmianie UIDVALIDITY
 * jest bezpieczny: najwyżej przeczytamy folder ponownie, a INSERT-y się odbiją.
 */
export async function syncMailbox(): Promise<SyncResult> {
  // ⏱️ Instrumentacja diagnostyczna (2026-07-16, TYMCZASOWA) — właściciel
  // zgłosił, że sync jest bardzo wolny mimo dwóch rund poprawek, i że
  // "Wysłane" pokazuje coś, co wygląda na źle sklasyfikowane wiadomości.
  // Loguje realne czasy każdego etapu i dokładne mapowanie odkrytych
  // folderów — do usunięcia, gdy przyczyna zostanie znaleziona i naprawiona.
  const t0 = Date.now();
  await ensureMailFoldersSchema();
  const sql = getSql();

  // Najpierw dociągnij kategorie wiadomościom sprzed ich wprowadzenia —
  // samo-naprawiające się, więc właściciel nie musi nic klikać ani wiedzieć,
  // że coś było do nadrobienia. Bez zmian — dotyczy tylko INBOX-a.
  await backfillCategories().catch((e) => {
    console.error("[mailSync] backfill kategorii nie powiódł się", e);
  });
  console.log(`[mailSync:timing] po backfillCategories: ${Date.now() - t0}ms`);

  await backfillCc().catch((e) => {
    console.error("[mailSync] backfill DW nie powiódł się", e);
  });
  console.log(`[mailSync:timing] po backfillCc: ${Date.now() - t0}ms`);

  // Wątkowanie (Moduł 4, Etap 3) — dogoń historyczne wiersze PRZED
  // załadowaniem kontekstu niżej, żeby nowe wiadomości z tego przebiegu
  // mogły się dowiązać do w pełni nadgonionego stanu.
  await backfillThreadIds().catch((e) => {
    console.error("[mailSync] backfill wątków nie powiódł się", e);
  });
  console.log(`[mailSync:timing] po backfillThreadIds: ${Date.now() - t0}ms`);

  // I dopnij maile, które przyszły ZANIM istniał pasujący klient/lead —
  // saveIncoming() dopasowuje tylko raz, w chwili pobrania, więc bez tego
  // takie maile zostają nieprzypisane na zawsze.
  await rematchUnassigned().catch((e) => {
    console.error("[mailSync] ponowne dopasowanie nieprzypisanych nie powiodło się", e);
  });
  console.log(`[mailSync:timing] po rematchUnassigned: ${Date.now() - t0}ms`);

  // Discovery to OSOBNE połączenie IMAP (~2s samego TLS+AUTH+LIST, zmierzone
  // 2026-07-16) — foldery na serwerze prawie nigdy się nie zmieniają, więc
  // nie ma sensu płacić ten koszt przy KAŻDYM syncu. Robimy je TYLKO gdy
  // jeszcze nigdy nie znaleźliśmy żadnego folderu specjalnego (pierwszy sync
  // po wdrożeniu) — po pierwszym udanym discovery kolejne synce lecą prosto
  // do pętli folderów z tego, co już wiemy. Koszt: nie wykryjemy automatycznie
  // zmiany nazwy folderu na serwerze ani nowo utworzonego Archiwum bez
  // ręcznego "resetu" (usunięcia wierszy sent/trash/archive z mail_folders) —
  // świadomy kompromis, do rewizji, jeśli kiedyś stanie się to problemem.
  const knownSpecialFolders = (await sql`
    SELECT 1 FROM mail_folders WHERE role IN ('sent', 'trash', 'archive') LIMIT 1;
  `) as unknown as unknown[];
  let discovered: Record<MailFolderRole, DiscoveredFolder | null> | null = null;
  if (knownSpecialFolders.length === 0) {
    try {
      discovered = await discoverMailFoldersOnce();
      console.log(`[mailSync:timing] po discoverMailFoldersOnce: ${Date.now() - t0}ms — mapowanie:`, JSON.stringify(discovered));
    } catch (e) {
      console.error("[mailSync] discoverMailFoldersOnce nie powiodło się — pomijam foldery specjalne w tym przebiegu", e);
    }
    if (discovered) {
      for (const role of ["sent", "trash", "archive"] as const) {
        const found = discovered[role];
        if (found) await upsertDiscoveredFolder(sql, role, found);
      }
    }
  } else {
    console.log(`[mailSync:timing] discovery pominięte (już znane), t=${Date.now() - t0}ms`);
  }

  const ownAddr = mailboxConfig().user.toLowerCase();

  const folderRows = (await sql`
    SELECT id, role, imap_path, uidvalidity, last_seen_uid FROM mail_folders;
  `) as unknown as FolderCursorRow[];
  console.log(`[mailSync:timing] przed pętlą folderów (${Date.now() - t0}ms) — wiersze:`, JSON.stringify(folderRows));

  // Kontekst wątkowania — ładowany RAZ, dzielony między wszystkie foldery
  // (mutowany w locie, patrz komentarz przy ThreadContext) tego przebiegu.
  const threadCtx = await loadThreadContext(sql);

  // Każdy folder = osobne połączenie IMAP (TLS + AUTH + SELECT) — sekwencyjne
  // wołanie ich jedno po drugim (jak przy jednym INBOX-ie) sumowałoby czas
  // WSZYSTKICH połączeń. Foldery są od siebie niezależne (własny kursor,
  // własne wiersze do zapisania), więc lecą równolegle — czas syncu ograniczony
  // przez NAJWOLNIEJSZY folder, nie sumę wszystkich. `allSettled`, nie `all`:
  // awaria jednego folderu (np. serwer akurat wolny na Trash) nie może
  // przerwać zapisu pozostałych — syncOneFolder() już łapie własne błędy
  // fetchu dla ról innych niż 'inbox' (zwraca puste wyniki), więc odrzucenie
  // tu praktycznie zdarza się tylko dla 'inbox' (świadomie przepuszczane
  // dalej, jak w oryginalnym, jednofolderowym kodzie).
  const settled = await Promise.allSettled(folderRows.map((folder) => syncOneFolder(sql, folder, ownAddr, t0, threadCtx)));
  console.log(`[mailSync:timing] po wszystkich folderach: ${Date.now() - t0}ms`);

  let fetched = 0;
  let saved = 0;
  let matched = 0;
  let unassigned = 0;
  let ignored = 0;
  let inboxError: unknown = null;

  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      fetched += result.value.fetched;
      saved += result.value.saved;
      matched += result.value.matched;
      unassigned += result.value.unassigned;
      ignored += result.value.ignored;
    } else if (folderRows[i].role === "inbox") {
      inboxError = result.reason;
    }
  });

  if (inboxError) throw inboxError;

  console.log(`[mailSync:timing] CAŁKOWITY czas: ${Date.now() - t0}ms — fetched=${fetched} saved=${saved}`);
  return { fetched, saved, matched, unassigned, ignored };
}

/** Upsertuje jeden odkryty folder specjalnego użycia do `mail_folders`. Nowa
 * rola startuje kursor "od teraz" (bez historii — decyzja właściciela
 * 2026-07-16); zmiana ścieżki względem zapisanej resetuje kursor do 0
 * (analogicznie do zmiany UIDVALIDITY). */
async function upsertDiscoveredFolder(
  sql: ReturnType<typeof getSql>,
  role: MailFolderRole,
  found: DiscoveredFolder
): Promise<void> {
  const rows = (await sql`SELECT id, imap_path FROM mail_folders WHERE role = ${role};`) as unknown as { id: string; imap_path: string }[];
  const existing = rows[0];

  if (!existing) {
    const start = await getFolderCursorStart(found.path).catch((e) => {
      console.error(
        `[mailSync] nie udało się wyznaczyć punktu startowego dla nowego folderu ${role} (${found.path}) — zaczynam od 0 (pełna historia tego folderu trafi do bazy przy najbliższym syncu)`,
        e
      );
      return { highestUid: 0, uidValidity: null as number | null };
    });
    await sql`
      INSERT INTO mail_folders (id, role, imap_path, special_use, uidvalidity, last_seen_uid)
      VALUES (${randomUUID()}, ${role}, ${found.path}, ${found.specialUse}, ${start.uidValidity}, ${start.highestUid})
      ON CONFLICT (role) DO NOTHING;
    `;
    return;
  }

  if (existing.imap_path !== found.path) {
    console.warn(`[mailSync] folder ${role} zmienił ścieżkę (${existing.imap_path} → ${found.path}) — resetuję kursor.`);
    await sql`
      UPDATE mail_folders
      SET imap_path = ${found.path}, special_use = ${found.specialUse}, last_seen_uid = 0, uidvalidity = NULL
      WHERE role = ${role};
    `;
    return;
  }

  await sql`UPDATE mail_folders SET special_use = ${found.specialUse} WHERE role = ${role};`;
}

/** Synchronizuje jeden folder (własny kursor, własna logika zapisu wg roli).
 * Błąd fetchu tego folderu (np. serwer offline) nie zatrzymuje syncu
 * pozostałych — jedna felerna skrzynka nie może wywrócić całego przebiegu. */
async function syncOneFolder(
  sql: ReturnType<typeof getSql>,
  folder: FolderCursorRow,
  ownAddr: string,
  t0: number,
  threadCtx: ThreadContext
): Promise<SyncResult> {
  const empty: SyncResult = { fetched: 0, saved: 0, matched: 0, unassigned: 0, ignored: 0 };
  let sinceUid = Number(folder.last_seen_uid) || 0;
  console.log(`[mailSync:timing] ${folder.role} (${folder.imap_path}) start fetch, sinceUid=${sinceUid}, t=${Date.now() - t0}ms`);

  let batch: Awaited<ReturnType<typeof fetchMessagesInFolder>>;
  try {
    batch = await fetchMessagesInFolder(folder.imap_path, sinceUid);
    console.log(
      `[mailSync:timing] ${folder.role} fetch gotowy, t=${Date.now() - t0}ms, messages=${batch.messages.length}, highestUid=${batch.highestUid}`
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sql`UPDATE mail_folders SET last_error = ${msg.slice(0, 500)}, last_sync_at = now() WHERE id = ${folder.id};`;
    console.error(`[mailSync] fetch folderu ${folder.role} (${folder.imap_path}) nie powiódł się`, e);
    if (folder.role === "inbox") throw e; // INBOX to nadal główna, oczekiwana ścieżka — jej błąd ma wypłynąć do UI jak dotąd.
    return empty;
  }

  // Serwer przenumerował folder (odtworzenie z backupu, migracja) — stare
  // UID-y wskazują teraz inne wiadomości. Czytamy od zera; dedup po
  // message_id chroni przed duplikatami.
  const prevValidity = folder.uidvalidity != null ? Number(folder.uidvalidity) : null;
  if (batch.uidValidity != null && prevValidity != null && batch.uidValidity !== prevValidity) {
    console.warn(`[mailSync] UIDVALIDITY folderu ${folder.role} zmieniła się (${prevValidity} → ${batch.uidValidity}) — czytam od nowa.`);
    sinceUid = 0;
    try {
      batch = await fetchMessagesInFolder(folder.imap_path, 0);
    } catch (e) {
      console.error(`[mailSync] ponowny fetch folderu ${folder.role} po zmianie UIDVALIDITY nie powiódł się`, e);
      if (folder.role === "inbox") throw e;
      return empty;
    }
  }

  let saved = 0;
  let matched = 0;
  let unassigned = 0;
  let ignored = 0;

  for (const msg of batch.messages) {
    try {
      if (folder.role === "inbox") {
        const outcome = await saveIncoming(sql, msg, threadCtx);
        if (outcome === "duplicate") continue;
        saved++;
        if (outcome === "ignored") ignored++;
        else if (outcome === "matched") matched++;
        else unassigned++;
      } else if (folder.role === "sent") {
        const outcome = await saveOutgoingFromServer(sql, msg, threadCtx);
        if (outcome === "duplicate") continue;
        saved++;
        if (outcome === "matched") matched++;
        else unassigned++;
      } else {
        // trash / archive — lekki odczyt: to dane już raz odrzucone przez
        // właściciela, świadomie BEZ klasyfikacji/dopasowania/wpisu na oś
        // kontaktu (nie mają automatycznie "ożywać" jako nowa aktywność).
        const outcome = await saveArchivedOrTrashed(sql, msg, folder.role, ownAddr, threadCtx);
        if (outcome === "saved") saved++;
      }
    } catch (e) {
      // Jedna felerna wiadomość nie może zatrzymać całego syncu — ten sam
      // wzorzec "łykaj błędy per-item", co w cronie przy przypomnieniach.
      console.error(`[mailSync] nie udało się zapisać wiadomości z folderu ${folder.role}`, msg.messageId, e);
    }
  }

  await sql`
    UPDATE mail_folders
    SET last_seen_uid = ${Math.max(batch.highestUid, sinceUid)},
        uidvalidity = ${batch.uidValidity},
        last_sync_at = now(),
        last_error = NULL
    WHERE id = ${folder.id};
  `;

  console.log(
    `[mailSync:timing] ${folder.role} GOTOWE, t=${Date.now() - t0}ms, fetched=${batch.messages.length} saved=${saved} matched=${matched} unassigned=${unassigned} ignored=${ignored}`
  );
  return { fetched: batch.messages.length, saved, matched, unassigned, ignored };
}

/** Zapisuje mail widziany w folderze Wysłane. `from_addr` tej wiadomości to
 * zawsze NASZ własny adres (wysłaliśmy ją) — dopasowanie kontaktu idzie po
 * ODBIORCY (to_addr/cc_addr), NIE po nadawcy jak w saveIncoming(). Konflikt
 * po message_id aktualizuje `folder`, jeśli się zmienił (np. mail przeniesiony
 * później do Archiwum w Outlooku) — w przeciwieństwie do saveIncoming(),
 * gdzie idempotentne "nic nie rób" jest właściwym zachowaniem dla INBOX-a.
 *
 * ⚠️ WYJĄTEK: NIGDY nie nadpisuj folderu, jeśli wiadomość jest już w
 * `'inbox'`. Mail wysłany DO SIEBIE (self-mail, częsty sposób testowania)
 * fizycznie istnieje w DWÓCH folderach na serwerze naraz (Wysłane — nasza
 * kopia, Odebrane — bo jesteśmy też odbiorcą) pod TYM SAMYM message_id, a
 * nasz schemat trzyma jeden wiersz na message_id. Bez tej straży skan
 * Wysłane potrafił "podkraść" wiadomość z Odebranych (zgłoszone przez
 * właściciela 2026-07-16: self-mail zniknął z Odebranych po pojawieniu się
 * w Wysłane) — Odebrane to kolejka "wymaga reakcji", więc priorytet ma
 * pozostać tam widoczna, nawet kosztem niewidoczności w Wysłane.
 *
 * ⚠️ DRUGA POPRAWKA (2026-07-16, luka w powyższej): gdy wiadomość zostanie
 * RĘCZNIE zarchiwizowana/usunięta z Odebranych (folder już NIE 'inbox'), straż
 * wyżej przestaje chronić — ten sam self-mail, odkryty później w Wysłane,
 * miał wtedy nadpisywany TYLKO `folder`, a `kierunek`/`status` zostawały ze
 * starego zapisu ('in'/'nowy') — wiadomość lądowała w zakładce "Wysłane" z
 * ikoną koperty i tagiem "Do odpowiedzi" (zgłoszone przez właściciela).
 * `ON CONFLICT` aktualizuje teraz też `kierunek`/`status` w tym samym SET —
 * skoro sync i tak w tym momencie decyduje, że wiersz należy do Wysłane, ma
 * być spójny ze wszystkimi trzema polami naraz, nie tylko folderem. */
async function saveOutgoingFromServer(sql: ReturnType<typeof getSql>, msg: FetchedMessage, threadCtx: ThreadContext): Promise<"matched" | "unassigned" | "duplicate"> {
  const candidateAddrs = [msg.toAddr, ...msg.ccAddr.split(",").map((a) => a.trim())].filter(Boolean);
  let match: { type: "client" | "lead"; id: string } | undefined;
  for (const addr of candidateAddrs) {
    const found = (await findContactsByEmail(addr))[0];
    if (found) {
      match = found;
      break;
    }
  }
  const clientId = match?.type === "client" ? match.id : null;
  const leadId = match?.type === "lead" ? match.id : null;

  const threadId = resolveThreadId(
    { message_id: msg.messageId, inReplyTo: msg.inReplyTo, refs: msg.refs, subject: msg.subject, fromAddr: msg.fromAddr, toAddr: msg.toAddr, ccAddr: msg.ccAddr, receivedAt: msg.receivedAt },
    threadCtx
  );

  const id = randomUUID();
  const written = (await sql`
    INSERT INTO mail_messages (
      id, uid, kierunek, folder, client_id, lead_id, from_addr, from_name, to_addr, cc_addr,
      subject, body_text, body_html, message_id, in_reply_to, refs, thread_id, status, received_at
    ) VALUES (
      ${id}, ${msg.uid}, 'out', 'sent', ${clientId}, ${leadId}, ${msg.fromAddr}, ${msg.fromName}, ${msg.toAddr}, ${msg.ccAddr},
      ${msg.subject}, ${msg.bodyText}, ${msg.bodyHtml}, ${msg.messageId}, ${msg.inReplyTo}, ${msg.refs}, ${threadId},
      'obsłużony', ${msg.receivedAt.toISOString()}
    )
    ON CONFLICT (message_id) DO UPDATE SET
      folder = EXCLUDED.folder,
      kierunek = EXCLUDED.kierunek,
      status = EXCLUDED.status
    WHERE mail_messages.folder <> EXCLUDED.folder AND mail_messages.folder <> 'inbox'
    RETURNING id;
  `) as unknown as { id: string }[];

  if (written.length === 0) return "duplicate";
  registerThreadedRow(threadCtx, { message_id: msg.messageId, thread_id: threadId, subject: msg.subject, from_addr: msg.fromAddr, to_addr: msg.toAddr, cc_addr: msg.ccAddr, received_at: msg.receivedAt });

  // `written[0].id`, nie lokalne `id` — z tego samego powodu, co przy
  // logMailOnTimeline() niżej: przy ON CONFLICT to jest id ISTNIEJĄCEGO
  // wiersza, a klucz obcy w mail_attachments wskazuje właśnie na niego.
  await saveAttachmentMeta(sql, written[0].id, msg.attachments);

  if (!match) return "unassigned";

  // UWAGA: gdy INSERT trafił w ON CONFLICT (wiadomość już istniała pod INNYM
  // id — np. wcześniej zapisana przez saveIncoming(), bo self-mail wpadł do
  // INBOX-a i Sent pod tym samym message_id), `written[0].id` to PRAWDZIWY id
  // istniejącego wiersza, różny od lokalnie wygenerowanego `id` powyżej.
  // Użycie tego drugiego tutaj psuło klucz obcy client_activity/lead_activity
  // (błąd na produkcji 2026-07-16: "Key (mail_message_id)=... is not present
  // in table mail_messages").
  await logMailOnTimeline(sql, {
    mailId: written[0].id,
    match,
    text: mailSummaryLine(msg.subject, msg.bodyText),
    kierunek: "wychodzacy",
  });
  return "matched";
}

/** Lekki zapis dla Kosz/Archiwum — bez klasyfikacji, dopasowania klienta czy
 * wpisu na oś kontaktu (patrz komentarz w syncOneFolder). Konflikt po
 * message_id aktualizuje `folder`, gdy się zmienił — np. mail przeniesiony
 * z Wysłane do Kosza w Outlooku poprawnie "przeskakuje" na kolejnym syncu
 * tego, w jakim folderze go dziś widzimy. Aktualizuje przy okazji
 * `kierunek`/`status` (ten sam problem i poprawka co w
 * saveOutgoingFromServer() wyżej) — mail zarchiwizowany/skasowany
 * bezpośrednio w Outlooku (nie przez panel) ma tu przestać wisieć jako
 * "Do odpowiedzi" tylko dlatego, że jego pierwszy zapis (przez
 * saveIncoming()) tak go oznaczył, zanim trafił do Kosza/Archiwum. */
async function saveArchivedOrTrashed(
  sql: ReturnType<typeof getSql>,
  msg: FetchedMessage,
  folder: "trash" | "archive",
  ownAddr: string,
  threadCtx: ThreadContext
): Promise<"saved" | "duplicate"> {
  const kierunek = msg.fromAddr.toLowerCase() === ownAddr ? "out" : "in";
  const threadId = resolveThreadId(
    { message_id: msg.messageId, inReplyTo: msg.inReplyTo, refs: msg.refs, subject: msg.subject, fromAddr: msg.fromAddr, toAddr: msg.toAddr, ccAddr: msg.ccAddr, receivedAt: msg.receivedAt },
    threadCtx
  );
  const id = randomUUID();
  const written = (await sql`
    INSERT INTO mail_messages (
      id, uid, kierunek, folder, from_addr, from_name, to_addr, cc_addr,
      subject, body_text, body_html, message_id, in_reply_to, refs, thread_id, status, received_at
    ) VALUES (
      ${id}, ${msg.uid}, ${kierunek}, ${folder}, ${msg.fromAddr}, ${msg.fromName}, ${msg.toAddr}, ${msg.ccAddr},
      ${msg.subject}, ${msg.bodyText}, ${msg.bodyHtml}, ${msg.messageId}, ${msg.inReplyTo}, ${msg.refs}, ${threadId},
      'obsłużony', ${msg.receivedAt.toISOString()}
    )
    ON CONFLICT (message_id) DO UPDATE SET
      folder = EXCLUDED.folder,
      kierunek = EXCLUDED.kierunek,
      status = EXCLUDED.status
    WHERE mail_messages.folder <> EXCLUDED.folder
    RETURNING id;
  `) as unknown as { id: string }[];

  if (written.length === 0) return "duplicate";
  registerThreadedRow(threadCtx, { message_id: msg.messageId, thread_id: threadId, subject: msg.subject, from_addr: msg.fromAddr, to_addr: msg.toAddr, cc_addr: msg.ccAddr, received_at: msg.receivedAt });
  await saveAttachmentMeta(sql, written[0].id, msg.attachments);
  return "saved";
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
           list_unsubscribe, precedence, auto_submitted, list_unsubscribe_url
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
    list_unsubscribe_url: string | null;
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
        ? {
            listUnsubscribe: r.list_unsubscribe,
            precedence: r.precedence,
            autoSubmitted: r.auto_submitted,
            listUnsubscribeUrl: r.list_unsubscribe_url,
          }
        : undefined);

    const kategoria = classifyMail({
      fromAddr: r.from_addr,
      subject: r.subject,
      hints,
      knownContact: Boolean(r.client_id || r.lead_id),
    });
    // Ta sama reguła co przy zapisie nowej wiadomości — patrz `isSelfReport`.
    // Bez tego raporty panelu, które już leżą w skrzynce, zostałyby na zawsze
    // „nowe" i dalej podbijały licznik Pulpitu.
    const wlasnyRaport = isMailboxConfigured() && isSelfReport(r.from_addr, r.subject, mailboxConfig().user);
    const newStatus =
      (kategoria === "reklama" || wlasnyRaport) && r.status === "nowy" ? "zignorowany" : r.status;

    await sql`
      UPDATE mail_messages
      SET kategoria = ${kategoria},
          status = ${newStatus},
          list_unsubscribe = ${hints ? hints.listUnsubscribe : r.list_unsubscribe},
          precedence = ${hints ? hints.precedence : r.precedence},
          auto_submitted = ${hints ? hints.autoSubmitted : r.auto_submitted},
          list_unsubscribe_url = ${hints ? hints.listUnsubscribeUrl : r.list_unsubscribe_url}
      WHERE id = ${r.id};
    `;
    updated++;
  }
  return { updated };
}

/**
 * Dociąga DW (Cc) wiadomościom pobranym PRZED wprowadzeniem kolumny
 * `cc_addr` (2026-07-15, Etap 1 Modułu 4b) — bez tego "Odpowiedz wszystkim"
 * na starszej korespondencji nie miałoby skąd wziąć adresów. Ten sam wzorzec
 * co backfillCategories(): dociągamy TANI fragment (sam nagłówek, nie całą
 * treść) po UID-zie, bo dedup po message_id nie pozwala pobrać wiadomości
 * ponownie w całości.
 */
export async function backfillCc(): Promise<{ updated: number }> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, uid FROM mail_messages
    WHERE kierunek = 'in' AND cc_addr IS NULL AND uid IS NOT NULL
    LIMIT 300;
  `) as unknown as { id: string; uid: number }[];
  if (rows.length === 0 || !isMailboxConfigured()) return { updated: 0 };

  const ccByUid = await fetchCcByUids(rows.map((r) => r.uid)).catch((e) => {
    console.error("[mailSync] nie udało się dociągnąć DW ze skrzynki", e);
    return new Map<number, string>();
  });
  if (ccByUid.size === 0) return { updated: 0 };

  let updated = 0;
  for (const r of rows) {
    const cc = ccByUid.get(r.uid);
    if (cc === undefined) continue; // serwer już nie zna tego UID-a — zostaw w spokoju
    await sql`UPDATE mail_messages SET cc_addr = ${cc} WHERE id = ${r.id};`;
    updated++;
  }
  return { updated };
}

/**
 * Dopasowuje ponownie maile, które w chwili pobrania nie miały pasującego
 * klienta/leada — bo `saveIncoming()` sprawdza adres TYLKO raz, przy
 * zapisie. Właściciel dopiero buduje bazę klientów, więc "mail przyszedł
 * przed kontaktem" jest normalnym, codziennym przypadkiem, nie wyjątkiem
 * (decyzja 2026-07-15, `docs/plany-modulow/04d-...md` pkt 1).
 *
 * Reklamy pomijamy — nie ma sensu dopinać newslettera do klienta, nawet
 * gdyby jego adres akurat pasował.
 */
export async function rematchUnassigned(): Promise<{ matched: number }> {
  // Wołane też spoza syncMailbox() (POST/PATCH klientów i leadów), gdzie
  // nikt wcześniej nie gwarantuje, że schemat poczty już istnieje.
  await ensureMailSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, from_addr, subject, body_text
    FROM mail_messages
    WHERE kierunek = 'in' AND client_id IS NULL AND lead_id IS NULL
      AND (kategoria IS NULL OR kategoria <> 'reklama')
    LIMIT 300;
  `) as unknown as { id: string; from_addr: string; subject: string; body_text: string }[];
  if (rows.length === 0) return { matched: 0 };

  let matched = 0;
  for (const r of rows) {
    const match = (await findContactsByEmail(r.from_addr))[0];
    if (!match) continue;

    const clientId = match.type === "client" ? match.id : null;
    const leadId = match.type === "lead" ? match.id : null;
    await sql`UPDATE mail_messages SET client_id = ${clientId}, lead_id = ${leadId} WHERE id = ${r.id};`;
    await logMailOnTimeline(sql, {
      mailId: r.id,
      match,
      text: mailSummaryLine(r.subject, r.body_text),
      kierunek: "przychodzacy",
    });
    matched++;
  }
  return { matched };
}

type SaveOutcome = "matched" | "unassigned" | "ignored" | "duplicate";

/** Zapisz jedną przychodzącą wiadomość + (gdy dopasowana) wpis na osi
 * kontaktu klienta/leada. */
/**
 * Zapisuje OPIS załączników wiadomości — nazwę, typ, rozmiar i numer części
 * MIME. Bajtów tu nie ma i być nie powinno: treść ściągamy z IMAP dopiero na
 * żądanie (decyzja właściciela 2026-07-20, patrz lib/mail.ts).
 *
 * `has_attachments` na samej wiadomości to denormalizacja pod ikonkę spinacza
 * na liście — ustawiamy ją TYLKO gdy coś faktycznie jest, żeby lista mogła
 * ufać tej kolumnie bez złączenia.
 *
 * Awaria zapisu metadanych NIE może wywrócić syncu: wiadomość z treścią jest
 * warta więcej niż lista jej plików, a te i tak da się odtworzyć — wystarczy
 * ponownie odczytać strukturę ze skrzynki.
 */
async function saveAttachmentMeta(
  sql: ReturnType<typeof getSql>,
  messageId: string,
  attachments: ParsedAttachmentMeta[]
): Promise<void> {
  if (!attachments || attachments.length === 0) return;
  try {
    for (const a of attachments) {
      await sql`
        INSERT INTO mail_attachments (id, message_id, part_id, filename, mime, size_bytes)
        VALUES (${randomUUID()}, ${messageId}, ${a.partId}, ${a.filename}, ${a.mime}, ${a.sizeBytes})
        ON CONFLICT (message_id, part_id) DO NOTHING;
      `;
    }
    await sql`UPDATE mail_messages SET has_attachments = true WHERE id = ${messageId};`;
  } catch (e) {
    console.error(`[mailSync] nie udało się zapisać opisu załączników wiadomości ${messageId}`, e);
  }
}

async function saveIncoming(sql: ReturnType<typeof getSql>, msg: FetchedMessage, threadCtx: ThreadContext): Promise<SaveOutcome> {
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
  // Raport, który panel wysłał sam do siebie, też wchodzi od razu jako
  // „zignorowany" — ale kategorię zostawiamy prawdziwą. Wrzucenie go do
  // „Reklamy" byłoby wygodniejsze (ta ścieżka już istnieje), tylko że
  // etykieta kłamałaby o tym, czym ten mail jest. Powód, dla którego to
  // w ogóle robimy, stoi przy `isSelfReport`.
  const wlasnyRaport = isSelfReport(msg.fromAddr, msg.subject, mailboxConfig().user);
  const status = kategoria === "reklama" || wlasnyRaport ? "zignorowany" : "nowy";

  const threadId = resolveThreadId(
    { message_id: msg.messageId, inReplyTo: msg.inReplyTo, refs: msg.refs, subject: msg.subject, fromAddr: msg.fromAddr, toAddr: msg.toAddr, ccAddr: msg.ccAddr, receivedAt: msg.receivedAt },
    threadCtx
  );

  const id = randomUUID();
  const inserted = (await sql`
    INSERT INTO mail_messages (
      id, uid, kierunek, client_id, lead_id, from_addr, from_name, to_addr, cc_addr,
      subject, body_text, body_html, message_id, in_reply_to, refs, thread_id, status, kategoria,
      list_unsubscribe, precedence, auto_submitted, list_unsubscribe_url, received_at
    ) VALUES (
      ${id}, ${msg.uid}, 'in', ${clientId}, ${leadId}, ${msg.fromAddr}, ${msg.fromName}, ${msg.toAddr}, ${msg.ccAddr},
      ${msg.subject}, ${msg.bodyText}, ${msg.bodyHtml}, ${msg.messageId}, ${msg.inReplyTo}, ${msg.refs}, ${threadId},
      ${status}, ${kategoria},
      ${msg.hints.listUnsubscribe}, ${msg.hints.precedence}, ${msg.hints.autoSubmitted}, ${msg.hints.listUnsubscribeUrl},
      ${msg.receivedAt.toISOString()}
    )
    ON CONFLICT (message_id) DO NOTHING
    RETURNING id;
  `) as unknown as { id: string }[];

  // Pusty RETURNING = ON CONFLICT zadziałał, czyli znaliśmy już tę wiadomość.
  if (inserted.length === 0) return "duplicate";
  registerThreadedRow(threadCtx, { message_id: msg.messageId, thread_id: threadId, subject: msg.subject, from_addr: msg.fromAddr, to_addr: msg.toAddr, cc_addr: msg.ccAddr, received_at: msg.receivedAt });

  await saveAttachmentMeta(sql, id, msg.attachments);

  // Screener nowych nadawców (Moduł 4, Etap 3) — 'oferta' jest jedyną
  // kategorią przypisywaną naprawdę nieznanym, nie-spamowym nadawcom (patrz
  // classifyMail w lib/mail.ts). ON CONFLICT DO NOTHING: nie nadpisuje decyzji
  // (approved/blocked) już podjętej wcześniej dla tego adresu.
  if (kategoria === "oferta") {
    await sql`
      INSERT INTO mail_senders (id, email, status)
      VALUES (${randomUUID()}, ${msg.fromAddr}, 'pending')
      ON CONFLICT (email) DO NOTHING;
    `;
  }

  // Centrum powiadomień (Moduł 24). Dzwoni tylko to, co przeszło screener
  // (`status === "nowy"`, czyli kategoria ≠ reklama) — newsletter, który panel
  // sam odłożył na bok, nie jest zdarzeniem, o którym trzeba kogokolwiek
  // informować. Wpis powstaje PRZED `return "unassigned"` niżej, bo mail od
  // kogoś, kogo jeszcze nie ma w CRM, to często najważniejsza wiadomość dnia
  // (nowe zapytanie) — właśnie jej nie wolno przegapić.
  if (status === "nowy") {
    await notify({
      kind: "mail_new",
      title: `Nowa wiadomość — ${msg.fromName || msg.fromAddr}`,
      body: msg.subject || "(bez tematu)",
      entity: "mail",
      entityId: id,
      dedupeKey: `mail_new:${id}`,
    });
  }

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
