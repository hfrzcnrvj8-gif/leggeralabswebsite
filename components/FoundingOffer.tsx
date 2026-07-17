"use client";

import { motion } from "framer-motion";
import { Reveal, stagger, staggerItem } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import type { Dictionary } from "@/i18n/types";

export function FoundingOffer({ dict }: { dict: Dictionary["founding"] }) {
  return (
    <section id="founding" className="relative px-6 py-20 md:py-28">
      <Reveal className="mx-auto max-w-5xl">
        <div className="glow-border relative overflow-hidden rounded-[2rem]">
          <div className="card-surface relative grid gap-10 rounded-[2rem] p-8 md:grid-cols-2 md:p-14">
            <div
              className="orb pointer-events-none absolute -left-24 top-1/2 h-80 w-80 -translate-y-1/2 animate-orb-float rounded-full opacity-40"
              aria-hidden
            />
            <div className="relative">
              <SectionLabel>{dict.label}</SectionLabel>
              <h2 className="mt-6 text-balance font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                {dict.title}
              </h2>
              <p className="mt-6 text-muted">{dict.description}</p>
              <a
                href="#contact"
                className="btn-cta mt-8 inline-block rounded-full px-7 py-3 text-sm font-semibold"
              >
                {dict.cta}
              </a>
            </div>

            <motion.ul
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              className="relative flex flex-col justify-center gap-4"
            >
              {dict.points.map((point) => (
                <motion.li
                  key={point}
                  variants={staggerItem}
                  className="glass flex items-start gap-3 rounded-2xl px-5 py-4"
                >
                  <span className="mt-0.5 text-brand-gold">✓</span>
                  <span className="text-sm sm:text-base">{point}</span>
                </motion.li>
              ))}
            </motion.ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
