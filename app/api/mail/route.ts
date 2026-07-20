import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailSchema } from "@/lib/db";
import { MAIL_STATUSES, MAIL_CATEGORIES, MAIL_FOLDERS, type MailMessageWithLinks } from "@/lib/mail";
import { isMailboxConfigured } from "@/lib/mailbox";
import { runDueOutbox } from "@/lib/mailOutbox";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/mail?folder=inbox&status=nowy&filter=unassigned — lista wiadomości
 * w JEDNYM folderze (domyślnie 'inbox' — zachowuje dawne zachowanie sprzed
 * Etapu 2 Modułu 4b dla wołających bez tego parametru).
 *
 * Nazwy powiązanych rekordów (klient/lead/faktura) dociągamy jednym LEFT JOIN,
 * żeby lista nie musiała odpytywać o każdego klienta osobno.
 * `body_html` świadomie POMIJAMY na liście — bywa ciężki (kilkaset kB przy
 * rozbudowanych mailach), a widać go dopiero w podglądzie pojedynczej
 * wiadomości.
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await ensureMailSchema();
  const sql = getSql();

  // Wysyłka odłożona (Faza 8) — kolejkę ruszamy PRZY OKAZJI wejścia w Pocztę,
  // bo cron na Vercelu chodzi raz dziennie. Bez tego mail odłożony na 14:00
  // czekałby do jutra rana.
  //
  // `await`, nie „wystrzel i zapomnij": funkcja serverless bywa uśpiona zaraz
  // po odpowiedzi, więc niedokończona obietnica po prostu by przepadła —
  // i wysyłka działałaby „czasami". Gdy nic nie czeka (przypadek zwykły), to
  // jedno tanie zapytanie po indeksie częściowym; gdy coś czeka, opóźnienie
  // jest ceną faktycznego wysłania poczty.
  await runDueOutbox().catch((e) => {
    // Awaria kolejki NIE może zabrać ze sobą listy wiadomości — właściciel
    // przyszedł tu czytać pocztę, nie wysyłać zaległości.
    console.error("[GET /api/mail] ruszenie kolejki wysyłki nie powiodło się", e);
  });

  const folderParam = req.nextUrl.searchParams.get("folder");
  const folder = (MAIL_FOLDERS as readonly string[]).includes(folderParam || "") ? (folderParam as string) : "inbox";
  const statusParam = req.nextUrl.searchParams.get("status");
  const status = (MAIL_STATUSES as readonly string[]).includes(statusParam || "") ? statusParam : null;
  const unassignedOnly = req.nextUrl.searchParams.get("filter") === "unassigned";
  const katParam = req.nextUrl.searchParams.get("kategoria");
  const kategoria = (MAIL_CATEGORIES as readonly string[]).includes(katParam || "") ? katParam : null;
  // Wyszukiwarka — po nadawcy, temacie i treści. Puste = brak filtra.
  // Escape'ujemy znaki wieloznaczne ILIKE, żeby "%" wpisany w pole szukania
  // był traktowany jako zwykły znak, a nie "dopasuj wszystko".
  const qRaw = (req.nextUrl.searchParams.get("q") || "").trim();
  const q = qRaw ? `%${qRaw.replace(/([%_\\])/g, "\\$1")}%` : null;

  // Neon HTTP nie składa fragmentów SQL, więc zamiast budować WHERE
  // dynamicznie, przekazujemy oba filtry jako parametry i wyłączamy je
  // NULL-em (ten sam wzorzec co w innych listach panelu). `folder` NIE jest
  // wyłączane przez wyszukiwanie (w przeciwieństwie do status/kategoria) —
  // szukanie działa w obrębie aktualnie wybranej "skrzynki", tak jak w
  // Apple Mail/Outlooku, dopóki właściciel nie poprosi o "szukaj wszędzie".
  const rows = (await sql`
    SELECT m.id, m.uid, m.kierunek, m.folder, m.client_id, m.lead_id, m.invoice_id,
           m.from_addr, m.from_name, m.to_addr, m.subject, m.body_text,
           '' AS body_html,
           m.message_id, m.in_reply_to, m.refs, m.thread_id, m.status, m.kategoria, m.list_unsubscribe_url, m.flagged,
           m.snooze_until, m.has_attachments,
           (mt.thread_id IS NOT NULL) AS muted,
           m.received_at, m.handled_at,
           c.nazwa AS client_nazwa, c.status AS client_status, l.firma AS lead_nazwa, i.numer AS invoice_numer,
           ms.status AS sender_status
    FROM mail_messages m
    LEFT JOIN clients c ON c.id = m.client_id
    LEFT JOIN leads l ON l.id = m.lead_id
    LEFT JOIN invoices i ON i.id = m.invoice_id
    LEFT JOIN mail_senders ms ON ms.email = m.from_addr
    LEFT JOIN mail_muted_threads mt ON mt.thread_id = m.thread_id
    WHERE m.folder = ${folder}
      AND (${status}::text IS NULL OR m.status = ${status})
      AND (${unassignedOnly} = false OR (m.client_id IS NULL AND m.lead_id IS NULL))
      AND (${kategoria}::text IS NULL OR m.kategoria = ${kategoria})
      AND (
        ${q}::text IS NULL
        OR m.from_addr ILIKE ${q} OR m.from_name ILIKE ${q}
        OR m.subject ILIKE ${q} OR m.body_text ILIKE ${q}
      )
    ORDER BY m.received_at DESC
    LIMIT 200;
  `) as unknown as MailMessageWithLinks[];

  // Liczniki dla KAŻDEJ kategorii (właściciel 2026-07-15: "przy zapytaniu
  // pokazuje, przy reklamie nie"). Liczą wiadomości przychodzące w danej
  // szufladce niezależnie od statusu — inaczej "Reklama" pokazywałaby 0, bo
  // reklamy z definicji są od razu 'zignorowany'. Wyjątkiem jest `nowe`,
  // które z natury dotyczy tylko nieobsłużonych. Wszystkie te liczniki są
  // świadomie ograniczone do folder='inbox' (Etap 2 Modułu 4b) — "Do
  // odpowiedzi"/"Rodzaj" to pojęcia sensowne tylko dla Odebranych, mail
  // przeniesiony do Archiwum/Kosza nie ma dalej "wymagać reakcji".
  // `sent`/`trash`/`archive` to zwykłe liczby wiadomości w danym folderze —
  // do liczników w sidebarze folderów.
  const [counts] = (await sql`
    SELECT
      /* Wyciszony wątek NIE liczy się do „do odpowiedzi" — o to właśnie
         chodzi w wyciszeniu: wiadomości zostają widoczne na liście, ale
         przestają wołać o reakcję. */
      COUNT(*) FILTER (WHERE m.status = 'nowy' AND m.kierunek = 'in' AND m.folder = 'inbox'
        AND COALESCE(ms.status,'') NOT IN ('pending','blocked')
        AND mt.thread_id IS NULL
        AND (m.snooze_until IS NULL OR m.snooze_until <= now()))::int AS nowe,
      COUNT(*) FILTER (WHERE m.client_id IS NULL AND m.lead_id IS NULL AND m.kierunek = 'in'
        AND m.status != 'zignorowany' AND m.folder = 'inbox'
        AND COALESCE(ms.status,'') NOT IN ('pending','blocked')
        AND (m.snooze_until IS NULL OR m.snooze_until <= now()))::int AS nieprzypisane,
      COUNT(*) FILTER (WHERE m.kierunek = 'in' AND m.folder = 'inbox' AND COALESCE(m.kategoria, 'inne') = 'oferta')::int AS oferta,
      COUNT(*) FILTER (WHERE m.kierunek = 'in' AND m.folder = 'inbox' AND COALESCE(m.kategoria, 'inne') = 'rachunek')::int AS rachunek,
      COUNT(*) FILTER (WHERE m.kierunek = 'in' AND m.folder = 'inbox' AND COALESCE(m.kategoria, 'inne') = 'urzedowe')::int AS urzedowe,
      COUNT(*) FILTER (WHERE m.kierunek = 'in' AND m.folder = 'inbox' AND COALESCE(m.kategoria, 'inne') = 'inne')::int AS inne,
      COUNT(*) FILTER (WHERE m.kierunek = 'in' AND m.folder = 'inbox' AND COALESCE(m.kategoria, 'inne') = 'reklama')::int AS reklama,
      COUNT(*) FILTER (WHERE m.kierunek = 'in' AND m.folder = 'inbox' AND ms.status = 'pending')::int AS pending_screener,
      COUNT(*) FILTER (WHERE m.kierunek = 'in' AND m.folder = 'inbox' AND c.status = 'Aktywny')::int AS vip,
      COUNT(*) FILTER (WHERE m.kierunek = 'in' AND m.folder = 'inbox' AND m.snooze_until IS NOT NULL AND m.snooze_until > now())::int AS snoozed,
      COUNT(*) FILTER (WHERE m.folder = 'inbox')::int AS folder_inbox,
      COUNT(*) FILTER (WHERE m.folder = 'sent')::int AS folder_sent,
      COUNT(*) FILTER (WHERE m.folder = 'trash')::int AS folder_trash,
      COUNT(*) FILTER (WHERE m.folder = 'archive')::int AS folder_archive
    FROM mail_messages m
    LEFT JOIN mail_senders ms ON ms.email = m.from_addr
    LEFT JOIN clients c ON c.id = m.client_id
    LEFT JOIN mail_muted_threads mt ON mt.thread_id = m.thread_id;
  `) as unknown as Record<string, number>[];

  return NextResponse.json({ messages: rows, counts, configured: isMailboxConfigured() });
}
