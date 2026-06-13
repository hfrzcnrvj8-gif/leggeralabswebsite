export const i18n = {
  defaultLocale: "pl",
  locales: ["pl", "en", "de"],
} as const;

export type Locale = (typeof i18n)["locales"][number];

export const localeNames: Record<Locale, string> = {
  pl: "Polski",
  en: "English",
  de: "Deutsch",
};
