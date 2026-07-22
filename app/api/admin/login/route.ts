import { NextRequest, NextResponse } from "next/server";
import { checkPassword, createSession, createDeviceToken } from "@/lib/auth";
import {
  HAMULEC_KOD,
  HAMULEC_LOGOWANIE,
  odciskZadania,
  odnotujProbe,
  sprawdzHamulec,
  wyczyscPoUdanej,
  zglosPrzekroczenie,
} from "@/lib/rateLimit";
import { weryfikujPrzyLogowaniu, wymaganyDrugiSkladnik } from "@/lib/twoFactor";

export const runtime = "nodejs";

/**
 * POST /api/admin/login — dwa tryby, rozpoznawane po treści żądania:
 *
 * 1. Przeglądarka: `{ password }` → ustawia ciasteczko sesji (jak dotąd).
 * 2. Klient natywny: `{ password, device: "iPhone Patryka" }` → NIE ustawia
 *    ciasteczka; tworzy token per-urządzenie i zwraca go w JSON. Token
 *    pojawia się tylko w tej jednej odpowiedzi — apka chowa go w Keychain
 *    i odtąd wysyła jako `Authorization: Bearer <token>`.
 *
 * ── Drugi składnik (Moduł 41, 2026-07-22) ─────────────────────────────────
 * Gdy jest włączony, oba tryby wymagają dodatkowo `{ kod }` — sześciu cyfr
 * z aplikacji uwierzytelniającej albo kodu zapasowego. Samo hasło dostaje
 * wtedy odpowiedź **401 z `kod_wymagany: true`**, i to pole jest kontraktem
 * z aplikacją iOS: po nim apka wie, że ma dorysować drugi ekran zamiast
 * pokazać „nieprawidłowe hasło".
 *
 * Drugi składnik dotyczy **wydania** dostępu, nie każdego żądania: raz
 * wydany token urządzenia działa dalej, tak samo jak ciasteczko.
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

  const body = (await req.json().catch(() => null)) as {
    password?: unknown;
    device?: unknown;
    kod?: unknown;
  } | null;
  const password = body?.password;
  if (typeof password !== "string" || !checkPassword(password)) {
    await odnotujProbe(HAMULEC_LOGOWANIE, odcisk);
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  // Udane wejście kasuje licznik — inaczej pomyłka sprzed kwadransa
  // sumowałaby się z pomyłką za tydzień i próg zadziałałby bez powodu.
  await wyczyscPoUdanej(HAMULEC_LOGOWANIE, odcisk);

  // ── Drugi krok: kod z aplikacji (Moduł 41) ───────────────────────────────
  if (await wymaganyDrugiSkladnik()) {
    const kod = typeof body?.kod === "string" ? body.kod.trim() : "";
    if (!kod) {
      // Osobny kształt odpowiedzi, nie „invalid credentials": hasło BYŁO
      // poprawne i klient (przeglądarka albo apka) ma o tym wiedzieć, żeby
      // poprosić o kod zamiast kazać poprawiać hasło.
      return NextResponse.json(
        { error: "Podaj kod z aplikacji uwierzytelniającej.", kod_wymagany: true },
        { status: 401 }
      );
    }

    // Osobny licznik dla kodu — patrz komentarz przy HAMULEC_KOD. Sprawdzany
    // dopiero tutaj, bo do tego miejsca dochodzi wyłącznie ktoś, kto zna hasło.
    const limitKodu = await sprawdzHamulec(HAMULEC_KOD, odcisk);
    if (!limitKodu.dozwolone) {
      await zglosPrzekroczenie(HAMULEC_KOD, limitKodu.globalny);
      return NextResponse.json(
        {
          error: `Za dużo błędnych kodów. Spróbuj ponownie za ${limitKodu.zaMinut} min.`,
          kod_wymagany: true,
        },
        { status: 429, headers: { "Retry-After": String(limitKodu.zaMinut * 60) } }
      );
    }

    const wynik = await weryfikujPrzyLogowaniu(kod);
    if (!wynik.ok) {
      await odnotujProbe(HAMULEC_KOD, odcisk);
      return NextResponse.json({ error: wynik.powod, kod_wymagany: true }, { status: 401 });
    }
    await wyczyscPoUdanej(HAMULEC_KOD, odcisk);
  }

  if (typeof body?.device === "string" && body.device.trim().length > 0) {
    const { id, token } = await createDeviceToken(body.device.trim().slice(0, 100));
    return NextResponse.json({ ok: true, device_id: id, token });
  }

  await createSession();
  return NextResponse.json({ ok: true });
}
