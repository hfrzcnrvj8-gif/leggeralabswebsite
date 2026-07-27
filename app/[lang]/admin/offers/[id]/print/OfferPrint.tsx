"use client";

import { useEffect, useState } from "react";
import {
  type Offer,
  type OfferItem,
  type OfferSection,
  type OfferLang,
  offerTotal,
  itemKwota,
  clientAddressLines,
  offerReference,
  isOfferExpired,
  obliczZwrot,
} from "@/lib/offers";
import { formatPlDateTime } from "@/lib/dates";
import { type CompanySettings } from "@/lib/invoices";
import { docMoney, docDate, DOC_GRADIENT } from "@/lib/documents";
import { DocLogoMark } from "../../../DocLogoMark";
import { LinkRevokedNotice } from "../../../LinkRevokedNotice";
import { DokumentResponsywny } from "../../../DocumentScale";

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
  acceptTitle: string;
  nameLabel: string;
  namePlaceholder: string;
  confirmLabel: string;
  acceptButton: string;
  accepting: string;
  acceptedByLabel: string;
  acceptedNoNameLabel: string;
  expiredLabel: string;
  privacyNote: string;
  privacyLink: string;
  /** Pozycje opcjonalne (runda 2 Modułu 57) — klient sam decyduje, czy je
   * bierze, więc dokument musi mu to powiedzieć w JEGO języku. */
  optionalTag: string;
  optionalHint: string;
  /** Runda 3 — certyfikat akceptacji na dokumencie, prośba o zmianę, zwrot. */
  certTitle: string;
  certWho: string;
  certWhen: string;
  certRef: string;
  changeTitle: string;
  changeHint: string;
  changePlaceholder: string;
  changeSend: string;
  changeSent: string;
  roiTitle: string;
  roiSaving: string;
  roiPayback: string;
  roiYear: string;
  roiNote: string;
  /** Zgłoszenie właściciela 2026-07-27: na dokumencie nie było ani słowa
   * o tym, że kwoty są NETTO. Dla klienta biznesowego to różnica 23%. */
  netNote: string;
  reverseChargeNote: string;
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
    acceptTitle: "Akceptacja oferty",
    nameLabel: "Imię i nazwisko",
    namePlaceholder: "Jan Kowalski",
    confirmLabel: "Potwierdzam, że zapoznałem/-am się z ofertą i ją akceptuję.",
    acceptButton: "Akceptuję ofertę",
    accepting: "Zapisywanie…",
    acceptedByLabel: "Zaakceptowano przez",
    acceptedNoNameLabel: "Oferta zaakceptowana.",
    expiredLabel: "Ta oferta wygasła. Skontaktuj się z nadawcą, aby ustalić dalsze kroki.",
    privacyNote: "Akceptując, zapisujemy Twoje imię i nazwisko, adres IP oraz datę i godzinę — jako dowód złożenia oświadczenia woli. Szczegóły przetwarzania danych: ",
    privacyLink: "Polityka Prywatności",
    optionalTag: "do wyboru",
    optionalHint: "Część pozycji jest do wyboru — zaznacz te, które Cię interesują, a kwota przeliczy się od razu.",
    certTitle: "Potwierdzenie akceptacji",
    certWho: "Zaakceptowano przez",
    certWhen: "Data i godzina",
    certRef: "Dokument",
    changeTitle: "Chcesz czegoś inaczej?",
    changeHint: "Napisz, co zmienić — wrócimy z poprawioną wersją. To nie jest akceptacja oferty.",
    changePlaceholder: "np. proszę o wariant bez szkolenia i termin od października.",
    changeSend: "Wyślij prośbę o zmianę",
    changeSent: "Dziękujemy — wiadomość dotarła. Odezwiemy się z poprawioną ofertą.",
    roiTitle: "Szacowany zwrot",
    roiSaving: "Oszczędność miesięczna",
    roiPayback: "Zwrot z inwestycji",
    roiYear: "W skali roku",
    roiNote: "Szacunek na podstawie czasu wskazanego przez Państwa w rozmowie — nie jest gwarancją wyniku.",
    netNote: "Wszystkie kwoty są kwotami NETTO i nie zawierają podatku VAT. Podatek zostanie doliczony na fakturze zgodnie z obowiązującymi przepisami.",
    reverseChargeNote: "Dla kontrahenta spoza Polski rozliczenie podatku może nastąpić w kraju nabywcy (odwrotne obciążenie) — stawka zostanie potwierdzona na fakturze.",
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
    acceptTitle: "Accept this quote",
    nameLabel: "Full name",
    namePlaceholder: "John Smith",
    confirmLabel: "I confirm I have reviewed this quote and accept it.",
    acceptButton: "Accept quote",
    accepting: "Saving…",
    acceptedByLabel: "Accepted by",
    acceptedNoNameLabel: "Quote accepted.",
    expiredLabel: "This quote has expired. Please contact the sender to discuss next steps.",
    privacyNote: "When you accept, we record your name, IP address and the date and time as proof of your declaration. Details on data processing: ",
    privacyLink: "Privacy Policy",
    optionalTag: "optional",
    optionalHint: "Some items are optional — tick the ones you want and the total updates instantly.",
    certTitle: "Acceptance confirmation",
    certWho: "Accepted by",
    certWhen: "Date and time",
    certRef: "Document",
    changeTitle: "Want something changed?",
    changeHint: "Tell us what to adjust and we will come back with a revised version. This is not an acceptance.",
    changePlaceholder: "e.g. please drop the training and start in October.",
    changeSend: "Send change request",
    changeSent: "Thank you — we received it and will come back with a revised quote.",
    roiTitle: "Estimated return",
    roiSaving: "Monthly saving",
    roiPayback: "Payback period",
    roiYear: "Per year",
    roiNote: "Estimate based on the time you indicated during our conversation — not a guaranteed outcome.",
    netNote: "All amounts are NET and exclude VAT. Tax will be added on the invoice in accordance with applicable regulations.",
    reverseChargeNote: "For customers outside Poland, tax may be accounted for in the customer's country (reverse charge) — the rate will be confirmed on the invoice.",
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
    acceptTitle: "Angebot annehmen",
    nameLabel: "Vor- und Nachname",
    namePlaceholder: "Max Mustermann",
    confirmLabel: "Ich bestätige, dass ich dieses Angebot geprüft habe und es annehme.",
    acceptButton: "Angebot annehmen",
    accepting: "Wird gespeichert…",
    acceptedByLabel: "Angenommen von",
    acceptedNoNameLabel: "Angebot angenommen.",
    expiredLabel: "Dieses Angebot ist abgelaufen. Bitte kontaktieren Sie den Absender für die nächsten Schritte.",
    privacyNote: "Bei der Annahme speichern wir Ihren Namen, Ihre IP-Adresse sowie Datum und Uhrzeit als Nachweis Ihrer Willenserklärung. Einzelheiten zur Datenverarbeitung: ",
    privacyLink: "Datenschutzerklärung",
    optionalTag: "optional",
    optionalHint: "Einige Positionen sind optional — wählen Sie aus, was Sie interessiert; die Summe wird sofort neu berechnet.",
    certTitle: "Annahmebestätigung",
    certWho: "Angenommen von",
    certWhen: "Datum und Uhrzeit",
    certRef: "Dokument",
    changeTitle: "Möchten Sie etwas ändern?",
    changeHint: "Schreiben Sie, was angepasst werden soll — wir melden uns mit einer überarbeiteten Fassung. Dies ist keine Annahme.",
    changePlaceholder: "z. B. bitte ohne Schulung und Start ab Oktober.",
    changeSend: "Änderungswunsch senden",
    changeSent: "Vielen Dank — wir haben Ihre Nachricht erhalten und melden uns mit einem überarbeiteten Angebot.",
    roiTitle: "Geschätzte Amortisation",
    roiSaving: "Monatliche Ersparnis",
    roiPayback: "Amortisationszeit",
    roiYear: "Pro Jahr",
    roiNote: "Schätzung auf Basis der von Ihnen genannten Zeit — keine Garantie für das Ergebnis.",
    netNote: "Alle Beträge sind NETTOBETRÄGE und enthalten keine Mehrwertsteuer. Die Steuer wird auf der Rechnung gemäß den geltenden Vorschriften ausgewiesen.",
    reverseChargeNote: "Für Kunden außerhalb Polens kann die Steuer im Land des Erwerbers abgerechnet werden (Reverse-Charge) — der Satz wird auf der Rechnung bestätigt.",
  },
};

/** Kwoty liczone w walucie DOKUMENTU (Moduł 57) — do 2026-07-26 wydruk brał
 * domyślne „PLN" z `docMoney`, więc oferta po niemiecku pokazywała klientowi
 * „6.000,00 zł". Starsze oferty nie mają kolumny wypełnionej — stąd fallback. */
const money = (n: number, lang: OfferLang, waluta?: string | null) => docMoney(n, lang, waluta || "PLN");
const dateStr = docDate;

export function OfferPrint({ id, token }: { id?: string; token?: string }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [items, setItems] = useState<OfferItem[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [notFound, setNotFound] = useState(false);
  // 410 z trasy publicznej = link unieważniony (Moduł 40) — inny ekran niż
  // "nie znaleziono", bo dokument istnieje, tylko dostęp odebrano.
  const [revoked, setRevoked] = useState(false);
  const [signName, setSignName] = useState("");
  const [signConfirm, setSignConfirm] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  /** Pozycje opcjonalne odhaczone przez KLIENTA (runda 2 Modułu 57).
   * Stan lokalny, dopóki nie kliknie akceptacji — kwota przelicza się na jego
   * oczach, ale nic nie zapisuje się bez decyzji. */
  const [wybrane, setWybrane] = useState<Set<string>>(new Set());
  const [sections, setSections] = useState<OfferSection[]>([]);
  const [zmianaTresc, setZmianaTresc] = useState("");
  const [zmianaWyslana, setZmianaWyslana] = useState(false);
  const [zmianaBusy, setZmianaBusy] = useState(false);

  useEffect(() => {
    if (token) {
      fetch(`/api/offers/public/${token}`)
        .then(async (r) => {
          if (r.status === 410) {
            setRevoked(true);
            return null;
          }
          if (!r.ok) {
            setNotFound(true);
            return null;
          }
          return r.json();
        })
        .then((d) => {
          if (!d) return;
          setOffer(d.offer);
          setItems(d.items);
          setSettings(d.settings);
          // Wybór zapisany wcześniej (np. klient wrócił do linku albo już
          // zaakceptował) wygrywa nad pustym zaznaczeniem — inaczej dokument
          // pokazywałby po akceptacji inny zestaw niż ten, który poszedł na
          // fakturę.
          setWybrane(new Set((d.items as OfferItem[]).filter((it) => it.wybrana).map((it) => it.id)));
          setSections((d.sections ?? []) as OfferSection[]);
        })
        .catch(() => setNotFound(true));
      return;
    }
    Promise.all([
      fetch(`/api/offers/${id}`).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/settings").then((r) => (r.ok ? r.json() : { settings: null })),
    ])
      .then(([offerData, settingsData]) => {
        setOffer(offerData.offer);
        setItems(offerData.items);
        setSettings(settingsData.settings);
        setWybrane(new Set((offerData.items as OfferItem[]).filter((it) => it.wybrana).map((it) => it.id)));
        setSections((offerData.sections ?? []) as OfferSection[]);
      })
      .catch(() => setNotFound(true));
  }, [id, token]);

  const lang: OfferLang = offer?.jezyk ?? "pl";
  const t = DICT[lang];

  if (revoked) return <LinkRevokedNotice dokument="Oferta" />;
  if (notFound) return <div className="p-10 text-center text-gray-600">{DICT.pl.notFound}</div>;
  if (!offer) return <div className="p-10 text-center text-gray-400">{DICT.pl.loading}</div>;

  // Wybór klienta NAKŁADANY na pozycje, a nie filtrowanie ich przed sumą:
  // `offerTotal` sam odrzuca opcjonalne bez `wybrana`, więc wcześniejsze
  // odfiltrowanie robiło to drugi raz i suma nie drgnęła po zaznaczeniu
  // (złapane pomiarem — na ekranie po prostu zostawała stara liczba).
  const pozycjeZWyborem = items.map((it) =>
    it.opcjonalna ? { ...it, wybrana: wybrane.has(it.id) } : it
  );
  const total = offerTotal(pozycjeZWyborem);
  const maOpcjonalne = items.some((it) => it.opcjonalna);
  const zwrot = obliczZwrot(offer, total);
  const zaakceptowana = offer.status === "Zaakceptowana";

  const przelacz = (id: string) => {
    setWybrane((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitChangeRequest = async () => {
    if (!token || !zmianaTresc.trim() || zmianaBusy) return;
    setZmianaBusy(true);
    const res = await fetch(`/api/offers/public/${token}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tresc: zmianaTresc.trim(), name: signName.trim() }),
    });
    setZmianaBusy(false);
    if (res.ok) {
      setZmianaWyslana(true);
      setZmianaTresc("");
    } else {
      setAcceptError("Nie udało się wysłać wiadomości.");
    }
  };

  const submitAcceptance = async () => {
    if (!token || !signName.trim() || !signConfirm || accepting) return;
    setAccepting(true);
    setAcceptError(null);
    const res = await fetch(`/api/offers/public/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: signName.trim(), wybrane: [...wybrane] }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; acceptedByName?: string };
    setAccepting(false);
    if (!res.ok) {
      setAcceptError(data.error ?? "Nie udało się zapisać akceptacji.");
      return;
    }
    setOffer((prev) =>
      prev ? { ...prev, status: "Zaakceptowana", accepted_by_name: data.acceptedByName ?? signName.trim(), accepted_at: new Date().toISOString() } : prev
    );
  };

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
      {/* PASEK EKRANOWY — „Zamknij" i „Drukuj / Zapisz PDF". `print:hidden`
          chowa go na WYDRUKU, `data-chrome="ekran"` pozwala schować go
          tam, gdzie strona nie jest przeglądarką: apka pokazuje tę samą
          stronę w WKWebView, gdzie `window.close()` i `window.print()` są
          martwe, więc pasek byłby dwoma nieklikalnymi przyciskami nad
          dokumentem. Osobny znacznik, NIE `print:hidden`, bo tej klasy
          używają też pigułka „OPCJONALNA" i podpowiedzi — apka ma ukryć
          chrome, nie treść. Bez dwukropka w nazwie: selektor idzie przez
          dwa języki (Swift → JS) i każdy escape to okazja do pomyłki,
          która już dwa razy przeszła niezauważona. */}
      <div data-chrome="ekran" className="mx-auto mb-4 flex max-w-[794px] items-center justify-between px-4 print:hidden">
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
      <DokumentResponsywny>
      <div className="mx-auto flex min-h-[1123px] max-w-[794px] flex-col bg-white text-[13px] text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_20px_40px_-16px_rgba(0,0,0,0.12)] print:min-h-0 print:max-w-none print:shadow-none">
        <div className="h-[3px] w-full shrink-0" style={{ background: DOC_GRADIENT }} />

        <div className="flex flex-1 flex-col p-10">
          {/* Nagłówek: logo + nazwa + tytuł/meta */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <DocLogoMark gradientId="offLogoGradient" />
              {settings?.nazwa && <span className="text-[15px] font-semibold tracking-tight text-neutral-900">{settings.nazwa}</span>}
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

          {/* Treść oferty PRZED cennikiem — klient ma najpierw przeczytać,
              co dostaje. Bez sekcji dokument wygląda dokładnie jak dawniej. */}
          {sections.length > 0 && (
            <div className="mt-10 space-y-5">
              {sections.map((sekcja) => (
                <div key={sekcja.id} className="break-inside-avoid">
                  {sekcja.tytul && (
                    <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                      {sekcja.tytul}
                    </h2>
                  )}
                  <div className="whitespace-pre-line text-[12.5px] leading-relaxed text-neutral-700">{sekcja.tresc}</div>
                </div>
              ))}
            </div>
          )}

          {maOpcjonalne && !zaakceptowana && (
            <p className="mt-8 rounded-lg bg-violet-50 px-3 py-2 text-[11.5px] text-violet-900 print:hidden">
              {t.optionalHint}
            </p>
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
                <th className="py-2 pl-2 text-right">{t.amount}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                // Pozycja opcjonalna: klient decyduje sam. Po akceptacji nikt
                // już nic nie przełącza — dokument staje się zapisem tego,
                // co zostało kupione, więc pola wyboru znikają.
                const wybor = it.opcjonalna && !zaakceptowana;
                const liczySie = !it.opcjonalna || wybrane.has(it.id);
                return (
                  <tr key={it.id} className={`border-b border-neutral-100 ${it.opcjonalna && !liczySie ? "text-neutral-400" : ""}`}>
                    <td className="py-2.5 pr-2 text-neutral-400">{it.opcjonalna ? "" : i + 1}</td>
                    <td className="py-2.5 pr-2 text-neutral-900">
                      {wybor ? (
                        <label className="flex cursor-pointer items-center gap-2 print:cursor-auto">
                          <input
                            type="checkbox"
                            checked={wybrane.has(it.id)}
                            onChange={() => przelacz(it.id)}
                            className="h-3.5 w-3.5 shrink-0 accent-violet-600"
                          />
                          <span className={liczySie ? "text-neutral-900" : "text-neutral-400"}>{it.nazwa || "—"}</span>
                          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-neutral-500 print:hidden">
                            {t.optionalTag}
                          </span>
                        </label>
                      ) : (
                        <span className={liczySie ? "" : "line-through"}>{it.nazwa || "—"}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-2 text-right tabular-nums text-neutral-700">{it.ilosc}</td>
                    <td className="py-2.5 pr-2 text-neutral-500">{it.jednostka}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums text-neutral-700">{money(it.cena, lang, offer.waluta)}</td>
                    <td className={`py-2.5 pl-2 text-right tabular-nums font-medium ${liczySie ? "text-neutral-900" : "text-neutral-400 line-through"}`}>
                      {money(itemKwota(it), lang, offer.waluta)}
                    </td>
                  </tr>
                );
              })}
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
                  {money(total, lang, offer.waluta)}
                </span>
              </div>
            </div>
          </div>

          {/* Kwoty NETTO — na dokumencie musi to być napisane wprost, nie
              domyślne (zgłoszenie właściciela 2026-07-27). Dla klienta
              zagranicznego dochodzi zdanie o odwrotnym obciążeniu: faktyczną
              stawkę i tak potwierdza faktura.
              Pełna szerokość, nie kolumna sumy — w słupku 256 px to zdanie
              łamało się na sześć linijek. */}
          <p className="mt-2 text-[10.5px] leading-relaxed text-neutral-500">
            {t.netNote}
            {(offer.klient_kraj ?? "").trim() && !["pl", "pol", "polska", "poland"].includes((offer.klient_kraj ?? "").trim().toLowerCase())
              ? ` ${t.reverseChargeNote}`
              : ""}
          </p>

          {/* Szacowany zwrot (runda 3). Liczby podaje właściciel w panelu,
              dokument tylko mnoży — i mówi wprost, że to szacunek, nie
              gwarancja. Blok znika, gdy którejkolwiek liczby brakuje. */}
          {zwrot && (
            <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-neutral-400">{t.roiTitle}</div>
              <div className="grid grid-cols-3 gap-4 text-[12px]">
                <div>
                  <div className="text-neutral-500">{t.roiSaving}</div>
                  <div className="mt-0.5 text-[15px] font-semibold text-neutral-900">{money(zwrot.oszczednoscMiesiac, lang, offer.waluta)}</div>
                </div>
                <div>
                  <div className="text-neutral-500">{t.roiPayback}</div>
                  <div className="mt-0.5 text-[15px] font-semibold text-neutral-900">
                    {zwrot.miesiecyDoZwrotu} {lang === "pl" ? "mies." : lang === "de" ? "Mon." : "mo."}
                  </div>
                </div>
                <div>
                  <div className="text-neutral-500">{t.roiYear}</div>
                  <div className="mt-0.5 text-[15px] font-semibold text-neutral-900">{money(zwrot.oszczednoscRok, lang, offer.waluta)}</div>
                </div>
              </div>
              <div className="mt-2 text-[10.5px] leading-relaxed text-neutral-400">{t.roiNote}</div>
            </div>
          )}

          {/* Certyfikat akceptacji — dowód, który do rundy 3 leżał w bazie
              i nigdzie nie było go widać. Drukuje się razem z dokumentem
              (bez `print:hidden`), bo o to w nim chodzi. */}
          {zaakceptowana && offer.accepted_at && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-[12px] text-neutral-700">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-emerald-700">{t.certTitle}</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-neutral-500">{t.certWho}</div>
                  <div className="mt-0.5 font-medium text-neutral-900">{offer.accepted_by_name || "—"}</div>
                </div>
                <div>
                  <div className="text-neutral-500">{t.certWhen}</div>
                  <div className="mt-0.5 font-medium text-neutral-900">{formatPlDateTime(offer.accepted_at)}</div>
                </div>
                <div>
                  <div className="text-neutral-500">{t.certRef}</div>
                  <div className="mt-0.5 font-medium text-neutral-900">{offerReference(offer)}</div>
                </div>
              </div>
              {/* IP tylko w podglądzie z panelu — publiczna biała lista pól
                  świadomie go nie wypuszcza (lib/publicFields.ts). */}
              {offer.accepted_ip && (
                <div className="mt-2 text-[10.5px] text-neutral-400">IP: {offer.accepted_ip}</div>
              )}
            </div>
          )}

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
      </DokumentResponsywny>

      {/* E-podpis akceptacji (Faza I) — tylko na publicznej stronie
          (token ustawiony), nie w podglądzie adminowym. */}
      {token && (
        <div className="mx-auto mt-4 max-w-[794px] px-4 print:hidden">
          {offer.status === "Zaakceptowana" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              ✓ {offer.accepted_by_name ? `${t.acceptedByLabel} ${offer.accepted_by_name}, ${docDate(offer.accepted_at, lang)}` : t.acceptedNoNameLabel}
            </div>
          ) : isOfferExpired(offer) ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">{t.expiredLabel}</div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-neutral-900">{t.acceptTitle}</h2>
              <div className="space-y-2.5">
                <input
                  value={signName}
                  onChange={(e) => setSignName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  aria-label={t.nameLabel}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
                />
                <label className="flex items-start gap-2 text-[13px] text-neutral-600">
                  <input type="checkbox" checked={signConfirm} onChange={(e) => setSignConfirm(e.target.checked)} className="mt-0.5" />
                  {t.confirmLabel}
                </label>
                <p className="text-[11px] leading-relaxed text-neutral-400">
                  {t.privacyNote}
                  <a
                    href={`/${lang}/privacy`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-neutral-600"
                  >
                    {t.privacyLink}
                  </a>
                </p>
                {acceptError && <div className="text-[13px] text-red-600">{acceptError}</div>}
                <button
                  onClick={submitAcceptance}
                  disabled={!signName.trim() || !signConfirm || accepting}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: DOC_GRADIENT }}
                >
                  {accepting ? t.accepting : t.acceptButton}
                </button>
              </div>
            </div>
          )}

          {/* „Poproszę o zmianę" — druga droga obok akceptacji (runda 3).
              Do tej pory klient, który chciał czegoś inaczej, musiał wyjść
              z dokumentu i napisać maila; teraz odpisuje stąd, a prośba trafia
              na oś czasu klienta i do dzwonka. Nie pokazujemy jej przy ofercie
              zaakceptowanej ani przeterminowanej — tam nie ma czego zmieniać. */}
          {!zaakceptowana && !isOfferExpired(offer) && (
            <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4">
              {zmianaWyslana ? (
                <p className="text-[13px] text-neutral-700">{t.changeSent}</p>
              ) : (
                <>
                  <h2 className="mb-1 text-sm font-semibold text-neutral-900">{t.changeTitle}</h2>
                  <p className="mb-2 text-[12px] text-neutral-500">{t.changeHint}</p>
                  <textarea
                    value={zmianaTresc}
                    onChange={(e) => setZmianaTresc(e.target.value)}
                    rows={3}
                    placeholder={t.changePlaceholder}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
                  />
                  <button
                    onClick={submitChangeRequest}
                    disabled={!zmianaTresc.trim() || zmianaBusy}
                    className="mt-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 disabled:opacity-40"
                  >
                    {t.changeSend}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

