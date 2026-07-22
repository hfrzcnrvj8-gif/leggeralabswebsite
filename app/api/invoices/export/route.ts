import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { todayLocalISO } from "@/lib/dates";
import { toCsv, csvMoney, csvSummaryRow, groupByCurrency, currentMonthRange, exportFilename } from "@/lib/export";

export const runtime = "nodejs";

/** GET /api/invoices/export?from=YYYY-MM-DD&to=YYYY-MM-DD — rejestr sprzedaży
 * (CSV) dla księgowej: wystawione faktury/korekty/proformy z okresu, z sumami
 * netto/VAT/brutto per dokument (uwzględniają rabaty na pozycjach — ta sama
 * logika co lista faktur). Świadomie pomija szkice (jeszcze nie są
 * dokumentami) — patrz Faza 4 mapy drogowej ERP w pamięci
 * comprehensive-audit-plan. Domyślny zakres: bieżący miesiąc. */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureInvoicesSchema();
  const sql = getSql();

  const today = todayLocalISO();
  const defaults = currentMonthRange(today);
  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const from = fromParam && isPlausibleDateString(fromParam) ? fromParam : defaults.from;
  const to = toParam && isPlausibleDateString(toParam) ? toParam : defaults.to;

  // Netto/VAT/brutto to ZAWSZE wartości z pozycji TEGO dokumentu (bez odjęcia
  // rozliczanej zaliczki) — dokładnie to, co widnieje na fakturze/w XML FA(3)
  // (dla faktury rozliczeniowej to PEŁNA wartość zamówienia, nie "kwota
  // pozostała do zapłaty" z P_15). Świadomie: to jest rejestr sprzedaży dla
  // księgowej, ma zgadzać się z wystawionymi dokumentami — netowanie
  // zaliczka↔rozliczenie (żeby nie liczyć przychodu podwójnie) to standardowa
  // czynność księgowego przy rozliczaniu VAT, stąd kolumna "Rozlicza
  // zaliczkę" ułatwiająca powiązanie dokumentów.
  const rows = await sql`
    SELECT i.numer, i.typ_dokumentu, i.data_wystawienia, i.data_sprzedazy, i.termin_platnosci,
      i.klient_nazwa, i.klient_nip, i.klient_kraj, i.waluta, i.status, i.ksef_numer,
      z.numer AS rozlicza_zaliczke_numer,
      COALESCE(t.netto, 0)::float8 AS netto,
      COALESCE(t.vat, 0)::float8 AS vat,
      COALESCE(t.brutto, 0)::float8 AS brutto
    FROM invoices i
    LEFT JOIN (
      SELECT invoice_id,
        SUM(ilosc * cena_netto * (1 - rabat_procent / 100)) AS netto,
        SUM(ilosc * cena_netto * (1 - rabat_procent / 100) * CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END) AS vat,
        SUM(ilosc * cena_netto * (1 - rabat_procent / 100) * (1 + CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END)) AS brutto
      FROM invoice_items GROUP BY invoice_id
    ) t ON t.invoice_id = i.id
    LEFT JOIN invoices z ON z.id = i.rozlicza_zaliczke_id
    WHERE i.status != 'Szkic' AND i.data_wystawienia BETWEEN ${from} AND ${to}
    ORDER BY i.data_wystawienia ASC, i.numer ASC;
  `;

  const header = [
    "Numer", "Typ", "Data wystawienia", "Data sprzedaży", "Termin płatności",
    "Kontrahent", "NIP", "Kraj", "Netto", "VAT", "Brutto", "Waluta", "Status", "Numer KSeF", "Rozlicza zaliczkę",
  ];
  const body = rows.map((r) => [
    String(r.numer ?? ""),
    String(r.typ_dokumentu ?? ""),
    String(r.data_wystawienia ?? "").slice(0, 10),
    String(r.data_sprzedazy ?? "").slice(0, 10),
    String(r.termin_platnosci ?? "").slice(0, 10),
    String(r.klient_nazwa ?? ""),
    String(r.klient_nip ?? ""),
    String(r.klient_kraj ?? ""),
    csvMoney(Number(r.netto)),
    csvMoney(Number(r.vat)),
    csvMoney(Number(r.brutto)),
    String(r.waluta ?? ""),
    String(r.status ?? ""),
    String(r.ksef_numer ?? ""),
    String(r.rozlicza_zaliczke_numer ?? ""),
  ]);

  // Sumy per waluta — patrz `groupByCurrency`. Liczone z tych samych wartości,
  // które trafiają do wierszy, więc plik zawsze sam się zgadza; policzenie ich
  // drugim zapytaniem SQL dałoby dwa źródła prawdy i ciche rozjazdy przy
  // zmianie reguły rabatów.
  const podsumowania = groupByCurrency(rows, (r) => String(r.waluta ?? "")).map(({ waluta, wiersze }) =>
    csvSummaryRow(header.length, `RAZEM ${waluta}`, {
      8: wiersze.reduce((s, r) => s + Number(r.netto), 0),
      9: wiersze.reduce((s, r) => s + Number(r.vat), 0),
      10: wiersze.reduce((s, r) => s + Number(r.brutto), 0),
    })
  );

  const csv = toCsv([header, ...body, ...podsumowania]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename("faktury", from, to)}"`,
    },
  });
}
