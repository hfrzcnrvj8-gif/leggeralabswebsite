import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { WSTEP, MODULY } from "@/lib/instrukcje";

export const runtime = "nodejs";

/**
 * GET /api/instrukcje — podręcznik obsługi dla apki (Moduł 53).
 *
 * Treść nie mieszka w bazie ani w Swifcie, tylko w `lib/instrukcje.ts`. Dzięki
 * temu jest JEDNO źródło: panel renderuje ją wprost, telefon i iPad pobierają
 * tę samą listę. Druga kopia tekstu w apce rozjechałaby się przy pierwszej
 * zmianie funkcji — dokładnie tak, jak rozjeżdżała się dokumentacja tego
 * projektu przed audytami.
 *
 * Admin-only, mimo że to „tylko dokumentacja": instrukcja wymienia z nazwy
 * automaty, progi i drogi wejścia do panelu, więc nie ma powodu wystawiać jej
 * publicznie.
 */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ wstep: WSTEP, moduly: MODULY });
}
