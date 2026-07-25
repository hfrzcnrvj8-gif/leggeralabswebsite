import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureLeadHunterSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { ceidgSkonfigurowany, ceidgSrodowisko } from "@/lib/ceidg";
import { isPlausibleDateString } from "@/lib/projects";

export const runtime = "nodejs";

/** GET /api/leads/hunts — definicje polowań + stan konfiguracji CEIDG.
 *
 * `token` w odpowiedzi to sam FAKT ustawienia zmiennej, nigdy jej wartość —
 * panel ma umieć powiedzieć „nie polujesz, bo nie ma tokenu" zamiast pokazywać
 * pustą listę bez wyjaśnienia. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureLeadHunterSchema();
  const sql = getSql();
  const hunts = await sql`SELECT * FROM lead_hunts ORDER BY created_at ASC;`;
  return NextResponse.json({
    hunts,
    ceidg: { skonfigurowany: ceidgSkonfigurowany(), srodowisko: ceidgSrodowisko() },
  });
}

/** POST /api/leads/hunts — nowe polowanie. Definiuje się je raz („biura
 * rachunkowe, Mazowsze") i chodzi w tle miesiącami. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const nazwa = String(body?.nazwa ?? "").trim();
  if (!nazwa) return NextResponse.json({ error: "Podaj nazwę polowania." }, { status: 400 });

  // PKD przyjmujemy w dowolnym zapisie („69.20", „6920Z", z przecinkami lub
  // spacjami) i sprowadzamy do jednego kształtu — właściciel przepisuje kody
  // z wyszukiwarki PKD, nie z naszej dokumentacji.
  const pkd = String(body?.pkd ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.replace(/[^0-9A-Za-z]/g, "").toUpperCase())
    .filter(Boolean)
    .join(",");

  // Każda data przez `isPlausibleDateString` — pułapka „0202" z CLAUDE.md
  // dotyczy KAŻDEGO nowego pola daty, także tego.
  const dataOd = String(body?.data_od ?? "").trim();
  const dataDo = String(body?.data_do ?? "").trim();
  if (dataOd && !isPlausibleDateString(dataOd)) return NextResponse.json({ error: "Niepoprawna data „od”." }, { status: 400 });
  if (dataDo && !isPlausibleDateString(dataDo)) return NextResponse.json({ error: "Niepoprawna data „do”." }, { status: 400 });

  await ensureLeadHunterSchema();
  const sql = getSql();
  const id = randomUUID();
  await sql`
    INSERT INTO lead_hunts (id, nazwa, pkd, wojewodztwo, powiat, miasto, data_od, data_do, aktywne)
    VALUES (
      ${id}, ${nazwa.slice(0, 200)}, ${pkd},
      ${String(body?.wojewodztwo ?? "").trim().toUpperCase().slice(0, 60)},
      ${String(body?.powiat ?? "").trim().slice(0, 60)},
      ${String(body?.miasto ?? "").trim().slice(0, 60)},
      ${dataOd || null}, ${dataDo || null}, ${body?.aktywne === false ? false : true}
    );
  `;
  const rows = await sql`SELECT * FROM lead_hunts WHERE id = ${id};`;
  return NextResponse.json({ hunt: rows[0] });
}
