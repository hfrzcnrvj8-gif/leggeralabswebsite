"use client";

import { useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import { MacWindow } from "./MacWindow";
import type { Dictionary } from "@/i18n/types";

export function Showcase({ dict }: { dict: Dictionary["showcase"] }) {
  const [index, setIndex] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const width = useTransform(scrollYProgress, [0, 0.25], ["55vw", "94vw"]);

  const items = dict.items;
  const go = (delta: number) =>
    setIndex((index + delta + items.length) % items.length);

  return (
    <section id="showcase" className="relative py-32 md:py-40">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal className="max-w-3xl">
          <SectionLabel>{dict.label}</SectionLabel>
          <h2 className="mt-6 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            {dict.title}
          </h2>
          <p className="mt-6 text-lg text-muted">{dict.subtitle}</p>
        </Reveal>
      </div>

      <div ref={sectionRef} className="mt-20 flex justify-center px-6">
        <motion.div style={{ width, minWidth: 280, maxWidth: "100%" }}>
          <MacWindow
            title={items[index].title}
            caption={items[index].caption}
            onSwipe={go}
          />

          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={() => go(-1)}
              aria-label="Poprzednie"
              className="glass grid h-9 w-9 place-items-center rounded-full transition-transform hover:scale-105"
            >
              ←
            </button>
            <div className="flex items-center gap-2.5">
              {items.map((item, i) => (
                <button
                  key={item.title}
                  onClick={() => setIndex(i)}
                  aria-label={item.title}
                  className="h-2.5 w-2.5 rounded-full border-2 transition-colors duration-300"
                  style={{
                    borderColor: "var(--fg)",
                    background: i === index ? "var(--fg)" : "transparent",
                  }}
                />
              ))}
            </div>
            <button
              onClick={() => go(1)}
              aria-label="Następne"
              className="glass grid h-9 w-9 place-items-center rounded-full transition-transform hover:scale-105"
            >
              →
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
