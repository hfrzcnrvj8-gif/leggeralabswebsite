import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { ProblemVision } from "@/components/ProblemVision";
import { Services } from "@/components/Services";
import { Showcase } from "@/components/Showcase";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);

  return (
    <>
      <Header lang={lang} dict={dict.nav} />
      <main className="relative overflow-x-clip">
        <Hero dict={dict.hero} />
        <ProblemVision dict={dict.problem} />
        <Services dict={dict.services} />
        <Showcase dict={dict.showcase} />
        <CTA dict={dict.cta} />
      </main>
      <Footer lang={lang} dict={dict.footer} />
    </>
  );
}
