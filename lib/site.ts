import type { Locale } from "@/i18n/config";

// Canonical production URL. Override per-environment with NEXT_PUBLIC_SITE_URL
// (e.g. on the host) so sitemap, robots and canonical/OG tags point at the
// real domain. Falls back to the production domain.
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://poltechnickx.com"
).replace(/\/$/, "");

// Maps our locale codes to Open Graph locale identifiers.
export const ogLocale: Record<Locale, string> = {
  pl: "pl_PL",
  en: "en_US",
  de: "de_DE",
};
