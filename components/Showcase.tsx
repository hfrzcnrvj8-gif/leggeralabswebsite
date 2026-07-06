"use client";

import { useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import { MacWindow } from "./MacWindow";
import type { Dictionary } from "@/i18n/types";

// Real footage wired to the "local-llm.py" tab (index 2) only — the other
// two tabs don't have footage yet and keep the plain placeholder.
const VIDEO_SOURCES: Record<number, string> = {
  2: "/videos/local-llm-demo.mp4",
};

export function Showcase({ dict }: { dict: Dictionary["showcase"] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const width = useTransform(scrollYProgress, [0, 0.25], ["55vw", "94vw"]);

  const items = dict.items;
  const go = (delta: number) => {
    setPlaying(false);
    setIndex((index + delta + items.length) % items.length);
  };
  const selectIndex = (i: number) => {
    setPlaying(false);
    setIndex(i);
  };

  const videoSrc = VIDEO_SOURCES[index];

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
            caption={videoSrc ? undefined : items[index].caption}
            onSwipe={playing ? undefined : go}
          >
            {videoSrc &&
              (playing ? (
                <video
                  src={videoSrc}
                  controls
                  autoPlay
                  playsInline
                  className="h-full w-full object-contain"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  aria-label={items[index].caption}
                  className="pointer-events-auto flex h-full w-full flex-col items-center justify-center gap-3 text-center"
                >
                  <span className="glass grid h-14 w-14 place-items-center rounded-full text-xl transition-transform duration-300 hover:scale-105">
                    ▶
                  </span>
                  <p className="px-6 text-sm text-muted">{items[index].caption}</p>
                </button>
              ))}
          </MacWindow>

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
                  onClick={() => selectIndex(i)}
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
