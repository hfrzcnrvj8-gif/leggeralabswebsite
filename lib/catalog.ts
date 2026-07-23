/** Moduł 47 — „wirtualny magazyn": biblioteka komponentów (sprzęt + software +
 * robocizna + serwis), z których właściciel składa ofertę wdrożenia lokalnego
 * LLM per klient. To NIE magazyn ze stanami — to cennik-klocki z widełkami.
 *
 * Czysta logika (bez Reacta): słownik kategorii, etykiety, helpery marży i
 * widełek. Mapa „kategoria → ikona" mieszka osobno w admin/icons.tsx (reguła
 * ikon z CLAUDE.md — ikony to Tabler, a lib/ jest w 100% .ts bez JSX).
 *
 * Typ `CatalogItem` zostaje w lib/invoices.ts (tam był i tam używa go picker
 * faktur) — tutaj tylko domena katalogu. */

/** Klucze kategorii zapisywane w kolumnie `service_catalog.kategoria`.
 * Kolejność = kolejność wyświetlania (od „mózgu" wdrożenia po serwis). */
export const CATALOG_CATEGORIES = [
  "compute",
  "gpu",
  "storage",
  "siec",
  "zasilanie",
  "software",
  "robocizna",
  "serwis",
  "inne",
] as const;

export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export const DEFAULT_CATALOG_CATEGORY: CatalogCategory = "inne";

/** Etykiety PL do UI. Trzymane blisko klucza, żeby filtr i modal mówiły
 * jednym głosem. */
export const CATALOG_CATEGORY_LABELS: Record<CatalogCategory, string> = {
  compute: "Komputer / serwer",
  gpu: "Karta GPU",
  storage: "Dyski / NAS",
  siec: "Sieć",
  zasilanie: "Zasilanie (UPS)",
  software: "Software / licencje",
  robocizna: "Robocizna / wdrożenie",
  serwis: "Serwis / utrzymanie",
  inne: "Inne",
};

/** Zawęża dowolny string do prawidłowego klucza kategorii (fallback = 'inne').
 * Używane po stronie serwera (walidacja) i przy normalizacji wiersza. */
export function normalizeCategory(value: unknown): CatalogCategory {
  return (CATALOG_CATEGORIES as readonly string[]).includes(String(value))
    ? (value as CatalogCategory)
    : DEFAULT_CATALOG_CATEGORY;
}

export function catalogCategoryLabel(value: unknown): string {
  return CATALOG_CATEGORY_LABELS[normalizeCategory(value)];
}

/** Marża kwotowa = cena bazowa − koszt zakupu. `null`, gdy koszt nieznany
 * (nie mylić z zerową marżą). */
export function catalogMargin(cena_netto: number, koszt_zakupu: number | null): number | null {
  if (koszt_zakupu == null || !Number.isFinite(koszt_zakupu)) return null;
  return cena_netto - koszt_zakupu;
}

/** Marża procentowa liczona OD CENY SPRZEDAŻY (ile z ceny jest zyskiem) —
 * jak w handlu, nie narzut od kosztu. `null`, gdy koszt nieznany lub cena 0. */
export function catalogMarginPercent(cena_netto: number, koszt_zakupu: number | null): number | null {
  const m = catalogMargin(cena_netto, koszt_zakupu);
  if (m == null || cena_netto <= 0) return null;
  return (m / cena_netto) * 100;
}

/** Czy pozycja ma sensowne widełki (obie granice podane i min ≤ max). */
export function hasPriceRange(cena_min: number | null, cena_max: number | null): boolean {
  return (
    cena_min != null &&
    cena_max != null &&
    Number.isFinite(cena_min) &&
    Number.isFinite(cena_max) &&
    cena_min <= cena_max
  );
}
