import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { DEFAULT_COMPANY_SETTINGS, type Invoice, type InvoiceItem, type CompanySettings } from "@/lib/invoices";
import { buildFA3Xml, validateForFA3, nipDigits, type KsefStatus } from "@/lib/ksef";
import { getKsefConfig, sendInvoiceToKsef } from "@/lib/ksef-api";

export const runtime = "nodejs";

/** Data wystawienia w formacie DD-MM-RRRR wymaganym w linku kodu QR KSeF.
 * Odporna na to, że baza zwraca kolumnę DATE jako string albo jako Date. */
function ddMmRrrr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    return `${String(v.getDate()).padStart(2, "0")}-${String(v.getMonth() + 1).padStart(2, "0")}-${v.getFullYear()}`;
  }
  const [y, m, d] = String(v).slice(0, 10).split("-");
  return d && m && y ? `${d}-${m}-${y}` : "";
}
// Pełna rozmowa z KSeF (uwierzytelnienie + sesja + wysyłka + polling statusu +
// UPO) bywa dłuższa niż domyślny limit funkcji — podnosimy go, żeby nie ucięło
// jej w połowie (co dawało pustą odpowiedź i „nieznany powód" w UI).
export const maxDuration = 60;

/**
 * POST /api/invoices/:id/ksef/send — Krok 4 Fazy 2: realna wysyłka faktury
 * FA(3) do KSeF przez sesję online (środowisko TESTOWE). Waliduje lokalnie,
 * generuje XML, szyfruje i wysyła, odbiera numer KSeF + UPO, po czym zapisuje
 * wynik na fakturze. Bramka test/prod siedzi w getKsefConfig/sendInvoiceToKsef
 * — produkcja jest technicznie niedostępna do czasu rejestracji firmy.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runSend(id);
}

/**
 * GET — diagnostyka „do kliknięcia w przeglądarce" (jak przy uwierzytelnianiu,
 * Krok 3). DOMYŚLNIE na sucho: waliduje i pokazuje podgląd XML, NIC nie wysyła
 * (bezpieczne przy prefetchu przeglądarki). Realna wysyłka dopiero przy jawnym
 * `?send=1` — wtedy działa identycznie jak POST.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (req.nextUrl.searchParams.get("send") === "1") return runSend(id);

  // Tryb „na sucho": walidacja + podgląd XML, bez ruchu sieciowego do KSeF.
  await ensureInvoicesSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM invoices WHERE id = ${id};`;
  const invoice = rows[0] as unknown as Invoice | undefined;
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });
  const itemRows = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${id} ORDER BY position ASC;`;
  const items = itemRows.map((r) => ({
    ...(r as Record<string, unknown>),
    ilosc: Number((r as Record<string, unknown>).ilosc),
    cena_netto: Number((r as Record<string, unknown>).cena_netto),
    rabat_procent: Number((r as Record<string, unknown>).rabat_procent),
  })) as unknown as InvoiceItem[];
  const settingsRows = await sql`SELECT * FROM company_settings WHERE id = 'default';`;
  const company = (settingsRows[0] as unknown as CompanySettings) ?? DEFAULT_COMPANY_SETTINGS;
  const validation = validateForFA3(invoice, items, company);
  const xml = buildFA3Xml(invoice, items, company);
  return NextResponse.json({
    dryRun: true,
    hint: "To tylko podgląd. Aby NAPRAWDĘ wysłać fakturę na środowisko testowe KSeF, dodaj do adresu ?send=1.",
    canSend: validation.errors.length === 0,
    validation,
    xmlPreview: xml.slice(0, 800),
    xmlLength: xml.length,
  });
}

async function runSend(id: string) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // CAŁOŚĆ w try/catch — żeby ŻADEN błąd (env, sieć, DB, nieoczekiwany wyjątek)
  // nie skończył się pustą odpowiedzią 500. Zawsze zwracamy czytelny komunikat
  // i zapisujemy go na fakturze (ksef_blad), żeby był widoczny w karcie KSeF.
  try {
    await ensureInvoicesSchema();
    const sql = getSql();

    const rows = await sql`SELECT * FROM invoices WHERE id = ${id};`;
    const invoice = rows[0] as unknown as Invoice | undefined;
    if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });

    const itemRows = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${id} ORDER BY position ASC;`;
    const items = itemRows.map((r) => ({
      ...(r as Record<string, unknown>),
      ilosc: Number((r as Record<string, unknown>).ilosc),
      cena_netto: Number((r as Record<string, unknown>).cena_netto),
    })) as unknown as InvoiceItem[];

    const settingsRows = await sql`SELECT * FROM company_settings WHERE id = 'default';`;
    const company = (settingsRows[0] as unknown as CompanySettings) ?? DEFAULT_COMPANY_SETTINGS;

    // Walidacja lokalna — błędy blokują wysyłkę (ostrzeżenia tylko informują).
    const validation = validateForFA3(invoice, items, company);
    if (validation.errors.length) {
      return NextResponse.json({ ok: false, stage: "walidacja", validation }, { status: 400 });
    }

    const xml = buildFA3Xml(invoice, items, company);
    const cfg = getKsefConfig();
    const result = await sendInvoiceToKsef(cfg, xml);

    // Mapowanie wyniku KSeF na status dokumentu.
    //   200         → przyjeto (numer KSeF nadany)
    //   ≥400        → odrzucono (powód w ksef_blad)
    //   100/150     → wyslano (nadal przetwarzane; numer dojdzie później)
    const status: KsefStatus = result.accepted
      ? "przyjeto"
      : result.statusCode >= 400
        ? "odrzucono"
        : "wyslano";
    const blad = result.accepted ? "" : `${result.statusText} (kod ${result.statusCode})`;

    // Link KOD I (weryfikujący) do kodu QR na wizualizacji — tylko dla przyjętej
    // faktury: {baza}/invoice/{NIP sprzedawcy}/{DD-MM-RRRR}/{SHA-256 XML Base64URL}.
    // Baza testowa/produkcyjna wg środowiska (qr-test vs qr).
    const qrBase = cfg.env === "test" ? "https://qr-test.ksef.mf.gov.pl/invoice" : "https://qr.ksef.mf.gov.pl/invoice";
    const ksefQr = result.accepted
      ? `${qrBase}/${nipDigits(company.nip)}/${ddMmRrrr(invoice.data_wystawienia)}/${result.invoiceHashUrl}`
      : null;

    await sql`
      UPDATE invoices SET
        ksef_status = ${status},
        ksef_tryb = 'test',
        ksef_numer = ${result.ksefNumber},
        ksef_upo = ${result.upo},
        ksef_blad = ${blad},
        ksef_qr = ${ksefQr},
        ksef_wyslano_at = NOW()
      WHERE id = ${id};
    `;

    return NextResponse.json({
      ok: result.accepted,
      status,
      env: "test",
      ksefNumber: result.ksefNumber,
      statusCode: result.statusCode,
      statusText: result.statusText,
      error: result.accepted ? undefined : blad,
      hasUpo: Boolean(result.upo),
      sessionReference: result.sessionReference,
      invoiceReference: result.invoiceReference,
      validation,
    });
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)) || "Nieznany błąd wysyłki do KSeF.";
    console.error("[POST /api/invoices/:id/ksef/send] failed", e);
    // Best-effort zapis powodu na fakturze (status zostaje bez zmian — dokument
    // nie dotarł do przetworzenia w KSeF, to błąd po drodze).
    try {
      await getSql()`UPDATE invoices SET ksef_blad = ${msg} WHERE id = ${id};`;
    } catch {
      // jeśli i to padnie, komunikat i tak wraca w odpowiedzi poniżej
    }
    // 200 z ok:false — żeby przeglądarka na pewno odczytała JSON z komunikatem
    // (a nie potraktowała tego jako pustą odpowiedź błędu).
    return NextResponse.json({ ok: false, stage: "wysyłka", error: msg });
  }
}
