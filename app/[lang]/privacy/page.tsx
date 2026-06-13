import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { i18n, type Locale } from "@/i18n/config";
import { Reveal } from "@/components/Reveal";

export async function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: { lang: Locale };
}): Promise<Metadata> {
  const dict = await getDictionary(params.lang);
  return { title: `${dict.privacy.title} — poltechnickx` };
}

export default async function PrivacyPage({
  params,
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(params.lang);
  const p = dict.privacy;

  return (
    <main className="relative mx-auto min-h-screen max-w-3xl px-6 py-28 md:py-36">
      <div
        className="orb pointer-events-none fixed -top-40 left-1/2 -z-10 h-[40vw] w-[40vw] max-h-[500px] max-w-[500px] -translate-x-1/2 rounded-full opacity-30"
        aria-hidden
      />
      <Reveal>
        <Link
          href={`/${params.lang}`}
          className="text-sm text-muted transition-colors hover:text-[var(--fg)]"
        >
          ← {p.back}
        </Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-tightest sm:text-5xl">
          <span className="text-liquid">{p.title}</span>
        </h1>
        <p className="mt-3 text-sm text-muted">{p.updated}</p>
        <p className="mt-8 text-pretty leading-relaxed text-muted">{p.intro}</p>
      </Reveal>

      <div className="mt-12 space-y-10">
        {p.sections.map((s, i) => (
          <Reveal key={s.heading} delay={i * 0.04}>
            <section>
              <h2 className="text-xl font-semibold tracking-tight">
                {s.heading}
              </h2>
              <p className="mt-3 leading-relaxed text-muted">{s.body}</p>
            </section>
          </Reveal>
        ))}
      </div>
    </main>
  );
}
