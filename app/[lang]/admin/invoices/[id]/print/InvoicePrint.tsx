"use client";

import { useEffect, useState } from "react";
import {
  type Invoice,
  type InvoiceItem,
  type CompanySettings,
  invoiceTotals,
  itemNetto,
  itemVat,
  itemBrutto,
  formatMoney,
  amountInWords,
} from "@/lib/invoices";
import { formatPlDate } from "@/lib/projects";

/** Podgląd/wydruk faktury — samodzielny biały dokument (niezależny od motywu
 * panelu), gotowy do „Drukuj / Zapisz jako PDF" przeglądarki. Layout zgodny z
 * polską fakturą; kolumny VAT chowają się, gdy sprzedawca nie jest płatnikiem VAT. */
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

  if (notFound) return <div className="p-10 text-center text-gray-600">Nie znaleziono faktury.</div>;
  if (!invoice || !settings) return <div className="p-10 text-center text-gray-400">Wczytywanie…</div>;

  const totals = invoiceTotals(items);
  const vat = settings.vat_payer;
  const dueAmount = vat ? totals.brutto : totals.netto;

  return (
    <div className="min-h-screen bg-neutral-200 py-8 print:bg-white print:py-0">
      {/* Pasek akcji — ukryty na wydruku */}
      <div className="mx-auto mb-4 flex max-w-[820px] items-center justify-between px-4 print:hidden">
        <button onClick={() => window.close()} className="rounded-lg border border-neutral-400 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
          ← Zamknij
        </button>
        <button onClick={() => window.print()} className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-neutral-700">
          Drukuj / Zapisz PDF
        </button>
      </div>

      {/* Dokument */}
      <div className="mx-auto max-w-[820px] bg-white p-10 text-[13px] text-neutral-900 shadow-lg print:max-w-none print:p-0 print:shadow-none">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{vat ? "Faktura" : "Faktura"}</h1>
            <div className="mt-1 text-neutral-600">Nr {invoice.numer ?? "(szkic)"}</div>
          </div>
          <div className="text-right text-neutral-700">
            <div>Data wystawienia: <b>{invoice.data_wystawienia ? formatPlDate(invoice.data_wystawienia) : "—"}</b></div>
            <div>Data sprzedaży: <b>{invoice.data_sprzedazy ? formatPlDate(invoice.data_sprzedazy) : "—"}</b></div>
          </div>
        </div>

        {/* Strony */}
        <div className="mt-8 grid grid-cols-2 gap-6">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Sprzedawca</div>
            <div className="whitespace-pre-line font-medium">{settings.nazwa || "—"}</div>
            {settings.adres && <div className="whitespace-pre-line text-neutral-700">{settings.adres}</div>}
            {settings.nip && <div className="text-neutral-700">NIP: {settings.nip}</div>}
            {settings.email && <div className="text-neutral-700">{settings.email}</div>}
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Nabywca</div>
            <div className="whitespace-pre-line font-medium">{invoice.klient_nazwa || "—"}</div>
            {invoice.klient_adres && <div className="whitespace-pre-line text-neutral-700">{invoice.klient_adres}</div>}
            {invoice.klient_nip && <div className="text-neutral-700">NIP: {invoice.klient_nip}</div>}
          </div>
        </div>

        {/* Pozycje */}
        <table className="mt-8 w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-y border-neutral-300 bg-neutral-50 text-left text-neutral-600">
              <th className="p-2">Lp</th>
              <th className="p-2">Nazwa</th>
              <th className="p-2 text-right">Ilość</th>
              <th className="p-2">j.m.</th>
              <th className="p-2 text-right">Cena netto</th>
              {vat && <th className="p-2 text-center">VAT</th>}
              <th className="p-2 text-right">Wartość netto</th>
              {vat && <th className="p-2 text-right">Kwota VAT</th>}
              <th className="p-2 text-right">Wartość brutto</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} className="border-b border-neutral-200">
                <td className="p-2">{i + 1}</td>
                <td className="p-2">{it.nazwa || "—"}</td>
                <td className="p-2 text-right tabular-nums">{it.ilosc}</td>
                <td className="p-2">{it.jednostka}</td>
                <td className="p-2 text-right tabular-nums">{formatMoney(it.cena_netto)}</td>
                {vat && <td className="p-2 text-center">{it.vat_stawka === "zw" || it.vat_stawka === "np" ? it.vat_stawka : `${it.vat_stawka}%`}</td>}
                <td className="p-2 text-right tabular-nums">{formatMoney(itemNetto(it))}</td>
                {vat && <td className="p-2 text-right tabular-nums">{formatMoney(itemVat(it))}</td>}
                <td className="p-2 text-right tabular-nums">{formatMoney(itemBrutto(it))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Sumy */}
        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-neutral-700">
              <span>Razem netto</span>
              <span className="tabular-nums">{formatMoney(totals.netto)}</span>
            </div>
            {vat && (
              <div className="flex justify-between text-neutral-700">
                <span>Razem VAT</span>
                <span className="tabular-nums">{formatMoney(totals.vat)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-neutral-300 pt-1 text-base font-bold">
              <span>Do zapłaty</span>
              <span className="tabular-nums">{formatMoney(dueAmount)}</span>
            </div>
          </div>
        </div>

        <div className="mt-2 text-neutral-700">Słownie: {amountInWords(dueAmount)}</div>

        {/* Płatność */}
        <div className="mt-8 grid grid-cols-2 gap-6 text-neutral-700">
          <div>
            <div>Sposób płatności: <b>Przelew</b></div>
            <div>Termin płatności: <b>{invoice.termin_platnosci ? formatPlDate(invoice.termin_platnosci) : "—"}</b></div>
            {settings.konto && <div>Nr konta: <b>{settings.konto}</b></div>}
          </div>
          <div>
            {!vat && settings.zwolnienie_podstawa && (
              <div className="text-[11px]">Zwolnienie z VAT na podstawie: {settings.zwolnienie_podstawa}</div>
            )}
          </div>
        </div>

        {invoice.uwagi && <div className="mt-6 whitespace-pre-line text-neutral-700">{invoice.uwagi}</div>}
      </div>
    </div>
  );
}
