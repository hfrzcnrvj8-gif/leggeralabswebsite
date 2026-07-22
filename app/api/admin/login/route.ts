import { NextRequest, NextResponse } from "next/server";
import { checkPassword, createSession, createDeviceToken } from "@/lib/auth";
import {
  HAMULEC_LOGOWANIE,
  odciskZadania,
  odnotujProbe,
  sprawdzHamulec,
  wyczyscPoUdanej,
  zglosPrzekroczenie,
} from "@/lib/rateLimit";

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
  // ── Hamulec (Audyt 1, 2026-07-22) ────────────────────────────────────────
  // PRZED sprawdzeniem hasła, świadomie: hamulec po sprawdzeniu chroniłby
  // tylko przed zapisem sesji, a samo zgadywanie działałoby dalej.
  const odcisk = odciskZadania(req.headers);
  const limit = await sprawdzHamulec(HAMULEC_LOGOWANIE, odcisk);
  if (!limit.dozwolone) {
    await zglosPrzekroczenie(HAMULEC_LOGOWANIE, limit.globalny);
    return NextResponse.json(
      {
        error: limit.globalny
          ? `Zbyt wiele prób logowania w systemie. Spróbuj ponownie za ${limit.zaMinut} min.`
          : `Za dużo nieudanych prób. Spróbuj ponownie za ${limit.zaMinut} min.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.zaMinut * 60) } }
    );
  }

  const body = (await req.json().catch(() => null)) as { password?: unknown; device?: unknown } | null;
  const password = body?.password;
  if (typeof password !== "string" || !checkPassword(password)) {
    await odnotujProbe(HAMULEC_LOGOWANIE, odcisk);
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  // Udane wejście kasuje licznik — inaczej pomyłka sprzed kwadransa
  // sumowałaby się z pomyłką za tydzień i próg zadziałałby bez powodu.
  await wyczyscPoUdanej(HAMULEC_LOGOWANIE, odcisk);

  if (typeof body?.device === "string" && body.device.trim().length > 0) {
    const { id, token } = await createDeviceToken(body.device.trim().slice(0, 100));
    return NextResponse.json({ ok: true, device_id: id, token });
  }

  await createSession();
  return NextResponse.json({ ok: true });
}
