import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { parseAddressList } from "@/lib/mail";
import { isMailboxConfigured } from "@/lib/mailbox";
import { sendEventInvite } from "@/lib/eventInviteSend";
import { icsUID } from "@/lib/eventInvites";
import { i18n, type Locale } from "@/i18n/config";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/events/:id/invite — wysyła klientowi zaproszenie na spotkanie
 * (2026-07-22, brief 27 pkt 2).
 *
 * Przyjmuje dokładnie ten sam FormData co `POST /api/mail/compose` i to
 * celowo: właściciel pisze zaproszenie w TYM SAMYM formularzu co zwykłą
 * wiadomość (decyzja 2026-07-22 — „przez kompozytor, żeby dopisać zdanie
 * przed wysłaniem"). Cała różnica siedzi w `sendEventInvite()`, wspólnym
 * z odwołaniem spotkania.
 *
 * Załączniki świadomie POMINIĘTE: zaproszenie ma nieść termin, nie paczkę
 * plików. Kto chce wysłać ofertę, wysyła ją mailem z Poczty.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!isMailboxConfigured()) {
    return NextResponse.json(
      { error: "Skrzynka pocztowa nie jest skonfigurowana — dodaj MAIL_IMAP_HOST, MAIL_USER i MAIL_PASS w zmiennych środowiskowych Vercela (dane z panelu az.pl)." },
      { status: 400 }
    );
  }

  const { id } = await params;
  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Nieprawidłowe dane formularza." }, { status: 400 });

  const to = parseAddressList(String(formData.get("to") ?? ""));
  if (to.length === 0) return NextResponse.json({ error: "Podaj adres osoby, którą zapraszasz." }, { status: 400 });

  const text = String(formData.get("text") ?? "").trim();
  if (!text) return NextResponse.json({ error: "Treść wiadomości nie może być pusta." }, { status: 400 });

  const podpisRaw = formData.get("podpis");
  const podpis = (i18n.locales as readonly string[]).includes(podpisRaw as string) ? (podpisRaw as Locale) : null;

  const result = await sendEventInvite({
    eventId: id,
    method: "REQUEST",
    to,
    cc: parseAddressList(String(formData.get("cc") ?? "")),
    bcc: parseAddressList(String(formData.get("bcc") ?? "")),
    subject: String(formData.get("subject") ?? "").trim(),
    text,
    podpis,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.mailId, uid: icsUID(id), sequence: result.sequence, warnings: result.warnings });
}
