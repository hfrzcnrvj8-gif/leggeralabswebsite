"use client";

import { motion } from "framer-motion";
import { Reveal, stagger, staggerItem } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import type { Dictionary } from "@/i18n/types";

export function Approach({ dict }: { dict: Dictionary["approach"] }) {
  return (
    <section id="approach" className="relative px-6 py-32 md:py-40">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-3xl">
          <SectionLabel>{dict.label}</SectionLabel>
          <h2 className="mt-6 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            {dict.title}
          </h2>
          <p className="mt-6 text-lg text-muted">{dict.subtitle}</p>
        </Reveal>

        <motion.ol
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          {dict.steps.map((step, i) => (
            <motion.li
              key={step.step}
              variants={staggerItem}
              className="relative"
            >
              <div className="card-paper h-full rounded-3xl p-7">
                <div className="flex items-baseline gap-3">
                  <span className="text-liquid text-4xl font-semibold tracking-tightest">
                    {step.step}
                  </span>
                  {i < dict.steps.length - 1 && (
                    <span className="hidden h-px flex-1 bg-gradient-to-r from-brand-purple/50 to-transparent lg:block" />
                  )}
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {step.description}
                </p>
              </div>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
