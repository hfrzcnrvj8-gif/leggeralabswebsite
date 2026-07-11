"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  type Invoice,
  type InvoiceItem,
  type CompanySettings,
  type InvoiceLang,
  invoiceTotals,
  itemNetto,
  itemVat,
  itemBrutto,
  amountInWords,
  clientAddressLines,
  vatBreakdown,
} from "@/lib/invoices";
import { docMoney, docDate, DOC_GRADIENT, buildEpcQrPayload } from "@/lib/documents";

/** Podgląd/wydruk faktury — samodzielny biały dokument (niezależny od motywu
 * panelu), gotowy do „Drukuj / Zapisz jako PDF" przeglądarki. Premium,
 * stonowany styl (czerń/biel/szarości + subtelny akcent gradientu marki
 * fiolet→złoto), wzorowany na fakturach Apple/Anthropic. Trójjęzyczny
 * (PL/EN/DE) — język wybiera się per faktura w edytorze (`invoice.jezyk`),
 * niezależnie od języka w jakim akurat przegląda się panel. */

type Dict = {
  doc: string;
  no: string;
  issueDate: string;
  saleDate: string;
  seller: string;
  buyer: string;
  taxId: string;
  lp: string;
  item: string;
  qty: string;
  unit: string;
  unitPrice: string;
  vatRate: string;
  netValue: string;
  vatAmount: string;
  grossValue: string;
  totalNet: string;
  totalVat: string;
  totalDue: string;
  inWords: string;
  paymentMethod: string;
  bankTransfer: string;
  dueDate: string;
  bankAccount: string;
  vatExemptBasis: string;
  eSignatureNote: string;
  loading: string;
  notFound: string;
  close: string;
  print: string;
  draft: string;
  phone: string;
  vatSummary: string;
  vatBase: string;
  reverseCharge: string;
  footerCompany: string;
  footerContact: string;
  footerBank: string;
  bank: string;
  scanToPay: string;
};

const DICT: Record<InvoiceLang, Dict> = {
  pl: {
    doc: "Faktura",
    no: "Nr",
    issueDate: "Data wystawienia",
    saleDate: "Data sprzedaży",
    seller: "Sprzedawca",
    buyer: "Nabywca",
    taxId: "NIP",
    lp: "Lp",
    item: "Nazwa",
    qty: "Ilość",
    unit: "J.m.",
    unitPrice: "Cena netto",
    vatRate: "VAT",
    netValue: "Wartość netto",
    vatAmount: "Kwota VAT",
    grossValue: "Wartość brutto",
    totalNet: "Razem netto",
    totalVat: "Razem VAT",
    totalDue: "Do zapłaty",
    inWords: "Słownie",
    paymentMethod: "Sposób płatności",
    bankTransfer: "Przelew",
    dueDate: "Termin płatności",
    bankAccount: "Nr konta",
    vatExemptBasis: "Zwolnienie z VAT na podstawie",
    eSignatureNote: "Faktura wystawiona elektronicznie i nie wymaga podpisu ani pieczęci.",
    loading: "Wczytywanie…",
    notFound: "Nie znaleziono faktury.",
    close: "Zamknij",
    print: "Drukuj / Zapisz PDF",
    draft: "szkic",
    phone: "Tel.",
    vatSummary: "Zestawienie VAT wg stawek",
    vatBase: "Podstawa VAT",
    reverseCharge: "Odwrotne obciążenie — podatek rozlicza nabywca.",
    footerCompany: "Firma",
    footerContact: "Kontakt",
    footerBank: "Dane do przelewu",
    bank: "Bank",
    scanToPay: "Zeskanuj, aby zapłacić",
  },
  en: {
    doc: "Invoice",
    no: "No.",
    issueDate: "Issue date",
    saleDate: "Sale date",
    seller: "Seller",
    buyer: "Bill to",
    taxId: "Tax ID (NIP)",
    lp: "No.",
    item: "Description",
    qty: "Qty",
    unit: "Unit",
    unitPrice: "Unit price (net)",
    vatRate: "VAT",
    netValue: "Net amount",
    vatAmount: "VAT amount",
    grossValue: "Gross amount",
    totalNet: "Total net",
    totalVat: "Total VAT",
    totalDue: "Total due",
    inWords: "Amount in words",
    paymentMethod: "Payment method",
    bankTransfer: "Bank transfer",
    dueDate: "Due date",
    bankAccount: "Bank account (IBAN)",
    vatExemptBasis: "VAT exempt pursuant to",
    eSignatureNote: "This invoice was issued electronically and does not require a signature or stamp.",
    loading: "Loading…",
    notFound: "Invoice not found.",
    close: "Close",
    print: "Print / Save PDF",
    draft: "draft",
    phone: "Phone",
    vatSummary: "VAT summary by rate",
    vatBase: "VAT base",
    reverseCharge: "Reverse charge — VAT to be accounted for by the recipient.",
    footerCompany: "Company",
    footerContact: "Contact",
    footerBank: "Bank details",
    bank: "Bank",
    scanToPay: "Scan to pay",
  },
  de: {
    doc: "Rechnung",
    no: "Nr.",
    issueDate: "Rechnungsdatum",
    saleDate: "Leistungsdatum",
    seller: "Verkäufer",
    buyer: "Käufer",
    taxId: "Steuernummer (NIP)",
    lp: "Nr.",
    item: "Bezeichnung",
    qty: "Menge",
    unit: "Einheit",
    unitPrice: "Einzelpreis (netto)",
    vatRate: "USt.",
    netValue: "Nettobetrag",
    vatAmount: "USt.-Betrag",
    grossValue: "Bruttobetrag",
    totalNet: "Gesamt netto",
    totalVat: "Gesamt USt.",
    totalDue: "Zu zahlen",
    inWords: "Betrag in Worten",
    paymentMethod: "Zahlungsart",
    bankTransfer: "Überweisung",
    dueDate: "Zahlungsziel",
    bankAccount: "Kontonummer (IBAN)",
    vatExemptBasis: "Von der Umsatzsteuer befreit gemäß",
    eSignatureNote: "Diese Rechnung wurde elektronisch ausgestellt und bedarf keiner Unterschrift oder eines Stempels.",
    loading: "Wird geladen…",
    notFound: "Rechnung nicht gefunden.",
    close: "Schließen",
    print: "Drucken / Als PDF speichern",
    draft: "Entwurf",
    phone: "Tel.",
    vatSummary: "USt.-Zusammenfassung nach Satz",
    vatBase: "USt.-Basis",
    reverseCharge: "Steuerschuldnerschaft des Leistungsempfängers (Reverse-Charge-Verfahren).",
    footerCompany: "Firma",
    footerContact: "Kontakt",
    footerBank: "Bankverbindung",
    bank: "Bank",
    scanToPay: "Zum Bezahlen scannen",
  },
};

const money = docMoney;
const dateStr = docDate;

export function InvoicePrint({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setInvoice(d.invoice);
        setItems(d.items);
        setSettings(d.settings);
      })
      .catch(() => setNotFound(true));
  }, [id]);

  const lang: InvoiceLang = invoice?.jezyk ?? "pl";
  const t = DICT[lang];

  const totals = invoiceTotals(items);
  const vat = settings?.vat_payer ?? true;
  const dueAmount = vat ? totals.brutto : totals.netto;
  const currency = invoice?.waluta || "PLN";

  // Kod QR (standard EPC069-12 / "GiroCode") — tylko dla EUR, bo standard
  // SEPA jest zdefiniowany wyłącznie dla tej waluty. Skanowalny przez
  // większość europejskich bankowości mobilnych, wypełnia gotowy przelew.
  useEffect(() => {
    if (!invoice || !settings || currency !== "EUR" || !settings.konto) {
      setQrUrl(null);
      return;
    }
    const payload = buildEpcQrPayload({
      beneficiaryName: settings.nazwa,
      iban: settings.konto,
      bic: settings.swift,
      amountEur: dueAmount,
      remittanceInfo: invoice.numer ?? invoice.id,
    });
    if (!payload) {
      setQrUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(payload, { margin: 0, width: 160 })
      .then((url) => !cancelled && setQrUrl(url))
      .catch(() => !cancelled && setQrUrl(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id, invoice?.numer, settings?.konto, settings?.swift, settings?.nazwa, currency, dueAmount]);

  if (notFound) return <div className="p-10 text-center text-gray-600">{DICT.pl.notFound}</div>;
  if (!invoice || !settings) return <div className="p-10 text-center text-gray-400">{DICT.pl.loading}</div>;

  const breakdown = vatBreakdown(items);
  const hasReverseCharge = items.some((it) => it.vat_stawka === "np");

  return (
    <div className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
      {/* A4: rozmiar strony i marginesy wydruku — bez tego przeglądarka
          drukuje na domyślnym papierze użytkownika (bywa Letter) z losowymi
          marginesami. Reset tła na biel, żeby ciemny motyw panelu (jeśli
          przeglądarka drukuje tła) nie wyciekał poza dokument. */}
      <style>{`
        @page { size: A4; margin: 16mm; }
        @media print {
          html, body { background: #fff !important; }
        }
      `}</style>

      {/* Pasek akcji — ukryty na wydruku */}
      <div className="mx-auto mb-4 flex max-w-[794px] items-center justify-between px-4 print:hidden">
        <button onClick={() => window.close()} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
          ← {t.close}
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white"
          style={{ background: DOC_GRADIENT }}
        >
          {t.print}
        </button>
      </div>

      {/* Dokument — 794px na ekranie ≈ szerokość A4 (210mm) przy 96dpi, więc
          podgląd wiernie odzwierciedla wydruk; na print bez ograniczenia
          szerokości, bo @page już definiuje obszar strony. min-h-[1123px]
          (≈297mm) daje na ekranie kształt pełnej strony A4 — na wydruku
          wyłączone (print:min-h-0), żeby nie wymuszać pustej drugiej strony
          przy krótkich fakturach; stopka i tak trzyma się dołu dzięki
          mt-auto w środku. */}
      <div className="mx-auto flex min-h-[1123px] max-w-[794px] flex-col bg-white text-[13px] text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_20px_40px_-16px_rgba(0,0,0,0.12)] print:min-h-0 print:max-w-none print:shadow-none">
        {/* Cienki pasek akcentu marki na górze dokumentu */}
        <div className="h-[3px] w-full shrink-0" style={{ background: DOC_GRADIENT }} />

        <div className="flex flex-1 flex-col p-10">
          {/* Nagłówek: logo + nazwa + tytuł/meta */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <DocLogoMark />
              <span className="text-[15px] font-semibold tracking-tight text-neutral-900">{settings.nazwa || "—"}</span>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400">{t.doc}</div>
              <div className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
                {invoice.numer ?? `(${t.draft})`}
              </div>
            </div>
          </div>

          {/* Meta: daty */}
          <div className="mt-6 flex justify-end gap-8 text-neutral-500">
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-neutral-400">{t.issueDate}</div>
              <div className="font-medium text-neutral-800">{dateStr(invoice.data_wystawienia, lang)}</div>
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-neutral-400">{t.saleDate}</div>
              <div className="font-medium text-neutral-800">{dateStr(invoice.data_sprzedazy, lang)}</div>
            </div>
          </div>

          {/* Strony */}
          <div className="mt-10 grid grid-cols-2 gap-8 border-t border-neutral-100 pt-6">
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{t.seller}</div>
              <div className="whitespace-pre-line font-medium text-neutral-900">{settings.nazwa || "—"}</div>
              {settings.adres && <div className="mt-0.5 whitespace-pre-line text-neutral-500">{settings.adres}</div>}
              {settings.nip && (
                <div className="mt-0.5 text-neutral-500">
                  {t.taxId}: {settings.nip}
                </div>
              )}
              {settings.email && <div className="mt-0.5 text-neutral-500">{settings.email}</div>}
              {settings.telefon && (
                <div className="mt-0.5 text-neutral-500">
                  {t.phone}: {settings.telefon}
                </div>
              )}
            </div>
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{t.buyer}</div>
              <div className="whitespace-pre-line font-medium text-neutral-900">{invoice.klient_nazwa || "—"}</div>
              {clientAddressLines(invoice).map((line, i) => (
                <div key={i} className="mt-0.5 text-neutral-500">
                  {line}
                </div>
              ))}
              {invoice.klient_nip && (
                <div className="mt-0.5 text-neutral-500">
                  {t.taxId}: {invoice.klient_nip}
                </div>
              )}
            </div>
          </div>

          {/* Pozycje */}
          <table className="mt-10 w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-[10.5px] font-medium uppercase tracking-wide text-neutral-400">
                <th className="py-2 pr-2">{t.lp}</th>
                <th className="py-2 pr-2">{t.item}</th>
                <th className="py-2 pr-2 text-right">{t.qty}</th>
                <th className="py-2 pr-2">{t.unit}</th>
                <th className="py-2 pr-2 text-right">{t.unitPrice}</th>
                {vat && <th className="py-2 pr-2 text-center">{t.vatRate}</th>}
                <th className="py-2 pr-2 text-right">{t.netValue}</th>
                {vat && <th className="py-2 pr-2 text-right">{t.vatAmount}</th>}
                <th className="py-2 pl-2 text-right">{t.grossValue}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id} className="border-b border-neutral-100">
                  <td className="py-2.5 pr-2 text-neutral-400">{i + 1}</td>
                  <td className="py-2.5 pr-2 text-neutral-900">{it.nazwa || "—"}</td>
                  <td className="py-2.5 pr-2 text-right tabular-nums text-neutral-700">{it.ilosc}</td>
                  <td className="py-2.5 pr-2 text-neutral-500">{it.jednostka}</td>
                  <td className="py-2.5 pr-2 text-right tabular-nums text-neutral-700">{money(it.cena_netto, lang, currency)}</td>
                  {vat && (
                    <td className="py-2.5 pr-2 text-center text-neutral-500">
                      {it.vat_stawka === "zw" || it.vat_stawka === "np" ? it.vat_stawka : `${it.vat_stawka}%`}
                    </td>
                  )}
                  <td className="py-2.5 pr-2 text-right tabular-nums text-neutral-700">{money(itemNetto(it), lang, currency)}</td>
                  {vat && <td className="py-2.5 pr-2 text-right tabular-nums text-neutral-500">{money(itemVat(it), lang, currency)}</td>}
                  <td className="py-2.5 pl-2 text-right tabular-nums font-medium text-neutral-900">{money(itemBrutto(it), lang, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Sumy */}
          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-1.5">
              <div className="flex justify-between text-neutral-500">
                <span>{t.totalNet}</span>
                <span className="tabular-nums">{money(totals.netto, lang, currency)}</span>
              </div>
              {vat && (
                <div className="flex justify-between text-neutral-500">
                  <span>{t.totalVat}</span>
                  <span className="tabular-nums">{money(totals.vat, lang, currency)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-neutral-200 pt-2 text-[15px] font-semibold">
                <span className="text-neutral-900">{t.totalDue}</span>
                <span
                  className="tabular-nums"
                  style={{ background: DOC_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
                >
                  {money(dueAmount, lang, currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Zestawienie VAT wg stawek — tylko gdy pozycje mieszają stawki
              (przy jednej stawce sumy wyżej już to w pełni pokrywają). */}
          {vat && breakdown.length > 1 && (
            <div className="mt-6 flex justify-end">
              <table className="w-80 border-collapse text-[11.5px]">
                <caption className="mb-1.5 text-left text-[10.5px] font-medium uppercase tracking-wide text-neutral-400">
                  {t.vatSummary}
                </caption>
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-[10px] uppercase tracking-wide text-neutral-400">
                    <th className="py-1 pr-2">{t.vatRate}</th>
                    <th className="py-1 pr-2 text-right">{t.vatBase}</th>
                    <th className="py-1 pr-2 text-right">{t.vatAmount}</th>
                    <th className="py-1 pl-2 text-right">{t.grossValue}</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((b) => (
                    <tr key={b.stawka} className="border-b border-neutral-100 text-neutral-600">
                      <td className="py-1 pr-2">{b.stawka === "zw" || b.stawka === "np" ? b.stawka : `${b.stawka}%`}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{money(b.netto, lang, currency)}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{money(b.vat, lang, currency)}</td>
                      <td className="py-1 pl-2 text-right tabular-nums font-medium text-neutral-900">{money(b.brutto, lang, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {lang === "pl" && <div className="mt-2 text-neutral-500">{t.inWords}: {amountInWords(dueAmount, currency)}</div>}

          {/* Płatność */}
          <div className="mt-10 grid grid-cols-2 gap-8 border-t border-neutral-100 pt-6 text-neutral-500">
            <div className="space-y-0.5">
              <div>
                {t.paymentMethod}: <span className="font-medium text-neutral-800">{t.bankTransfer}</span>
              </div>
              <div>
                {t.dueDate}: <span className="font-medium text-neutral-800">{dateStr(invoice.termin_platnosci, lang)}</span>
              </div>
              {settings.konto && (
                <div>
                  {t.bankAccount}: <span className="font-medium text-neutral-800">{settings.konto}</span>
                </div>
              )}
            </div>
            <div>
              {!vat && settings.zwolnienie_podstawa && (
                <div className="text-[11px]">
                  {t.vatExemptBasis}: {settings.zwolnienie_podstawa}
                </div>
              )}
            </div>
          </div>

          {invoice.uwagi && <div className="mt-6 whitespace-pre-line text-neutral-600">{invoice.uwagi}</div>}

          {hasReverseCharge && (
            <div className="mt-6 rounded-lg bg-neutral-50 px-3 py-2 text-[11px] font-medium text-neutral-700">{t.reverseCharge}</div>
          )}

          {/* Stopka: stałe dane firmowe (jak w klasycznych fakturach) +
              QR do przelewu (tylko EUR/SEPA) — mt-auto trzyma ją przy dole
              strony niezależnie od długości faktury. */}
          <div className="mt-auto pt-10">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-6 border-t border-neutral-100 pt-4 text-[10.5px] text-neutral-500">
              <div>
                <div className="mb-1 font-semibold uppercase tracking-wide text-neutral-400">{t.footerCompany}</div>
                <div className="font-medium text-neutral-700">{settings.nazwa || "—"}</div>
                {settings.adres && <div className="whitespace-pre-line">{settings.adres}</div>}
                {settings.nip && <div>{t.taxId}: {settings.nip}</div>}
              </div>
              <div>
                <div className="mb-1 font-semibold uppercase tracking-wide text-neutral-400">{t.footerContact}</div>
                {settings.email && <div>{settings.email}</div>}
                {settings.telefon && <div>{settings.telefon}</div>}
              </div>
              <div>
                <div className="mb-1 font-semibold uppercase tracking-wide text-neutral-400">{t.footerBank}</div>
                {settings.bank_nazwa && <div>{t.bank}: {settings.bank_nazwa}</div>}
                {settings.konto && <div>{settings.konto}</div>}
                {settings.swift && <div>BIC/SWIFT: {settings.swift}</div>}
              </div>
              {qrUrl && (
                <div className="flex flex-col items-center gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrUrl} alt="" width={64} height={64} className="rounded" />
                  <span className="text-center text-[9px] leading-tight text-neutral-400">{t.scanToPay}</span>
                </div>
              )}
            </div>

            {/* Drobny druk */}
            <div className="mt-4 border-t border-neutral-100 pt-4 text-[10.5px] leading-relaxed text-neutral-400">{t.eSignatureNote}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Prawdziwe logo Leggera Labs (dwa nachodzące na siebie "L", jak w
 * app/icon.svg i components/Logo.tsx) — tu jako sam kontur w gradiencie
 * marki, bez wypełnienia, na wniosek właściciela. */
function DocLogoMark() {
  return (
    <svg viewBox="0 0 90 90" width="30" height="30" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="invLogoGradient" x1="0" y1="0" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#E0A93B" />
        </linearGradient>
      </defs>
      <text x="18" y="55" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="62" fill="none" stroke="url(#invLogoGradient)" strokeWidth="2.5">
        L
      </text>
      <text x="30" y="67" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="62" fill="none" stroke="url(#invLogoGradient)" strokeWidth="2.5">
        L
      </text>
    </svg>
  );
}
