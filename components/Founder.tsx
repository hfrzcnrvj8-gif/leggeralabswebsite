"use client";

import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import type { Dictionary } from "@/i18n/types";

export function Founder({ dict }: { dict: Dictionary["founder"] }) {
  return (
    <section id="founder" className="relative px-6 py-32 md:py-40">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          {/* No card/frame — the cutout is meant to float directly on the
              page, not sit boxed inside a bordered tile. */}
          <div className="relative mx-auto w-full max-w-sm">
            <img
              src="/founder.webp"
              alt={dict.name}
              className="w-full h-auto drop-shadow-[0_30px_50px_rgba(0,0,0,0.35)]"
            />
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div>
            <SectionLabel>{dict.label}</SectionLabel>
            <h2 className="mt-6 text-balance font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
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
