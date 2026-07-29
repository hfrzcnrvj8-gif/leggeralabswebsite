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

/** Sygnał „sesja wygasła" — nie jest błędem do pokazania, tylko powodem do
 * przeładowania strony (formularz logowania renderuje serwer). Rzucamy go,
 * żeby wołający przerwał swoją funkcję, ale NIE zapisywał komunikatu. */
export class SesjaWygasla extends Error {
  constructor() {
    super("Sesja wygasła");
    this.name = "SesjaWygasla";
  }
}

/**
 * Pobiera JSON z trasy panelu. Zachowuje dotychczasowe zachowanie przy 401
 * (przeładowanie strony → formularz logowania), a każdą inną awarię zamienia
 * na `BladPanelu` z komunikatem po polsku.
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
    if (typeof window !== "undefined") window.location.reload();
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
