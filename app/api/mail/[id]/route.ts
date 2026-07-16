import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailSchema, ensureMailFoldersSchema } from "@/lib/db";
import { MAIL_STATUSES, mailSummaryLine, isPlausibleTimestamp, type MailMessageWithLinks } from "@/lib/mail";
import { logMailOnTimeline } from "@/lib/mailSync";
import { sanitizeMailHtml } from "@/lib/mailHtml";
import { isMailboxConfigured, moveMessage } from "@/lib/mailbox";

/** Cele MOVE dostępne z UI (Etap 2 Modułu 4b) — Drafts/Junk poza zakresem. */
const MOVE_TARGETS = ["inbox", "trash", "archive"] as const;
type MoveTarget = (typeof MOVE_TARGETS)[number];

export const runtime = "nodejs";

/**
 * GET /api/mail/[id] — pełna wiadomość + odkażony HTML.
 *
 * `?images=1` wczytuje zdalne obrazki (domyślnie blokowane — to tracking
 * pixele; patrz lib/mailHtml.ts). Odkażamy przy KAŻDYM odczycie, a nie raz
 * przy zapisie: gdyby w regułach znalazła się luka, poprawka działa od razu
 * na całej historii, bez migracji i bez ponownego pobierania poczty.
 * Surowy `body_html` NIE opuszcza serwera.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const allowImages = req.nextUrl.searchParams.get("images") === "1";

  await ensureMailSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT m.*, c.nazwa AS client_nazwa, c.status AS client_status, l.firma AS lead_nazwa, i.numer AS invoice_numer,
           ms.status AS sender_status
    FROM mail_messages m
    LEFT JOIN clients c ON c.id = m.client_id
    LEFT JOIN leads l ON l.id = m.lead_id
    LEFT JOIN invoices i ON i.id = m.invoice_id
    LEFT JOIN mail_senders ms ON ms.email = m.from_addr
    WHERE m.id = ${id};
  `) as unknown as MailMessageWithLinks[];

  const message = rows[0];
  if (!message) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { html, blockedImages } = sanitizeMailHtml(message.body_html || "", allowImages);

  // Pasek wątku (Moduł 4, Etap 3) — inne wiadomości TEGO SAMEGO wątku,
  // NIEZALEŻNIE od folderu (odpowiedź wysłana z panelu ląduje w Wysłane,
  // oryginał bywa w Odebranych — konwersacja ma sens tylko pokazana razem).
  // `message.thread_id` bywa `null` w wąskim oknie przed pierwszym
  // backfillThreadIds() — wtedy po prostu brak paska, bez błędu.
  const thread = message.thread_id
    ? ((await sql`
        SELECT id, subject, from_addr, from_name, kierunek, folder, status, received_at
        FROM mail_messages
        WHERE thread_id = ${message.thread_id} AND id != ${id}
        ORDER BY received_at ASC;
      `) as unknown as {
        id: string;
        subject: string;
        from_addr: string;
        from_name: string;
        kierunek: string;
        folder: string;
        status: string;
        received_at: string;
      }[])
    : [];

  return NextResponse.json({
    message: { ...message, body_html: "" },
    html,
    blockedImages,
    thread,
  });
}

/**
 * PATCH /api/mail/[id] — zmiana statusu ("Obsłużone"/"Zignoruj"/przywrócenie)
 * albo ręczne przypisanie do klienta/leada z kolejki "Nieprzypisane".
 *
 * Przypisanie dopisuje wiadomość na oś kontaktu wskazanego klienta/leada —
 * inaczej ręcznie przypięty mail byłby widoczny w Poczcie, ale niewidoczny
 * na karcie klienta, czyli dokładnie tam, gdzie właściciel go szuka.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as {
    status?: unknown;
    client_id?: unknown;
    lead_id?: unknown;
    move?: unknown;
    flagged?: unknown;
    senderDecision?: unknown;
    snoozeUntil?: unknown;
    nudgeDismissed?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  await ensureMailSchema();
  const sql = getSql();

  const existing = (await sql`SELECT * FROM mail_messages WHERE id = ${id};`) as unknown as {
    id: string;
    uid: number | null;
    folder: string;
    subject: string;
    body_text: string;
    from_addr: string;
    client_id: string | null;
    lead_id: string | null;
  }[];
  const mail = existing[0];
  if (!mail) return NextResponse.json({ error: "not found" }, { status: 404 });

  // "Usuń"/"Archiwizuj"/"Przywróć do Odebranych" (Etap 2 Modułu 4b) — to
  // ZAWSZE prawdziwy MOVE na serwerze (RFC 6851, patrz lib/mailbox.ts —
  // NIGDY \Deleted+EXPUNGE), osobna oś od `status` ("Wycisz" zostaje jak
  // było: chowa z kolejki w panelu, ale fizycznie zostaje w INBOX-ie —
  // decyzja właściciela 2026-07-16, dwie niezależne akcje).
  if (typeof body.move === "string") {
    if (!(MOVE_TARGETS as readonly string[]).includes(body.move)) {
      return NextResponse.json({ error: "invalid move target" }, { status: 400 });
    }
    const dest = body.move as MoveTarget;
    if (!isMailboxConfigured()) {
      return NextResponse.json({ error: "Skrzynka pocztowa nie jest skonfigurowana." }, { status: 503 });
    }
    if (mail.uid == null) {
      return NextResponse.json({ error: "Ta wiadomość nie ma znanego UID-a na serwerze — nie da się jej przenieść." }, { status: 422 });
    }
    if (mail.folder === dest) {
      return NextResponse.json({ error: "Wiadomość już jest w tym folderze." }, { status: 400 });
    }

    await ensureMailFoldersSchema();
    const folderRows = (await sql`SELECT role, imap_path FROM mail_folders WHERE role = ${mail.folder} OR role = ${dest};`) as unknown as {
      role: string;
      imap_path: string;
    }[];
    const sourcePath = folderRows.find((f) => f.role === mail.folder)?.imap_path;
    const destPath = folderRows.find((f) => f.role === dest)?.imap_path;

    if (!sourcePath) {
      return NextResponse.json(
        { error: `Nie znaleziono folderu źródłowego (${mail.folder}) na serwerze — poczekaj na kolejną synchronizację.` },
        { status: 502 }
      );
    }
    if (!destPath) {
      return NextResponse.json(
        { error: `Nie znaleziono folderu "${dest}" na serwerze pocztowej — sprawdź konfigurację skrzynki.` },
        { status: 502 }
      );
    }

    try {
      await moveMessage(sourcePath, mail.uid, destPath);
    } catch (e) {
      console.error("[PATCH /api/mail/:id] moveMessage nie powiodło się", e);
      return NextResponse.json({ error: "Nie udało się przenieść wiadomości na serwerze pocztowym." }, { status: 502 });
    }

    // Dopiero PO udanym MOVE na serwerze — stan bazy ma zawsze odzwierciedlać
    // stan serwera, nie wyprzedzać go. Kolejny sync i tak znalazłby tę samą
    // wiadomość w nowym folderze (dedup po message_id), ale UI nie powinno
    // czekać na to w nieskończoność.
    await sql`UPDATE mail_messages SET folder = ${dest} WHERE id = ${id};`;
  }

  if (typeof body.status === "string") {
    if (!(MAIL_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    // handled_at niesie "kiedy odhaczono" — przy powrocie do "nowy" musi
    // zniknąć, inaczej zostałaby data z poprzedniego odhaczenia.
    const handledAt = body.status === "obsłużony" ? new Date().toISOString() : null;
    await sql`UPDATE mail_messages SET status = ${body.status}, handled_at = ${handledAt} WHERE id = ${id};`;
  }

  // Flaga "ważne" (Moduł 4e, runda 2) — TYLKO lokalna, nie dotyka IMAP-a.
  if (typeof body.flagged === "boolean") {
    await sql`UPDATE mail_messages SET flagged = ${body.flagged} WHERE id = ${id};`;
  }

  // Screener nowych nadawców (Moduł 4, Etap 3) — decyzja "Zatwierdź"/"Zablokuj"
  // z baneru w podglądzie wiadomości. Upsert (nie goły UPDATE): odporne nawet
  // gdyby wywołanie przyszło bez istniejącego wcześniej wpisu 'pending'.
  if (typeof body.senderDecision === "string") {
    if (body.senderDecision !== "approved" && body.senderDecision !== "blocked") {
      return NextResponse.json({ error: "invalid sender decision" }, { status: 400 });
    }
    if (!mail.from_addr) {
      return NextResponse.json({ error: "Ta wiadomość nie ma adresu nadawcy." }, { status: 400 });
    }
    await sql`
      INSERT INTO mail_senders (id, email, status, decided_at)
      VALUES (${randomUUID()}, ${mail.from_addr}, ${body.senderDecision}, now())
      ON CONFLICT (email) DO UPDATE SET status = EXCLUDED.status, decided_at = now();
    `;
  }

  // Snooze / Odłóż (Moduł 4, Etap 3) — `null` = "Wróć teraz"/nigdy nie było
  // odłożone, string = ISO jednej z NAZWANYCH opcji snoozeOptions()
  // (lib/mail.ts). Właściciel nigdy nie wpisuje tu daty ręcznie (CLAUDE.md,
  // pułapka <input type="date">) — mimo to walidujemy, bo endpoint jest
  // wywoływalny bezpośrednio. Widoczność wraca sama przy odczycie, bez
  // dodatkowej logiki tutaj (patrz lib/db.ts).
  if (body.snoozeUntil === null || typeof body.snoozeUntil === "string") {
    if (typeof body.snoozeUntil === "string" && !isPlausibleTimestamp(body.snoozeUntil)) {
      return NextResponse.json({ error: "invalid snooze date" }, { status: 400 });
    }
    await sql`UPDATE mail_messages SET snooze_until = ${body.snoozeUntil} WHERE id = ${id};`;
  }

  // Nudge/Follow-up (Moduł 4f) — "przestań mi przypominać o tym wątku".
  // TYLKO `true` zapisuje wyciszenie; w przeciwieństwie do snooze nie ma tu
  // "wróć teraz" — jedyny naturalny powrót to wysłanie kolejnej wiadomości w
  // wątku (patrz komentarz przy getNudgeThreads(), lib/db.ts).
  if (body.nudgeDismissed === true) {
    await sql`UPDATE mail_messages SET nudge_dismissed_at = now() WHERE id = ${id};`;
  }

  // Ręczne przypisanie z kolejki "Nieprzypisane". Zawsze dokładnie jedna
  // strona relacji — przypisanie do klienta czyści leada i odwrotnie.
  const clientId = typeof body.client_id === "string" && body.client_id ? body.client_id : null;
  const leadId = typeof body.lead_id === "string" && body.lead_id ? body.lead_id : null;

  if (clientId || leadId) {
    await sql`UPDATE mail_messages SET client_id = ${clientId}, lead_id = ${leadId} WHERE id = ${id};`;

    // Nie dubluj wpisu, gdy mail był już przypisany do tego samego rekordu.
    const alreadyLinked = (clientId && mail.client_id === clientId) || (leadId && mail.lead_id === leadId);
    if (!alreadyLinked) {
      await logMailOnTimeline(sql, {
        mailId: id,
        match: clientId ? { type: "client", id: clientId } : { type: "lead", id: leadId! },
        text: mailSummaryLine(mail.subject, mail.body_text),
        kierunek: "przychodzacy",
      });
    }
  }

  const updated = (await sql`SELECT * FROM mail_messages WHERE id = ${id};`) as unknown as MailMessageWithLinks[];
  return NextResponse.json({ ok: true, message: updated[0] });
}
