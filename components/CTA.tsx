"use client";

import { Reveal } from "./Reveal";
import type { Dictionary } from "@/i18n/types";

export function CTA({ dict }: { dict: Dictionary["cta"] }) {
  return (
    <section id="contact" className="relative px-6 py-32 md:py-44">
      <Reveal className="mx-auto max-w-4xl">
        <div className="glow-border relative overflow-hidden rounded-[2.5rem]">
          <div className="card-surface relative rounded-[2.5rem] px-8 py-20 text-center md:px-16">
            <div
              className="orb pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[60%] -translate-x-1/2 -translate-y-1/2 animate-orb-float rounded-full"
              aria-hidden
            />
            <div className="relative">
              <h2 className="text-balance text-4xl font-semibold leading-tight tracking-tightest sm:text-5xl md:text-6xl">
                {dict.title}
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
                {dict.subtitle}
              </p>
              <a
                href="mailto:hello@poltechnickx.com"
                className="btn-primary mt-10 inline-block rounded-full px-10 py-4 text-base font-semibold"
              >
                {dict.button}
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
