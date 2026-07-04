import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { i18n, type Locale } from "@/i18n/config";
import { getAllSlugs, getPost } from "@/lib/blog";
import { siteUrl, ogLocale, getBookingUrl } from "@/lib/site";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";

export async function generateStaticParams() {
  const slugs = getAllSlugs();
  return i18n.locales.flatMap((lang) =>
    slugs.map((slug) => ({ lang, slug }))
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/blog/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const locale = lang as Locale;
  const post = await getPost(slug, locale);
  if (!post) return {};

  const languages = Object.fromEntries(
    i18n.locales.map((l) => [l, `/${l}/blog/${slug}`])
  ) as Record<string, string>;

  return {
    title: `${post.title} — Leggera Labs`,
    description: post.metaDescription,
    alternates: {
      canonical: `/${locale}/blog/${slug}`,
      languages: { ...languages, "x-default": `/${i18n.defaultLocale}/blog/${slug}` },
    },
    openGraph: {
      type: "article",
      siteName: "Leggera Labs",
      title: post.title,
      description: post.metaDescription,
      url: `/${locale}/blog/${slug}`,
      locale: ogLocale[locale],
      publishedTime: post.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.metaDescription,
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

export default async function BlogPostPage({
  params,
}: PageProps<"/[lang]/blog/[slug]">) {
  const { lang: rawLang, slug } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const post = await getPost(slug, lang);

  if (!post) notFound();

  const bookingUrl = getBookingUrl(lang);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription,
    datePublished: post.date,
    inLanguage: lang,
    author: { "@type": "Person", name: "Patryk Piecyk" },
    publisher: { "@type": "Organization", name: "Leggera Labs" },
    mainEntityOfPage: `${siteUrl}/${lang}/blog/${slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header lang={lang} nav={dict.nav} footer={dict.footer} />
      <main className="relative overflow-x-clip">
        <article className="relative mx-auto max-w-3xl px-6 pb-32 pt-40 md:pt-48">
          <div
            className="orb pointer-events-none fixed -top-40 left-1/2 -z-10 h-[40vw] w-[40vw] max-h-[500px] max-w-[500px] -translate-x-1/2 rounded-full opacity-30"
            aria-hidden
          />
          <Reveal>
            <Link
              href={`/${lang}/blog`}
              className="text-sm text-muted transition-colors hover:text-[var(--fg)]"
            >
              ← {dict.blog.back}
            </Link>
            <p className="mt-8 text-xs uppercase tracking-[0.15em] text-muted">
              {dict.blog.publishedOn} {formatDate(post.date, lang)} ·{" "}
              {post.readingTime} {dict.blog.minRead}
            </p>
            <h1 className="mt-4 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {post.title}
            </h1>
          </Reveal>

          <Reveal delay={0.08}>
            <div
              className="prose prose-lg mt-12 max-w-none text-[var(--fg)] prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-[var(--fg)] prose-p:text-muted prose-li:text-muted prose-a:text-liquid prose-a:no-underline prose-strong:text-[var(--fg)] prose-blockquote:border-l-brand-purple prose-blockquote:text-muted"
              dangerouslySetInnerHTML={{ __html: post.contentHtml }}
            />
          </Reveal>

          <Reveal delay={0.12} className="mt-16">
            <div className="glow-border relative overflow-hidden rounded-3xl">
              <div className="card-surface relative rounded-3xl px-8 py-10 text-center">
                <p className="text-lg font-medium">{dict.blog.ctaText}</p>
                <a
                  href={bookingUrl}
                  className="btn-primary mt-6 inline-block rounded-full px-6 py-3 text-sm font-semibold"
                  {...(bookingUrl.startsWith("http")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {dict.blog.ctaLink} →
                </a>
              </div>
            </div>
          </Reveal>
        </article>
      </main>
      <Footer lang={lang} dict={dict.footer} />
    </>
  );
}

export const dynamicParams = false;
