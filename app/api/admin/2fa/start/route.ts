import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { rozpocznijWlaczanie } from "@/lib/twoFactor";

export const runtime = "nodejs";

/**
 * POST /api/admin/2fa/start — krok 1 włączania: losuje sekret i zwraca go
 * razem z adresem `otpauth://` do kodu QR.
 *
 * **Sekret jest tu jeszcze nieaktywny.** Chroni dopiero po potwierdzeniu
 * kodem (`/confirm`) — bez tego literówka w ręcznie przepisanym sekrecie
 * zatrzasnęłaby właściciela przed panelem.
 *
 * Wywołanie po raz drugi (właściciel zamknął okno i zaczyna od nowa) losuje
 * nowy sekret i unieważnia poprzedni, niepotwierdzony. To celowe: dwa
 * oczekujące sekrety, z których działa losowy, byłyby gorsze niż jeden.
 */
export async function POST() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const wynik = await rozpocznijWlaczanie();
  if (!wynik.ok) return NextResponse.json({ error: wynik.powod }, { status: 409 });
  return NextResponse.json({
    sekret: wynik.sekret,
    sekret_czytelny: wynik.sekretCzytelny,
    adres: wynik.adres,
  });
}
