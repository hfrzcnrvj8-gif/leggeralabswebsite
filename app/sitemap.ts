import type { MetadataRoute } from "next";
import { i18n } from "@/i18n/config";
import { siteUrl } from "@/lib/site";
import { getAllSlugs } from "@/lib/blog";

const routes = ["", "/privacy", "/impressum", "/blog"];

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
