"use client";

import { useRef, useState } from "react";
import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import type { Dictionary } from "@/i18n/types";

// Only "local-llm.py" (index 2) has real footage so far — shown full-bleed
// as an ambient, looping background instead of a small windowed carousel.
// Bring back a multi-item carousel once the other two have footage too.
const VIDEO_SRC = "/videos/local-llm-demo.mp4";

export function Showcase({ dict }: { dict: Dictionary["showcase"] }) {
  const item = dict.items[2];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPaused(false);
    } else {
      video.pause();
      setIsPaused(true);
    }
  }

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

      <Reveal delay={0.1}>
        <div className="relative left-1/2 right-1/2 mt-16 w-screen -mx-[50vw]">
          <div className="relative aspect-video w-full overflow-hidden bg-black">
            <video
              ref={videoRef}
              src={VIDEO_SRC}
              autoPlay
              muted
              loop
              playsInline
              aria-label={item.caption}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={toggle}
              aria-label={isPaused ? dict.play : dict.pause}
              className="glass absolute bottom-4 right-4 grid h-10 w-10 place-items-center rounded-full text-brand-gold opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 sm:bottom-6 sm:right-6"
            >
              {isPaused ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                  <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
