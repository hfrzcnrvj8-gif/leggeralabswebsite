import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureInvoicesSchema, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { todayLocalISO } from "@/lib/dates";
import { totalPaid } from "@/lib/invoices";

export const runtime = "nodejs";

const OPEN_STATUSES = new Set(["Wystawiona", "Po terminie"]);

/** POST /api/invoices/:id/payments — rejestruje wpłatę na fakturę (częściową
 * lub całkowitą). Jeśli suma wpłat pokryje całą kwotę brutto, status leci
 * automatycznie na "Opłacona" (tylko z otwartego stanu — nie nadpisuje
 * ręcznie ustawionej "Anulowana"/"Szkic"). Częściowe wpłaty nie zmieniają
 * statusu — to nadal ewidencja kwot, nie automat księgowy. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await ensureInvoicesSchema();
    const sql = getSql();

    const kwota = Number(body.kwota);
    if (!Number.isFinite(kwota) || kwota <= 0) return NextResponse.json({ error: "Nieprawidłowa kwota wpłaty." }, { status: 400 });
    const data = typeof body.data === "string" && isPlausibleDateString(body.data) ? body.data : todayLocalISO();

    const inv = await sql`SELECT id, status, numer, client_id, waluta FROM invoices WHERE id = ${id};`;
    if (!inv[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
    const clientId = typeof inv[0].client_id === "string" ? inv[0].client_id : null;

    const paymentId = randomUUID();
    await sql`INSERT INTO invoice_payments (id, invoice_id, kwota, data) VALUES (${paymentId}, ${id}, ${kwota}, ${data});`;
    await logClientEvent(sql, clientId, "payment_received", `Wpłata na fakturę ${inv[0].numer ?? "(szkic)"}`, kwota);

    const payments = await sql`SELECT * FROM invoice_payments WHERE invoice_id = ${id} ORDER BY data ASC;`;
    const paymentsNum = payments.map((p) => ({ ...p, kwota: Number(p.kwota) }));

    let status = String(inv[0].status);
    if (OPEN_STATUSES.has(status)) {
      const totals = await sql`
        SELECT COALESCE(SUM(ilosc * cena_netto * (1 - rabat_procent / 100) * (1 + CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END)), 0)::float8 AS brutto
        FROM invoice_items WHERE invoice_id = ${id};
      `;
      const brutto = Number(totals[0]?.brutto ?? 0);
      if (brutto > 0 && totalPaid(paymentsNum) >= brutto) {
        await sql`UPDATE invoices SET status = 'Opłacona', updated_at = now() WHERE id = ${id};`;
        status = "Opłacona";
        await logClientEvent(sql, clientId, "invoice_paid", `Faktura ${inv[0].numer ?? "(szkic)"} w pełni opłacona`);
      }
    }

    return NextResponse.json({ ok: true, payments: paymentsNum, status });
  } catch (err) {
    console.error("[POST /api/invoices/:id/payments] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu wpłaty: ${message}` }, { status: 500 });
  }
}
