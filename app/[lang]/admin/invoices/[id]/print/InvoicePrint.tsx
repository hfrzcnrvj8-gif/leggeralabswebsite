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
  recipientAddressLines,
  vatBreakdown,
  round2,
} from "@/lib/invoices";
import { docMoney, docDate, DOC_GRADIENT, buildEpcQrPayload } from "@/lib/documents";
import { DocLogoMark } from "../../../DocLogoMark";

/** Podgląd/wydruk faktury — samodzielny biały dokument (niezależny od motywu
 * panelu), gotowy do „Drukuj / Zapisz jako PDF" przeglądarki. Premium,
 * stonowany styl (czerń/biel/szarości + subtelny akcent gradientu marki
 * fiolet→złoto), wzorowany na fakturach Apple/Anthropic. Trójjęzyczny
 * (PL/EN/DE) — język wybiera się per faktura w edytorze (`invoice.jezyk`),
 * niezależnie od języka w jakim akurat przegląda się panel. */

// Kraje UE (nazwy PL/EN/DE, małe litery) — do rozróżnienia, czy pozycja ze
// stawką "np" to odwrotne obciążenie (usługa B2B dla kontrahenta z UE, art.
// 28b ustawy o VAT) czy sprzedaż całkowicie poza zakresem polskiego VAT
// (klient spoza UE, np. USA) — to dwie różne, prawnie odmienne adnotacje.
// Pole kraju jest wolnym tekstem (patrz InvoiceEditor.tsx), więc dopasowanie
// nie jest w 100% niezawodne przy literówkach/rzadkich zapisach, ale jest
// wyraźnie lepsze niż jedna adnotacja dla wszystkich krajów.
const EU_COUNTRIES = new Set([
  "polska", "poland", "polen",
  "austria", "österreich",
  "belgia", "belgium", "belgien",
  "bułgaria", "bulgaria", "bulgarien",
  "chorwacja", "croatia", "kroatien",
  "cypr", "cyprus", "zypern",
  "czechy", "czech republic", "tschechien",
  "dania", "denmark", "dänemark",
  "estonia", "estland",
  "finlandia", "finland", "finnland",
  "francja", "france", "frankreich",
  "grecja", "greece", "griechenland",
  "hiszpania", "spain", "spanien",
  "holandia", "niderlandy", "netherlands", "niederlande",
  "irlandia", "ireland", "irland",
  "litwa", "lithuania", "litauen",
  "luksemburg", "luxembourg",
  "łotwa", "latvia", "lettland",
  "malta",
  "niemcy", "germany", "deutschland",
  "portugalia", "portugal",
  "rumunia", "romania", "rumänien",
  "słowacja", "slovakia", "slowakei",
  "słowenia", "slovenia", "slowenien",
  "szwecja", "sweden", "schweden",
  "węgry", "hungary", "ungarn",
  "włochy", "italy", "italien",
]);
function isEuCountry(kraj: string): boolean {
  const norm = kraj.trim().toLowerCase();
  return norm !== "" && EU_COUNTRIES.has(norm);
}

type Dict = {
  doc: string;
  no: string;
  issueDate: string;
  saleDate: string;
  seller: string;
  buyer: string;
  recipient: string;
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
  cash: string;
  card: string;
  dueDate: string;
  bankAccount: string;
  vatExemptBasis: string;
  outsideVatScope: string;
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
    recipient: "Odbiorca",
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
    cash: "Gotówka",
    card: "Karta",
    dueDate: "Termin płatności",
    bankAccount: "Nr konta",
    vatExemptBasis: "Zwolnienie z VAT na podstawie",
    outsideVatScope: "Transakcja poza terytorium kraju — nie podlega opodatkowaniu VAT w Polsce.",
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
    no: "Invoice no.",
    issueDate: "Issue date",
    saleDate: "Sale date",
    seller: "Seller",
    buyer: "Bill to",
    recipient: "Ship to",
    taxId: "Tax ID (NIP)",
    lp: "#",
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
    cash: "Cash",
    card: "Card",
    dueDate: "Due date",
    bankAccount: "Bank account (IBAN)",
    vatExemptBasis: "VAT exemption basis",
    outsideVatScope: "Outside the scope of Polish VAT.",
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
    no: "Rechnungsnr.",
    issueDate: "Rechnungsdatum",
    saleDate: "Leistungsdatum",
    seller: "Verkäufer",
    buyer: "Käufer",
    recipient: "Empfänger",
    taxId: "Steuernummer (NIP)",
    lp: "#",
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
    cash: "Bar",
    card: "Karte",
    dueDate: "Zahlungsziel",
    bankAccount: "Kontonummer (IBAN)",
    vatExemptBasis: "Grundlage der USt.-Befreiung",
    outsideVatScope: "Außerhalb des Anwendungsbereichs der polnischen Umsatzsteuer.",
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

/** Nagłówek dokumentu dla typów innych niż zwykła faktura (proforma nie jest
 * dokumentem fiskalnym; zaliczkowa jest, ale inaczej nazwana). */
const DOC_TITLE_OVERRIDE: Record<InvoiceLang, Record<string, string>> = {
  pl: { proforma: "Proforma", zaliczkowa: "Faktura zaliczkowa" },
  en: { proforma: "Pro forma invoice", zaliczkowa: "Advance invoice" },
  de: { proforma: "Proforma-Rechnung", zaliczkowa: "Abschlagsrechnung" },
};

const CORRECTION_LABEL: Record<InvoiceLang, { title: string; reason: string; before: string; after: string; difference: string }> = {
  pl: { title: "Faktura korygująca do faktury nr", reason: "Przyczyna korekty", before: "Przed korektą", after: "Po korekcie", difference: "Różnica" },
  en: { title: "Correction invoice to invoice no.", reason: "Reason for correction", before: "Before correction", after: "After correction", difference: "Difference" },
  de: { title: "Rechnungskorrektur zur Rechnung Nr.", reason: "Korrekturgrund", before: "Vor der Korrektur", after: "Nach der Korrektur", difference: "Differenz" },
};

const ADVANCE_LABEL: Record<InvoiceLang, string> = {
  pl: "Otrzymana zaliczka (faktura nr {numer})",
  en: "Advance received (invoice no. {numer})",
  de: "Erhaltene Anzahlung (Rechnung Nr. {numer})",
};

const NBP_LABEL: Record<InvoiceLang, string> = {
  pl: "Kwota VAT w PLN wg kursu NBP",
  en: "VAT amount in PLN per NBP exchange rate",
  de: "USt.-Betrag in PLN nach NBP-Wechselkurs",
};

export function InvoicePrint({ id, token }: { id?: string; token?: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [original, setOriginal] = useState<{ invoice: Invoice; items: InvoiceItem[] } | null>(null);
  const [zaliczka, setZaliczka] = useState<{ numer: string | null; brutto: number } | null>(null);

  useEffect(() => {
    const url = token ? `/api/invoices/public/${token}` : `/api/invoices/${id}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setInvoice(d.invoice);
        setItems(d.items);
        setSettings(d.settings);
      })
      .catch(() => setNotFound(true));
  }, [id, token]);

  // Korekta: podgląd admina dociąga oryginał do porównania przed/po. Klient
  // (widok publiczny po tokenie) widzi tylko finalny stan — bez dostępu do
  // wewnętrznego API admina.
  useEffect(() => {
    if (token || !invoice?.koryguje_id) {
      setOriginal(null);
      return;
    }
    fetch(`/api/invoices/${invoice.koryguje_id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setOriginal({ invoice: d.invoice, items: d.items }))
      .catch(() => setOriginal(null));
  }, [invoice?.koryguje_id, token]);

  // Faktura końcowa rozliczająca zaliczkę — dociągnij kwotę zaliczki do
  // odjęcia od sumy.
  useEffect(() => {
    if (token || !invoice?.rozlicza_zaliczke_id) {
      setZaliczka(null);
      return;
    }
    fetch(`/api/invoices/${invoice.rozlicza_zaliczke_id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const t = invoiceTotals(d.items as { ilosc: number; cena_netto: number; vat_stawka: string }[]);
        setZaliczka({ numer: d.invoice.numer, brutto: t.brutto });
      })
      .catch(() => setZaliczka(null));
  }, [invoice?.rozlicza_zaliczke_id, token]);

  const lang: InvoiceLang = invoice?.jezyk ?? "pl";
  const t = DICT[lang];

  const totals = invoiceTotals(items);
  const vat = settings?.vat_payer ?? true;
  const dueAmount = vat ? totals.brutto : totals.netto;
  // Faktura końcowa rozliczająca zaliczkę — odejmij już opłaconą zaliczkę od
  // sumy do zapłaty.
  const finalDue = zaliczka ? Math.round((dueAmount - zaliczka.brutto + Number.EPSILON) * 100) / 100 : dueAmount;
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
      amountEur: finalDue,
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
  }, [invoice?.id, invoice?.numer, settings?.konto, settings?.swift, settings?.nazwa, currency, finalDue]);

  if (notFound) return <div className="p-10 text-center text-gray-600">{DICT.pl.notFound}</div>;
  if (!invoice || !settings) return <div className="p-10 text-center text-gray-400">{DICT.pl.loading}</div>;

  const breakdown = vatBreakdown(items);
  const hasNpItems = items.some((it) => it.vat_stawka === "np");
  const buyerCountry = invoice.odbiorca_kraj || invoice.klient_kraj || "";
  const hasReverseCharge = hasNpItems && isEuCountry(buyerCountry);
  const hasOutsideVatScope = hasNpItems && !isEuCountry(buyerCountry);
  const hasExemptItems = items.some((it) => it.vat_stawka === "zw");
  const paymentMethodLabel =
    invoice.sposob_platnosci === "gotowka" ? t.cash : invoice.sposob_platnosci === "karta" ? t.card : t.bankTransfer;
  const docTitle = DOC_TITLE_OVERRIDE[lang][invoice.typ_dokumentu] ?? t.doc;
  const originalTotals = original ? invoiceTotals(original.items) : null;

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
            <div className="flex items-center gap-3">
              <DocLogoMark gradientId="invLogoGradient" />
              {settings.nazwa && <span className="text-[15px] font-semibold tracking-tight text-neutral-900">{settings.nazwa}</span>}
            </div>
            <div className="text-right">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400">{docTitle}</div>
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
          <div className={`mt-10 grid gap-8 border-t border-neutral-100 pt-6 ${invoice.odbiorca_nazwa ? "grid-cols-3" : "grid-cols-2"}`}>
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
            {invoice.odbiorca_nazwa && (
              <div>
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{t.recipient}</div>
                <div className="whitespace-pre-line font-medium text-neutral-900">{invoice.odbiorca_nazwa}</div>
                {recipientAddressLines(invoice).map((line, i) => (
                  <div key={i} className="mt-0.5 text-neutral-500">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Faktura korygująca — odwołanie do oryginału + przyczyna */}
          {invoice.koryguje_id && (
            <div className="mt-6 rounded-lg bg-neutral-50 px-3 py-2.5 text-[11.5px] text-neutral-700">
              <div>
                {CORRECTION_LABEL[lang].title} <span className="font-medium">{original?.invoice.numer ?? "…"}</span>
                {original?.invoice.data_wystawienia ? ` (${dateStr(original.invoice.data_wystawienia, lang)})` : ""}
              </div>
              {invoice.przyczyna_korekty && (
                <div className="mt-1">
                  {CORRECTION_LABEL[lang].reason}: {invoice.przyczyna_korekty}
                </div>
              )}
            </div>
          )}

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

          {/* Korekta: podsumowanie przed/po/różnica (tylko widok admina, gdy
              udało się dociągnąć oryginał) */}
          {invoice.koryguje_id && originalTotals && (
            <div className="mt-4 flex justify-end">
              <table className="w-80 border-collapse text-[11.5px] text-neutral-600">
                <tbody>
                  <tr className="border-b border-neutral-100">
                    <td className="py-1 pr-2">{CORRECTION_LABEL[lang].before}</td>
                    <td className="py-1 text-right tabular-nums">{money(originalTotals.brutto, lang, currency)}</td>
                  </tr>
                  <tr className="border-b border-neutral-100">
                    <td className="py-1 pr-2">{CORRECTION_LABEL[lang].after}</td>
                    <td className="py-1 text-right tabular-nums">{money(totals.brutto, lang, currency)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-2 font-medium text-neutral-900">{CORRECTION_LABEL[lang].difference}</td>
                    <td className="py-1 text-right tabular-nums font-medium text-neutral-900">
                      {money(round2(totals.brutto - originalTotals.brutto), lang, currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

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
              {vat && invoice.kurs_nbp && (
                <div className="flex justify-between text-[11px] text-neutral-400">
                  <span>
                    {NBP_LABEL[lang]} ({invoice.kurs_nbp_tabela} {invoice.kurs_nbp_data ? dateStr(invoice.kurs_nbp_data, lang) : ""}, 1 {currency} = {invoice.kurs_nbp} PLN)
                  </span>
                  <span className="tabular-nums">{docMoney(round2(totals.vat * invoice.kurs_nbp), lang, "PLN")}</span>
                </div>
              )}
              {zaliczka && (
                <div className="flex justify-between text-neutral-500">
                  <span>{ADVANCE_LABEL[lang].replace("{numer}", zaliczka.numer ?? "—")}</span>
                  <span className="tabular-nums">−{money(zaliczka.brutto, lang, currency)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-neutral-200 pt-2 text-[15px] font-semibold">
                <span className="text-neutral-900">{t.totalDue}</span>
                <span
                  className="tabular-nums"
                  style={{ background: DOC_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
                >
                  {money(finalDue, lang, currency)}
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

          {lang === "pl" && <div className="mt-2 text-neutral-500">{t.inWords}: {amountInWords(finalDue, currency)}</div>}

          {/* Płatność */}
          <div className="mt-10 grid grid-cols-2 gap-8 border-t border-neutral-100 pt-6 text-neutral-500">
            <div className="space-y-0.5">
              <div>
                {t.paymentMethod}: <span className="font-medium text-neutral-800">{paymentMethodLabel}</span>
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
              {(!vat || hasExemptItems) && settings.zwolnienie_podstawa && (
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
          {hasOutsideVatScope && (
            <div className="mt-6 rounded-lg bg-neutral-50 px-3 py-2 text-[11px] font-medium text-neutral-700">{t.outsideVatScope}</div>
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

