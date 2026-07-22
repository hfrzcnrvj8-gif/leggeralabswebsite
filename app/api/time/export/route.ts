import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureTimeSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { todayLocalISO } from "@/lib/dates";
import { toCsv, csvMoney, csvSummaryRow, currentMonthRange, exportFilename } from "@/lib/export";

export const runtime = "nodejs";

/** GET /api/time/export?from=YYYY-MM-DD&to=YYYY-MM-DD — rejestr czasu pracy
 * (CSV) do rozliczenia z klientem. Domyślny zakres: bieżący miesiąc.
 *
 * **Jedna linia = jedna sesja**, a klient i projekt to dwie osobne kolumny —
 * świadomie BEZ agregowania po projekcie ani po kliencie (decyzja właściciela
 * 2026-07-22, po zadaniu pytania „per projekt czy per klient?"). Powód:
 * z linii da się w Excelu zrobić sumę w dowolnym przekroju jednym ruchem,
 * a z sumy nie da się odzyskać szczegółu — a to właśnie szczegół („za co
 * konkretnie te 14 godzin?") jest tym, o co pyta klient przy fakturze.
 * Sumy per projekt są na dole pliku, więc jedno nie wyklucza drugiego.
 *
 * **Chodzący stoper wypada z eksportu** (`ended_at IS NULL`) — nie da się
 * wystawić rachunku za czas, który jeszcze trwa. To ta sama reguła, którą
 * stosuje suma czasu na profilu projektu w apce; gdyby się rozjechały,
 * faktura nie zgadzałaby się z tym, co właściciel widzi na telefonie. */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureTimeSchema();
  const sql = getSql();

  const today = todayLocalISO();
  const defaults = currentMonthRange(today);
  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const from = fromParam && isPlausibleDateString(fromParam) ? fromParam : defaults.from;
  const to = toParam && isPlausibleDateString(toParam) ? toParam : defaults.to;

  // Klient przez projekt — `time_entries` nie ma własnego `client_id`, bo czas
  // loguje się zawsze przy projekcie. `LEFT JOIN`, nie `JOIN`: projekt bez
  // klienta (wewnętrzny) ma zostać w rejestrze z pustą kolumną, a nie zniknąć
  // — cicho gubiony wiersz jest gorszy niż wiersz z pustym polem.
  const rows = await sql`
    SELECT t.entry_date, t.minutes::float8 AS minutes, t.note, t.source,
      p.tytul AS projekt, c.nazwa AS klient, z.text AS zadanie
    FROM time_entries t
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN clients c ON c.id = p.client_id
    LEFT JOIN project_tasks z ON z.id = t.task_id
    WHERE t.ended_at IS NOT NULL
      AND t.entry_date BETWEEN ${from} AND ${to}
    ORDER BY t.entry_date ASC, p.tytul ASC, t.created_at ASC;
  `;

  const header = ["Data", "Klient", "Projekt", "Zadanie", "Opis", "Minuty", "Godziny", "Źródło"];
  const body = rows.map((r) => [
    String(r.entry_date ?? "").slice(0, 10),
    String(r.klient ?? ""),
    String(r.projekt ?? ""),
    String(r.zadanie ?? ""),
    String(r.note ?? ""),
    csvMoney(Number(r.minutes)),
    // Godziny osobną kolumną, bo w tych jednostkach się fakturuje. Dwa miejsca
    // po przecinku, nie zaokrąglenie do pełnych — 20 minut to 0,33 h i tak ma
    // wyjść, a nie 0 albo 1.
    csvMoney(Number(r.minutes) / 60),
    String(r.source ?? ""),
  ]);

  // Sumy per projekt na dole + jedna zbiorcza. Kolejność jak w rejestrze,
  // żeby plik czytało się z góry na dół bez skakania.
  const wgProjektu = new Map<string, { klient: string; minuty: number }>();
  for (const r of rows) {
    const klucz = String(r.projekt ?? "");
    const wpis = wgProjektu.get(klucz) ?? { klient: String(r.klient ?? ""), minuty: 0 };
    wpis.minuty += Number(r.minutes);
    wgProjektu.set(klucz, wpis);
  }
  const podsumowania = [...wgProjektu].map(([projekt, { klient, minuty }]) => {
    const row = csvSummaryRow(header.length, "RAZEM", { 5: minuty, 6: minuty / 60 });
    row[1] = klient;
    row[2] = projekt;
    return row;
  });
  const lacznieMinut = rows.reduce((s, r) => s + Number(r.minutes), 0);
  const lacznie = csvSummaryRow(header.length, "RAZEM WSZYSTKO", {
    5: lacznieMinut,
    6: lacznieMinut / 60,
  });

  const csv = toCsv([header, ...body, ...podsumowania, lacznie]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename("czas-pracy", from, to)}"`,
    },
  });
}
