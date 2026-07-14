"use client";

import { useEffect, useState } from "react";
import { PROJECT_REVIEW_CONSENT_TEXT } from "@/lib/projects";

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
};

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
 * logowania (token = hasło-w-linku). Polski jedynie, wzorem ContractPrint. */
export function ProjectReviewForm({ token }: { token: string }) {
  const [project, setProject] = useState<PublicProject | null>(null);
  const [notFound, setNotFound] = useState(false);
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
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setProject(d.project))
      .catch(() => setNotFound(true));
  }, [token]);

  if (notFound) return <div className="p-10 text-center text-neutral-600">Nie znaleziono formularza opinii.</div>;
  if (!project) return <div className="p-10 text-center text-neutral-400">Wczytywanie…</div>;

  const alreadySubmitted = Boolean(project.review_submitted_at) || justSubmitted;

  const submit = async () => {
    if (jakosc === 0 || terminowosc === 0 || komunikacja === 0 || submitting) return;
    if (consentCaseStudy && !consentName.trim()) {
      setError("Podaj imię i nazwisko, żeby potwierdzić zgodę.");
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
      setError(data.error ?? "Nie udało się zapisać opinii.");
      return;
    }
    setJustSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-neutral-100 py-10">
      <div className="mx-auto flex max-w-[560px] flex-col overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_20px_40px_-16px_rgba(0,0,0,0.12)]">
        <div className="h-[3px] w-full shrink-0" style={{ background: DOC_GRADIENT }} />
        <div className="p-8">
          <h1 className="text-lg font-semibold">Opinia o współpracy</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            Projekt „{project.tytul}”{project.client_nazwa ? ` — ${project.client_nazwa}` : ""}
          </p>

          {alreadySubmitted ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              ✓ Dziękujemy — opinia została zapisana.
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <StarRating value={jakosc} onChange={setJakosc} label="Jakość realizacji" />
              <StarRating value={terminowosc} onChange={setTerminowosc} label="Terminowość" />
              <StarRating value={komunikacja} onChange={setKomunikacja} label="Komunikacja" />

              <div>
                <div className="mb-1.5 text-sm font-medium text-neutral-800">Komentarz (opcjonalnie)</div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  placeholder="Co się udało, co warto poprawić…"
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
                  {PROJECT_REVIEW_CONSENT_TEXT}
                </label>
                {consentCaseStudy && (
                  <input
                    value={consentName}
                    onChange={(e) => setConsentName(e.target.value)}
                    placeholder="Imię i nazwisko"
                    aria-label="Imię i nazwisko"
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
                {submitting ? "Zapisywanie…" : "Wyślij opinię"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
