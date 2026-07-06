"use client";

import Link from "next/link";
import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import costProofData from "@/content/cost-proof.json";

// Rough token → page conversion so non-technical visitors get a feel for
// volume without needing to know what a "token" is: ~0.6 words per token
// (conservative for mixed EN/PL/DE content) over ~250 words per book page.
const WORDS_PER_TOKEN = 0.6;
const WORDS_PER_PAGE = 250;

export function CostProof({ dict, lang }: { dict: Dictionary["costProof"]; lang: Locale }) {
  const g = costProofData.grandTotal;
  const headline = Math.max(
    g.costUsdByTier.gpt4o,
    g.costUsdByTier.sonnet,
    g.costUsdByTier.mini
  );
  const pages = Math.round((g.tokensTotal * WORDS_PER_TOKEN) / WORDS_PER_PAGE);

  return (
    <section id="cost-proof" className="relative px-6 py-32 md:py-40">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-3xl">
          <SectionLabel>{dict.label}</SectionLabel>
          <h2 className="mt-6 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            {dict.title}
          </h2>
          <p className="mt-6 text-lg text-muted">{dict.subtitle}</p>
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          <Reveal>
            <article className="card-paper h-full rounded-3xl p-8">
              <p className="text-sm text-muted">{dict.statRequests}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight">
                {g.requests.toLocaleString("pl-PL")}
              </p>
            </article>
          </Reveal>
          <Reveal delay={0.1}>
            <article className="card-paper h-full rounded-3xl p-8">
              <p className="text-sm text-muted">{dict.statVolume}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight">
                ~{pages.toLocaleString("pl-PL")}
              </p>
              <p className="mt-1 text-sm text-muted">{dict.statVolumeUnit}</p>
            </article>
          </Reveal>
          <Reveal delay={0.2}>
            <article className="card-paper group h-full rounded-3xl p-8 transition-colors hover:border-brand-purple/40">
              <p className="text-sm text-muted">{dict.statCloudCost}</p>
              <p className="text-liquid mt-3 text-4xl font-semibold tracking-tight">
                ${headline.toFixed(2)}
              </p>
              <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium">
                <span className="h-1 w-1 rounded-full bg-brand-cyan shadow-[0_0_10px_2px_rgba(34,211,238,0.6)]" />
                <span>{dict.statLocalCost}</span>
              </p>
            </article>
          </Reveal>
        </div>

        <Reveal delay={0.3}>
          <Link
            href={`/${lang}/calculator`}
            className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-liquid underline-offset-2 hover:underline"
          >
            {dict.calculatorCta} →
          </Link>
        </Reveal>

        <p className="mt-6 text-xs text-muted">
          {dict.footnote} {costProofData.pricingSourceDate}
        </p>
      </div>
    </section>
  );
}
