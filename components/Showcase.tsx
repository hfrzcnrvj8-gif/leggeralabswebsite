"use client";

import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import { MacWindow } from "./MacWindow";
import type { Dictionary } from "@/i18n/types";

export function Showcase({ dict }: { dict: Dictionary["showcase"] }) {
  return (
    <section id="showcase" className="relative px-6 py-32 md:py-40">
      <div className="mx-auto max-w-5xl">
        <Reveal className="max-w-3xl">
          <SectionLabel>{dict.label}</SectionLabel>
          <h2 className="mt-6 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            {dict.title}
          </h2>
          <p className="mt-6 text-lg text-muted">{dict.subtitle}</p>
        </Reveal>

        <div className="mt-20 flex flex-col gap-24 md:gap-32">
          {dict.items.map((item) => (
            <MacWindow key={item.title} title={item.title} caption={item.caption} />
          ))}
        </div>
      </div>
    </section>
  );
}
