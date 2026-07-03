import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { i18n, type Locale } from "@/i18n/config";
import { getAllPosts } from "@/lib/blog";
import { ogLocale } from "@/lib/site";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { SectionLabel } from "@/components/SectionLabel";

export async function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/blog">): Promise<Metadata> {
  const { lang } = await params;
  const locale = lang as Locale;
  const dict = await getDictionary(locale);

  const languages = Object.fromEntries(
    i18n.locales.map((l) => [l, `/${l}/blog`])
  ) as Record<string, string>;

  return {
    title: dict.blog.meta.title,
    description: dict.blog.meta.description,
    alternates: {
      canonical: `/${locale}/blog`,
      languages: { ...languages, "x-default": `/${i18n.defaultLocale}/blog` },
    },
    openGraph: {
      type: "website",
      siteName: "Leggera Labs",
      title: dict.blog.meta.title,
      description: dict.blog.meta.description,
      url: `/${locale}/blog`,
      locale: ogLocale[locale],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.blog.meta.title,
      description: dict.blog.meta.description,
    },
  };
}

function formatDate(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export default async function BlogIndexPage({
  params,
}: PageProps<"/[lang]/blog">) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const posts = getAllPosts(lang);

  return (
    <>
      <Header lang={lang} nav={dict.nav} footer={dict.footer} />
      <main className="relative overflow-x-clip">
        <section className="relative px-6 pb-24 pt-40 md:pb-32 md:pt-48">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-3xl">
              <SectionLabel>{dict.blog.label}</SectionLabel>
              <h1 className="mt-6 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
                {dict.blog.title}
              </h1>
              <p className="mt-6 text-lg text-muted">{dict.blog.subtitle}</p>
            </Reveal>

            {posts.length === 0 ? (
              <Reveal delay={0.1} className="mt-16">
                <p className="text-muted">{dict.blog.empty}</p>
              </Reveal>
            ) : (
              <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post, i) => (
                  <Reveal key={post.slug} delay={(i % 3) * 0.08}>
                    <Link
                      href={`/${lang}/blog/${post.slug}`}
                      className="card-paper group flex h-full flex-col rounded-3xl p-8 transition-colors hover:border-brand-purple/40"
                    >
                      <p className="text-xs uppercase tracking-[0.15em] text-muted">
                        {formatDate(post.date, lang)} · {post.readingTime}{" "}
                        {dict.blog.minRead}
                      </p>
                      <h2 className="mt-4 text-xl font-semibold leading-snug tracking-tight">
                        {post.title}
                      </h2>
                      <p className="mt-3 flex-1 text-sm text-muted">
                        {post.excerpt ?? post.metaDescription}
                      </p>
                      <p className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-liquid">
                        {dict.blog.readMore} →
                      </p>
                    </Link>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer lang={lang} dict={dict.footer} />
    </>
  );
}


export const dynamicParams = false;
