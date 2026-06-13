import type en from "./dictionaries/en.json";

// The English dictionary is the canonical shape; all locales conform to it.
export type Dictionary = typeof en;
