import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureCostsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { todayLocalISO } from "@/lib/dates";
import { toCsv, csvMoney, csvSummaryRow, currentMonthRange, exportFilename } from "@/lib/export";
import { PAYMENT_METHOD_LABEL, type PaymentMethod, vatDoOdliczenia } from "@/lib/costs";

export const runtime = "nodejs";

/** GET /api/costs/export?from=YYYY-MM-DD&to=YYYY-MM-DD — rejestr zakupów
 * (CSV) dla księgowej: koszty z okresu (wg daty wydatku). Domyślny zakres:
 * bieżący miesiąc. Patrz Faza 4 mapy drogowej ERP w pamięci
 * comprehensive-audit-plan. */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureCostsSchema();
  const sql = getSql();

  const today = todayLocalISO();
  const defaults = currentMonthRange(today);
  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const from = fromParam && isPlausibleDateString(fromParam) ? fromParam : defaults.from;
  const to = toParam && isPlausibleDateString(toParam) ? toParam : defaults.to;

  const rows = await sql`
    SELECT dostawca_nazwa, dostawca_nip, numer_faktury, kategoria, opis, data_wydatku,
      data_wplywu, kwota_netto::float8 AS kwota_netto, vat_stawka, kwota_brutto::float8 AS kwota_brutto,
      vat_odliczenie_procent, status, data_platnosci, metoda_platnosci, dostawca_konto
    FROM costs
    WHERE data_wydatku BETWEEN ${from} AND ${to}
    ORDER BY data_wydatku ASC, created_at ASC;
  `;

  const header = [
    "Dostawca", "NIP", "Nr faktury", "Kategoria", "Opis", "Data wystawienia", "Data wpływu",
    "Netto", "VAT (stawka)", "Kwota VAT", "VAT do odliczenia", "Brutto", "Status", "Data płatności",
    "Metoda płatności", "Nr konta dostawcy",
  ];
  const body = rows.map((r) => {
    const netto = Number(r.kwota_netto);
    const brutto = Number(r.kwota_brutto);
    const vatStawka = String(r.vat_stawka ?? "");
    const procentOdliczenia = Number(r.vat_odliczenie_procent ?? 100);
    const metoda = r.metoda_platnosci as PaymentMethod | null;
    return [
      String(r.dostawca_nazwa ?? ""),
      String(r.dostawca_nip ?? ""),
      String(r.numer_faktury ?? ""),
      String(r.kategoria ?? ""),
      String(r.opis ?? ""),
      String(r.data_wydatku ?? "").slice(0, 10),
      String(r.data_wplywu ?? "").slice(0, 10),
      csvMoney(netto),
      vatStawka,
      csvMoney(brutto - netto),
      csvMoney(vatDoOdliczenia(netto, vatStawka, procentOdliczenia)),
      csvMoney(brutto),
      String(r.status ?? ""),
      String(r.data_platnosci ?? "").slice(0, 10),
      metoda ? (PAYMENT_METHOD_LABEL[metoda] ?? metoda) : "",
      String(r.dostawca_konto ?? ""),
    ];
  });

  // Jeden wiersz sumy, bez podziału na waluty — `costs` nie ma kolumny waluty,
  // więc rejestr zakupów jest z definicji jednowalutowy (inaczej niż sprzedaż).
  // Sumy liczone z tych samych liczb, które poszły do wierszy, żeby plik sam
  // się zgadzał.
  const netto = rows.reduce((s, r) => s + Number(r.kwota_netto), 0);
  const brutto = rows.reduce((s, r) => s + Number(r.kwota_brutto), 0);
  const vatOdliczenie = rows.reduce(
    (s, r) => s + vatDoOdliczenia(Number(r.kwota_netto), String(r.vat_stawka ?? ""), Number(r.vat_odliczenie_procent ?? 100)),
    0
  );
  const podsumowanie = csvSummaryRow(header.length, "RAZEM", {
    7: netto,
    9: brutto - netto,
    10: vatOdliczenie,
    11: brutto,
  });

  const csv = toCsv([header, ...body, podsumowanie]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename("koszty", from, to)}"`,
    },
  });
}
