import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema, ensureInvoiceShareToken, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { INVOICE_TYPE_LABEL, type InvoiceDocType } from "@/lib/invoices";

export const runtime = "nodejs";

/** POST /api/invoices/:id/send — wysyła klientowi mailem link do publicznego
 * podglądu faktury (musi być już wystawiona i mieć e-mail nabywcy). Admin-only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await ensureInvoicesSchema();
    const sql = getSql();
    const rows = await sql`SELECT * FROM invoices WHERE id = ${id};`;
    const inv = rows[0];
    if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
    // Moduł 40 — wysyłka nie może iść unieważnionym linkiem. Świadomie NIE
    // regenerujemy tokenu po cichu: nowy link to osobna, jawna decyzja.
    if (inv.share_revoked_at) return NextResponse.json({ error: "Link do tej faktury jest unieważniony — wygeneruj nowy przed wysyłką." }, { status: 409 });
    if (!inv.numer) return NextResponse.json({ error: "Wystaw najpierw fakturę — szkicu nie da się wysłać klientowi." }, { status: 400 });
    if (!inv.klient_email) return NextResponse.json({ error: "Brak adresu e-mail nabywcy — uzupełnij go w edytorze." }, { status: 400 });

    const token = await ensureInvoiceShareToken(sql, id, typeof inv.share_token === "string" ? inv.share_token : null);
    const url = `${req.nextUrl.origin}/pl/faktura/${token}`;
    const typLabel = INVOICE_TYPE_LABEL[(inv.typ_dokumentu as InvoiceDocType) ?? "faktura"];

    await sendEmail({
      to: String(inv.klient_email),
      subject: `${typLabel} ${inv.numer}`,
      text: [
        `Dzień dobry,`,
        ``,
        `w załączeniu link do dokumentu: ${typLabel} nr ${inv.numer}.`,
        ``,
        url,
        ``,
        `Dokument można podejrzeć i zapisać jako PDF pod powyższym adresem.`,
        ``,
        `Pozdrawiamy,`,
        `Leggera Labs`,
      ].join("\n"),
    });

    const clientId = typeof inv.client_id === "string" ? inv.client_id : null;
    await logClientEvent(sql, clientId, "invoice_sent", `Wysłano mailem: ${typLabel} nr ${inv.numer}`, null, id);

    // Patrz analogiczna adnotacja w app/api/offers/[id]/send.
    return NextResponse.json({ ok: true, shareToken: token });
  } catch (err) {
    console.error("[POST /api/invoices/:id/send] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd wysyłki: ${message}` }, { status: 500 });
  }
}
