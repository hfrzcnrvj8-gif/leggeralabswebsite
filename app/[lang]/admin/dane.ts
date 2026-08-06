/**
 * Jedno gardło wczytywania danych panelu — odpowiednik `wykonaj(zasob, waga)`
 * z apki (`Store/Komunikaty.swift`, ustalenie A1).
 *
 * Powód: do Modułu 59 KAŻDY dashboard panelu miał ten sam kształt
 * `fetch → if 401 reload → await res.json()` **bez `catch`**. Zerwana sieć albo
 * 500 z trasy nie dawały żadnego objawu poza tym, że stan listy zostawał
 * `null` — czyli ekran w nieskończoność pokazywał „Wczytuję…" albo, gorzej,
 * pusty stan mówiący „Brak leadów". Apka ten sam błąd zamknęła w Fazie A1
 * (`docs/natywna-aplikacja/22-wynik-a1-komunikaty.md`); panel został.
 *
 * Nie jest to `"use client"` — to czysty TypeScript bez Reacta, więc może go
 * wołać także kod serwerowy, gdyby zaszła potrzeba.
 */

import { zglosWygasnieciesesji } from "./strazSesji";

/** Rzucane przez `pobierzJSON`. Komunikat jest już po polsku i nadaje się
 * wprost na ekran — panel nigdy nie pokazuje surowego `Failed to fetch`. */
export class BladPanelu extends Error {
  readonly status: number | null;
  constructor(komunikat: string, status: number | null = null) {
    super(komunikat);
    this.name = "BladPanelu";
    this.status = status;
  }
}

/** Sygnał „sesja wygasła" — nie jest błędem do pokazania, bo mówi o tym pasek
 * ze `strazSesji.ts`. Rzucamy go, żeby wołający przerwał swoją funkcję, ale
 * NIE zapisywał własnego komunikatu (dwa zdania o tym samym uczą ignorować
 * oba). */
export class SesjaWygasla extends Error {
  constructor() {
    super("Sesja wygasła");
    this.name = "SesjaWygasla";
  }
}

/**
 * Pobiera JSON z trasy panelu. Przy 401 zapala pasek wygasłej sesji
 * (`strazSesji.ts`) i rzuca `SesjaWygasla`; każdą inną awarię zamienia na
 * `BladPanelu` z komunikatem po polsku.
 */
export async function pobierzJSON<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    // Zerwana sieć, uśpiony laptop, Vercel w trakcie wdrożenia — `fetch`
    // rzuca `TypeError` bez żadnej użytecznej treści.
    throw new BladPanelu("Brak połączenia z panelem. Sprawdź sieć i spróbuj ponownie.");
  }

  if (res.status === 401) {
    // Do etapu 3 stało tu `window.location.reload()` — po to, żeby serwer
    // narysował formularz logowania. Przeładowanie KASUJE niezapisany
    // formularz bez ostrzeżenia, a odczyt potrafi wypaść w dowolnej chwili
    // (dzwonek powiadomień odpytuje w tle). Dziś zamiast tego zapala się
    // pasek — patrz `strazSesji.ts`.
    zglosWygasnieciesesji();
    throw new SesjaWygasla();
  }

  if (!res.ok) {
    // Trasa mogła zwrócić `{ error: "…" }` — jeśli tak, to jest zdanie
    // napisane dla właściciela i jest lepsze od czegokolwiek generycznego.
    const dane = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new BladPanelu(dane?.error || `Panel odpowiedział błędem ${res.status}.`, res.status);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new BladPanelu("Panel zwrócił odpowiedź, której nie da się odczytać.", res.status);
  }
}

/**
 * Zdanie o tym, dlaczego zapis się nie udał — do pokazania w toaście.
 *
 * **Po co osobna funkcja (etap 3, 2026-08-06).** Przebieg „sesja wygasła
 * w połowie pracy" pokazał, że część zapisów panelu nie mówiła NIC (zmierzone
 * na treści oferty: właściciel pisze, klika obok, ekran dalej pokazuje tekst,
 * w bazie stara wartość, zero komunikatu). Poprawka miała jeden kształt
 * w kilkunastu miejscach, więc kształt mieszka tutaj, nie w kopiach.
 *
 * Zdanie z trasy wygrywa, gdy jest: od etapu 3 trasy mówią wprost „ten rekord
 * już nie istnieje, mógł zostać usunięty w innym oknie" (patrz
 * `lib/brakRekordu.ts`), a to jest informacja, której nie da się zgadnąć
 * z kodu odpowiedzi.
 *
 * O wygasłej sesji NIE mówimy tutaj — mówi o niej pasek (`strazSesji.ts`),
 * a dwa komunikaty o tym samym uczą ignorować oba.
 */
export type OdmowaZapisu = {
  /** Zdanie do toasta albo `null`, gdy mówi już o tym pasek wygasłej sesji. */
  komunikat: string | null;
  /** Czy cofnąć optymistyczny podgląd (zwykle przez `load()`). */
  cofnij: boolean;
};

export async function odmowaZapisu(res: Response, zapasowy = "Nie udało się zapisać."): Promise<OdmowaZapisu> {
  // **Przy wygasłej sesji NIE cofamy podglądu.** Pasek obiecuje wprost: „to,
  // co masz na ekranie, zostaje" — a `load()` w tym miejscu zabierałby
  // właśnie tę treść, dla której cały ten mechanizm powstał. Złapane
  // przebiegiem w przeglądarce PO napisaniu poprawki: pasek mówił prawdę,
  // a pole obok już pokazywało starą treść z bazy.
  if (res.status === 401) return { komunikat: null, cofnij: false };
  const dane = (await res.json().catch(() => null)) as { error?: string } | null;
  return { komunikat: dane?.error?.trim() || zapasowy, cofnij: true };
}

/**
 * Zamienia cokolwiek złapanego w `catch` na zdanie do pokazania — albo na
 * `null`, gdy to była wygasła sesja (strona i tak się właśnie przeładowuje,
 * więc migający komunikat byłby szumem).
 *
 * Wzorzec użycia w dashboardzie:
 * ```ts
 * try { … ; setBlad(null); }
 * catch (e) { setBlad(komunikatBledu(e)); }
 * ```
 */
export function komunikatBledu(e: unknown): string | null {
  if (e instanceof SesjaWygasla) return null;
  if (e instanceof BladPanelu) return e.message;
  if (e instanceof Error && e.name === "AbortError") return null;
  return "Nie udało się wczytać danych. Spróbuj ponownie.";
}
