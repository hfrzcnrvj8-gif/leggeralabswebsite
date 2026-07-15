import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Reveal } from "@/components/Reveal";
import { i18n, type Locale } from "@/i18n/config";
import { projectReviewAverage } from "@/lib/projects";

export const runtime = "nodejs";

type Dict = {
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyBody: string;
  ctaLabel: string;
  back: string;
};

const DICT: Record<Locale, Dict> = {
  pl: {
    title: "Referencje",
    subtitle: "Co mówią klienci, z którymi już pracowaliśmy.",
    emptyTitle: "Pierwsze referencje pojawią się tutaj wkrótce.",
    emptyBody:
      "Leggera Labs dopiero zaczyna — wybieramy naszych pierwszych partnerów założycieli. Bądź jednym z pierwszych klientów, z którego opinii będziemy dumni.",
    ctaLabel: "Zostań partnerem założycielem",
    back: "← Strona główna",
  },
  en: {
    title: "References",
    subtitle: "What clients we've already worked with have to say.",
    emptyTitle: "The first references will appear here soon.",
    emptyBody:
      "Leggera Labs is just getting started — we're choosing our first founding partners. Be one of the first clients whose feedback we'll be proud to show.",
    ctaLabel: "Become a founding partner",
    back: "← Home",
  },
  de: {
    title: "Referenzen",
    subtitle: "Was Kunden sagen, mit denen wir bereits zusammengearbeitet haben.",
    emptyTitle: "Die ersten Referenzen erscheinen hier in Kürze.",
    emptyBody:
      "Leggera Labs steht noch am Anfang — wir wählen unsere ersten Gründungspartner aus. Seien Sie einer der ersten Kunden, auf dessen Feedback wir stolz sein werden.",
    ctaLabel: "Gründungspartner werden",
    back: "← Startseite",
  },
};

type ReviewRow = {
  tytul: string;
  review_rating_jakosc: number | null;
  review_rating_terminowosc: number | null;
  review_rating_komunikacja: number | null;
  review_comment: string;
  review_consent_name: string | null;
  client_nazwa: string | null;
  branza: string | null;
};

/** Dociąga opinie przez własne /api/references (a nie bezpośrednio przez
 * lib/db.ts) — importowanie klienta Neona wprost w Server Component
 * (page.tsx) wywoływało błąd bundlowania w tym środowisku, dokumenty
 * (Oferta/Umowa/Opinia) i tak zawsze idą przez fetch do API route, więc to
 * spójne z resztą aplikacji, nie nowy wzorzec. */
async function getConsentedReviews(): Promise<ReviewRow[]> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const res = await fetch(`${protocol}://${host}/api/references`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { reviews: ReviewRow[] };
  return data.reviews;
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const t = DICT[(lang as Locale) in DICT ? (lang as Locale) : "pl"];
  return { title: `${t.title} — Leggera Labs` };
}

/** Publiczna strona referencji (Moduł 15, dodatek) — pokazuje wyłącznie
 * opinie zebrane PRZEZ świadomą zgodę klienta na case study
 * (review_consent_case_study), nigdy surowe oceny bez zgody. Świadomie
 * odczyt bezpośrednio z bazy w Server Component (dane publiczne,
 * nie-wrażliwe — bez pośredniego API route, wzorem prostych stron
 * informacyjnych jak /privacy), a nie przez fetch do własnego API jak
 * dokumenty (Oferta/Umowa/Opinia), które renderują się po stronie klienta. */
export default async function ReferencesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang: Locale = (i18n.locales as readonly string[]).includes(rawLang) ? (rawLang as Locale) : "pl";
  const t = DICT[lang];
  const reviews = await getConsentedReviews();

  return (
    <main className="relative mx-auto min-h-screen max-w-5xl px-6 py-28 md:py-36">
      <div
        className="orb pointer-events-none fixed -top-40 left-1/2 -z-10 h-[40vw] w-[40vw] max-h-[500px] max-w-[500px] -translate-x-1/2 rounded-full opacity-30"
        aria-hidden
      />
      <Reveal>
        <Link href={`/${lang}`} className="text-sm text-muted transition-colors hover:text-[var(--fg)]">
          {t.back}
        </Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-tightest sm:text-5xl">
          <span className="text-liquid">{t.title}</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">{t.subtitle}</p>
      </Reveal>

      {reviews.length === 0 ? (
        <Reveal delay={0.1}>
          <div className="card-paper mt-14 rounded-2xl border hairline p-8 text-center sm:p-12">
            <h2 className="text-xl font-semibold">{t.emptyTitle}</h2>
            <p className="mx-auto mt-3 max-w-md text-muted">{t.emptyBody}</p>
            <Link href={`/${lang}`} className="btn-primary mt-6 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold">
              {t.ctaLabel}
            </Link>
          </div>
        </Reveal>
      ) : (
        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {reviews.map((r, i) => {
            const avg = projectReviewAverage({
              review_rating_jakosc: r.review_rating_jakosc,
              review_rating_terminowosc: r.review_rating_terminowosc,
              review_rating_komunikacja: r.review_rating_komunikacja,
            });
            return (
              <Reveal key={i} delay={0.05 * (i % 6)}>
                <div className="card-paper h-full rounded-2xl border hairline p-6">
                  {avg != null && (
                    <div className="text-brand-gold text-sm">
                      {"★".repeat(Math.round(avg))}
                      <span className="text-muted">{"★".repeat(5 - Math.round(avg))}</span>
                    </div>
                  )}
                  {r.review_comment && <p className="mt-3 text-[15px] leading-relaxed text-[var(--fg)]">„{r.review_comment}"</p>}
                  <div className="mt-4 text-sm text-muted">
                    {r.review_consent_name && <span className="font-medium text-[var(--fg)]">{r.review_consent_name}</span>}
                    {r.client_nazwa && <span>{r.review_consent_name ? " — " : ""}{r.client_nazwa}</span>}
                    {r.branza && <span className="opacity-70"> · {r.branza}</span>}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      )}
    </main>
  );
}
