import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import type { Dictionary } from "@/i18n/types";

// Only "local-llm.py" (index 2) has real footage so far — shown full-bleed
// as an ambient, looping background instead of a small windowed carousel.
// Bring back a multi-item carousel once the other two have footage too.
const VIDEO_SRC = "/videos/local-llm-demo.mp4";

export function Showcase({ dict }: { dict: Dictionary["showcase"] }) {
  const item = dict.items[2];

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
              src={VIDEO_SRC}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-cover"
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent"
              aria-hidden
            />
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 text-center text-sm text-white/80">
              {item.caption}
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
