"use client";

import { useEffect, useState } from "react";
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
} from "@/lib/invoices";

/** Podgląd/wydruk faktury — samodzielny biały dokument (niezależny od motywu
 * panelu), gotowy do „Drukuj / Zapisz jako PDF" przeglądarki. Premium,
 * stonowany styl (czerń/biel/szarości + jeden delikatny akcent koloru marki),
 * wzorowany na fakturach Apple/Anthropic. Trójjęzyczny (PL/EN/DE) — język
 * wybiera się per faktura w edytorze (`invoice.jezyk`), niezależnie od
 * języka w jakim akurat przegląda się panel. */

const ACCENT = "#7C3AED"; // brand.purple — jedyny akcent koloru na dokumencie

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
  },
};

const LOCALE: Record<InvoiceLang, string> = { pl: "pl-PL", en: "en-GB", de: "de-DE" };

function money(n: number, lang: InvoiceLang, currency = "PLN"): string {
  return new Intl.NumberFormat(LOCALE[lang], { style: "currency", currency }).format(n);
}

function dateStr(s: string | null, lang: InvoiceLang): string {
  if (!s) return "—";
  const d = new Date(`${s.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(LOCALE[lang], { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function InvoicePrint({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [notFound, setNotFound] = useState(false);

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

  if (notFound) return <div className="p-10 text-center text-gray-600">{DICT.pl.notFound}</div>;
  if (!invoice || !settings) return <div className="p-10 text-center text-gray-400">{DICT.pl.loading}</div>;

  const totals = invoiceTotals(items);
  const vat = settings.vat_payer;
  const dueAmount = vat ? totals.brutto : totals.netto;
  const currency = invoice.waluta || "PLN";

  return (
    <div className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
      {/* Pasek akcji — ukryty na wydruku */}
      <div className="mx-auto mb-4 flex max-w-[820px] items-center justify-between px-4 print:hidden">
        <button onClick={() => window.close()} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
          ← {t.close}
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white"
          style={{ background: ACCENT }}
        >
          {t.print}
        </button>
      </div>

      {/* Dokument */}
      <div className="mx-auto max-w-[820px] bg-white text-[13px] text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_20px_40px_-16px_rgba(0,0,0,0.12)] print:max-w-none print:shadow-none">
        {/* Cienki pasek akcentu marki na górze dokumentu */}
        <div className="h-[3px] w-full" style={{ background: ACCENT }} />

        <div className="p-10">
          {/* Nagłówek: wordmark + tytuł/meta */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: ACCENT }} />
                <span className="text-[15px] font-semibold tracking-tight text-neutral-900">{settings.nazwa || "—"}</span>
              </div>
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
                <span className="tabular-nums" style={{ color: ACCENT }}>
                  {money(dueAmount, lang, currency)}
                </span>
              </div>
            </div>
          </div>

          {lang === "pl" && <div className="mt-2 text-neutral-500">{t.inWords}: {amountInWords(dueAmount)}</div>}

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

          {/* Drobny druk */}
          <div className="mt-10 border-t border-neutral-100 pt-4 text-[10.5px] leading-relaxed text-neutral-400">{t.eSignatureNote}</div>
        </div>
      </div>
    </div>
  );
}
