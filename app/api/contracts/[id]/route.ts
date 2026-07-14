import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureContractsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";

export const runtime = "nodejs";

/** GET /api/contracts/:id — dokument. Admin-only. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureContractsSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM contracts WHERE id = ${id};`;
  const contract = rows[0];
  if (!contract) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ contract: { ...contract, cena: Number(contract.cena) } });
}

/** PATCH /api/contracts/:id — aktualizacja pól. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  try {
    await ensureContractsSchema();
    const sql = getSql();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
    const dateOrNull = (v: unknown): string | null | undefined => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      if (!t) return null;
      return isPlausibleDateString(t) ? t : undefined;
    };

    if ("klient_nazwa" in body) await sql`UPDATE contracts SET klient_nazwa = ${str(body.klient_nazwa, 300)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_nip" in body) await sql`UPDATE contracts SET klient_nip = ${str(body.klient_nip, 30)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_ulica" in body) await sql`UPDATE contracts SET klient_ulica = ${str(body.klient_ulica, 300)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_kod" in body) await sql`UPDATE contracts SET klient_kod = ${str(body.klient_kod, 20)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_miasto" in body) await sql`UPDATE contracts SET klient_miasto = ${str(body.klient_miasto, 200)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_kraj" in body) await sql`UPDATE contracts SET klient_kraj = ${str(body.klient_kraj, 100)}, updated_at = now() WHERE id = ${id};`;
    if ("klient_email" in body) await sql`UPDATE contracts SET klient_email = ${str(body.klient_email, 200)}, updated_at = now() WHERE id = ${id};`;
    if ("zakres_prac" in body) await sql`UPDATE contracts SET zakres_prac = ${str(body.zakres_prac, 4000)}, updated_at = now() WHERE id = ${id};`;
    if ("uwagi" in body) await sql`UPDATE contracts SET uwagi = ${str(body.uwagi, 2000)}, updated_at = now() WHERE id = ${id};`;
    if ("waluta" in body) await sql`UPDATE contracts SET waluta = ${str(body.waluta, 10) || "PLN"}, updated_at = now() WHERE id = ${id};`;
    if ("cena" in body) {
      const n = typeof body.cena === "number" && Number.isFinite(body.cena) ? body.cena : 0;
      await sql`UPDATE contracts SET cena = ${n}, updated_at = now() WHERE id = ${id};`;
    }
    if ("status" in body) await sql`UPDATE contracts SET status = ${str(body.status, 40)}, updated_at = now() WHERE id = ${id};`;
    if ("termin_realizacji" in body) {
      const v = dateOrNull(body.termin_realizacji);
      if (v === undefined) return NextResponse.json({ error: "invalid termin_realizacji" }, { status: 400 });
      await sql`UPDATE contracts SET termin_realizacji = ${v}, updated_at = now() WHERE id = ${id};`;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/contracts/:id] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd zapisu: ${message}` }, { status: 500 });
  }
}

/** DELETE /api/contracts/:id. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureContractsSchema();
  const sql = getSql();
  await sql`DELETE FROM contracts WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
