"use client";

import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import type { Dictionary } from "@/i18n/types";

export function Founder({ dict }: { dict: Dictionary["founder"] }) {
  return (
    <section id="founder" className="relative px-6 py-32 md:py-40">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[0.9fr_1.1fr]">
        {/* Portrait — replace the placeholder block with a real <img> when ready:
            <img src="/founder.jpg" alt="..." className="h-full w-full object-cover" /> */}
        <Reveal>
          <div className="glow-border relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-[2rem]">
            <div className="card-surface relative h-full w-full">
              <div
                className="orb pointer-events-none absolute inset-0 animate-orb-float opacity-50"
                aria-hidden
              />
              <div className="relative flex h-full flex-col items-center justify-center">
                <span className="text-liquid text-8xl font-semibold tracking-tightest">
                  ◇
                </span>
                <p className="mt-6 text-sm text-muted">{dict.role}</p>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div>
            <SectionLabel>{dict.label}</SectionLabel>
            <h2 className="mt-6 text-balance text-3xl font-semibold leading-tight tracking-tightest sm:text-4xl md:text-5xl">
              {dict.title}
            </h2>
            <p className="mt-6 text-lg text-muted">{dict.body}</p>

            <blockquote className="mt-8 border-l-2 border-brand-purple/60 pl-5 text-lg italic">
              “{dict.quote}”
            </blockquote>

            <p className="mt-6 font-semibold tracking-tight">
              {dict.name}
              <span className="ml-2 font-normal text-muted">— {dict.role}</span>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
