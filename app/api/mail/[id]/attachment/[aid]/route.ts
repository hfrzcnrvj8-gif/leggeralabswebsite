import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailSchema, ensureMailFoldersSchema } from "@/lib/db";
import { MAIL_INCOMING_ATTACHMENT_MAX_BYTES, safeAttachmentFilename } from "@/lib/mail";
import { isMailboxConfigured, downloadAttachmentPart } from "@/lib/mailbox";

export const runtime = "nodejs";

/**
 * GET /api/mail/[id]/attachment/[aid] — treść JEDNEGO załącznika.
 *
 * Tu materializuje się decyzja właściciela z 2026-07-20: w bazie leżą tylko
 * metadane, a bajty ściągamy z IMAP-a dopiero teraz, przy kliknięciu.
 * Konsekwencje są wpisane w tę trasę i widoczne w komunikatach:
 *
 * - **Trwa kilka sekund** — to pełne łączenie z serwerem pocztowym.
 * - **Wymaga żywej skrzynki** — bez konfiguracji nie ma czego pobrać.
 * - **Mail skasowany ze skrzynki zabiera ze sobą załącznik.** To nie awaria,
 *   tylko cena wybranego sposobu trzymania danych, więc mówimy o niej
 *   wprost zamiast pokazywać ogólny błąd.
 *
 * Odpowiedź ZAWSZE `Content-Disposition: attachment` — nawet dla PDF-a
 * i obrazka. Przeglądarka nie ma renderować cudzej treści w naszym origin;
 * podgląd robi apka (QuickLook), a w panelu plik się pobiera.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; aid: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, aid } = await params;

  await ensureMailSchema();
  const sql = getSql();

  // Złączenie z wiadomością, bo do pobrania z IMAP-a potrzeba TRZECH rzeczy
  // naraz: folderu, UID-a wiadomości i numeru części MIME. Warunek na
  // `message_id` jest tu też kontrolą dostępu — nie da się pobrać załącznika
  // podając cudze id wiadomości.
  const rows = (await sql`
    SELECT a.part_id, a.filename, a.mime, a.size_bytes::int AS size_bytes,
           m.uid, m.folder
    FROM mail_attachments a
    JOIN mail_messages m ON m.id = a.message_id
    WHERE a.id = ${aid} AND a.message_id = ${id};
  `) as unknown as {
    part_id: string;
    filename: string;
    mime: string;
    size_bytes: number;
    uid: number | null;
    folder: string;
  }[];

  const att = rows[0];
  if (!att) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Próg sprawdzamy PRZED łączeniem się ze skrzynką — nie ma sensu ściągać
  // 30 MB, żeby dopiero potem stwierdzić, że i tak nie przejdzie przez
  // odpowiedź funkcji. Metadane zapisujemy bez tego limitu, więc właściciel
  // widzi, że plik istnieje; tu dowiaduje się, gdzie go wziąć.
  if (att.size_bytes > MAIL_INCOMING_ATTACHMENT_MAX_BYTES) {
    return NextResponse.json(
      {
        error: `Załącznik jest za duży, żeby otworzyć go tutaj (${Math.round(att.size_bytes / (1024 * 1024))} MB). Otwórz tę wiadomość w programie pocztowym.`,
      },
      { status: 413 }
    );
  }

  if (!isMailboxConfigured()) {
    return NextResponse.json({ error: "Skrzynka pocztowa nie jest skonfigurowana." }, { status: 503 });
  }
  if (att.uid == null) {
    return NextResponse.json(
      { error: "Ta wiadomość nie ma znanego UID-a na serwerze — nie da się pobrać jej załącznika." },
      { status: 422 }
    );
  }

  await ensureMailFoldersSchema();
  const folderRows = (await sql`SELECT imap_path FROM mail_folders WHERE role = ${att.folder};`) as unknown as {
    imap_path: string;
  }[];
  const imapPath = folderRows[0]?.imap_path;
  if (!imapPath) {
    return NextResponse.json(
      { error: `Nie znaleziono folderu „${att.folder}" na serwerze — poczekaj na kolejną synchronizację.` },
      { status: 502 }
    );
  }

  const pobrane = await downloadAttachmentPart(imapPath, att.uid, att.part_id);
  if (!pobrane) {
    return NextResponse.json(
      {
        error:
          "Nie udało się pobrać załącznika ze skrzynki. Załączniki nie są przechowywane w panelu — jeśli wiadomość została usunięta z serwera pocztowego, pliku już nie ma.",
      },
      { status: 502 }
    );
  }

  // Nazwa idzie do nagłówka, więc odkażamy ją PONOWNIE, mimo że zapisywana
  // była już odkażona: gdyby reguła kiedyś się zmieniła albo wiersz powstał
  // przed jej wprowadzeniem, nagłówek i tak musi być bezpieczny. `filename*`
  // (RFC 5987) niesie polskie znaki, `filename` zostaje jako wersja ASCII
  // dla starszych klientów.
  const nazwa = safeAttachmentFilename(att.filename);
  const nazwaAscii = nazwa.replace(/[^\x20-\x7e]/g, "_");

  return new NextResponse(new Uint8Array(pobrane.content), {
    headers: {
      // Typ z bazy, nie z serwera pocztowego: to ten sam typ, który widział
      // właściciel na liście plików, więc pobranie nie może go zaskoczyć.
      "Content-Type": att.mime || pobrane.mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${nazwaAscii}"; filename*=UTF-8''${encodeURIComponent(nazwa)}`,
      "Content-Length": String(pobrane.content.length),
      // Cudza treść — pod żadnym pozorem nie zgadujemy typu po zawartości.
      "X-Content-Type-Options": "nosniff",
      // Prywatna korespondencja: nie ma prawa wylądować w pamięci podręcznej
      // pośredników.
      "Cache-Control": "private, no-store",
    },
  });
}
