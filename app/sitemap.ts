import type { MetadataRoute } from "next";
import { i18n } from "@/i18n/config";
import { siteUrl } from "@/lib/site";
import { getAllSlugs } from "@/lib/blog";

// `/impressum` świadomie POZA sitemapą do czasu rejestracji działalności.
// Strona istnieje i renderuje się poprawnie, ale dane rejestrowe to wciąż
// placeholdery („[Pełna nazwa firmy]", „[NIP / ...]") — patrz COMPANY w
// app/[lang]/impressum/page.tsx. Linki w Header/Footer są z tego samego
// powodu zdjęte, ale sam wpis w sitemapie zapraszał Google do zaindeksowania
// strony z placeholderami (znalezione w audycie Modułu 29, 2026-07-17).
// Po rejestracji: dopisać z powrotem — patrz PO_REJESTRACJI.md pkt 1.
const routes = ["", "/privacy", "/blog"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const blogRoutes = getAllSlugs().map((slug) => `/blog/${slug}`);

  return [...routes, ...blogRoutes].flatMap((route) =>
    i18n.locales.map((lang) => ({
      url: `${siteUrl}/${lang}${route}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: route === "" ? 1 : 0.5,
      alternates: {
        languages: Object.fromEntries(
          i18n.locales.map((l) => [l, `${siteUrl}/${l}${route}`])
        ),
      },
    }))
  );
}
