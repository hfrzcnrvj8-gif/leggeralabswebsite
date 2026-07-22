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
 * POST /api/events/:id/cancel-invite — odwołuje spotkanie u zaproszonych
 * (2026-07-22). Bliźniak `/invite`, różnica to `METHOD:CANCEL`: kalendarz
 * klienta USUWA wtedy wpis u siebie, zamiast prosić o kolejną odpowiedź.
 *
 * Nazwa route'a mówi „cancel-INVITE", nie „cancel", bo to odwołanie
 * SPOTKANIA U ZAPROSZONYCH, a nie usunięcie wydarzenia z panelu. Wydarzenie
 * zostaje — właściciel może chcieć zachować ślad po tym, co się nie odbyło,
 * a kasowanie go za niego byłoby decyzją, o którą nikt nie prosił.
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
  if (to.length === 0) return NextResponse.json({ error: "Nie ma komu odwołać — lista odbiorców jest pusta." }, { status: 400 });

  const text = String(formData.get("text") ?? "").trim();
  if (!text) return NextResponse.json({ error: "Treść wiadomości nie może być pusta." }, { status: 400 });

  const podpisRaw = formData.get("podpis");
  const podpis = (i18n.locales as readonly string[]).includes(podpisRaw as string) ? (podpisRaw as Locale) : null;

  const result = await sendEventInvite({
    eventId: id,
    method: "CANCEL",
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
