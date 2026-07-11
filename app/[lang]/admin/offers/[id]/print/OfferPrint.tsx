"use client";

import { useEffect, useState } from "react";
import { type Offer, type OfferItem, type OfferLang, offerTotal, itemKwota, clientAddressLines, offerReference } from "@/lib/offers";
import { type CompanySettings } from "@/lib/invoices";
import { docMoney, docDate, DOC_GRADIENT } from "@/lib/documents";

/** Podgląd/wydruk oferty — ten sam premium, stonowany styl co faktura
 * (czerń/biel/szarości + subtelny akcent gradientu marki fiolet→złoto),
 * trójjęzyczny (PL/EN/DE) wg `offer.jezyk`. Bez VAT — oferta to kwota
 * ogólna, VAT pojawia się dopiero na fakturze po akceptacji. */

type Dict = {
  doc: string;
  ref: string;
  issueDate: string;
  validUntil: string;
  seller: string;
  buyer: string;
  taxId: string;
  lp: string;
  item: string;
  qty: string;
  unit: string;
  unitPrice: string;
  amount: string;
  totalAmount: string;
  phone: string;
  eSignatureNote: string;
  loading: string;
  notFound: string;
  close: string;
  print: string;
  draft: string;
  footerCompany: string;
  footerContact: string;
};

const DICT: Record<OfferLang, Dict> = {
  pl: {
    doc: "Oferta",
    ref: "Nr ref.",
    issueDate: "Data przygotowania",
    validUntil: "Ważna do",
    seller: "Wystawca",
    buyer: "Dla",
    taxId: "NIP",
    lp: "Lp",
    item: "Nazwa",
    qty: "Ilość",
    unit: "J.m.",
    unitPrice: "Cena",
    amount: "Kwota",
    totalAmount: "Kwota oferty",
    phone: "Tel.",
    eSignatureNote: "Oferta nie stanowi faktury ani formalnej umowy — jest niewiążącą propozycją warunków współpracy.",
    loading: "Wczytywanie…",
    notFound: "Nie znaleziono oferty.",
    close: "Zamknij",
    print: "Drukuj / Zapisz PDF",
    draft: "szkic",
    footerCompany: "Firma",
    footerContact: "Kontakt",
  },
  en: {
    doc: "Quote",
    ref: "Ref. no.",
    issueDate: "Date prepared",
    validUntil: "Valid until",
    seller: "From",
    buyer: "For",
    taxId: "Tax ID (NIP)",
    lp: "No.",
    item: "Description",
    qty: "Qty",
    unit: "Unit",
    unitPrice: "Price",
    amount: "Amount",
    totalAmount: "Quote amount",
    phone: "Phone",
    eSignatureNote: "This quote is not an invoice or a binding agreement — it is a non-binding proposal of terms.",
    loading: "Loading…",
    notFound: "Quote not found.",
    close: "Close",
    print: "Print / Save PDF",
    draft: "draft",
    footerCompany: "Company",
    footerContact: "Contact",
  },
  de: {
    doc: "Angebot",
    ref: "Referenz-Nr.",
    issueDate: "Erstellungsdatum",
    validUntil: "Gültig bis",
    seller: "Von",
    buyer: "Für",
    taxId: "Steuernummer (NIP)",
    lp: "Nr.",
    item: "Bezeichnung",
    qty: "Menge",
    unit: "Einheit",
    unitPrice: "Preis",
    amount: "Betrag",
    totalAmount: "Angebotsbetrag",
    phone: "Tel.",
    eSignatureNote: "Dieses Angebot ist keine Rechnung und kein verbindlicher Vertrag — es ist ein unverbindlicher Vorschlag der Konditionen.",
    loading: "Wird geladen…",
    notFound: "Angebot nicht gefunden.",
    close: "Schließen",
    print: "Drucken / Als PDF speichern",
    draft: "Entwurf",
    footerCompany: "Firma",
    footerContact: "Kontakt",
  },
};

const money = docMoney;
const dateStr = docDate;

export function OfferPrint({ id }: { id: string }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [items, setItems] = useState<OfferItem[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/offers/${id}`).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/settings").then((r) => (r.ok ? r.json() : { settings: null })),
    ])
      .then(([offerData, settingsData]) => {
        setOffer(offerData.offer);
        setItems(offerData.items);
        setSettings(settingsData.settings);
      })
      .catch(() => setNotFound(true));
  }, [id]);

  const lang: OfferLang = offer?.jezyk ?? "pl";
  const t = DICT[lang];

  if (notFound) return <div className="p-10 text-center text-gray-600">{DICT.pl.notFound}</div>;
  if (!offer) return <div className="p-10 text-center text-gray-400">{DICT.pl.loading}</div>;

  const total = offerTotal(items);
  const logoLetter = (settings?.nazwa || "L").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
      {/* A4: rozmiar strony i marginesy wydruku — patrz komentarz w
          InvoicePrint.tsx (ten sam powód). */}
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

      {/* Dokument — 794px na ekranie ≈ szerokość A4 (210mm) przy 96dpi;
          min-h-[1123px] (≈297mm) daje kształt pełnej strony A4 na ekranie,
          wyłączone na print (patrz komentarz w InvoicePrint.tsx). */}
      <div className="mx-auto flex min-h-[1123px] max-w-[794px] flex-col bg-white text-[13px] text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_20px_40px_-16px_rgba(0,0,0,0.12)] print:min-h-0 print:max-w-none print:shadow-none">
        <div className="h-[3px] w-full shrink-0" style={{ background: DOC_GRADIENT }} />

        <div className="flex flex-1 flex-col p-10">
          {/* Nagłówek: logo + nazwa + tytuł/meta */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[14px] font-bold text-white"
                style={{ background: DOC_GRADIENT }}
              >
                {logoLetter}
              </div>
              <span className="text-[15px] font-semibold tracking-tight text-neutral-900">{settings?.nazwa || "—"}</span>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400">{t.doc}</div>
              <div className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
                {offer.status === "Szkic" ? `(${t.draft})` : offerReference(offer)}
              </div>
              {offer.tytul && <div className="mt-0.5 text-neutral-500">{offer.tytul}</div>}
            </div>
          </div>

          {/* Meta: daty */}
          <div className="mt-6 flex justify-end gap-8 text-neutral-500">
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-neutral-400">{t.issueDate}</div>
              <div className="font-medium text-neutral-800">{dateStr(offer.created_at, lang)}</div>
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-neutral-400">{t.validUntil}</div>
              <div className="font-medium text-neutral-800">{dateStr(offer.wazna_do, lang)}</div>
            </div>
          </div>

          {/* Strony */}
          <div className="mt-10 grid grid-cols-2 gap-8 border-t border-neutral-100 pt-6">
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{t.seller}</div>
              <div className="whitespace-pre-line font-medium text-neutral-900">{settings?.nazwa || "—"}</div>
              {settings?.adres && <div className="mt-0.5 whitespace-pre-line text-neutral-500">{settings.adres}</div>}
              {settings?.nip && (
                <div className="mt-0.5 text-neutral-500">
                  {t.taxId}: {settings.nip}
                </div>
              )}
              {settings?.email && <div className="mt-0.5 text-neutral-500">{settings.email}</div>}
              {settings?.telefon && (
                <div className="mt-0.5 text-neutral-500">
                  {t.phone}: {settings.telefon}
                </div>
              )}
            </div>
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{t.buyer}</div>
              <div className="whitespace-pre-line font-medium text-neutral-900">{offer.klient_nazwa || "—"}</div>
              {clientAddressLines(offer).map((line, i) => (
                <div key={i} className="mt-0.5 text-neutral-500">
                  {line}
                </div>
              ))}
              {offer.klient_nip && (
                <div className="mt-0.5 text-neutral-500">
                  {t.taxId}: {offer.klient_nip}
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
                <th className="py-2 pl-2 text-right">{t.amount}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id} className="border-b border-neutral-100">
                  <td className="py-2.5 pr-2 text-neutral-400">{i + 1}</td>
                  <td className="py-2.5 pr-2 text-neutral-900">{it.nazwa || "—"}</td>
                  <td className="py-2.5 pr-2 text-right tabular-nums text-neutral-700">{it.ilosc}</td>
                  <td className="py-2.5 pr-2 text-neutral-500">{it.jednostka}</td>
                  <td className="py-2.5 pr-2 text-right tabular-nums text-neutral-700">{money(it.cena, lang)}</td>
                  <td className="py-2.5 pl-2 text-right tabular-nums font-medium text-neutral-900">{money(itemKwota(it), lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Suma */}
          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-1.5">
              <div className="flex justify-between border-t border-neutral-200 pt-2 text-[15px] font-semibold">
                <span className="text-neutral-900">{t.totalAmount}</span>
                <span
                  className="tabular-nums"
                  style={{ background: DOC_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
                >
                  {money(total, lang)}
                </span>
              </div>
            </div>
          </div>

          {offer.uwagi && <div className="mt-6 whitespace-pre-line text-neutral-600">{offer.uwagi}</div>}

          {/* Stopka: stałe dane firmowe, przyklejona do dołu strony
              (mt-auto) niezależnie od długości oferty. */}
          <div className="mt-auto pt-10">
            <div className="grid grid-cols-2 gap-6 border-t border-neutral-100 pt-4 text-[10.5px] text-neutral-500">
              <div>
                <div className="mb-1 font-semibold uppercase tracking-wide text-neutral-400">{t.footerCompany}</div>
                <div className="font-medium text-neutral-700">{settings?.nazwa || "—"}</div>
                {settings?.adres && <div className="whitespace-pre-line">{settings.adres}</div>}
                {settings?.nip && <div>{t.taxId}: {settings.nip}</div>}
              </div>
              <div>
                <div className="mb-1 font-semibold uppercase tracking-wide text-neutral-400">{t.footerContact}</div>
                {settings?.email && <div>{settings.email}</div>}
                {settings?.telefon && <div>{settings.telefon}</div>}
              </div>
            </div>

            {/* Drobny druk */}
            <div className="mt-4 border-t border-neutral-100 pt-4 text-[10.5px] leading-relaxed text-neutral-400">{t.eSignatureNote}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
