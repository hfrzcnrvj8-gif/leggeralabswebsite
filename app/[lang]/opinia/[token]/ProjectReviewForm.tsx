"use client";

import { useEffect, useState } from "react";
import { PROJECT_REVIEW_CONSENT_TEXT } from "@/lib/projects";
import type { DocLang } from "@/lib/documents";
import { LinkRevokedNotice } from "../../admin/LinkRevokedNotice";

const DOC_GRADIENT = "linear-gradient(120deg, #7C3AED 0%, #E0A93B 100%)";

type PublicProject = {
  tytul: string;
  client_nazwa: string | null;
  review_submitted_at: string | null;
  review_rating_jakosc: number | null;
  review_rating_terminowosc: number | null;
  review_rating_komunikacja: number | null;
  review_comment: string;
  review_consent_case_study: boolean;
  jezyk: string;
};

type Dict = {
  title: string;
  projectLabel: string;
  quality: string;
  timeliness: string;
  communication: string;
  commentLabel: string;
  commentPlaceholder: string;
  namePlaceholder: string;
  submit: string;
  submitting: string;
  thanks: string;
  notFound: string;
  loading: string;
  consentNameError: string;
  genericError: string;
};

const DICT: Record<DocLang, Dict> = {
  pl: {
    title: "Opinia o współpracy",
    projectLabel: "Projekt",
    quality: "Jakość realizacji",
    timeliness: "Terminowość",
    communication: "Komunikacja",
    commentLabel: "Komentarz (opcjonalnie)",
    commentPlaceholder: "Co się udało, co warto poprawić…",
    namePlaceholder: "Imię i nazwisko",
    submit: "Wyślij opinię",
    submitting: "Zapisywanie…",
    thanks: "Dziękujemy — opinia została zapisana.",
    notFound: "Nie znaleziono formularza opinii.",
    loading: "Wczytywanie…",
    consentNameError: "Podaj imię i nazwisko, żeby potwierdzić zgodę.",
    genericError: "Nie udało się zapisać opinii.",
  },
  en: {
    title: "Project feedback",
    projectLabel: "Project",
    quality: "Quality of work",
    timeliness: "Timeliness",
    communication: "Communication",
    commentLabel: "Comment (optional)",
    commentPlaceholder: "What went well, what could be improved…",
    namePlaceholder: "Full name",
    submit: "Submit feedback",
    submitting: "Saving…",
    thanks: "Thank you — your feedback has been saved.",
    notFound: "Feedback form not found.",
    loading: "Loading…",
    consentNameError: "Please enter your full name to confirm consent.",
    genericError: "Failed to save your feedback.",
  },
  de: {
    title: "Bewertung der Zusammenarbeit",
    projectLabel: "Projekt",
    quality: "Qualität der Umsetzung",
    timeliness: "Termintreue",
    communication: "Kommunikation",
    commentLabel: "Kommentar (optional)",
    commentPlaceholder: "Was gut lief, was verbessert werden könnte…",
    namePlaceholder: "Vor- und Nachname",
    submit: "Bewertung absenden",
    submitting: "Wird gespeichert…",
    thanks: "Vielen Dank — Ihre Bewertung wurde gespeichert.",
    notFound: "Bewertungsformular nicht gefunden.",
    loading: "Wird geladen…",
    consentNameError: "Bitte geben Sie Ihren Namen ein, um die Einwilligung zu bestätigen.",
    genericError: "Die Bewertung konnte nicht gespeichert werden.",
  },
};

function isDocLang(v: string): v is DocLang {
  return v === "pl" || v === "en" || v === "de";
}

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-neutral-800">{label}</div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n}/5`}
            className="text-2xl leading-none transition-transform hover:scale-110"
            style={{ color: n <= value ? "#E0A93B" : "#d4d4d4" }}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

/** Publiczny formularz opinii o zakończonym projekcie (Moduł 15) — prostszy
 * niż OfferPrint/ContractPrint (to nie dokument do druku, tylko krótka
 * ankieta), ale ten sam duch: jasne tło, akcent gradientu marki, bez
 * logowania (token = hasło-w-linku). Wersja językowa wg `project.jezyk`
 * (dziedziczonego z oferty, patrz lib/offerAccept.ts) — ŚWIADOMIE nie wg
 * segmentu URL-a `[lang]`, bo to język, w jakim rozmawia się z KLIENTEM, nie
 * język, w jakim ktoś akurat przegląda stronę leggeralabs.pl. */
export function ProjectReviewForm({ token }: { token: string }) {
  const [project, setProject] = useState<PublicProject | null>(null);
  const [notFound, setNotFound] = useState(false);
  // 410 = link unieważniony (Moduł 40) — inny ekran niż "nie znaleziono".
  const [revoked, setRevoked] = useState(false);
  const [jakosc, setJakosc] = useState(0);
  const [terminowosc, setTerminowosc] = useState(0);
  const [komunikacja, setKomunikacja] = useState(0);
  const [comment, setComment] = useState("");
  const [consentCaseStudy, setConsentCaseStudy] = useState(false);
  const [consentName, setConsentName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/review/public/${token}`)
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
      .then((d) => d && setProject(d.project))
      .catch(() => setNotFound(true));
  }, [token]);

  const lang: DocLang = project && isDocLang(project.jezyk) ? project.jezyk : "pl";
  const t = DICT[lang];

  if (revoked) return <LinkRevokedNotice dokument="Formularz opinii" />;
  if (notFound) return <div className="p-10 text-center text-neutral-600">{DICT.pl.notFound}</div>;
  if (!project) return <div className="p-10 text-center text-neutral-400">{DICT.pl.loading}</div>;

  const alreadySubmitted = Boolean(project.review_submitted_at) || justSubmitted;

  const submit = async () => {
    if (jakosc === 0 || terminowosc === 0 || komunikacja === 0 || submitting) return;
    if (consentCaseStudy && !consentName.trim()) {
      setError(t.consentNameError);
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/projects/review/public/${token}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jakosc,
        terminowosc,
        komunikacja,
        comment: comment.trim(),
        consentCaseStudy,
        consentName: consentName.trim(),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? t.genericError);
      return;
    }
    setJustSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-neutral-100 py-10">
      <div className="mx-auto flex max-w-[560px] flex-col overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_20px_40px_-16px_rgba(0,0,0,0.12)]">
        <div className="h-[3px] w-full shrink-0" style={{ background: DOC_GRADIENT }} />
        <div className="p-8">
          <h1 className="text-lg font-semibold">{t.title}</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            {t.projectLabel} „{project.tytul}”{project.client_nazwa ? ` — ${project.client_nazwa}` : ""}
          </p>

          {alreadySubmitted ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">✓ {t.thanks}</div>
          ) : (
            <div className="mt-6 space-y-5">
              <StarRating value={jakosc} onChange={setJakosc} label={t.quality} />
              <StarRating value={terminowosc} onChange={setTerminowosc} label={t.timeliness} />
              <StarRating value={komunikacja} onChange={setKomunikacja} label={t.communication} />

              <div>
                <div className="mb-1.5 text-sm font-medium text-neutral-800">{t.commentLabel}</div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  placeholder={t.commentPlaceholder}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
                />
              </div>

              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3.5">
                <label className="flex items-start gap-2 text-[13px] text-neutral-700">
                  <input
                    type="checkbox"
                    checked={consentCaseStudy}
                    onChange={(e) => setConsentCaseStudy(e.target.checked)}
                    className="mt-0.5"
                  />
                  {PROJECT_REVIEW_CONSENT_TEXT[lang]}
                </label>
                {consentCaseStudy && (
                  <input
                    value={consentName}
                    onChange={(e) => setConsentName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    aria-label={t.namePlaceholder}
                    className="mt-2.5 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
                  />
                )}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                onClick={submit}
                disabled={jakosc === 0 || terminowosc === 0 || komunikacja === 0 || submitting}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: DOC_GRADIENT }}
              >
                {submitting ? t.submitting : t.submit}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
