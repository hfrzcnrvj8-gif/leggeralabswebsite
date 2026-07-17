import { NextResponse } from "next/server";
import { getSql, ensureLeadsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { toCsv } from "@/lib/export";
import { todayLocalISO } from "@/lib/dates";
import { leadSourceLabel } from "@/lib/leads";

export const runtime = "nodejs";

/** GET /api/leads/export — CSV rejestru leadów. W przeciwieństwie do
 * Faktur/Kosztów (zdarzenia z konkretnego okresu) leady to żywy rejestr bez
 * naturalnego zakresu dat, więc eksport bierze wszystkie na raz zamiast
 * pytać o "od-do".
 *
 * `?ids=a,b,c` (Moduł 34) — zawęża do podanych rekordów. Używa tego menu pod
 * prawym przyciskiem przy ikonie eksportu: „tylko widoczne (po filtrach)" i
 * „tylko zaznaczone". Świadomie ID-ki, a nie powtórzenie filtrów w SQL-u:
 * lista na ekranie jest już przefiltrowana i przeszukana po stronie klienta
 * (m.in. `search` po pięciu polach), więc odtwarzanie tej samej logiki tutaj
 * dałoby drugie źródło prawdy, które prędzej czy później rozjedzie się z UI.
 * Bez parametru zachowanie jest jak dotąd — cały rejestr. */
export async function GET(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureLeadsSchema();
  const sql = getSql();

  const idsParam = new URL(req.url).searchParams.get("ids");
  const ids = idsParam
    ? idsParam.split(",").map((s) => s.trim()).filter((s) => /^[0-9a-f-]{36}$/i.test(s))
    : null;
  // Pusta lista po odfiltrowaniu śmieci = świadomie pusty CSV (same nagłówki),
  // nie "cały rejestr" — inaczej "eksportuj zaznaczone" przy zepsutym
  // parametrze po cichu wysłałby księgowej wszystko.
  // `string_to_array(...)` zamiast `= ANY(${ids}::uuid[])`: przekazanie tablicy
  // JS jako parametru NIE działa jednakowo w obu sterownikach — na PGlite (dev)
  // zapytanie cicho zwracało zero wierszy, czyli CSV z samym nagłówkiem, i
  // `tsc` tego nie widzi. Parametrem jest zwykły string, więc oba sterowniki
  // traktują go tak samo. Porównanie po `id::text`, bo string_to_array daje text[].
  const rows =
    ids === null
      ? await sql`SELECT * FROM leads ORDER BY created_at DESC;`
      : await sql`SELECT * FROM leads WHERE id::text = ANY(string_to_array(${ids.join(",")}, ',')) ORDER BY created_at DESC;`;

  const header = [
    "Firma", "Osoba kontaktowa", "Branża", "Telefon", "Email", "WWW",
    "Ulica", "Kod", "Miasto", "Kraj", "Źródło", "Status",
    "Ostatni kontakt", "Przypomnij mi", "Notatki",
  ];
  const body = rows.map((r) => [
    String(r.firma ?? ""),
    String(r.osoba_kontaktowa ?? ""),
    String(r.branza ?? ""),
    String(r.telefon ?? ""),
    String(r.email ?? ""),
    String(r.www ?? ""),
    String(r.ulica ?? ""),
    String(r.kod ?? ""),
    String(r.miasto ?? ""),
    String(r.kraj ?? ""),
    leadSourceLabel({ zrodlo_kategoria: String(r.zrodlo_kategoria ?? ""), zrodlo: String(r.zrodlo ?? "") }),
    String(r.status ?? ""),
    String(r.ostatni_kontakt ?? "").slice(0, 10),
    String(r.next_followup ?? "").slice(0, 10),
    String(r.notatki ?? ""),
  ]);

  const csv = toCsv([header, ...body]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leady_${todayLocalISO()}.csv"`,
    },
  });
}
