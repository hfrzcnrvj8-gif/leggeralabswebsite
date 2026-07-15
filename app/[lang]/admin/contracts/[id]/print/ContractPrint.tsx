"use client";

import { useEffect, useState } from "react";
import {
  type Contract,
  CONTRACT_TYP_LABEL_LANG,
  CONTRACT_CLAUSES,
  NDA_CLAUSES,
  LEGAL_PLACEHOLDER_NOTE_LANG,
  CLAUSES_UNTRANSLATED_NOTE,
  clientAddressLines,
  contractReference,
} from "@/lib/contracts";
import { type CompanySettings } from "@/lib/invoices";
import { docMoney, docDate, DOC_GRADIENT, type DocLang } from "@/lib/documents";
import { DocLogoMark } from "../../../DocLogoMark";

/** Podgląd/wydruk/podpis Umowy lub NDA — ten sam premium styl co
 * OfferPrint.tsx. Wersja językowa (`contract.jezyk`, dla Umów dziedziczona
 * z oferty przy generowaniu) dotyczy TYLKO "chrome" wydruku (nagłówki,
 * przyciski, e-podpis) — same klauzule (CONTRACT_CLAUSES/NDA_CLAUSES)
 * renderują się zawsze po polsku i świadomie NIE są tłumaczone, dopóki nie
 * przejdą weryfikacji prawnika (patrz komentarz w lib/contracts.ts) —
 * tłumaczenie niezweryfikowanego szkicu dokładałoby pracę do wyrzucenia. */

type Dict = {
  notFound: string;
  loading: string;
  close: string;
  print: string;
  draft: string;
  preparedDate: string;
  deadline: string;
  seller: string;
  buyer: string;
  taxId: string;
  subject: string;
  fee: string;
  signatureTitle: string;
  namePlaceholder: string;
  confirmLabel: string;
  signButton: string;
  signing: string;
  signedByLabel: string;
  signedNoNameLabel: string;
  privacyNote: string;
  privacyLink: string;
};

const DICT: Record<DocLang, Dict> = {
  pl: {
    notFound: "Nie znaleziono dokumentu.",
    loading: "Wczytywanie…",
    close: "Zamknij",
    print: "Drukuj / Zapisz PDF",
    draft: "szkic",
    preparedDate: "Data przygotowania",
    deadline: "Termin realizacji",
    seller: "Zleceniodawca / Wykonawca",
    buyer: "Druga strona",
    taxId: "NIP",
    subject: "Przedmiot umowy",
    fee: "Wynagrodzenie",
    signatureTitle: "Podpis",
    namePlaceholder: "Jan Kowalski",
    confirmLabel: "Potwierdzam, że zapoznałem/-am się z treścią dokumentu i ją akceptuję.",
    signButton: "Podpisuję",
    signing: "Zapisywanie…",
    signedByLabel: "Podpisano przez",
    signedNoNameLabel: "Dokument podpisany.",
    privacyNote:
      "Akceptując, zapisujemy Twoje imię i nazwisko, adres IP oraz datę i godzinę — jako dowód złożenia oświadczenia woli. Szczegóły przetwarzania danych: ",
    privacyLink: "Polityka Prywatności",
  },
  en: {
    notFound: "Document not found.",
    loading: "Loading…",
    close: "Close",
    print: "Print / Save PDF",
    draft: "draft",
    preparedDate: "Prepared on",
    deadline: "Delivery deadline",
    seller: "Client / Contractor",
    buyer: "Other party",
    taxId: "Tax ID",
    subject: "Scope of the agreement",
    fee: "Fee",
    signatureTitle: "Signature",
    namePlaceholder: "John Smith",
    confirmLabel: "I confirm that I have read and accept the content of this document.",
    signButton: "I sign",
    signing: "Saving…",
    signedByLabel: "Signed by",
    signedNoNameLabel: "Document signed.",
    privacyNote:
      "By accepting, we record your full name, IP address, and timestamp — as proof of your declaration of intent. Data processing details: ",
    privacyLink: "Privacy Policy",
  },
  de: {
    notFound: "Dokument nicht gefunden.",
    loading: "Wird geladen…",
    close: "Schließen",
    print: "Drucken / Als PDF speichern",
    draft: "Entwurf",
    preparedDate: "Erstellungsdatum",
    deadline: "Ausführungsfrist",
    seller: "Auftraggeber / Auftragnehmer",
    buyer: "Andere Partei",
    taxId: "USt-IdNr.",
    subject: "Vertragsgegenstand",
    fee: "Vergütung",
    signatureTitle: "Unterschrift",
    namePlaceholder: "Max Mustermann",
    confirmLabel: "Ich bestätige, dass ich den Inhalt dieses Dokuments gelesen habe und akzeptiere.",
    signButton: "Ich unterschreibe",
    signing: "Wird gespeichert…",
    signedByLabel: "Unterzeichnet von",
    signedNoNameLabel: "Dokument unterzeichnet.",
    privacyNote:
      "Bei der Annahme speichern wir Ihren Namen, Ihre IP-Adresse sowie Datum und Uhrzeit als Nachweis Ihrer Willenserklärung. Einzelheiten zur Datenverarbeitung: ",
    privacyLink: "Datenschutzerklärung",
  },
};

export function ContractPrint({ id, token }: { id?: string; token?: string }) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [signName, setSignName] = useState("");
  const [signConfirm, setSignConfirm] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetch(`/api/contracts/public/${token}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          setContract(d.contract);
          setSettings(d.settings);
        })
        .catch(() => setNotFound(true));
      return;
    }
    Promise.all([
      fetch(`/api/contracts/${id}`).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/settings").then((r) => (r.ok ? r.json() : { settings: null })),
    ])
      .then(([contractData, settingsData]) => {
        setContract(contractData.contract);
        setSettings(settingsData.settings);
      })
      .catch(() => setNotFound(true));
  }, [id, token]);

  const lang: DocLang = contract?.jezyk ?? "pl";
  const t = DICT[lang];

  if (notFound) return <div className="p-10 text-center text-gray-600">{DICT.pl.notFound}</div>;
  if (!contract) return <div className="p-10 text-center text-gray-400">{DICT.pl.loading}</div>;

  const isUmowa = contract.typ === "umowa";
  const clauses = isUmowa ? CONTRACT_CLAUSES : NDA_CLAUSES;
  const docLabel = CONTRACT_TYP_LABEL_LANG[lang][contract.typ];

  const submitAcceptance = async () => {
    if (!token || !signName.trim() || !signConfirm || accepting) return;
    setAccepting(true);
    setAcceptError(null);
    const res = await fetch(`/api/contracts/public/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: signName.trim() }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; acceptedByName?: string };
    setAccepting(false);
    if (!res.ok) {
      setAcceptError(data.error ?? "—");
      return;
    }
    setContract((prev) =>
      prev ? { ...prev, status: "Podpisana", accepted_by_name: data.acceptedByName ?? signName.trim(), accepted_at: new Date().toISOString() } : prev
    );
  };

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

      <div className="mx-auto flex min-h-[1123px] max-w-[794px] flex-col bg-white text-[13px] text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_20px_40px_-16px_rgba(0,0,0,0.12)] print:min-h-0 print:max-w-none print:shadow-none">
        <div className="h-[3px] w-full shrink-0" style={{ background: DOC_GRADIENT }} />

        <div className="flex flex-1 flex-col p-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <DocLogoMark gradientId="contractLogoGradient" />
              {settings?.nazwa && <span className="text-[15px] font-semibold tracking-tight text-neutral-900">{settings.nazwa}</span>}
            </div>
            <div className="text-right">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400">{docLabel}</div>
              <div className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
                {contract.status === "Szkic" ? `(${t.draft})` : contractReference(contract)}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-8 text-neutral-500">
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-neutral-400">{t.preparedDate}</div>
              <div className="font-medium text-neutral-800">{docDate(contract.created_at, lang)}</div>
            </div>
            {isUmowa && contract.termin_realizacji && (
              <div>
                <div className="text-[10.5px] uppercase tracking-wide text-neutral-400">{t.deadline}</div>
                <div className="font-medium text-neutral-800">{docDate(contract.termin_realizacji, lang)}</div>
              </div>
            )}
          </div>

          <div className="mt-10 grid grid-cols-2 gap-8 border-t border-neutral-100 pt-6">
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{t.seller}</div>
              <div className="whitespace-pre-line font-medium text-neutral-900">{settings?.nazwa || "—"}</div>
              {settings?.adres && <div className="mt-0.5 whitespace-pre-line text-neutral-500">{settings.adres}</div>}
              {settings?.nip && <div className="mt-0.5 text-neutral-500">{t.taxId}: {settings.nip}</div>}
              {settings?.email && <div className="mt-0.5 text-neutral-500">{settings.email}</div>}
            </div>
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{t.buyer}</div>
              <div className="whitespace-pre-line font-medium text-neutral-900">{contract.klient_nazwa || "—"}</div>
              {clientAddressLines(contract).map((line, i) => (
                <div key={i} className="mt-0.5 text-neutral-500">
                  {line}
                </div>
              ))}
              {contract.klient_nip && <div className="mt-0.5 text-neutral-500">{t.taxId}: {contract.klient_nip}</div>}
            </div>
          </div>

          {isUmowa && (
            <div className="mt-8">
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{t.subject}</div>
              <p className="whitespace-pre-line text-neutral-700">{contract.zakres_prac || "—"}</p>
              {contract.cena > 0 && (
                <div className="mt-3 flex justify-between border-t border-neutral-100 pt-2 text-[14px] font-semibold">
                  <span className="text-neutral-900">{t.fee}</span>
                  <span
                    className="tabular-nums"
                    style={{ background: DOC_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
                  >
                    {docMoney(contract.cena, lang, contract.waluta || "PLN")}
                  </span>
                </div>
              )}
            </div>
          )}

          {lang !== "pl" && (
            <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-[10.5px] leading-relaxed text-neutral-500">
              {CLAUSES_UNTRANSLATED_NOTE[lang]}
            </div>
          )}

          <div className="mt-8 space-y-5">
            {clauses.map((c) => (
              <div key={c.title}>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{c.title}</div>
                <p className="mt-0.5 leading-relaxed text-neutral-700">{c.text}</p>
              </div>
            ))}
          </div>

          {contract.uwagi && <div className="mt-6 whitespace-pre-line text-neutral-600">{contract.uwagi}</div>}

          <div className="mt-auto pt-10">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10.5px] leading-relaxed text-amber-700">
              ⚠ {LEGAL_PLACEHOLDER_NOTE_LANG[lang]}
            </div>
          </div>
        </div>
      </div>

      {/* E-podpis — tylko na publicznej stronie (token ustawiony). */}
      {token && (
        <div className="mx-auto mt-4 max-w-[794px] px-4 print:hidden">
          {contract.status === "Podpisana" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              ✓ {contract.accepted_by_name ? `${t.signedByLabel} ${contract.accepted_by_name}, ${docDate(contract.accepted_at, lang)}` : t.signedNoNameLabel}
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-neutral-900">{t.signatureTitle} — {docLabel.toLowerCase()}</h2>
              <div className="space-y-2.5">
                <input
                  value={signName}
                  onChange={(e) => setSignName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  aria-label={t.namePlaceholder}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
                />
                <label className="flex items-start gap-2 text-[13px] text-neutral-600">
                  <input type="checkbox" checked={signConfirm} onChange={(e) => setSignConfirm(e.target.checked)} className="mt-0.5" />
                  {t.confirmLabel}
                </label>
                <p className="text-[11px] leading-relaxed text-neutral-400">
                  {t.privacyNote}
                  <a href={`/${lang}/privacy`} target="_blank" rel="noopener noreferrer" className="underline hover:text-neutral-600">
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
                  {accepting ? t.signing : `${t.signButton} — ${docLabel}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
