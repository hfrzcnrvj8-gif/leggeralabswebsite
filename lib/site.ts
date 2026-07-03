import type { Locale } from "@/i18n/config";

// Canonical production URL. Override per-environment with NEXT_PUBLIC_SITE_URL
// (e.g. on the host) so sitemap, robots and canonical/OG tags point at the
// real domain. Falls back to the production domain.
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://leggeralabs.pl"
).replace(/\/$/, "");

// Booking link for the "book a call" CTAs. Set NEXT_PUBLIC_BOOKING_URL to your
// Calendly / Cal.com link; falls back to scrolling to the contact form.
export const bookingUrl =
  process.env.NEXT_PUBLIC_BOOKING_URL ?? "#contact";

// LinkedIn company/profile URL. Set NEXT_PUBLIC_LINKEDIN_URL once the account
// exists; the link is hidden everywhere until then.
export const linkedinUrl = process.env.NEXT_PUBLIC_LINKEDIN_URL ?? "";

// Maps our locale codes to Open Graph locale identifiers.
export const ogLocale: Record<Locale, string> = {
  pl: "pl_PL",
  en: "en_US",
  de: "de_DE",
};
