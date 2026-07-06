import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { i18n, type Locale } from "@/i18n/config";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { SectionLabel } from "@/components/SectionLabel";
import { SavingsCalculator } from "@/components/SavingsCalculator";

export function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/calculator">): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);
  return { title: `${dict.calculator.title} — Leggera Labs` };
}

export default async function CalculatorPage({
  params,
}: PageProps<"/[lang]/calculator">) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);

  return (
    <>
      <Header lang={lang} nav={dict.nav} footer={dict.footer} />
      <main className="relative overflow-x-clip">
        <section className="relative px-6 pb-8 pt-40 md:pt-48">
          <Reveal className="mx-auto max-w-3xl text-center">
            <SectionLabel>{dict.calculator.label}</SectionLabel>
            <h1 className="mt-6 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
              {dict.calculator.title}
            </h1>
            <p className="mt-6 text-lg text-muted">{dict.calculator.subtitle}</p>
          </Reveal>
        </section>
        <SavingsCalculator
          dict={dict.calculator}
          formDict={dict.cta.form}
          lang={lang}
        />
      </main>
      <Footer lang={lang} dict={dict.footer} />
    </>
  );
}
