import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureCostsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { todayLocalISO } from "@/lib/dates";
import { toCsv, csvMoney, csvSummaryRow, currentMonthRange, exportFilename } from "@/lib/export";
import { PAYMENT_METHOD_LABEL, type PaymentMethod, vatDoOdliczenia, kursDoPln, wPln, maPrzelicznik } from "@/lib/costs";

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
      data_wplywu, termin_platnosci, kwota_netto::float8 AS kwota_netto, vat_stawka,
      kwota_brutto::float8 AS kwota_brutto, waluta, kurs_pln::float8 AS kurs_pln,
      vat_odliczenie_procent, status, data_platnosci, metoda_platnosci, dostawca_konto
    FROM costs
    WHERE data_wydatku BETWEEN ${from} AND ${to}
    ORDER BY data_wydatku ASC, created_at ASC;
  `;

  // Kolumny występują PARAMI: kwota z dokumentu (w jego własnej walucie) i ta
  // sama kwota po przeliczeniu na złote (Moduł 63). Księgowa potrzebuje obu —
  // pierwsza musi zgadzać się z papierową fakturą, druga wchodzi do rejestru
  // zakupów. Wiersz RAZEM sumuje WYŁĄCZNIE kolumny PLN: suma kwot w mieszanych
  // walutach nie znaczyłaby nic.
  const header = [
    "Dostawca", "NIP", "Nr faktury", "Kategoria", "Opis", "Data wystawienia", "Data wpływu",
    "Termin płatności", "Netto", "VAT (stawka)", "Kwota VAT", "VAT do odliczenia", "Brutto",
    "Waluta", "Kurs do PLN",
    "Netto PLN", "Kwota VAT PLN", "VAT do odliczenia PLN", "Brutto PLN",
    "Status", "Data płatności", "Metoda płatności", "Nr konta dostawcy",
  ];
  const wPlnKol = { netto: 15, vat: 16, odliczenie: 17, brutto: 18 };

  const body = rows.map((r) => {
    const netto = Number(r.kwota_netto);
    const brutto = Number(r.kwota_brutto);
    const vatStawka = String(r.vat_stawka ?? "");
    const procentOdliczenia = Number(r.vat_odliczenie_procent ?? 100);
    const metoda = r.metoda_platnosci as PaymentMethod | null;
    const kurs = kursDoPln(r.kurs_pln as number | null);
    const odliczenie = vatDoOdliczenia(netto, vatStawka, procentOdliczenia);
    // Koszt w obcej walucie bez kursu (import z KSeF) zostawia kolumny PLN
    // PUSTE. Wpisanie tam kwoty oryginalnej udawałoby przeliczenie, którego
    // nie było — a księgowa czytałaby to jako złotówki.
    const przeliczalny = maPrzelicznik(String(r.waluta ?? "PLN"), r.kurs_pln as number | null);
    const pln = (v: number) => (przeliczalny ? csvMoney(wPln(v, kurs)) : "");
    return [
      String(r.dostawca_nazwa ?? ""),
      String(r.dostawca_nip ?? ""),
      String(r.numer_faktury ?? ""),
      String(r.kategoria ?? ""),
      String(r.opis ?? ""),
      String(r.data_wydatku ?? "").slice(0, 10),
      String(r.data_wplywu ?? "").slice(0, 10),
      String(r.termin_platnosci ?? "").slice(0, 10),
      csvMoney(netto),
      vatStawka,
      csvMoney(brutto - netto),
      csvMoney(odliczenie),
      csvMoney(brutto),
      String(r.waluta ?? "PLN"),
      // Kurs pusty dla PLN — „1,0000" sugerowałoby przeliczenie, którego nie było.
      r.kurs_pln == null ? "" : String(kurs),
      pln(netto),
      pln(brutto - netto),
      pln(odliczenie),
      pln(brutto),
      String(r.status ?? ""),
      String(r.data_platnosci ?? "").slice(0, 10),
      metoda ? (PAYMENT_METHOD_LABEL[metoda] ?? metoda) : "",
      String(r.dostawca_konto ?? ""),
    ];
  });

  // Sumy liczone z tych samych liczb, które poszły do wierszy, żeby plik sam
  // się zgadzał — i wyłącznie po przeliczeniu na PLN.
  // Sumujemy tylko wiersze, które DA SIĘ przeliczyć — reszta jest w pliku
  // widoczna z pustymi kolumnami PLN, więc pominięcie nie jest ciche.
  const sumaPln = (wybierz: (r: Record<string, unknown>) => number) =>
    rows
      .filter((r) => maPrzelicznik(String(r.waluta ?? "PLN"), r.kurs_pln as number | null))
      .reduce((s, r) => s + wPln(wybierz(r as Record<string, unknown>), kursDoPln(r.kurs_pln as number | null)), 0);
  const netto = sumaPln((r) => Number(r.kwota_netto));
  const brutto = sumaPln((r) => Number(r.kwota_brutto));
  const vatOdliczenie = sumaPln((r) =>
    vatDoOdliczenia(Number(r.kwota_netto), String(r.vat_stawka ?? ""), Number(r.vat_odliczenie_procent ?? 100))
  );
  const podsumowanie = csvSummaryRow(header.length, "RAZEM (PLN)", {
    [wPlnKol.netto]: netto,
    [wPlnKol.vat]: brutto - netto,
    [wPlnKol.odliczenie]: vatOdliczenie,
    [wPlnKol.brutto]: brutto,
  });

  const csv = toCsv([header, ...body, podsumowanie]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename("koszty", from, to)}"`,
    },
  });
}
