import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { ProblemVision } from "@/components/ProblemVision";
import { Services } from "@/components/Services";
import { UseCases } from "@/components/UseCases";
import { Approach } from "@/components/Approach";
import { Founder } from "@/components/Founder";
import { Showcase } from "@/components/Showcase";
import { Faq } from "@/components/Faq";
import { FoundingOffer } from "@/components/FoundingOffer";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";
import { StructuredData } from "@/components/StructuredData";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);

  return (
    <>
      <StructuredData lang={lang} dict={dict} />
      <Header lang={lang} dict={dict.nav} />
      <main className="relative overflow-x-clip">
        <Hero dict={dict.hero} />
        <ProblemVision dict={dict.problem} />
        <Services dict={dict.services} />
        <UseCases dict={dict.useCases} />
        <Approach dict={dict.approach} />
        <Founder dict={dict.founder} />
        <Showcase dict={dict.showcase} />
        <Faq dict={dict.faq} />
        <FoundingOffer dict={dict.founding} />
        <CTA dict={dict.cta} lang={lang} />
      </main>
      <Footer lang={lang} dict={dict.footer} />
    </>
  );
}
