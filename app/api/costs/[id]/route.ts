import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureCostsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { todayLocalISO } from "@/lib/dates";
import { costBrutto, COST_CATEGORIES, COST_STATUSES, VAT_RATES, PAYMENT_METHODS } from "@/lib/costs";

export const runtime = "nodejs";

/** GET /api/costs/:id — pojedynczy koszt. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureCostsSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, dostawca_nazwa, dostawca_nip, kategoria, opis, data_wydatku,
      kwota_netto, vat_stawka, kwota_brutto, status, data_platnosci, project_id,
      created_at, updated_at, zalacznik_nazwa, zalacznik_typ, ksef_numer, ksef_tryb,
      metoda_platnosci, dostawca_konto
    FROM costs WHERE id = ${id};
  `;
  const cost = rows[0];
  if (!cost) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ cost: { ...cost, kwota_netto: Number(cost.kwota_netto), kwota_brutto: Number(cost.kwota_brutto) } });
}

/** PATCH /api/costs/:id — aktualizacja pól kosztu. Zmiana kwoty netto lub
 * stawki VAT przelicza brutto; zmiana statusu na "Opłacony" ustawia
 * data_platnosci na dziś, jeśli jeszcze nie ma daty. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  try {
    await ensureCostsSchema();
    const sql = getSql();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
    const dateOrNull = (v: unknown): string | null | undefined => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      if (!t) return null;
      return isPlausibleDateString(t) ? t : undefined;
    };

    if ("dostawca_nazwa" in body) await sql`UPDATE costs SET dostawca_nazwa = ${str(body.dostawca_nazwa, 300)}, updated_at = now() WHERE id = ${id};`;
    if ("dostawca_nip" in body) await sql`UPDATE costs SET dostawca_nip = ${str(body.dostawca_nip, 30)}, updated_at = now() WHERE id = ${id};`;
    if ("opis" in body) await sql`UPDATE costs SET opis = ${str(body.opis, 2000)}, updated_at = now() WHERE id = ${id};`;
    if ("kategoria" in body) {
      const v = typeof body.kategoria === "string" && (COST_CATEGORIES as readonly string[]).includes(body.kategoria) ? body.kategoria : "Inne";
      await sql`UPDATE costs SET kategoria = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("project_id" in body) {
      const v = typeof body.project_id === "string" && body.project_id.trim() ? body.project_id : null;
      await sql`UPDATE costs SET project_id = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("metoda_platnosci" in body) {
      const v = typeof body.metoda_platnosci === "string" && (PAYMENT_METHODS as readonly string[]).includes(body.metoda_platnosci) ? body.metoda_platnosci : null;
      await sql`UPDATE costs SET metoda_platnosci = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("dostawca_konto" in body) await sql`UPDATE costs SET dostawca_konto = ${str(body.dostawca_konto, 40)}, updated_at = now() WHERE id = ${id};`;
    if ("data_wydatku" in body) {
      const v = dateOrNull(body.data_wydatku);
      if (v === undefined || v === null) return NextResponse.json({ error: "invalid data_wydatku" }, { status: 400 });
      await sql`UPDATE costs SET data_wydatku = ${v}, updated_at = now() WHERE id = ${id};`;
    }
    if ("data_platnosci" in body) {
      const v = dateOrNull(body.data_platnosci);
      if (v === undefined) return NextResponse.json({ error: "invalid data_platnosci" }, { status: 400 });
      await sql`UPDATE costs SET data_platnosci = ${v}, updated_at = now() WHERE id = ${id};`;
    }

    // Kwota netto i/lub stawka VAT — jeśli przyszła choć jedna, przelicz brutto
    // na podstawie aktualnego stanu obu pól.
    if ("kwota_netto" in body || "vat_stawka" in body) {
      let vatStawka: string | undefined;
      if ("vat_stawka" in body) {
        vatStawka = typeof body.vat_stawka === "string" && (VAT_RATES as readonly string[]).includes(body.vat_stawka) ? body.vat_stawka : "23";
        await sql`UPDATE costs SET vat_stawka = ${vatStawka}, updated_at = now() WHERE id = ${id};`;
      }
      let kwotaNetto: number | undefined;
      if ("kwota_netto" in body) {
        kwotaNetto = typeof body.kwota_netto === "number" && Number.isFinite(body.kwota_netto) ? body.kwota_netto : 0;
        await sql`UPDATE costs SET kwota_netto = ${kwotaNetto}, updated_at = now() WHERE id = ${id};`;
      }
      const current = (await sql`SELECT kwota_netto, vat_stawka FROM costs WHERE id = ${id};`)[0];
      const netto = kwotaNetto ?? Number(current?.kwota_netto ?? 0);
      const stawka = vatStawka ?? String(current?.vat_stawka ?? "23");
      await sql`UPDATE costs SET kwota_brutto = ${costBrutto(netto, stawka)}, updated_at = now() WHERE id = ${id};`;
    }

    if ("status" in body) {
      const v = typeof body.status === "string" && (COST_STATUSES as readonly string[]).includes(body.status) ? body.status : "Nieopłacony";
      if (v === "Opłacony") {
        const current = (await sql`SELECT data_platnosci FROM costs WHERE id = ${id};`)[0];
        if (!current?.data_platnosci) {
          await sql`UPDATE costs SET status = ${v}, data_platnosci = ${todayLocalISO()}, updated_at = now() WHERE id = ${id};`;
        } else {
          await sql`UPDATE costs SET status = ${v}, updated_at = now() WHERE id = ${id};`;
        }
      } else {
        await sql`UPDATE costs SET status = ${v}, updated_at = now() WHERE id = ${id};`;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/costs/:id] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu kosztu: ${message}` }, { status: 500 });
  }
}

/** DELETE /api/costs/:id — koszt można zawsze usunąć (to nie dokument
 * księgowy z numeracją jak faktura wystawiona). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureCostsSchema();
  const sql = getSql();
  await sql`DELETE FROM costs WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
