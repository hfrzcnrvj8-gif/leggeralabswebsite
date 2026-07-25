import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureLeadHunterSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";

export const runtime = "nodejs";

/** Pola, które wolno zmienić. Biała lista, nie czarna — nowa kolumna
 * (`kursor`, `znalezionych`) ma domyślnie NIE być edytowalna z zewnątrz.
 * Ustalenie z Audytu 1: czarna lista wypuszcza wszystko, co dojdzie później. */
const POLA = new Set(["nazwa", "pkd", "wojewodztwo", "powiat", "miasto", "data_od", "data_do", "aktywne"]);

/** PATCH /api/leads/hunts/:id — zmiana definicji polowania (najczęściej
 * włącz/wyłącz albo dopisanie kodu PKD). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  await ensureLeadHunterSchema();
  const sql = getSql();

  for (const [pole, wartosc] of Object.entries(body)) {
    if (!POLA.has(pole)) continue;

    if (pole === "aktywne") {
      await sql`UPDATE lead_hunts SET aktywne = ${Boolean(wartosc)}, updated_at = now() WHERE id = ${id};`;
      continue;
    }
    if (pole === "data_od" || pole === "data_do") {
      const v = String(wartosc ?? "").trim();
      if (v && !isPlausibleDateString(v)) {
        return NextResponse.json({ error: `Niepoprawna data w polu ${pole}.` }, { status: 400 });
      }
      if (pole === "data_od") await sql`UPDATE lead_hunts SET data_od = ${v || null}, updated_at = now() WHERE id = ${id};`;
      else await sql`UPDATE lead_hunts SET data_do = ${v || null}, updated_at = now() WHERE id = ${id};`;
      continue;
    }

    const v = String(wartosc ?? "").trim().slice(0, 200);
    // Zmiana kryteriów = polowanie szuka czego innego, więc kursor musi wrócić
    // na początek. Bez tego nowa lista PKD zaczynałaby od strony 7 STAREGO
    // zapytania i po cichu pomijała pierwsze 300 firm.
    if (pole === "nazwa") await sql`UPDATE lead_hunts SET nazwa = ${v}, updated_at = now() WHERE id = ${id};`;
    if (pole === "pkd") {
      const pkd = v.split(/[,;\s]+/).map((s) => s.replace(/[^0-9A-Za-z]/g, "").toUpperCase()).filter(Boolean).join(",");
      await sql`UPDATE lead_hunts SET pkd = ${pkd}, kursor = 0, updated_at = now() WHERE id = ${id};`;
    }
    if (pole === "wojewodztwo") await sql`UPDATE lead_hunts SET wojewodztwo = ${v.toUpperCase()}, kursor = 0, updated_at = now() WHERE id = ${id};`;
    if (pole === "powiat") await sql`UPDATE lead_hunts SET powiat = ${v}, kursor = 0, updated_at = now() WHERE id = ${id};`;
    if (pole === "miasto") await sql`UPDATE lead_hunts SET miasto = ${v}, kursor = 0, updated_at = now() WHERE id = ${id};`;
  }

  const rows = await sql`SELECT * FROM lead_hunts WHERE id = ${id};`;
  if (!rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ hunt: rows[0] });
}

/** DELETE /api/leads/hunts/:id — kasuje polowanie. Kandydaci z niego ZOSTAJĄ
 * (FK `ON DELETE SET NULL`): to, że przestajemy szukać, nie znaczy, że firmy
 * już znalezione mają zniknąć właścicielowi ze skrzynki. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureLeadHunterSchema();
  const sql = getSql();
  await sql`DELETE FROM lead_hunts WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
