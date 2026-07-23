"use client";

/** Katalog / „wirtualny magazyn" (Moduł 47) — kliencki re-export czystej
 * logiki z `lib/catalog.ts` (słownik kategorii, marża, widełki) plus mały
 * komponent UI `KategoriaTag`. Wzorzec `shared.tsx` z CLAUDE.md.
 *
 * `CatalogItem` mieszka w `lib/invoices.ts` (tam go używa picker faktur) —
 * re-eksportujemy stąd, żeby ekran katalogu miał jeden import. */

export {
  CATALOG_CATEGORIES,
  CATALOG_CATEGORY_LABELS,
  DEFAULT_CATALOG_CATEGORY,
  catalogCategoryLabel,
  normalizeCategory,
  catalogMargin,
  catalogMarginPercent,
  hasPriceRange,
  type CatalogCategory,
} from "@/lib/catalog";
export { formatMoney, type CatalogItem } from "@/lib/invoices";

import { CatalogCategoryIcon } from "../icons";
import { catalogCategoryLabel } from "@/lib/catalog";

/** Pigułka kategorii — ikona Tablera + etykieta PL. Neutralna kolorystycznie
 * (znaczenie niesie kategoria, nie barwa) — zgodnie ze słownikiem koloru
 * panelu, kolory rezerwujemy dla statusów/zdrowia, nie dla typów. */
export function KategoriaTag({ kategoria }: { kategoria: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border hairline px-2 py-0.5 text-[11px] text-muted">
      <CatalogCategoryIcon kind={kategoria} size={12} />
      {catalogCategoryLabel(kategoria)}
    </span>
  );
}
