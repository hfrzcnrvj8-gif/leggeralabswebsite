import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailSchema } from "@/lib/db";
import type { MailSubscription } from "@/lib/mail";

export const runtime = "nodejs";

/**
 * GET /api/mail/subscriptions — masówka pogrupowana po nadawcy.
 *
 * Najtańsza funkcja tego modułu: dane leżą w bazie od Modułu 4
 * (`list_unsubscribe_url`, zapisywany przy syncu z nagłówka RFC 2369) —
 * brakowało wyłącznie ekranu, który by je pokazał.
 *
 * **Sortowanie malejąco po liczbie wiadomości to nie kosmetyka, tylko sens
 * tego ekranu**: chodzi o to, żeby najpierw pozbyć się najgłośniejszych.
 * Alfabetycznie byłoby bezużyteczne.
 *
 * Grupujemy po adresie, a nie po nazwie nadawcy — nazwa bywa zmienna
 * („Newsletter", „Zespół X", „X Weekly" z tej samej skrzynki), adres nie.
 * Nazwę pokazujemy tę z NAJNOWSZEJ wiadomości, bo ta jest właściwa dziś.
 */
export async function GET(_req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await ensureMailSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT
      m.from_addr,
      /* Nazwa i link z NAJNOWSZEJ wiadomości nadawcy: adresy wypisania
         bywają jednorazowe/podpisane, a stary link potrafi już nie działać. */
      (ARRAY_AGG(m.from_name ORDER BY m.received_at DESC)
        FILTER (WHERE m.from_name <> ''))[1] AS from_name,
      (ARRAY_AGG(m.list_unsubscribe_url ORDER BY m.received_at DESC)
        FILTER (WHERE m.list_unsubscribe_url IS NOT NULL))[1] AS unsubscribe_url,
      COUNT(*)::int AS ile,
      MAX(m.received_at) AS ostatnia
    FROM mail_messages m
    WHERE m.kierunek = 'in'
      /* Masówka = ma nagłówek List-Unsubscribe albo panel zaklasyfikował ją
         jako reklamę. Sam adres to za słaby sygnał — ta sama lekcja co przy
         classifyMail() (Calendly/n8n nie mają "noreply" w adresie). */
      AND (m.list_unsubscribe = true OR m.kategoria = 'reklama')
    GROUP BY m.from_addr
    ORDER BY ile DESC, ostatnia DESC;
  `) as unknown as MailSubscription[];

  return NextResponse.json({ subscriptions: rows });
}

/**
 * DELETE /api/mail/subscriptions?from=adres — „posprzątaj po tym nadawcy".
 *
 * Sam link wypisania załatwia przyszłość, ale zostawia w skrzynce 47 maili,
 * które już przyszły — a to właśnie one są problemem, który przygnał
 * właściciela na ten ekran. Dlatego drugi przycisk.
 *
 * **Kasujemy TYLKO roboczą kopię w panelu, nigdy na serwerze pocztowym.**
 * To ta sama zasada, co przy retencji (MAIL_RETENTION_MONTHS): oryginały
 * zostają w skrzynce az.pl, panel jest kopią roboczą. Konsekwencja, o której
 * trzeba pamiętać: skasowane wiadomości MOGĄ wrócić przy kolejnym syncu,
 * jeśli wciąż leżą na serwerze i mieszczą się w oknie kursora — dlatego
 * wypisanie się (link) jest tu ważniejsze niż samo sprzątanie.
 */
export async function DELETE(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const from = (req.nextUrl.searchParams.get("from") || "").trim();
  if (!from) return NextResponse.json({ error: "brak adresu nadawcy" }, { status: 400 });

  await ensureMailSchema();
  const sql = getSql();

  // Tylko przychodzące i tylko masówka — te same warunki co w GET wyżej.
  // Bez nich literówka w adresie mogłaby zmieść zwykłą korespondencję
  // z człowiekiem, a tego nie da się cofnąć z poziomu panelu.
  const usuniete = (await sql`
    DELETE FROM mail_messages
    WHERE kierunek = 'in'
      AND LOWER(TRIM(from_addr)) = LOWER(TRIM(${from}))
      AND (list_unsubscribe = true OR kategoria = 'reklama')
    RETURNING id;
  `) as unknown as { id: string }[];

  return NextResponse.json({ ok: true, usuniete: usuniete.length });
}
