"use client";

import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import { MacWindow } from "./MacWindow";
import type { Dictionary } from "@/i18n/types";

export function Showcase({ dict }: { dict: Dictionary["showcase"] }) {
  return (
    <section id="showcase" className="relative px-6 py-32 md:py-40">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-3xl">
          <SectionLabel>{dict.label}</SectionLabel>
          <h2 className="mt-6 text-balance text-4xl font-semibold leading-tight tracking-tightest sm:text-5xl md:text-6xl">
            {dict.title}
          </h2>
          <p className="mt-6 text-lg text-muted">{dict.subtitle}</p>
        </Reveal>

        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          {dict.items.map((item, i) => (
            <Reveal
              key={item.title}
              delay={i * 0.08}
              className={i === 0 ? "lg:col-span-2" : ""}
            >
              <MacWindow title={item.title} caption={item.caption} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
