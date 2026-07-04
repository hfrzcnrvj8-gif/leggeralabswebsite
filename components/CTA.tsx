"use client";

import { Reveal } from "./Reveal";
import { ContactForm } from "./ContactForm";
import { getBookingUrl } from "@/lib/site";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";

export function CTA({
  dict,
  lang,
}: {
  dict: Dictionary["cta"];
  lang: Locale;
}) {
  const bookingUrl = getBookingUrl(lang);
  return (
    <section id="contact" className="relative px-6 py-32 md:py-44">
      <Reveal className="mx-auto max-w-4xl">
        <div className="glow-border relative overflow-hidden rounded-[2.5rem]">
          <div className="card-surface relative rounded-[2.5rem] px-8 py-20 text-center md:px-16">
            <div
              className="orb pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[60%] -translate-x-1/2 -translate-y-1/2 animate-orb-float rounded-full"
              aria-hidden
            />
            <div className="relative">
              <h2 className="text-balance font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
                {dict.title}
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
                {dict.subtitle}
              </p>
              <p className="mt-5 text-sm text-muted">
                {dict.bookingText}{" "}
                <a
                  href={bookingUrl}
                  className="text-liquid font-medium underline-offset-2 hover:underline"
                  {...(bookingUrl.startsWith("http")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {dict.bookingCta} →
                </a>
              </p>
              <div className="mx-auto mt-12 max-w-xl">
                <ContactForm dict={dict.form} lang={lang} />
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
