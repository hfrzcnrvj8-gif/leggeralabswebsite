import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { syncMailbox, backfillCategories } from "@/lib/mailSync";
import { ensureMailSchema } from "@/lib/db";
import { isMailboxConfigured } from "@/lib/mailbox";

// IMAP/SMTP to zwykły TCP — Edge tego nie potrafi.
export const runtime = "nodejs";
// Sync łączy się z az.pl, czyta i parsuje wiadomości — domyślne 10 s bywa za
// mało przy pierwszym przebiegu na wolniejszej skrzynce.
export const maxDuration = 60;

/**
 * POST /api/mail/sync — pobierz nowe wiadomości ze skrzynki az.pl.
 *
 * Wołane przy otwarciu zakładki Poczta i raz dziennie z crona
 * (app/api/leads/notify) — decyzja właściciela 2026-07-15. Cała logika
 * (dopasowanie, dedup, zapis) mieszka w lib/mailSync.ts, żeby cron mógł
 * wywołać ją bezpośrednio, bez HTTP-owego skoku po samym sobie.
 *
 * Nieskonfigurowana skrzynka to NIE błąd: dopóki właściciel nie poda danych z
 * panelu az.pl (i lokalnie, gdzie ich nigdy nie ma), zwracamy spokojne
 * `configured: false` — zakładka Poczta ma się otwierać i pokazywać dane z
 * bazy, a nie czerwony błąd.
 */
export async function POST() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Uzupełnienie kategorii PRZED sprawdzeniem skrzynki i niezależnie od niej —
  // to porządki na własnej bazie, nie pobieranie poczty. Dzięki temu stare
  // wiadomości dostają szufladkę nawet gdy IMAP akurat nie odpowiada (albo
  // gdy skrzynki w ogóle nie ma, jak lokalnie).
  await ensureMailSchema();
  await backfillCategories().catch((e) => console.error("[POST /api/mail/sync] backfill", e));

  if (!isMailboxConfigured()) {
    return NextResponse.json({ configured: false, fetched: 0, matched: 0 });
  }

  try {
    const result = await syncMailbox();
    return NextResponse.json({ configured: true, ...result });
  } catch (e) {
    // Skrzynka niedostępna/złe hasło nie może wywrócić widoku poczty —
    // pokazujemy to, co już mamy w bazie, plus czytelny komunikat.
    const message = e instanceof Error ? e.message : "Nieznany błąd synchronizacji poczty.";
    console.error("[POST /api/mail/sync]", e);
    return NextResponse.json({ configured: true, error: message, fetched: 0, matched: 0 }, { status: 502 });
  }
}
