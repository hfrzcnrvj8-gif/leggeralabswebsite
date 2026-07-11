import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { INVOICE_LANGS } from "@/lib/invoices";
import { RECURRING_CYCLES, type RecurringItem } from "@/lib/recurring";

export const runtime = "nodejs";

/** PATCH /api/recurring/:id — edycja szablonu faktury cyklicznej. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  try {
    await ensureInvoicesSchema();
    const sql = getSql();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

    if ("nazwa" in body) await sql`UPDATE recurring_invoices SET nazwa = ${str(body.nazwa, 200)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_nazwa" in body) await sql`UPDATE recurring_invoices SET klient_nazwa = ${str(body.klient_nazwa, 300)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_nip" in body) await sql`UPDATE recurring_invoices SET klient_nip = ${str(body.klient_nip, 30)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_ulica" in body) await sql`UPDATE recurring_invoices SET klient_ulica = ${str(body.klient_ulica, 300)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_kod" in body) await sql`UPDATE recurring_invoices SET klient_kod = ${str(body.klient_kod, 20)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_miasto" in body) await sql`UPDATE recurring_invoices SET klient_miasto = ${str(body.klient_miasto, 200)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_kraj" in body) await sql`UPDATE recurring_invoices SET klient_kraj = ${str(body.klient_kraj, 100)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_email" in body) await sql`UPDATE recurring_invoices SET klient_email = ${str(body.klient_email, 200)}, updated_at = now() WHERE id = ${id};`;
    if ("waluta" in body) await sql`UPDATE recurring_invoices SET waluta = ${str(body.waluta, 10) || "PLN"}, updated_at = now() WHERE id = ${id};`;
    if ("jezyk" in body) {
      const v = typeof body.jezyk === "string" && (INVOICE_LANGS as readonly string[]).includes(body.jezyk) ? body.jezyk : "pl";
      await sql`UPDATE recurring_invoices SET jezyk = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("termin_dni" in body) {
      const v = Number.isFinite(Number(body.termin_dni)) ? Math.max(0, Math.round(Number(body.termin_dni))) : 14;
      await sql`UPDATE recurring_invoices SET termin_dni = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("cykl" in body) {
      const v = typeof body.cykl === "string" && (RECURRING_CYCLES as readonly string[]).includes(body.cykl) ? body.cykl : "miesiecznie";
      await sql`UPDATE recurring_invoices SET cykl = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("next_run" in body && typeof body.next_run === "string" && body.next_run.trim()) {
      await sql`UPDATE recurring_invoices SET next_run = ${body.next_run.slice(0, 10)}, updated_at = now() WHERE id = ${id};`;
    }
    if ("active" in body) await sql`UPDATE recurring_invoices SET active = ${Boolean(body.active)}, updated_at = now() WHERE id = ${id};`;
    if ("pozycje" in body && Array.isArray(body.pozycje)) {
      const pozycje: RecurringItem[] = body.pozycje.map((it: Record<string, unknown>) => ({
        nazwa: str(it?.nazwa, 300),
        ilosc: Number.isFinite(Number(it?.ilosc)) ? Number(it.ilosc) : 1,
        jednostka: str(it?.jednostka, 20) || "szt.",
        cena_netto: Number.isFinite(Number(it?.cena_netto)) ? Number(it.cena_netto) : 0,
        vat_stawka: str(it?.vat_stawka, 10) || "23",
      }));
      await sql`UPDATE recurring_invoices SET pozycje = ${JSON.stringify(pozycje)}, updated_at = now() WHERE id = ${id};`;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/recurring/:id] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu szablonu: ${message}` }, { status: 500 });
  }
}

/** DELETE /api/recurring/:id — usuwa szablon faktury cyklicznej. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureInvoicesSchema();
  const sql = getSql();
  await sql`DELETE FROM recurring_invoices WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
