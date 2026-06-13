import "server-only";
import type { Locale } from "./config";

const dictionaries = {
  pl: () => import("./dictionaries/pl.json").then((m) => m.default),
  en: () => import("./dictionaries/en.json").then((m) => m.default),
  de: () => import("./dictionaries/de.json").then((m) => m.default),
};

export const getDictionary = async (locale: Locale) =>
  (dictionaries[locale] ?? dictionaries.pl)();

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;
