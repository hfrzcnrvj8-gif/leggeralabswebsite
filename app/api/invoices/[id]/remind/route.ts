import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureInvoicesSchema, ensureInvoiceShareToken, ensureInvoiceWezwanieShareToken, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { daysOverdue, reminderLevelForDays, reminderEmailText, dunningEmailText, dunningReference, lateInterestAmount } from "@/lib/invoices";

export const runtime = "nodejs";

/** POST /api/invoices/:id/remind — ręczne wysłanie kolejnego kroku
 * eskalacji windykacji, wyzwalane z panelu. Poziom (1 uprzejme / 2 stanowcze
 * / 3 formalne wezwanie do zapłaty) liczony tym samym progiem dni co w
 * automatycznym cronie (app/api/leads/notify/route.ts), z dolnym progiem 1 —
 * ręczne kliknięcie zawsze wysyła PRZYNAJMNIEJ poziom 1, nawet gdy
 * automatyczny próg (+3 dni) jeszcze nie minął, bo to jawna decyzja
 * właściciela "wyślij teraz", nie automat czekający na próg. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await ensureInvoicesSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT i.*, COALESCE(t.brutto, 0)::float8 AS brutto
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(ilosc * cena_netto * (1 - rabat_procent / 100) * (1 + CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END)) AS brutto
        FROM invoice_items GROUP BY invoice_id
      ) t ON t.invoice_id = i.id
      WHERE i.id = ${id};
    `;
    const inv = rows[0];
    if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!inv.numer) return NextResponse.json({ error: "Faktura nie jest jeszcze wystawiona." }, { status: 400 });
    if (!inv.klient_email) return NextResponse.json({ error: "Brak adresu e-mail nabywcy — uzupełnij go w edytorze." }, { status: 400 });

    const dni = daysOverdue({ termin_platnosci: inv.termin_platnosci as string | null });
    const level = Math.max(1, reminderLevelForDays(dni)) as 1 | 2 | 3;
    // Moduł 40 — poziom 3 idzie linkiem do wezwania, niższe linkiem do
    // faktury; unieważniony jest ten, którego akurat użyjemy.
    if (level === 3 ? inv.wezwanie_share_revoked_at : inv.share_revoked_at) {
      return NextResponse.json(
        {
          error:
            level === 3
              ? "Link do wezwania jest unieważniony — wygeneruj nowy przed wysyłką."
              : "Link do tej faktury jest unieważniony — wygeneruj nowy przed wysyłką.",
        },
        { status: 409 }
      );
    }
    const brutto = Number(inv.brutto);
    const waluta = String(inv.waluta || "PLN");
    const terminPlatnosci = inv.termin_platnosci ? String(inv.termin_platnosci) : null;
    const numer = String(inv.numer);
    const clientId = typeof inv.client_id === "string" ? inv.client_id : null;

    if (level === 3) {
      const token = await ensureInvoiceWezwanieShareToken(sql, id, typeof inv.wezwanie_share_token === "string" ? inv.wezwanie_share_token : null);
      const url = `${req.nextUrl.origin}/pl/wezwanie/${token}`;
      const reference = dunningReference(id, String(inv.created_at));
      const settingsRows = await sql`SELECT stawka_odsetek_ustawowych FROM company_settings WHERE id = 'default';`;
      const stawkaOdsetek = settingsRows[0]?.stawka_odsetek_ustawowych != null ? Number(settingsRows[0].stawka_odsetek_ustawowych) : null;
      const odsetki = lateInterestAmount(brutto, stawkaOdsetek, dni ?? 0);
      const { subject, text } = dunningEmailText({ numer, brutto, waluta, terminPlatnosci, dni: dni ?? 0, odsetki, url, reference });
      await sendEmail({ to: String(inv.klient_email), subject, text });
      await sql`UPDATE invoices SET wezwanie_wystawiono_at = now() WHERE id = ${id};`;
      await logClientEvent(sql, clientId, "invoice_dunning_sent", `Wysłano wezwanie do zapłaty — faktura ${numer} (${reference})`, null, id);
    } else {
      const token = await ensureInvoiceShareToken(sql, id, typeof inv.share_token === "string" ? inv.share_token : null);
      const url = `${req.nextUrl.origin}/pl/faktura/${token}`;
      const { subject, text } = reminderEmailText(level, { numer, brutto, waluta, terminPlatnosci, url });
      await sendEmail({ to: String(inv.klient_email), subject, text });
      await logClientEvent(sql, clientId, "invoice_reminder", `Wysłano przypomnienie o płatności (poziom ${level}) — faktura ${numer}`, null, id);
    }

    // reminder_level nigdy nie cofa się w dół (ręczne wysłanie niższego
    // poziomu niż już osiągnięty nie powinno "zapomnieć" wcześniejszej eskalacji).
    const newReminderLevel = Math.max(level, Number(inv.reminder_level) || 0);
    await sql`UPDATE invoices SET last_reminder_at = now(), reminder_level = ${newReminderLevel} WHERE id = ${id};`;
    await sql`
      INSERT INTO invoice_reminders (id, invoice_id, level, kind)
      VALUES (${randomUUID()}, ${id}, ${level}, ${level === 3 ? "wezwanie" : "reminder"});
    `;

    return NextResponse.json({ ok: true, level });
  } catch (err) {
    console.error("[POST /api/invoices/:id/remind] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd wysyłki przypomnienia: ${message}` }, { status: 500 });
  }
}
