"use client";

import { useEffect, useState } from "react";
import {
  type Invoice,
  type CompanySettings,
  type InvoiceItem,
  invoiceTotals,
  clientAddressLines,
  companyAddressLines,
  daysOverdue,
  lateInterestAmount,
  dunningReference,
  formatMoney,
  DUNNING_LEGAL_NOTE,
} from "@/lib/invoices";
import { docDate, DOC_GRADIENT } from "@/lib/documents";
import { DocLogoMark } from "../../../../DocLogoMark";

type DunningInvoice = Invoice & { brutto: number };

/** Podgląd/wydruk formalnego wezwania do zapłaty (Moduł 13, poziom 3
 * eskalacji windykacji) — ten sam premium styl co ContractPrint.tsx, bez
 * sekcji e-podpisu (wezwanie to jednostronne oświadczenie, nie dokument do
 * kontrasygnaty). Dwa tryby wejścia: `id` (panel admina, wymaga
 * `wezwanie_wystawiono_at`) i `token` (publiczny podgląd bez logowania, link
 * wysyłany mailem — patrz app/[lang]/wezwanie/[token]). */
export function DunningPrint({ id, token }: { id?: string; token?: string }) {
  const [invoice, setInvoice] = useState<DunningInvoice | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (token) {
      fetch(`/api/invoices/wezwanie/public/${token}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          setInvoice({ ...d.invoice, brutto: Number(d.invoice.brutto) });
          setSettings(d.settings);
        })
        .catch(() => setNotFound(true));
      return;
    }
    Promise.all([
      fetch(`/api/invoices/${id}`).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/settings").then((r) => (r.ok ? r.json() : { settings: null })),
    ])
      .then(([invoiceData, settingsData]) => {
        if (!invoiceData.invoice?.wezwanie_wystawiono_at) {
          setNotFound(true);
          return;
        }
        const brutto = invoiceTotals(invoiceData.items as InvoiceItem[]).brutto;
        setInvoice({ ...invoiceData.invoice, brutto });
        setSettings(settingsData.settings);
      })
      .catch(() => setNotFound(true));
  }, [id, token]);

  if (notFound) return <div className="p-10 text-center text-gray-600">Nie znaleziono wezwania.</div>;
  if (!invoice) return <div className="p-10 text-center text-gray-400">Wczytywanie…</div>;

  const dni = daysOverdue(invoice) ?? 0;
  const odsetki = lateInterestAmount(invoice.brutto, settings?.stawka_odsetek_ustawowych ?? null, dni);
  const reference = dunningReference(invoice.id, invoice.created_at);

  return (
    <div className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
      <style>{`
        @page { size: A4; margin: 16mm; }
        @media print {
          html, body { background: #fff !important; }
        }
      `}</style>

      <div className="mx-auto mb-4 flex max-w-[794px] items-center justify-between px-4 print:hidden">
        <button onClick={() => window.close()} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
          ← Zamknij
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white"
          style={{ background: DOC_GRADIENT }}
        >
          Drukuj / Zapisz PDF
        </button>
      </div>

      <div className="mx-auto flex min-h-[1123px] max-w-[794px] flex-col bg-white text-[13px] text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_20px_40px_-16px_rgba(0,0,0,0.12)] print:min-h-0 print:max-w-none print:shadow-none">
        <div className="h-[3px] w-full shrink-0" style={{ background: DOC_GRADIENT }} />

        <div className="flex flex-1 flex-col p-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <DocLogoMark gradientId="dunningLogoGradient" />
              {settings?.nazwa && <span className="text-[15px] font-semibold tracking-tight text-neutral-900">{settings.nazwa}</span>}
            </div>
            <div className="text-right">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400">Wezwanie do zapłaty</div>
              <div className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">{reference}</div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-8 text-neutral-500">
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-neutral-400">Data wystawienia</div>
              <div className="font-medium text-neutral-800">{docDate(invoice.wezwanie_wystawiono_at, "pl")}</div>
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-neutral-400">Dotyczy faktury</div>
              <div className="font-medium text-neutral-800">{invoice.numer}</div>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-8 border-t border-neutral-100 pt-6">
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">Wierzyciel</div>
              <div className="whitespace-pre-line font-medium text-neutral-900">{settings?.nazwa || "—"}</div>
              {settings && companyAddressLines(settings).map((line, i) => (
                <div key={i} className="mt-0.5 text-neutral-500">
                  {line}
                </div>
              ))}
              {settings?.nip && <div className="mt-0.5 text-neutral-500">NIP: {settings.nip}</div>}
            </div>
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">Dłużnik</div>
              <div className="whitespace-pre-line font-medium text-neutral-900">{invoice.klient_nazwa || "—"}</div>
              {clientAddressLines(invoice).map((line, i) => (
                <div key={i} className="mt-0.5 text-neutral-500">
                  {line}
                </div>
              ))}
              {invoice.klient_nip && <div className="mt-0.5 text-neutral-500">NIP: {invoice.klient_nip}</div>}
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-red-100 bg-red-50/60 p-4">
            <p className="leading-relaxed text-neutral-700">
              Pomimo wcześniejszych przypomnień, do dnia dzisiejszego nie odnotowaliśmy zapłaty za fakturę nr{" "}
              <span className="font-semibold">{invoice.numer}</span> z terminem płatności{" "}
              <span className="font-semibold">{docDate(invoice.termin_platnosci, "pl")}</span> —{" "}
              <span className="font-semibold text-red-600">{dni} {dni === 1 ? "dzień" : "dni"} po terminie</span>. Niniejszym wzywamy do
              zapłaty należności w terminie 7 dni od dnia otrzymania niniejszego wezwania.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-neutral-100 pt-4 text-[14px] font-semibold">
            <span className="text-neutral-900">Kwota należności głównej</span>
            <span
              className="tabular-nums"
              style={{ background: DOC_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
            >
              {formatMoney(invoice.brutto, invoice.waluta || "PLN")}
            </span>
          </div>
          {odsetki > 0 && (
            <div className="mt-2 flex items-center justify-between text-[13px] text-neutral-600">
              <span>Odsetki ustawowe za opóźnienie (naliczone na dziś, {dni} dni)</span>
              <span className="tabular-nums font-medium">{formatMoney(odsetki, invoice.waluta || "PLN")}</span>
            </div>
          )}
          {odsetki > 0 && (
            <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 text-[14px] font-semibold text-neutral-900">
              <span>Razem do zapłaty</span>
              <span className="tabular-nums">{formatMoney(invoice.brutto + odsetki, invoice.waluta || "PLN")}</span>
            </div>
          )}

          {settings?.konto && (
            <div className="mt-6 text-neutral-500">
              Płatność na rachunek: <span className="font-medium text-neutral-800">{settings.konto}</span>
              {settings.bank_nazwa ? ` (${settings.bank_nazwa})` : ""}
            </div>
          )}

          <div className="mt-auto pt-10">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10.5px] leading-relaxed text-amber-700">
              ⚠ {DUNNING_LEGAL_NOTE}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
