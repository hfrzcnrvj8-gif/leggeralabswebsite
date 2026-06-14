import type { MetadataRoute } from "next";
import { i18n } from "@/i18n/config";
import { siteUrl } from "@/lib/site";

const routes = ["", "/privacy", "/impressum"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return routes.flatMap((route) =>
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
