import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureCostsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { todayLocalISO } from "@/lib/dates";
import { toCsv, csvMoney, currentMonthRange, exportFilename } from "@/lib/export";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/costs";

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
    SELECT dostawca_nazwa, dostawca_nip, kategoria, opis, data_wydatku,
      kwota_netto::float8 AS kwota_netto, vat_stawka, kwota_brutto::float8 AS kwota_brutto,
      status, data_platnosci, metoda_platnosci, dostawca_konto
    FROM costs
    WHERE data_wydatku BETWEEN ${from} AND ${to}
    ORDER BY data_wydatku ASC, created_at ASC;
  `;

  const header = [
    "Dostawca", "NIP", "Kategoria", "Opis", "Data wydatku",
    "Netto", "VAT (stawka)", "Kwota VAT", "Brutto", "Status", "Data płatności",
    "Metoda płatności", "Nr konta dostawcy",
  ];
  const body = rows.map((r) => {
    const netto = Number(r.kwota_netto);
    const brutto = Number(r.kwota_brutto);
    const metoda = r.metoda_platnosci as PaymentMethod | null;
    return [
      String(r.dostawca_nazwa ?? ""),
      String(r.dostawca_nip ?? ""),
      String(r.kategoria ?? ""),
      String(r.opis ?? ""),
      String(r.data_wydatku ?? "").slice(0, 10),
      csvMoney(netto),
      String(r.vat_stawka ?? ""),
      csvMoney(brutto - netto),
      csvMoney(brutto),
      String(r.status ?? ""),
      String(r.data_platnosci ?? "").slice(0, 10),
      metoda ? (PAYMENT_METHOD_LABEL[metoda] ?? metoda) : "",
      String(r.dostawca_konto ?? ""),
    ];
  });

  const csv = toCsv([header, ...body]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename("koszty", from, to)}"`,
    },
  });
}
