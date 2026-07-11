import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";

export const runtime = "nodejs";

/** POST /api/invoices/:id/payments — rejestruje wpłatę na fakturę (częściową
 * lub całkowitą). Nie zmienia automatycznie statusu faktury — właściciel
 * sam oznacza "Opłacona", to tylko ewidencja kwot. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await ensureInvoicesSchema();
    const sql = getSql();

    const kwota = Number(body.kwota);
    if (!Number.isFinite(kwota) || kwota <= 0) return NextResponse.json({ error: "Nieprawidłowa kwota wpłaty." }, { status: 400 });
    const data = typeof body.data === "string" && isPlausibleDateString(body.data) ? body.data : new Date().toISOString().slice(0, 10);

    const inv = await sql`SELECT id FROM invoices WHERE id = ${id};`;
    if (!inv[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

    const paymentId = randomUUID();
    await sql`INSERT INTO invoice_payments (id, invoice_id, kwota, data) VALUES (${paymentId}, ${id}, ${kwota}, ${data});`;

    const payments = await sql`SELECT * FROM invoice_payments WHERE invoice_id = ${id} ORDER BY data ASC;`;
    return NextResponse.json({ ok: true, payments: payments.map((p) => ({ ...p, kwota: Number(p.kwota) })) });
  } catch (err) {
    console.error("[POST /api/invoices/:id/payments] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu wpłaty: ${message}` }, { status: 500 });
  }
}
