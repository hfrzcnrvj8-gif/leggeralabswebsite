import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getKsefConfig, authenticateWithToken } from "@/lib/ksef-api";

export const runtime = "nodejs";

/**
 * POST /api/ksef/auth/test — sprawdza uwierzytelnienie na środowisku TESTOWYM
 * KSeF (Krok 3). Odpala pełen handshake i zwraca CZYTELNY wynik. Świadomie NIE
 * zwraca surowych tokenów do przeglądarki — tylko potwierdzenie, że się udało.
 * Bramka test/prod jest w getKsefConfig/authenticateWithToken; produkcja jest
 * technicznie niedostępna.
 */
export async function POST() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const cfg = getKsefConfig();
    const result = await authenticateWithToken(cfg);
    return NextResponse.json({
      ok: true,
      env: cfg.env,
      referenceNumber: result.referenceNumber,
      status: result.status,
      hasAccessToken: Boolean(result.accessToken),
      hasRefreshToken: Boolean(result.refreshToken),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Nieznany błąd." }, { status: 400 });
  }
}
