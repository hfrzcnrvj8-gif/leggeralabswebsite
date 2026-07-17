"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import type { Dictionary } from "@/i18n/types";

export function Hero({ dict }: { dict: Dictionary["hero"] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const orbY = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const container = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.14, delayChildren: 0.2 } },
  };
  const item = {
    hidden: { opacity: 0, y: 36, filter: "blur(8px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.9,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      },
    },
  };

  return (
    <section
      ref={ref}
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-6 pt-28 pb-12 md:pt-24"
    >
      {/* Liquid glass orbs */}
      <motion.div
        style={{ y: orbY }}
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
      >
        <div className="orb absolute left-1/2 top-1/3 h-[55vw] w-[55vw] max-h-[700px] max-w-[700px] -translate-x-1/2 -translate-y-1/2 animate-orb-float rounded-full" />
        <div
          className="orb absolute right-[12%] top-[60%] h-[28vw] w-[28vw] max-h-[360px] max-w-[360px] animate-orb-float rounded-full"
          style={{ animationDelay: "-8s" }}
        />
      </motion.div>

      {/* subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.25]"
        style={{
          backgroundImage:
            "linear-gradient(var(--hairline) 1px, transparent 1px), linear-gradient(90deg, var(--hairline) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)",
        }}
        aria-hidden
      />

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        variants={container}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-5xl text-center"
      >
        <h1 className="text-balance font-serif text-5xl font-semibold leading-[0.95] tracking-tight sm:text-7xl md:text-8xl">
          {dict.titleLines.map((line, i) => (
            <motion.span key={i} variants={item} className="block">
              {i === dict.titleLines.length - 1 ? (
                <span className="text-liquid">{line}</span>
              ) : (
                line
              )}
            </motion.span>
          ))}
        </h1>

        <motion.p
          variants={item}
          className="mx-auto mt-8 max-w-2xl text-pretty text-lg text-muted sm:text-xl"
        >
          {dict.subtitle}
        </motion.p>

        <motion.div
          variants={item}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <a
            href="#contact"
            className="btn-cta w-full rounded-full px-8 py-3.5 text-base font-semibold sm:w-auto"
          >
            {dict.ctaPrimary}
          </a>
          <a
            href="#vision"
            className="glass w-full rounded-full px-8 py-3.5 text-base font-medium transition-transform hover:scale-[1.02] sm:w-auto"
          >
            {dict.ctaSecondary}
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
