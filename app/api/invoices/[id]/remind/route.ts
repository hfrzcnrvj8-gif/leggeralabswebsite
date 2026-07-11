import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema, ensureInvoiceShareToken, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { formatMoney } from "@/lib/invoices";

export const runtime = "nodejs";

/** POST /api/invoices/:id/remind — ręczne przypomnienie o zaległej płatności,
 * wysyłane do nabywcy z linkiem do faktury. Admin-only. Ten sam mechanizm
 * (bez ręcznego triggera) uruchamia się automatycznie w dziennym cronie
 * (app/api/leads/notify/route.ts) dla faktur po terminie. */
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
        SELECT invoice_id, SUM(ilosc * cena_netto * (1 + CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END)) AS brutto
        FROM invoice_items GROUP BY invoice_id
      ) t ON t.invoice_id = i.id
      WHERE i.id = ${id};
    `;
    const inv = rows[0];
    if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!inv.numer) return NextResponse.json({ error: "Faktura nie jest jeszcze wystawiona." }, { status: 400 });
    if (!inv.klient_email) return NextResponse.json({ error: "Brak adresu e-mail nabywcy — uzupełnij go w edytorze." }, { status: 400 });

    const token = await ensureInvoiceShareToken(sql, id, typeof inv.share_token === "string" ? inv.share_token : null);
    const url = `${req.nextUrl.origin}/pl/faktura/${token}`;

    await sendEmail({
      to: String(inv.klient_email),
      subject: `Przypomnienie o płatności — faktura ${inv.numer}`,
      text: [
        `Dzień dobry,`,
        ``,
        `przypominamy o płatności za fakturę nr ${inv.numer} na kwotę ${formatMoney(Number(inv.brutto), String(inv.waluta || "PLN"))}, `,
        `z terminem płatności ${inv.termin_platnosci ? String(inv.termin_platnosci).slice(0, 10) : "—"}.`,
        ``,
        url,
        ``,
        `Jeśli płatność została już zrealizowana, prosimy zignorować tę wiadomość.`,
        ``,
        `Pozdrawiamy,`,
        `Leggera Labs`,
      ].join("\n"),
    });

    await sql`UPDATE invoices SET last_reminder_at = now() WHERE id = ${id};`;
    const clientId = typeof inv.client_id === "string" ? inv.client_id : null;
    await logClientEvent(sql, clientId, "invoice_reminder", `Wysłano przypomnienie o płatności — faktura ${inv.numer}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/invoices/:id/remind] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd wysyłki przypomnienia: ${message}` }, { status: 500 });
  }
}
