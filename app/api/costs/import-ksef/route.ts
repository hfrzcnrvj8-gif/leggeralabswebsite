import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureCostsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { guessVatRate } from "@/lib/costs";
import { getKsefConfig, queryPurchaseInvoices, downloadInvoiceXml } from "@/lib/ksef-api";

export const runtime = "nodejs";
// Uwierzytelnienie + zapytanie z paginacją + pobranie XML każdej faktury bywa
// dłuższe niż domyślny limit funkcji — podnosimy go jak przy wysyłce.
export const maxDuration = 60;

/** Domyślny zakres importu: bieżący miesiąc (do dziś). API KSeF przyjmuje
 * max 3 miesiące na jedno zapytanie. Daty bez offsetu = czas Europe/Warsaw. */
function isoDay(d: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
}

/**
 * POST /api/costs/import-ksef — Faza 3, część 2: pobiera z KSeF faktury
 * zakupowe (gdzie jesteśmy nabywcą) za wybrany zakres dat i tworzy z nich
 * gotowe wpisy w Kosztach, dokładając oryginalny XML jako załącznik. Faktury
 * już zaimportowane rozpoznaje po numerze KSeF i pomija (dedup). Bramka
 * test/prod siedzi w getKsefConfig/queryPurchaseInvoices — produkcja jest
 * technicznie niedostępna do czasu rejestracji firmy.
 *
 * Body: { from?: "YYYY-MM-DD", to?: "YYYY-MM-DD" }.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // CAŁOŚĆ w try/catch — żaden błąd (env, sieć, DB) nie może skończyć się pustą
  // odpowiedzią; zawsze zwracamy czytelny komunikat do wyświetlenia w toaście.
  try {
    const body = (await req.json().catch(() => null)) as { from?: unknown; to?: unknown } | null;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;
    const from = isoDay(String(body?.from ?? "")) || monthStart;
    const to = isoDay(String(body?.to ?? "")) || today;

    await ensureCostsSchema();
    const sql = getSql();

    const cfg = getKsefConfig();
    // Pełne dni w strefie Europe/Warsaw (API dopuszcza brak offsetu = WAW).
    const { bearer, invoices } = await queryPurchaseInvoices(cfg, `${from}T00:00:00`, `${to}T23:59:59`);

    // Numery KSeF już obecne w bazie — pomijamy je (dedup).
    const existingRows = await sql`SELECT ksef_numer FROM costs WHERE ksef_numer IS NOT NULL;`;
    const existing = new Set(existingRows.map((r) => String(r.ksef_numer)));

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const m of invoices) {
      if (existing.has(m.ksefNumber)) {
        skipped++;
        continue;
      }
      try {
        const id = randomUUID();
        const vatStawka = guessVatRate(m.netAmount, m.vatAmount);
        const opis = m.invoiceNumber ? `Faktura ${m.invoiceNumber} (import KSeF)` : "Faktura z KSeF";
        const dataWydatku = isoDay(m.issueDate) || to;

        // Oryginalny XML z KSeF jako załącznik (archiwum). Pobranie best-effort —
        // brak pliku nie blokuje utworzenia samego kosztu z danych liczbowych.
        const xml = await downloadInvoiceXml(cfg, bearer, m.ksefNumber);
        const zalNazwa = xml ? `${m.ksefNumber}.xml` : "";
        const zalTyp = xml ? "application/xml" : "";
        const zalDane = xml ? Buffer.from(xml, "utf8").toString("base64") : null;

        await sql`
          INSERT INTO costs (
            id, dostawca_nazwa, dostawca_nip, kategoria, opis, data_wydatku,
            kwota_netto, vat_stawka, kwota_brutto, status,
            ksef_numer, ksef_tryb, zalacznik_nazwa, zalacznik_typ, zalacznik_dane
          ) VALUES (
            ${id}, ${m.sellerName}, ${m.sellerNip.replace(/[^0-9]/g, "")}, 'Inne', ${opis}, ${dataWydatku},
            ${m.netAmount}, ${vatStawka}, ${m.grossAmount}, 'Nieopłacony',
            ${m.ksefNumber}, ${cfg.env}, ${zalNazwa}, ${zalTyp}, ${zalDane}
          )
          ON CONFLICT (ksef_numer) DO NOTHING;
        `;
        existing.add(m.ksefNumber);
        imported++;
      } catch (e) {
        errors.push(`${m.invoiceNumber || m.ksefNumber}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      env: cfg.env,
      found: invoices.length,
      imported,
      skipped,
      errors,
      range: { from, to },
    });
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)) || "Nieznany błąd importu z KSeF.";
    console.error("[POST /api/costs/import-ksef] failed", e);
    return NextResponse.json({ ok: false, error: msg });
  }
}
