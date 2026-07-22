import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { potwierdzWlaczanie } from "@/lib/twoFactor";

export const runtime = "nodejs";

/**
 * POST /api/admin/2fa/confirm — krok 2: `{ kod }` z aplikacji.
 *
 * Dopiero to zapisuje sekret jako aktywny i wydaje osiem kodów zapasowych.
 * Kody wracają **jawnie i jeden jedyny raz** — w bazie zostają wyłącznie ich
 * skróty, więc nie ma trasy, która umiałaby je pokazać ponownie. Panel musi
 * je w tym momencie pokazać z możliwością wydruku i skopiowania.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { kod?: unknown } | null;
  const kod = typeof body?.kod === "string" ? body.kod : "";
  const wynik = await potwierdzWlaczanie(kod);
  // 409, nie 401: żądanie było poprawnie uwierzytelnione, odmowa dotyczy
  // treści. Apka rozróżnia te dwa przypadki (patrz APIError w APIClient.swift).
  if (!wynik.ok) return NextResponse.json({ error: wynik.powod }, { status: 409 });
  return NextResponse.json({ ok: true, kody_zapasowe: wynik.kodyZapasowe });
}
