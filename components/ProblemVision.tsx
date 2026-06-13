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
          <h2 className="mt-6 text-balance text-4xl font-semibold leading-tight tracking-tightest sm:text-5xl md:text-6xl">
            {dict.title}
          </h2>
          <p className="mt-6 text-lg text-muted">{dict.subtitle}</p>
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {/* Cloud — the risk */}
          <Reveal>
            <div className="card-surface h-full rounded-3xl p-8 md:p-10">
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
            <div className="glow-border relative h-full overflow-hidden rounded-3xl p-8 md:p-10">
              <div
                className="card-surface absolute inset-0 -z-10 rounded-3xl"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-40 blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle, rgba(124,58,237,0.6), transparent 70%)",
                }}
                aria-hidden
              />
              <div className="mb-6 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-cyan/10 text-brand-cyan">
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
                    <span className="mt-1 text-brand-cyan">✓</span>
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
