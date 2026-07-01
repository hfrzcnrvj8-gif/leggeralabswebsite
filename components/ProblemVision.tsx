"use client";

import { motion } from "framer-motion";
import { Reveal, stagger, staggerItem } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import type { Dictionary } from "@/i18n/types";

export function ProblemVision({ dict }: { dict: Dictionary["problem"] }) {
  return (
    <section id="vision" className="relative px-6 py-32 md:py-40">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-3xl">
          <SectionLabel>{dict.label}</SectionLabel>
          <h2 className="mt-6 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            {dict.title}
          </h2>
          <p className="mt-6 text-lg text-muted">{dict.subtitle}</p>
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {/* Cloud — the risk */}
          <Reveal>
            <div className="card-paper h-full rounded-3xl p-8 md:p-10">
              <div className="mb-6 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-500/10 text-red-400">
                  ⚠
                </span>
                <h3 className="text-xl font-semibold">{dict.cloud.title}</h3>
              </div>
              <motion.ul
                variants={stagger}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                className="space-y-4"
              >
                {dict.cloud.points.map((p) => (
                  <motion.li
                    key={p}
                    variants={staggerItem}
                    className="flex items-start gap-3 text-muted"
                  >
                    <span className="mt-1 text-red-400/70">✕</span>
                    <span>{p}</span>
                  </motion.li>
                ))}
              </motion.ul>
            </div>
          </Reveal>

          {/* Local — the vision */}
          <Reveal delay={0.1}>
            <div className="card-paper relative h-full overflow-hidden rounded-3xl p-8 md:p-10">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-purple via-brand-pink to-brand-gold"
                aria-hidden
              />
              <div className="mb-6 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gold/10 text-brand-gold">
                  ◇
                </span>
                <h3 className="text-xl font-semibold">{dict.local.title}</h3>
              </div>
              <motion.ul
                variants={stagger}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                className="space-y-4"
              >
                {dict.local.points.map((p) => (
                  <motion.li
                    key={p}
                    variants={staggerItem}
                    className="flex items-start gap-3"
                  >
                    <span className="mt-1 text-brand-gold">✓</span>
                    <span>{p}</span>
                  </motion.li>
                ))}
              </motion.ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
