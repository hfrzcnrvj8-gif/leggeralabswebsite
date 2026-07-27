"use client";

import { useEffect, useState } from "react";
import {
  type Contract,
  CONTRACT_TYP_LABEL_LANG,
  clausesDokumentu,
  POLE_ANEKSU_LABEL,
  aneksReference,
  roznicaAneksu,
  type PoprzednieWarunki,
  type ZmianaAneksu,
  LEGAL_PLACEHOLDER_NOTE_LANG,
  CLAUSES_UNTRANSLATED_NOTE,
  clientAddressLines,
  contractReference,
} from "@/lib/contracts";
import { type CompanySettings } from "@/lib/invoices";
import { docMoney, docDate, DOC_GRADIENT, type DocLang } from "@/lib/documents";
import { PasekMarkiDokumentu, KwotaGradientem } from "../../../DocGradient";
import { DocLogoMark } from "../../../DocLogoMark";
import { LinkRevokedNotice } from "../../../LinkRevokedNotice";
import { DokumentResponsywny } from "../../../DocumentScale";

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
  /* Aneks (Moduł 58) */
  amendmentNo: string;
  amendmentTo: string;
  amendmentConcluded: string;
  amendmentIntro: string;
  amendmentWas: string;
  amendmentIs: string;
  amendmentRest: string;
  amendmentEmpty: string;
  amendmentNone: string;
  /* Okres obowiązywania i dwustronny podpis (2026-07-27) */
  validity: string;
  validFrom: string;
  validTo: string;
  autoRenew: string;
  noticePeriod: string;
  rolePlaceholder: string;
  roleHint: string;
  signatureBoxUs: string;
  signatureBoxThem: string;
  signaturePending: string;
  /* DPA (art. 28 RODO) i płatność etapami (2026-07-27) */
  dpaSubject: string;
  dpaDataTypes: string;
  dpaDataSubjects: string;
  dpaSubprocessors: string;
  dpaSubprocessorsNone: string;
  paymentTitle: string;
  paymentAdvance: string;
  paymentStages: string;
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
    amendmentNo: "Aneks nr",
    amendmentTo: "do umowy",
    amendmentConcluded: "zawartej dnia",
    amendmentIntro: "Strony zgodnie postanawiają, że umowa wskazana powyżej ulega zmianie w następującym zakresie:",
    amendmentRest: "Pozostałe postanowienia umowy pozostają bez zmian.",
    amendmentWas: "Dotychczasowe brzmienie",
    amendmentIs: "Nowe brzmienie",
    amendmentEmpty: "(brak)",
    amendmentNone: "W tym aneksie nie zmieniono jeszcze żadnego z warunków umowy. Zmień zakres, wynagrodzenie, walutę albo termin — dopiero wtedy aneks będzie miał treść.",
    validity: "Okres obowiązywania",
    validFrom: "od",
    validTo: "do",
    autoRenew: "Umowa przedłuża się na kolejny taki sam okres, o ile żadna ze stron nie wypowie jej wcześniej.",
    noticePeriod: "Okres wypowiedzenia",
    rolePlaceholder: "Stanowisko / funkcja (opcjonalnie)",
    roleHint: "Np. „Prezes Zarządu” albo „Właściciel” — pomaga wykazać umocowanie do podpisania.",
    signatureBoxUs: "Wykonawca",
    signatureBoxThem: "Zamawiający",
    signaturePending: "podpis elektroniczny — oczekuje",
    dpaSubject: "Przedmiot i cel powierzenia",
    dpaDataTypes: "Rodzaj danych osobowych",
    dpaDataSubjects: "Kategorie osób, których dane dotyczą",
    dpaSubprocessors: "Dalsze podmioty przetwarzające",
    dpaSubprocessorsNone: "Wykonawca nie korzysta z dalszych podmiotów przetwarzających.",
    paymentTitle: "Warunki płatności",
    paymentAdvance: "Zaliczka",
    paymentStages: "Harmonogram płatności",
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
    amendmentNo: "Amendment no.",
    amendmentTo: "to the agreement",
    amendmentConcluded: "concluded on",
    amendmentIntro: "The parties agree that the agreement referred to above is amended as follows:",
    amendmentRest: "All remaining provisions of the agreement remain unchanged.",
    amendmentWas: "Previous wording",
    amendmentIs: "New wording",
    amendmentEmpty: "(none)",
    validity: "Term",
    validFrom: "from",
    validTo: "to",
    autoRenew: "The agreement renews for a further identical term unless either party terminates it earlier.",
    noticePeriod: "Notice period",
    rolePlaceholder: "Position / role (optional)",
    roleHint: "E.g. „CEO” or „Owner” — helps evidence the authority to sign.",
    signatureBoxUs: "Contractor",
    signatureBoxThem: "Client",
    signaturePending: "electronic signature — pending",
    dpaSubject: "Subject and purpose of processing",
    dpaDataTypes: "Types of personal data",
    dpaDataSubjects: "Categories of data subjects",
    dpaSubprocessors: "Sub-processors",
    dpaSubprocessorsNone: "The Processor does not use any sub-processors.",
    paymentTitle: "Payment terms",
    paymentAdvance: "Advance payment",
    paymentStages: "Payment schedule",
    amendmentNone: "No terms have been changed in this amendment yet.",
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
    amendmentNo: "Nachtrag Nr.",
    amendmentTo: "zum Vertrag",
    amendmentConcluded: "geschlossen am",
    amendmentIntro: "Die Parteien vereinbaren, dass der oben genannte Vertrag wie folgt geändert wird:",
    amendmentRest: "Die übrigen Bestimmungen des Vertrages bleiben unverändert.",
    amendmentWas: "Bisherige Fassung",
    amendmentIs: "Neue Fassung",
    amendmentEmpty: "(keine)",
    validity: "Laufzeit",
    validFrom: "von",
    validTo: "bis",
    autoRenew: "Der Vertrag verlängert sich um einen weiteren gleich langen Zeitraum, sofern er nicht vorher von einer Partei gekündigt wird.",
    noticePeriod: "Kündigungsfrist",
    rolePlaceholder: "Position / Funktion (optional)",
    roleHint: "Z. B. „Geschäftsführer” oder „Inhaber” — belegt die Vertretungsbefugnis.",
    signatureBoxUs: "Auftragnehmer",
    signatureBoxThem: "Auftraggeber",
    signaturePending: "elektronische Unterschrift — ausstehend",
    dpaSubject: "Gegenstand und Zweck der Verarbeitung",
    dpaDataTypes: "Art der personenbezogenen Daten",
    dpaDataSubjects: "Kategorien betroffener Personen",
    dpaSubprocessors: "Weitere Auftragsverarbeiter",
    dpaSubprocessorsNone: "Der Auftragsverarbeiter setzt keine weiteren Auftragsverarbeiter ein.",
    paymentTitle: "Zahlungsbedingungen",
    paymentAdvance: "Anzahlung",
    paymentStages: "Zahlungsplan",
    amendmentNone: "In diesem Nachtrag wurden noch keine Vertragsbedingungen geändert.",
  },
};

export function ContractPrint({ id, token }: { id?: string; token?: string }) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [notFound, setNotFound] = useState(false);
  // 410 z trasy publicznej = link unieważniony (Moduł 40) — inny ekran niż
  // "nie znaleziono", bo dokument istnieje, tylko dostęp odebrano.
  const [revoked, setRevoked] = useState(false);
  const [signName, setSignName] = useState("");
  const [signConfirm, setSignConfirm] = useState(false);
  /** Stanowisko podpisującego — OPCJONALNE. Wymuszanie go zatrzymałoby podpis
   * kogoś, kto po prostu nie wie, co wpisać; brak jest mniej szkodliwy niż
   * zgadnięta funkcja. */
  const [signRole, setSignRole] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetch(`/api/contracts/public/${token}`)
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

  if (revoked) return <LinkRevokedNotice dokument="Dokument" />;
  if (notFound) return <div className="p-10 text-center text-gray-600">{DICT.pl.notFound}</div>;
  if (!contract) return <div className="p-10 text-center text-gray-400">{DICT.pl.loading}</div>;

  // Aneks (Moduł 58) ma inny kształt niż umowa i NDA: nie powtarza całego
  // dokumentu, tylko pokazuje, co się w nim zmienia. Klauzul NIE drukuje —
  // one obowiązują dalej z umowy-matki i przepisanie ich sugerowałoby, że
  // aneks je zastępuje. Zamiast nich idzie zdanie „pozostałe postanowienia
  // pozostają bez zmian", które mówi to samo, a jest prawdą.
  const isAneks = contract.typ === "aneks";
  const isDpa = contract.typ === "dpa";
  const isUmowa = contract.typ === "umowa";
  // Klauzule wg RODZAJU umowy (2026-07-27) — wydruk liczył je lokalnie z pełnego
  // katalogu, więc umowa utrzymaniowa drukowała klauzulę o odbiorze etapów,
  // której panel dla niej świadomie nie pokazuje. Jedno źródło:
  // clausesDlaSzablonu.
  const clauses = clausesDokumentu(contract.typ, contract.szablon);
  const docLabel = CONTRACT_TYP_LABEL_LANG[lang][contract.typ];
  const poprzednie = (contract.poprzednie ?? null) as PoprzednieWarunki | null;
  const zmiany = isAneks && poprzednie ? roznicaAneksu(poprzednie, contract) : [];

  /** Wartość pola do wydruku — kwota z walutą, data wg locale, tekst jak jest. */
  const wartoscZmiany = (pole: ZmianaAneksu["pole"], v: string | number | null) => {
    if (v === null || v === "") return t.amendmentEmpty;
    if (pole === "cena") return docMoney(Number(v), lang, contract.waluta || "PLN");
    if (pole === "termin_realizacji") return docDate(String(v), lang);
    return String(v);
  };

  const submitAcceptance = async () => {
    if (!token || !signName.trim() || !signConfirm || accepting) return;
    setAccepting(true);
    setAcceptError(null);
    const res = await fetch(`/api/contracts/public/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: signName.trim(), role: signRole.trim() }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; acceptedByName?: string };
    setAccepting(false);
    if (!res.ok) {
      setAcceptError(data.error ?? "—");
      return;
    }
    setContract((prev) =>
      prev
        ? {
            ...prev,
            status: "Podpisana",
            accepted_by_name: data.acceptedByName ?? signName.trim(),
            accepted_by_role: signRole.trim() || null,
            accepted_at: new Date().toISOString(),
          }
        : prev
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

      <DokumentResponsywny>
      <div className="mx-auto flex min-h-[1123px] max-w-[794px] flex-col bg-white text-[13px] text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_20px_40px_-16px_rgba(0,0,0,0.12)] print:min-h-0 print:max-w-none print:shadow-none">
        <PasekMarkiDokumentu id="pasek-umowa" />

        <div className="flex flex-1 flex-col p-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <DocLogoMark gradientId="contractLogoGradient" />
              {settings?.nazwa && <span className="text-[15px] font-semibold tracking-tight text-neutral-900">{settings.nazwa}</span>}
            </div>
            <div className="text-right">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400">
                {isAneks ? `${t.amendmentNo} ${contract.aneks_nr}` : docLabel}
              </div>
              <div className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
                {contract.status === "Szkic"
                  ? `(${t.draft})`
                  : isAneks && poprzednie
                    ? aneksReference(contract.aneks_nr, poprzednie.reference)
                    : contractReference(contract)}
              </div>
              {/* Do czego ten aneks się odnosi — na dokumencie, nie tylko w bazie.
                  Bez tej linijki podpisana kartka nie mówi, którą umowę zmienia. */}
              {isAneks && poprzednie && (
                <div className="mt-1 text-[11px] text-neutral-500">
                  {t.amendmentTo} {poprzednie.reference}
                  <br />
                  {t.amendmentConcluded} {docDate(poprzednie.zawarta, lang)}
                </div>
              )}
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

          {/* KORPUS ANEKSU — wyłącznie to, co się zmienia. Kolumna „było"
              pochodzi z migawki (`poprzednie`), zrobionej w chwili sporządzenia
              aneksu, nie z odczytu umowy-matki: dokument ma pokazywać to, co
              strony przeczytały, także gdyby oryginał kiedyś zniknął. */}
          {isAneks && (
            <div className="mt-8">
              {zmiany.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 leading-relaxed text-amber-800">
                  {t.amendmentNone}
                </p>
              ) : (
                <>
                  <p className="leading-relaxed text-neutral-700">{t.amendmentIntro}</p>
                  <div className="mt-5 space-y-5">
                    {zmiany.map((z, i) => (
                      <div key={z.pole}>
                        <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                          § {i + 1} {POLE_ANEKSU_LABEL[lang][z.pole]}
                        </div>
                        <div className="mt-1.5 grid grid-cols-2 gap-4 border-t border-neutral-100 pt-2">
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-neutral-400">{t.amendmentWas}</div>
                            {/* Przekreślenie, nie sam kolor — dokument bywa
                                drukowany na czarno-białej drukarce. */}
                            <div className="mt-0.5 whitespace-pre-line text-neutral-500 line-through decoration-neutral-300">
                              {wartoscZmiany(z.pole, z.bylo)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-neutral-400">{t.amendmentIs}</div>
                            <div className="mt-0.5 whitespace-pre-line font-medium text-neutral-900">
                              {wartoscZmiany(z.pole, z.jest)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-6 border-t border-neutral-100 pt-3 leading-relaxed text-neutral-700">
                    § {zmiany.length + 1} {t.amendmentRest}
                  </p>
                </>
              )}
            </div>
          )}

          {isUmowa && (
            <div className="mt-8">
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{t.subject}</div>
              <p className="whitespace-pre-line text-neutral-700">{contract.zakres_prac || "—"}</p>
              {contract.cena > 0 && (
                <div className="mt-3 flex justify-between border-t border-neutral-100 pt-2 text-[14px] font-semibold">
                  <span className="text-neutral-900">{t.fee}</span>
                  {/* Kwota gradientem — SVG, nie `background-clip: text`.
                      Tło nie jest malowane przy druku, więc tamta sztuczka gubiła
                      najważniejszą liczbę na dokumencie. Patrz admin/DocGradient.tsx. */}
                  <KwotaGradientem
                    id="kwota-umowa"
                    rozmiar={14}
                    tekst={docMoney(contract.cena, lang, contract.waluta || "PLN")}
                  />
                </div>
              )}
            </div>
          )}

          {/* DPA — pola, których art. 28 ust. 3 RODO wymaga KONKRETNIE dla
              danego powierzenia. Świadomie NIE są stałymi klauzulami: wpisane
              na sztywno dałyby dokument, który wygląda poprawnie i mówi
              nieprawdę o tym, jakie dane naprawdę przetwarzamy. */}
          {isDpa && (
            <div className="mt-8 space-y-4">
              <div>
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{t.dpaSubject}</div>
                <p className="whitespace-pre-line leading-relaxed text-neutral-700">{contract.zakres_prac || "—"}</p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{t.dpaDataTypes}</div>
                  <p className="whitespace-pre-line leading-relaxed text-neutral-700">{contract.dpa_kategorie_danych || "—"}</p>
                </div>
                <div>
                  <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{t.dpaDataSubjects}</div>
                  <p className="whitespace-pre-line leading-relaxed text-neutral-700">{contract.dpa_kategorie_osob || "—"}</p>
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{t.dpaSubprocessors}</div>
                <p className="whitespace-pre-line leading-relaxed text-neutral-700">
                  {contract.dpa_podprocesorzy || t.dpaSubprocessorsNone}
                </p>
              </div>
            </div>
          )}

          {/* Warunki płatności — drukowane tylko wtedy, gdy odbiegają od
              domyślnej klauzuli („faktura po zakończeniu, 14 dni"). Zaliczka
              albo harmonogram to zmiana warunku handlowego, więc musi stać na
              dokumencie, a nie tylko w panelu. */}
          {isUmowa && (contract.zaliczka_procent > 0 || contract.platnosci_opis) && (
            <div className="mt-6">
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{t.paymentTitle}</div>
              {contract.zaliczka_procent > 0 && (
                <p className="leading-relaxed text-neutral-700">
                  {t.paymentAdvance}: {contract.zaliczka_procent}%
                  {contract.cena > 0
                    ? ` (${docMoney((contract.cena * contract.zaliczka_procent) / 100, lang, contract.waluta || "PLN")})`
                    : ""}
                </p>
              )}
              {contract.platnosci_opis && (
                <p className="mt-1 whitespace-pre-line leading-relaxed text-neutral-700">{contract.platnosci_opis}</p>
              )}
            </div>
          )}

          {/* OKRES OBOWIĄZYWANIA (2026-07-27) — to treść umowy, nie metadana
              panelu: przy umowie utrzymaniowej jest ważniejszy niż termin
              realizacji. Milczące przedłużenie MUSI stać na dokumencie, bo to
              ono zobowiązuje drugą stronę do pilnowania terminu. */}
          {isUmowa && (contract.obowiazuje_od || contract.obowiazuje_do) && (
            <div className="mt-6">
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{t.validity}</div>
              <p className="leading-relaxed text-neutral-700">
                {contract.obowiazuje_od ? `${t.validFrom} ${docDate(contract.obowiazuje_od, lang)}` : ""}
                {contract.obowiazuje_od && contract.obowiazuje_do ? " " : ""}
                {contract.obowiazuje_do ? `${t.validTo} ${docDate(contract.obowiazuje_do, lang)}` : ""}
                {contract.odnawialna ? `. ${t.autoRenew}` : "."}
                {contract.odnawialna && contract.wypowiedzenie_dni > 0
                  ? ` ${t.noticePeriod}: ${contract.wypowiedzenie_dni} ${lang === "pl" ? "dni" : lang === "de" ? "Tage" : "days"}.`
                  : ""}
              </p>
            </div>
          )}

          {/* Aneks NIE powtarza klauzul umowy-matki — one obowiązują dalej,
              a przedruk sugerowałby, że aneks je zastępuje. Mówi to wprost
              zdanie „pozostałe postanowienia bez zmian" wyżej. */}
          {!isAneks && lang !== "pl" && (
            <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-[10.5px] leading-relaxed text-neutral-500">
              {CLAUSES_UNTRANSLATED_NOTE[lang]}
            </div>
          )}

          {!isAneks && (
            <div className="mt-8 space-y-5">
              {clauses.map((c) => (
                <div key={c.title}>
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{c.title}</div>
                  <p className="mt-0.5 leading-relaxed text-neutral-700">{c.text}</p>
                </div>
              ))}
            </div>
          )}

          {contract.uwagi && <div className="mt-6 whitespace-pre-line text-neutral-600">{contract.uwagi}</div>}

          {/* DWIE RUBRYKI PODPISU (2026-07-27) — dokument miał wcześniej tylko
              ślad podpisu drugiej strony pod formularzem, więc wydrukowana
              kartka wyglądała jak jednostronne oświadczenie. Umowa jest
              dwustronna; rubryka pusta mówi wprost, że podpis czeka. */}
          <div className="mt-10 grid grid-cols-2 gap-8">
            <div>
              <div className="text-[10px] uppercase tracking-[0.1em] text-neutral-400">{t.signatureBoxUs}</div>
              <div className="mt-6 border-t border-neutral-300 pt-1.5 text-[11px] text-neutral-600">
                {contract.podpis_nasz_osoba || settings?.nazwa || ""}
                {contract.podpis_nasz_at ? `, ${docDate(contract.podpis_nasz_at, lang)}` : ""}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.1em] text-neutral-400">{t.signatureBoxThem}</div>
              <div className="mt-6 border-t border-neutral-300 pt-1.5 text-[11px] text-neutral-600">
                {contract.accepted_by_name ? (
                  <>
                    {contract.accepted_by_name}
                    {contract.accepted_by_role ? `, ${contract.accepted_by_role}` : ""}
                    {contract.accepted_at ? `, ${docDate(contract.accepted_at, lang)}` : ""}
                  </>
                ) : (
                  <span className="text-neutral-400">{t.signaturePending}</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-auto pt-10">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10.5px] leading-relaxed text-amber-700">
              ⚠ {LEGAL_PLACEHOLDER_NOTE_LANG[lang]}
            </div>
          </div>
        </div>
      </div>
      </DokumentResponsywny>

      {/* E-podpis — tylko na publicznej stronie (token ustawiony). */}
      {token && (
        <div className="mx-auto mt-4 max-w-[794px] px-4 print:hidden">
          {contract.status === "Podpisana" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              ✓ {contract.accepted_by_name
                ? `${t.signedByLabel} ${contract.accepted_by_name}${contract.accepted_by_role ? `, ${contract.accepted_by_role}` : ""}, ${docDate(contract.accepted_at, lang)}`
                : t.signedNoNameLabel}
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
                <input
                  value={signRole}
                  onChange={(e) => setSignRole(e.target.value)}
                  placeholder={t.rolePlaceholder}
                  aria-label={t.rolePlaceholder}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
                />
                <p className="text-[11px] leading-relaxed text-neutral-400">{t.roleHint}</p>
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
