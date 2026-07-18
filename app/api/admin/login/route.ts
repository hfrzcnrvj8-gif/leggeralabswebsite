import { NextRequest, NextResponse } from "next/server";
import { checkPassword, createSession, createDeviceToken } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/admin/login — dwa tryby, rozpoznawane po treści żądania:
 *
 * 1. Przeglądarka: `{ password }` → ustawia ciasteczko sesji (jak dotąd).
 * 2. Klient natywny: `{ password, device: "iPhone Patryka" }` → NIE ustawia
 *    ciasteczka; tworzy token per-urządzenie i zwraca go w JSON. Token
 *    pojawia się tylko w tej jednej odpowiedzi — apka chowa go w Keychain
 *    i odtąd wysyła jako `Authorization: Bearer <token>`.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { password?: unknown; device?: unknown } | null;
  const password = body?.password;
  if (typeof password !== "string" || !checkPassword(password)) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  if (typeof body?.device === "string" && body.device.trim().length > 0) {
    const { id, token } = await createDeviceToken(body.device.trim().slice(0, 100));
    return NextResponse.json({ ok: true, device_id: id, token });
  }

  await createSession();
  return NextResponse.json({ ok: true });
}
