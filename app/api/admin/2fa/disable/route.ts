import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { wylaczDrugiSkladnik } from "@/lib/twoFactor";

export const runtime = "nodejs";

/**
 * POST /api/admin/2fa/disable — `{ kod }` → wyłącza drugi składnik i kasuje
 * kody zapasowe.
 *
 * **Wymaga kodu, mimo że żądanie jest już uwierzytelnione** (decyzja
 * właściciela 2026-07-22). Bez tego przejęta otwarta sesja w przeglądarce
 * zdejmuje całą ochronę jednym kliknięciem i panel wraca do stanu sprzed
 * tego modułu. Kod zapasowy też przechodzi — właściciel bez telefonu musi
 * mieć czym to wyłączyć.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { kod?: unknown } | null;
  const kod = typeof body?.kod === "string" ? body.kod : "";
  const wynik = await wylaczDrugiSkladnik(kod);
  if (!wynik.ok) return NextResponse.json({ error: wynik.powod }, { status: 409 });
  return NextResponse.json({ ok: true });
}
