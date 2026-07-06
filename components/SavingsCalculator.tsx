"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Reveal } from "./Reveal";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";

type Volume = "under10" | "10to50" | "50to200" | "over200";
type Sensitivity = "clients" | "internal" | "public";
type FormStatus = "idle" | "sending" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Reuses the same Formspree endpoint as the main contact form — a
// "source" field distinguishes calculator leads in the notification email.
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xdarydza";

const VOLUME_KEYS: Volume[] = ["under10", "10to50", "50to200", "over200"];
const SENSITIVITY_KEYS: Sensitivity[] = ["clients", "internal", "public"];

// Estimated monthly queries per volume bucket (conservative midpoints).
const QUERIES_PER_MONTH: Record<Volume, number> = {
  under10: 300,
  "10to50": 900,
  "50to200": 3750,
  over200: 7500,
};

// Tokens/query based on real usage from a running document-analysis RAG
// system (koszt_kalkulator/data/cost_report.json), not a "short question"
// guess — replies that cite and structure document content run long.
const INPUT_TOKENS_PER_QUERY = 3400;
const OUTPUT_TOKENS_PER_QUERY = 3000;

// Public API pricing per 1M tokens (in/out), verified July 2026.
const PRICING = {
  mini: { in: 0.15, out: 0.6 },
  sonnet: { in: 3, out: 15 },
};

function monthlyCloudCost(volume: Volume, tier: keyof typeof PRICING) {
  const queries = QUERIES_PER_MONTH[volume];
  const inCost = (queries * INPUT_TOKENS_PER_QUERY * PRICING[tier].in) / 1_000_000;
  const outCost = (queries * OUTPUT_TOKENS_PER_QUERY * PRICING[tier].out) / 1_000_000;
  return inCost + outCost;
}

export function SavingsCalculator({
  dict,
  formDict,
  lang,
}: {
  dict: Dictionary["calculator"];
  formDict: Dictionary["cta"]["form"];
  lang: Locale;
}) {
  const [volume, setVolume] = useState<Volume | null>(null);
  const [sensitivity, setSensitivity] = useState<Sensitivity | null>(null);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [consentError, setConsentError] = useState(false);
  const [emailError, setEmailError] = useState(false);

  const showResults = volume !== null && sensitivity !== null;
  const costLow = volume ? monthlyCloudCost(volume, "mini") : 0;
  const costHigh = volume ? monthlyCloudCost(volume, "sonnet") : 0;

  const pillClass = (active: boolean) =>
    `glass rounded-2xl border px-5 py-3 text-sm font-medium transition-colors ${
      active
        ? "border-brand-purple/60 text-liquid"
        : "border-[var(--glass-border)] text-muted hover:border-brand-cyan/40"
    }`;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const email = (data.get("email") as string).trim();
    const consent = data.get("consent");

    const nextEmailError = !EMAIL_RE.test(email);
    const nextConsentError = !consent;
    setEmailError(nextEmailError);
    setConsentError(nextConsentError);
    if (nextEmailError || nextConsentError) {
      setStatus("idle");
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email,
          source: "calculator",
          volume: volume ? dict.volumeOptions[VOLUME_KEYS.indexOf(volume)] : "",
          sensitivity: sensitivity ? dict.sensitivityOptions[SENSITIVITY_KEYS.indexOf(sensitivity)] : "",
          estimatedCloudCostUsd: `${costLow.toFixed(0)}-${costHigh.toFixed(0)}`,
        }),
      });
      if (res.ok) {
        setStatus("success");
        form.reset();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="relative px-6 py-16 md:py-24">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <div className="glass rounded-3xl p-6 md:p-10">
            <p className="mb-3 text-sm font-medium text-muted">{dict.volumeQuestion}</p>
            <div className="flex flex-wrap gap-3">
              {VOLUME_KEYS.map((key, i) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setVolume(key)}
                  className={pillClass(volume === key)}
                >
                  {dict.volumeOptions[i]}
                </button>
              ))}
            </div>

            <p className="mb-3 mt-8 text-sm font-medium text-muted">{dict.sensitivityQuestion}</p>
            <div className="flex flex-wrap gap-3">
              {SENSITIVITY_KEYS.map((key, i) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSensitivity(key)}
                  className={pillClass(sensitivity === key)}
                >
                  {dict.sensitivityOptions[i]}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <AnimatePresence>
          {showResults && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-10"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-muted">
                {dict.resultsLabel}
              </p>

              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                <div className="card-paper h-full rounded-3xl p-8">
                  <p className="text-sm text-muted">{dict.cloudCostLabel}</p>
                  <p className="text-liquid mt-3 text-4xl font-semibold tracking-tight">
                    ${costLow.toFixed(0)}–${costHigh.toFixed(0)}
                  </p>
                </div>
                <div className="card-paper h-full rounded-3xl p-8">
                  <p className="text-sm text-muted">{dict.localCostLabel}</p>
                  <p className="mt-3 text-xl font-semibold tracking-tight">
                    {dict.localCostDescription}
                  </p>
                  <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium">
                    <span className="h-1 w-1 rounded-full bg-brand-cyan shadow-[0_0_10px_2px_rgba(34,211,238,0.6)]" />
                    <span>{dict.localCostMarginal}</span>
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="card-paper h-full rounded-3xl p-8">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-500/10 text-red-400">
                      ⚠
                    </span>
                    <h3 className="text-lg font-semibold">{dict.riskCloudTitle}</h3>
                  </div>
                  <p className="flex items-start gap-3 text-muted">
                    <span className="mt-1 text-red-400/70">✕</span>
                    <span>{sensitivity && dict.riskByLevel[sensitivity]}</span>
                  </p>
                </div>
                <div className="card-paper relative h-full overflow-hidden rounded-3xl p-8">
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-purple to-brand-gold"
                    aria-hidden
                  />
                  <div className="mb-4 flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gold/10 text-brand-gold">
                      ◇
                    </span>
                    <h3 className="text-lg font-semibold">{dict.riskLocalTitle}</h3>
                  </div>
                  <p className="flex items-start gap-3">
                    <span className="mt-1 text-brand-gold">✓</span>
                    <span>{dict.riskLocalPoint}</span>
                  </p>
                </div>
              </div>

              <div className="mt-10 rounded-3xl border p-6 hairline md:p-8">
                {status === "success" ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-3 text-center"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-cyan/15 text-xl text-brand-cyan">
                      ✓
                    </span>
                    <p className="max-w-sm text-muted">{formDict.success}</p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} noValidate>
                    <p className="mb-4 font-medium">{dict.leadIntro}</p>
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div
                        className={`glass flex-1 rounded-2xl border ${
                          emailError ? "border-red-400/60" : "border-[var(--glass-border)]"
                        } focus-within:border-brand-cyan/60`}
                      >
                        <input
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder={formDict.emailPlaceholder}
                          className="w-full rounded-2xl bg-transparent px-4 py-3 text-[var(--fg)] placeholder:text-muted outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={status === "sending"}
                        className="btn-primary shrink-0 rounded-full px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {status === "sending" ? formDict.sending : dict.submit}
                      </button>
                    </div>
                    {emailError && (
                      <p className="mt-1.5 text-xs text-red-400">{formDict.errors.email}</p>
                    )}

                    <label className="mt-4 flex items-start gap-3 text-left text-sm text-muted">
                      <input
                        type="checkbox"
                        name="consent"
                        value="yes"
                        className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#7C3AED]"
                      />
                      <span>
                        {formDict.consent}{" "}
                        <Link
                          href={`/${lang}/privacy`}
                          target="_blank"
                          className="text-liquid underline-offset-2 hover:underline"
                        >
                          {formDict.consentLink}
                        </Link>
                        .
                      </span>
                    </label>
                    {consentError && (
                      <p className="mt-1.5 text-xs text-red-400">{formDict.consentError}</p>
                    )}

                    {status === "error" && (
                      <p className="mt-3 text-sm text-red-400">{formDict.error}</p>
                    )}
                  </form>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-muted">
          {dict.footnote}
        </p>
      </div>
    </section>
  );
}
