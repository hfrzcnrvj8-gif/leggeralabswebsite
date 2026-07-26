// Zamiana tego, co właściciel wpisał, na zapytanie pełnotekstowe Postgresa
// (Moduł 56, 2026-07-26). Czysta funkcja bez bazy — dzięki temu da się ją
// przetestować (`npm test`) bez stawiania Postgresa.
//
// Dlaczego w ogóle jest tu kod, a nie samo `to_tsquery(fraza)`:
//
// 1. **`to_tsquery` WYWALA SIĘ na zwykłym tekście.** Przyjmuje własną
//    składnię (`&`, `|`, `!`, `<->`), więc wpisane w wyszukiwarkę
//    „faktura & ” albo „co z tym?” kończy się błędem SQL, a nie pustym
//    wynikiem. `plainto_tsquery` tego nie ma, ale za to nie umie
//    przedrostków — a przedrostki są tu całą sztuczką na polską odmianę.
// 2. **`'simple'` nie odmienia wyrazów.** Postgres nie ma wbudowanego
//    słownika polskiego (patrz komentarz przy `createSearchSchema`), więc
//    „faktury” nie znalazłoby „faktura”. Każde słowo idzie jako PRZEDROSTEK
//    (`faktur:*`), co odmianę przybliża. To celowo przybliżenie: „auto:*”
//    złapie też „automatyzację”. Lepsze niż milczenie.
// 3. **Krótkie słowa wypadają.** Jednoliterowy przedrostek (`a:*`) pasuje do
//    połowy bazy i zamienia wynik w szum.

/** Najkrótsze słowo, które ma sens jako przedrostek. Dwa znaki to już fraza
 * („AI”, „PL”), jeden to zwykle literówka albo spójnik. */
const MIN_DLUGOSC_SLOWA = 2;

/** Ile słów bierzemy pod uwagę. Zapytanie z dwudziestu słów (ktoś wkleił
 * zdanie) i tak nie ma prawa nic znaleźć przy łączeniu przez `&`, a kosztuje
 * tyle samo co sensowne. */
const MAX_SLOW = 8;

/**
 * Buduje wyrażenie dla `to_tsquery('simple', …)`. Zwraca `null`, gdy z frazy
 * nie zostaje nic sensownego — wtedy trasa ma NIE odpytywać bazy.
 *
 * Wynik jest bezpieczny do wstawienia jako PARAMETR zapytania (nie do
 * sklejania w SQL — to nadal parametr, tylko o kontrolowanej treści):
 * zostają wyłącznie litery i cyfry, `:*` oraz `&`.
 */
export function zapytanieTsquery(fraza: string): string | null {
  const slowa = fraza
    .split(/\s+/)
    // Wszystko poza literami i cyframi leci — w tym operatory `to_tsquery`,
    // które inaczej wysadziłyby zapytanie. `\p{L}` zamiast `a-z`, żeby polskie
    // znaki przetrwały (normalizacja ogonków dzieje się po stronie bazy,
    // funkcją `szukaj_norm`, tą samą co przy budowie indeksu).
    .map((s) => s.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((s) => s.length >= MIN_DLUGOSC_SLOWA)
    .slice(0, MAX_SLOW);

  if (slowa.length === 0) return null;
  // `&` — wszystkie słowa muszą wystąpić. Przy `|` (którekolwiek) wpisanie
  // dwóch słów dawałoby WIĘCEJ wyników niż wpisanie jednego, co jest odwrotne
  // do tego, czego się oczekuje od zawężania.
  return slowa.map((s) => `${s}:*`).join(" & ");
}

/** Pierwsze słowo frazy — po nim baza szuka miejsca na wycinek treści
 * (`szukaj_fragment`). Bez tego wycinek zaczynałby się zawsze od początku
 * wpisu, a trafienie bywa w połowie długiej rozmowy. */
export function pierwszeSlowo(fraza: string): string {
  const slowa = fraza.split(/\s+/).map((s) => s.replace(/[^\p{L}\p{N}]/gu, ""));
  return slowa.find((s) => s.length >= MIN_DLUGOSC_SLOWA) ?? "";
}

/** Rodzaj trafienia — decyduje o ikonie i o tym, dokąd prowadzi kliknięcie. */
export type RodzajTrafienia =
  | "lead"
  | "klient"
  | "rozmowa-lead"
  | "rozmowa-klient"
  | "zdarzenie-klient"
  | "rozmowa-projekt"
  | "mail"
  | "notatka"
  | "projekt";

export type TrafienieTresci = {
  rodzaj: RodzajTrafienia;
  /** Id REKORDU DOCELOWEGO, nie wpisu — wpis historii nie ma własnej strony,
   * więc trafienie w rozmowie prowadzi do karty leada/klienta. */
  id: string;
  /** Nazwa rekordu docelowego („Nordwind Studio”). */
  tytul: string;
  /** Wycinek treści wokół szukanego słowa, w ORYGINALNEJ pisowni. */
  fragment: string;
  data: string;
};

/** Segment adresu w panelu dla danego rodzaju trafienia. Apka ma własne
 * mapowanie — dlatego trasa zwraca `rodzaj`, a nie gotowy link. */
export const SEGMENT_TRAFIENIA: Record<RodzajTrafienia, string> = {
  lead: "leads",
  klient: "clients",
  "rozmowa-lead": "leads",
  "rozmowa-klient": "clients",
  "zdarzenie-klient": "clients",
  "rozmowa-projekt": "projects",
  mail: "mail",
  notatka: "notes",
  projekt: "projects",
};

/** Etykieta rodzaju w wynikach — ta sama w panelu i (docelowo) w apce. */
export const ETYKIETA_TRAFIENIA: Record<RodzajTrafienia, string> = {
  lead: "Lead",
  klient: "Klient",
  "rozmowa-lead": "Rozmowa (lead)",
  "rozmowa-klient": "Rozmowa (klient)",
  "zdarzenie-klient": "Zdarzenie (klient)",
  "rozmowa-projekt": "Wpis w projekcie",
  mail: "Mail",
  notatka: "Notatka",
  projekt: "Projekt",
};
