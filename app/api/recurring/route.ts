import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { INVOICE_LANGS } from "@/lib/invoices";
import { RECURRING_CYCLES, todayISO, type RecurringItem } from "@/lib/recurring";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
function parseRow(r: Row): Row {
  return { ...r, termin_dni: Number(r.termin_dni), pozycje: typeof r.pozycje === "string" ? JSON.parse(r.pozycje) : r.pozycje };
}

/** GET /api/recurring — lista szablonów faktur cyklicznych. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureInvoicesSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM recurring_invoices ORDER BY active DESC, next_run ASC;`;
  return NextResponse.json({ recurring: rows.map(parseRow) });
}

/** POST /api/recurring — nowy szablon faktury cyklicznej. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await ensureInvoicesSchema();
    const sql = getSql();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
    const cykl = typeof body.cykl === "string" && (RECURRING_CYCLES as readonly string[]).includes(body.cykl) ? body.cykl : "miesiecznie";
    const jezyk = typeof body.jezyk === "string" && (INVOICE_LANGS as readonly string[]).includes(body.jezyk) ? body.jezyk : "pl";
    const terminDni = Number.isFinite(Number(body.termin_dni)) ? Math.max(0, Math.round(Number(body.termin_dni))) : 14;
    const pozycje: RecurringItem[] = Array.isArray(body.pozycje)
      ? body.pozycje.map((it: Record<string, unknown>) => ({
          nazwa: str(it?.nazwa, 300),
          ilosc: Number.isFinite(Number(it?.ilosc)) ? Number(it.ilosc) : 1,
          jednostka: str(it?.jednostka, 20) || "szt.",
          cena_netto: Number.isFinite(Number(it?.cena_netto)) ? Number(it.cena_netto) : 0,
          vat_stawka: str(it?.vat_stawka, 10) || "23",
        }))
      : [];
    const nextRun = typeof body.next_run === "string" && body.next_run.trim() ? body.next_run.slice(0, 10) : todayISO();

    const id = randomUUID();
    await sql`
      INSERT INTO recurring_invoices (
        id, nazwa, klient_nazwa, klient_nip, klient_ulica, klient_kod, klient_miasto, klient_kraj,
        klient_email, waluta, jezyk, termin_dni, pozycje, cykl, next_run, active
      ) VALUES (
        ${id}, ${str(body.nazwa, 200)}, ${str(body.klient_nazwa, 300)}, ${str(body.klient_nip, 30)},
        ${str(body.klient_ulica, 300)}, ${str(body.klient_kod, 20)}, ${str(body.klient_miasto, 200)}, ${str(body.klient_kraj, 100)},
        ${str(body.klient_email, 200)}, ${str(body.waluta, 10) || "PLN"}, ${jezyk}, ${terminDni},
        ${JSON.stringify(pozycje)}, ${cykl}, ${nextRun}, true
      );
    `;
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[POST /api/recurring] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu szablonu: ${message}` }, { status: 500 });
  }
}
