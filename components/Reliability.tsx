"use client";

import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import { MacWindow } from "./MacWindow";
import type { Dictionary } from "@/i18n/types";
import reliabilityData from "@/content/reliability-proof.json";

export function Reliability({ dict }: { dict: Dictionary["reliability"] }) {
  const timeline = reliabilityData.selfHealingEvents.flagshipIncident.timeline;
  const total = reliabilityData.selfHealingEvents.totalEvents;
  const days = reliabilityData.selfHealingEvents.windowDays;

  return (
    <section id="reliability" className="relative px-6 py-32 md:py-40">
      <div className="mx-auto max-w-5xl">
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
              <p className="text-sm text-muted">{dict.statEvents}</p>
              <p className="text-liquid mt-3 text-4xl font-semibold tracking-tight">{total}</p>
            </article>
          </Reveal>
          <Reveal delay={0.1}>
            <article className="card-paper h-full rounded-3xl p-8">
              <p className="text-sm text-muted">{dict.statWindow}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight">{days} {dict.statWindowUnit}</p>
            </article>
          </Reveal>
          <Reveal delay={0.2}>
            <article className="card-paper h-full rounded-3xl p-8">
              <p className="text-sm text-muted">{dict.statHuman}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight">0</p>
              <p className="mt-1 text-sm text-muted">{dict.statHumanCaption}</p>
            </article>
          </Reveal>
        </div>

        <Reveal className="mx-auto mt-12 max-w-3xl">
          <p className="text-lg text-muted">{dict.stakes}</p>
        </Reveal>

        <div className="mt-10">
          <Reveal>
            <MacWindow title="proxy-watchdog-alert.log" compact>
              <div className="w-full select-text px-8 py-6 text-left font-mono text-sm leading-relaxed">
                <p className="mb-4 text-muted">{dict.logIntro}</p>
                {timeline.map((t: { timestamp: string; waitedMinutes: number }, i: number) => (
                  <p key={t.timestamp} className={i > 0 ? "mt-2" : ""}>
                    <span className="text-muted">{t.timestamp.replace("T", " ").replace("Z", "").slice(0, 16)}</span>
                    {"  →  "}
                    <span className="text-liquid">{dict.logWaited} {t.waitedMinutes} min</span>
                    {"  "}
                    <span>{dict.logRecovered}</span>
                  </p>
                ))}
              </div>
            </MacWindow>
          </Reveal>
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted">
          {dict.footnote}
        </p>
      </div>
    </section>
  );
}
