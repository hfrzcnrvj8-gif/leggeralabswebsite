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

import { zeSlownika, VAT_RATES, type VatRate } from "./invoices";
import { WALUTY, DOMYSLNA_WALUTA, isWaluta, type Waluta } from "./waluty";

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

/**
 * Wiersz z bazy → `CatalogItem`, z ODPORNOŚCIĄ PO STRONIE ODCZYTU.
 *
 * Bramka zapisu (niżej) nie naprawia danych, które są w bazie od wcześniej,
 * a do produkcyjnej bazy nie ma dostępu z panelu — więc to, co już tam siedzi,
 * musi dać się bezpiecznie pokazać. Kluczowa jest waluta: `formatMoney` na
 * nieznanym kodzie waluty RZUCA (`RangeError`), a rzucający formater wywala
 * cały ekran w error boundary, nie jeden wiersz. Nieznaną walutę czytamy więc
 * jako PLN — bo dokładnie to znaczyły wszystkie wiersze sprzed Modułu 62.
 * Liczba nie do sparsowania (`NaN`) czyta się jako `null`, czyli „nie podano",
 * a nie jako zero.
 */
export function normalizeCatalogRow(r: Record<string, unknown>): {
  id: string;
  nazwa: string;
  cena_netto: number;
  waluta: Waluta;
  vat_stawka: VatRate;
  jednostka: string;
  kategoria: CatalogCategory;
  cena_min: number | null;
  cena_max: number | null;
  koszt_zakupu: number | null;
  dostawca: string;
  opis: string;
  created_at: string;
} {
  const opcjonalna = (v: unknown): number | null => {
    if (v === "" || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const cena = Number(r.cena_netto ?? 0);
  return {
    id: String(r.id),
    nazwa: String(r.nazwa ?? ""),
    cena_netto: Number.isFinite(cena) ? cena : 0,
    waluta: isWaluta(r.waluta) ? (String(r.waluta).trim() as Waluta) : DOMYSLNA_WALUTA,
    vat_stawka: zeSlownika(VAT_RATES, r.vat_stawka) ?? "23",
    jednostka: String(r.jednostka ?? "szt."),
    kategoria: normalizeCategory(r.kategoria),
    cena_min: opcjonalna(r.cena_min),
    cena_max: opcjonalna(r.cena_max),
    koszt_zakupu: opcjonalna(r.koszt_zakupu),
    dostawca: String(r.dostawca ?? ""),
    opis: String(r.opis ?? ""),
    created_at: String(r.created_at ?? ""),
  };
}

/* ───────────────────────── BRAMKA ZAPISU (Moduł 62) ─────────────────────────
 *
 * Do 2026-08-01 obie trasy katalogu robiły dokładnie to, co Faktury przed
 * swoim audytem: brały śmieć, podmieniały go na wartość domyślną i
 * odpowiadały `{"ok":true}`. Zmierzone sondą:
 *
 *   POST {"kategoria":"hopla","vat_stawka":"999","koszt_zakupu":-99,
 *         "cena_min":9000,"cena_max":100}          →  200
 *   GET  tej samej pozycji                          →  kategoria "inne",
 *                                                      vat "23", koszt −99,
 *                                                      widełki 9000–100
 *
 * Trzy z tych czterech błędów są niewidoczne w interfejsie: kategoria i VAT
 * wyglądają na wybrane świadomie, a odwrotne widełki UI po prostu UKRYWA
 * (`hasPriceRange` zwraca `false`), więc zła dana siedzi w bazie bez żadnego
 * objawu. Dlatego bramka stoi w TRASIE, nie w formularzu.
 */

/** Sufit kwoty w katalogu. Nie jest to limit biznesowy, tylko bariera
 * absurdu: `POST {"cena_netto":1e30}` przechodził i malował w wierszu listy
 * 31-cyfrową liczbę, rozpychając ekran. Sto milionów netto za jedną sztukę
 * z naddatkiem starcza na każdy komponent, jaki tu wejdzie. */
export const MAX_KWOTA_KATALOGU = 100_000_000;

/** Ujemna CENA jest dozwolona świadomie (decyzja właściciela 2026-08-01):
 * rabat wystawia się jako osobną pozycję dokumentu, a taka pozycja ma kwotę
 * ujemną — pozycja „Rabat za referencję" musi dać się trzymać w katalogu.
 * Ujemny KOSZT ZAKUPU nie znaczy nic i jest odrzucany. */
export type PolaKatalogu = {
  nazwa: string;
  kategoria: CatalogCategory;
  waluta: Waluta;
  vat_stawka: VatRate;
  jednostka: string;
  cena_netto: number;
  cena_min: number | null;
  cena_max: number | null;
  koszt_zakupu: number | null;
  dostawca: string;
  opis: string;
};

type WynikPol = { pola: PolaKatalogu; blad?: undefined } | { pola?: undefined; blad: string };

/** Liczba opcjonalna: pusto → `null` („nie podano" ≠ zero). Śmieć → błąd,
 * NIE cicha zamiana na `null`. */
function liczba(v: unknown, etykieta: string, { ujemnaOk }: { ujemnaOk: boolean }): number | null | string {
  if (v === "" || v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", ".").trim());
  if (!Number.isFinite(n)) return `${etykieta}: „${String(v).slice(0, 30)}" to nie jest liczba.`;
  // „liczbą ujemną", nie „ujemna" — etykiety mają różne rodzaje gramatyczne
  // („Cena", „Koszt zakupu"), a komunikat ma się czytać jak zdanie.
  if (!ujemnaOk && n < 0) return `${etykieta} nie może być liczbą ujemną.`;
  if (Math.abs(n) > MAX_KWOTA_KATALOGU) return `${etykieta} przekracza rozsądny sufit (100 mln).`;
  return n;
}

/**
 * Czyta i WALIDUJE pola pozycji katalogu — jedno miejsce dla `POST` i `PATCH`.
 *
 * `istniejaca` (tylko przy `PATCH`) daje prawdziwą semantykę częściowej
 * aktualizacji: **klucza nie ma w ciele → pole zostaje takie, jakie było**.
 * Wcześniej `PATCH` zachowywał się jak `PUT` i po cichu KASOWAŁ wszystko, czego
 * nie przysłano (zmierzone: `PATCH {"nazwa":"…","cena_netto":…}` wyzerował
 * widełki, koszt zakupu i jednostkę). Przy dokładaniu kolumny `waluta` to
 * przestaje być teoretyczne: starsza wersja apki, która o walucie nie wie,
 * cofałaby każdą pozycję do PLN przy każdej edycji.
 */
export function czytajPolaKatalogu(
  body: Record<string, unknown>,
  istniejaca?: Partial<PolaKatalogu>
): WynikPol {
  const ma = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const tekst = (k: string, limit: number, domyslnie: string) =>
    ma(k) ? (typeof body[k] === "string" ? (body[k] as string).slice(0, limit) : "") : ((istniejaca?.[k as keyof PolaKatalogu] as string) ?? domyslnie);

  const nazwa = (ma("nazwa") ? String(body.nazwa ?? "") : (istniejaca?.nazwa ?? "")).trim().slice(0, 500);
  if (!nazwa) return { blad: "Podaj nazwę pozycji." };

  const kategoria = ma("kategoria")
    ? zeSlownika(CATALOG_CATEGORIES, body.kategoria)
    : (istniejaca?.kategoria ?? DEFAULT_CATALOG_CATEGORY);
  if (!kategoria) return { blad: "Nieznana kategoria komponentu." };

  const waluta = ma("waluta") ? (isWaluta(body.waluta) ? (String(body.waluta).trim() as Waluta) : null) : (istniejaca?.waluta ?? DOMYSLNA_WALUTA);
  if (!waluta) return { blad: `Nieznana waluta. Dozwolone: ${WALUTY.join(", ")}.` };

  const vat = ma("vat_stawka") ? zeSlownika(VAT_RATES, body.vat_stawka) : (istniejaca?.vat_stawka ?? "23");
  if (!vat) return { blad: `Nieznana stawka VAT. Dozwolone: ${VAT_RATES.join(", ")}.` };

  const jednostka = (tekst("jednostka", 20, "szt.") || "szt.").trim() || "szt.";

  const cena = ma("cena_netto") ? liczba(body.cena_netto, "Cena", { ujemnaOk: true }) : (istniejaca?.cena_netto ?? 0);
  if (typeof cena === "string") return { blad: cena };
  const min = ma("cena_min") ? liczba(body.cena_min, "Widełki „od”", { ujemnaOk: true }) : (istniejaca?.cena_min ?? null);
  if (typeof min === "string") return { blad: min };
  const max = ma("cena_max") ? liczba(body.cena_max, "Widełki „do”", { ujemnaOk: true }) : (istniejaca?.cena_max ?? null);
  if (typeof max === "string") return { blad: max };
  if (min != null && max != null && min > max)
    return { blad: "Dolna granica widełek jest wyższa od górnej — zamień je miejscami." };
  const koszt = ma("koszt_zakupu") ? liczba(body.koszt_zakupu, "Koszt zakupu", { ujemnaOk: false }) : (istniejaca?.koszt_zakupu ?? null);
  if (typeof koszt === "string") return { blad: koszt };

  return {
    pola: {
      nazwa,
      kategoria,
      waluta,
      vat_stawka: vat,
      jednostka,
      cena_netto: cena ?? 0,
      cena_min: min,
      cena_max: max,
      koszt_zakupu: koszt,
      dostawca: tekst("dostawca", 200, "").trim(),
      opis: tekst("opis", 1000, ""),
    },
  };
}
