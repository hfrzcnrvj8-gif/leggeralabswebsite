import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { odnowKodyZapasowe } from "@/lib/twoFactor";

export const runtime = "nodejs";

/**
 * POST /api/admin/2fa/backup-codes — `{ kod }` → nowa ósemka, stare przestają
 * działać.
 *
 * Istnieje, bo kody zapasowe są jednorazowe: bez tej trasy ósmy zużyty kod
 * po cichu likwidowałby główną drogę powrotu (papier), a właściciel
 * dowiedziałby się o tym dopiero po zgubieniu telefonu. Decyzja właściciela
 * z 2026-07-22.
 *
 * Wymaga **kodu z aplikacji**, nie zapasowego — inaczej jeden podejrzany
 * kod zapasowy dawałby atakującemu komplet ośmiu nowych.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { kod?: unknown } | null;
  const kod = typeof body?.kod === "string" ? body.kod : "";
  const wynik = await odnowKodyZapasowe(kod);
  if (!wynik.ok) return NextResponse.json({ error: wynik.powod }, { status: 409 });
  return NextResponse.json({ ok: true, kody_zapasowe: wynik.kodyZapasowe });
}
