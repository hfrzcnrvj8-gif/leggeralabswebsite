"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import type { Dictionary } from "@/i18n/types";

export function Faq({ dict }: { dict: Dictionary["faq"] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative px-6 py-32 md:py-40">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <SectionLabel>{dict.label}</SectionLabel>
          <h2 className="mt-6 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {dict.title}
          </h2>
        </Reveal>

        <div className="mt-12 space-y-3">
          {dict.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} delay={i * 0.04}>
                <div className="card-paper overflow-hidden rounded-2xl">
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className="text-base font-medium sm:text-lg">
                      {item.q}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-lg text-muted"
                    >
                      +
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <p className="px-6 pb-6 leading-relaxed text-muted">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
