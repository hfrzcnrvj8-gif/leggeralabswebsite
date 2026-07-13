import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureCostsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { COST_CATEGORIES, VAT_RATES, PAYMENT_METHODS } from "@/lib/costs";
import { RECURRING_CYCLES } from "@/lib/recurring";

export const runtime = "nodejs";

/** PATCH /api/recurring-costs/:id — edycja szablonu kosztu cyklicznego. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  try {
    await ensureCostsSchema();
    const sql = getSql();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

    if ("nazwa" in body) await sql`UPDATE recurring_costs SET nazwa = ${str(body.nazwa, 200)}, updated_at = now() WHERE id = ${id};`;
    if ("dostawca_nazwa" in body) await sql`UPDATE recurring_costs SET dostawca_nazwa = ${str(body.dostawca_nazwa, 300)}, updated_at = now() WHERE id = ${id};`;
    if ("dostawca_nip" in body) await sql`UPDATE recurring_costs SET dostawca_nip = ${str(body.dostawca_nip, 30)}, updated_at = now() WHERE id = ${id};`;
    if ("dostawca_konto" in body) await sql`UPDATE recurring_costs SET dostawca_konto = ${str(body.dostawca_konto, 60)}, updated_at = now() WHERE id = ${id};`;
    if ("opis" in body) await sql`UPDATE recurring_costs SET opis = ${str(body.opis, 2000)}, updated_at = now() WHERE id = ${id};`;
    if ("kategoria" in body) {
      const v = typeof body.kategoria === "string" && (COST_CATEGORIES as readonly string[]).includes(body.kategoria) ? body.kategoria : "Subskrypcje";
      await sql`UPDATE recurring_costs SET kategoria = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("kwota_netto" in body) {
      const v = Number.isFinite(Number(body.kwota_netto)) ? Number(body.kwota_netto) : 0;
      await sql`UPDATE recurring_costs SET kwota_netto = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("vat_stawka" in body) {
      const v = typeof body.vat_stawka === "string" && (VAT_RATES as readonly string[]).includes(body.vat_stawka) ? body.vat_stawka : "23";
      await sql`UPDATE recurring_costs SET vat_stawka = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("metoda_platnosci" in body) {
      const v = typeof body.metoda_platnosci === "string" && (PAYMENT_METHODS as readonly string[]).includes(body.metoda_platnosci) ? body.metoda_platnosci : null;
      await sql`UPDATE recurring_costs SET metoda_platnosci = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("project_id" in body) {
      const v = typeof body.project_id === "string" && body.project_id.trim() ? body.project_id : null;
      await sql`UPDATE recurring_costs SET project_id = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("cykl" in body) {
      const v = typeof body.cykl === "string" && (RECURRING_CYCLES as readonly string[]).includes(body.cykl) ? body.cykl : "miesiecznie";
      await sql`UPDATE recurring_costs SET cykl = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("next_run" in body && typeof body.next_run === "string" && body.next_run.trim()) {
      await sql`UPDATE recurring_costs SET next_run = ${body.next_run.slice(0, 10)}, updated_at = now() WHERE id = ${id};`;
    }
    if ("active" in body) await sql`UPDATE recurring_costs SET active = ${Boolean(body.active)}, updated_at = now() WHERE id = ${id};`;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/recurring-costs/:id] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu szablonu: ${message}` }, { status: 500 });
  }
}

/** DELETE /api/recurring-costs/:id — usuwa szablon kosztu cyklicznego. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureCostsSchema();
  const sql = getSql();
  await sql`DELETE FROM recurring_costs WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
