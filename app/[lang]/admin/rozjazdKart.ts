/**
 * Pamięć „jaki stan rekordu miała TA karta" — druga połowa wykrywania rozjazdu
 * dwóch kart (pierwsza siedzi w `lib/rozjazd.ts`, po stronie tras).
 *
 * **Po co osobny moduł, a nie pole w każdym edytorze.** Bo edytorów jest
 * kilkanaście, a każdy trzymałby ten znacznik po swojemu — i pierwszy, który
 * zapomni, zamieni wykrywanie w ciszę bez żadnego objawu. Tu jest jedno
 * miejsce: przy odczycie POJEDYNCZEGO rekordu zapamiętujemy `updated_at`,
 * przy zapisie do tego samego rekordu doklejamy go w nagłówku. Edytory nie
 * wiedzą o istnieniu tego pliku.
 *
 * Wpięte w ten sam podgląd `window.fetch`, co straż sesji (`strazSesji.ts`) —
 * jeden strażnik, dwie sprawy. Drugie opakowanie byłoby drugą kolejnością
 * wykonania do pilnowania.
 */

/** Klucz rekordu wyciągnięty z dowolnego adresu API panelu.
 *
 * `/api/offers/abc`                    → `offers/abc`
 * `/api/offers/abc/items/xyz`          → `offers/abc`   (pozycja NALEŻY do oferty)
 * `/api/offers?status=Szkic`           → `null`         (lista, nie rekord)
 * `/api/offers/abc/send`               → `offers/abc`
 *
 * Sprowadzenie dziecka do rodzica jest tu istotą, nie skrótem: rozjazd
 * rozstrzyga znacznik DOKUMENTU, a trasy pozycji i bloków treści ruszają go
 * właśnie po to (patrz komentarz w `api/offers/[id]/items/route.ts`).
 */
export function kluczRekordu(url: string): string | null {
  const sciezka = url.startsWith("/") ? url.split("?")[0] : (() => {
    try {
      const u = new URL(url, typeof window !== "undefined" ? window.location.href : "http://localhost");
      if (typeof window !== "undefined" && u.origin !== window.location.origin) return "";
      return u.pathname;
    } catch {
      return "";
    }
  })();
  if (!sciezka.startsWith("/api/")) return null;
  const czesci = sciezka.slice(5).split("/").filter(Boolean);
  if (czesci.length < 2) return null;
  // Trasy publiczne i systemowe nie mają „rekordu tej karty".
  if (czesci[0] === "admin" || czesci[1] === "public") return null;
  return `${czesci[0]}/${czesci[1]}`;
}

const stany = new Map<string, string>();

/** Zapamiętuje znacznik rekordu — z odczytu ORAZ z odpowiedzi na zapis.
 *
 * To drugie jest tu najważniejsze i wyszło dopiero z przebiegu: trasy oddają
 * po zapisie nowy `updated_at`, a bez jego przyjęcia DRUGI zapis z rzędu
 * w tej samej karcie wysyłałby znacznik sprzed własnej poprzedniej zmiany
 * — czyli panel krzyczałby „ktoś zmienił to w innym oknie" sam na siebie.
 * Fałszywy alarm kasuje mechanizm skuteczniej niż jego brak. */
export function zapamietajStan(url: string, dane: unknown): void {
  const klucz = kluczRekordu(url);
  if (!klucz) return;
  const znacznik = wyciagnijUpdatedAt(dane);
  if (znacznik) stany.set(klucz, znacznik);
}

/** Znacznik do doklejenia przy zapisie — albo `null`, gdy ta karta nie
 *  wczytała tego rekordu (np. akcja z listy). Brak znacznika znaczy „nie wiem",
 *  a trasa przy braku nagłówka świadomie NIE zgłasza rozjazdu. */
export function znanyStan(url: string): string | null {
  const klucz = kluczRekordu(url);
  return klucz ? stany.get(klucz) ?? null : null;
}

/** Tylko do testów i do sprzątania po wylogowaniu. */
export function wyczyscStany(): void {
  stany.clear();
}

/**
 * Wyciąga `updated_at` z odpowiedzi trasy.
 *
 * Trasy oddają rekord na trzy sposoby — na wierzchu (`{...pola}`), pod nazwą
 * modułu (`{ offer: {...} }`, `{ client: {...} }`) albo pod `record`. Zamiast
 * listy nazw, której trzeba pilnować przy każdym nowym module, schodzimy
 * **jeden poziom w głąb** i bierzemy pierwszy obiekt, który ma `updated_at`.
 * Listy (`{ offers: [...] }`) odpadają same, bo tablica nie ma tego pola.
 */
function wyciagnijUpdatedAt(dane: unknown): string | null {
  if (!dane || typeof dane !== "object") return null;
  const obiekt = dane as Record<string, unknown>;
  if (typeof obiekt.updated_at === "string" && obiekt.updated_at) return obiekt.updated_at;
  for (const wartosc of Object.values(obiekt)) {
    if (wartosc && typeof wartosc === "object" && !Array.isArray(wartosc)) {
      const w = (wartosc as Record<string, unknown>).updated_at;
      if (typeof w === "string" && w) return w;
    }
  }
  return null;
}
