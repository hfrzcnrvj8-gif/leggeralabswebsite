import { NextResponse } from "next/server";
import { getSql, ensureLeadHunterSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { ceidgSkonfigurowany, ceidgSrodowisko } from "@/lib/ceidg";
import { KANDYDACI_RETENCJA_DNI } from "@/lib/leadHunterRun";

export const runtime = "nodejs";

/**
 * GET /api/leads/candidates — skrzynka kandydatów „Łowcy leadów" (Moduł 52).
 *
 * Zwraca WSZYSTKIE stany poza `surowy` (ten jest etapem pośrednim potoku i nie
 * ma czego pokazać — nie przeszedł jeszcze sita). Kandydaci z oceną „C" też
 * lecą w tej samej liście: panel pokazuje ich na końcu i domyślnie zwiniętych,
 * ale ukrycie ich TUTAJ zamieniłoby sito w czarną skrzynkę, a właściciel ma
 * widzieć, co odsiewa.
 *
 * Sortowanie po punktach malejąco — to jest cała wartość tego modułu.
 */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureLeadHunterSchema();
  const sql = getSql();

  const candidates = await sql`
    SELECT c.*, h.nazwa AS polowanie
    FROM lead_candidates c
    LEFT JOIN lead_hunts h ON h.id = c.hunt_id
    WHERE c.stan <> 'surowy'
    ORDER BY
      CASE c.stan WHEN 'nowy' THEN 0 ELSE 1 END,
      c.punkty DESC,
      c.created_at DESC
    LIMIT 500;
  `;

  // Licznik odsiewu — drugi wskaźnik pętli poprawy („30× za młoda" = próg
  // wieku jest źle ustawiony). Ostatnie 90 dni, bo starsze mówią o wagach,
  // których już nie ma.
  const odsiew = await sql`
    SELECT powod, SUM(ile)::int AS ile FROM lead_hunt_rejects
    WHERE dzien > CURRENT_DATE - 90 GROUP BY powod ORDER BY ile DESC;
  `;

  const surowych = (await sql`SELECT COUNT(*)::int AS n FROM lead_candidates WHERE stan = 'surowy';`) as unknown as { n: number }[];

  return NextResponse.json({
    candidates,
    odsiew,
    // „Ilu czeka na wzbogacenie" — bez tego przebieg przerwany budżetem czasu
    // wygląda w panelu jak przebieg, który nic nie znalazł.
    surowych: surowych[0]?.n ?? 0,
    retencjaDni: KANDYDACI_RETENCJA_DNI,
    ceidg: { skonfigurowany: ceidgSkonfigurowany(), srodowisko: ceidgSrodowisko() },
  });
}
