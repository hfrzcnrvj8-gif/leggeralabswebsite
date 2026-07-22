import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { zapiszBlad } from "@/lib/errorLog";

export const runtime = "nodejs";

/**
 * POST /api/errors/client — zgłoszenie wysypki interfejsu z przeglądarki
 * (Audyt 4, ustalenie 4 — 2026-07-22).
 *
 * Do tego audytu awaria interfejsu była niewidoczna w 100%: z 95 miejsc
 * logujących błędy 94 to serwer, a jedyny `console.error` po stronie
 * przeglądarki trafiał do konsoli właściciela, czyli donikąd. Wysypka
 * renderowania kończyła się ekranem błędu i zerowym śladem.
 *
 * **Wymaga zalogowania — świadomie.** Otwarta trasa dopisująca wiersze do
 * bazy byłaby zaproszeniem do zaśmiecania logu, a sekretu nie da się ukryć
 * w kodzie przeglądarki (ten sam problem, którego nie ma `/api/backup/ping`,
 * bo tam melduje się maszyna). Konsekwencja, którą trzeba nazwać wprost:
 * **łapiemy wysypki panelu, nie strony publicznej.** Panel jest tym, co ma
 * działać latami; strona publiczna jest prosta i jej awaria widać od razu.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    komunikat?: unknown;
    stos?: unknown;
    sciezka?: unknown;
  } | null;
  if (!body || typeof body.komunikat !== "string") {
    return NextResponse.json({ error: "Wymagane pole `komunikat`." }, { status: 400 });
  }

  // Ścieżka bez query stringa — patrz komentarz w instrumentation.ts.
  const sciezka = typeof body.sciezka === "string" ? body.sciezka.split("?")[0].slice(0, 200) : "";

  await zapiszBlad({
    zakres: "przeglądarka",
    komunikat: `${sciezka}: ${body.komunikat}`,
    szczegoly: typeof body.stos === "string" ? body.stos : "",
    klucz: `przeglądarka:${sciezka}:${body.komunikat.slice(0, 120)}`,
  });

  return NextResponse.json({ ok: true });
}
