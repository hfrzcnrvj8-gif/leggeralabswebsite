// „Ktoś zmienił ten rekord, odkąd go otworzyłeś" — wykrywanie, NIE blokowanie.
//
// **Decyzja właściciela (2026-08-06, etap 3).** Z czterech wariantów — blokada
// rekordu, pytanie „nadpisać?", milczenie, wykrywanie — wybrany został czwarty:
// **zapis zostaje wolny, ale przestaje być niewidoczny**. To ten sam duch co
// reguła Fazy 4 („co odwracalne, nie pyta") i co kontrola spójności przy
// zdublowanej wpłacie: nie stawiamy bariery, tylko odbieramy skutkowi ciszę.
//
// **Dlaczego to w ogóle jest potrzebne.** Panel nie ma żadnej kontroli
// współbieżności (zmierzone w etapie 3: zero `If-Match`, zero `ETag`, zero
// `UPDATE … AND updated_at = …`). Dwie karty piszące w RÓŻNE pola nie depczą
// się — trasa dotyka wyłącznie pól, które przyszły. Ale dwie karty w TO SAMO
// pole kończą się tak: wygrywa ostatnia, obie dostają `{"ok":true}`, przegrany
// nie wie, że przegrał. I dopóki nie odświeży ekranu — nie ma jak się dowiedzieć.
//
// **Zero AI.** O tym, czy rekord się zmienił, decyduje porównanie dwóch
// znaczników czasu. Nic więcej.

/** Znacznik `updated_at`, który przeglądarka miała przy wczytaniu rekordu.
 *  Nagłówek, nie ciało: ta sama wartość jedzie przy `PATCH`-u z ciałem i przy
 *  żądaniu bez ciała, a jeden nośnik dla wszystkich jest wart więcej niż
 *  elegancja w połowie z nich (ta sama decyzja co przy `x-potwierdzenie`). */
export const NAGLOWEK_ZNANY_STAN = "x-znany-stan";

export type Rozjazd = {
  /** Znacznik, który miała przeglądarka. */
  znany: string;
  /** Znacznik, który jest w bazie TERAZ. */
  aktualny: string;
};

/**
 * Czy rekord ruszył się, odkąd ta karta go wczytała.
 *
 * Czysta funkcja — całe porównanie to jedno zdanie, ale **przypadki brzegowe
 * są tu regułą, nie stylem** i każdy z nich ma test:
 *
 * — **brak nagłówka → NIE ma rozjazdu.** Żądanie mogło przyjść z apki, ze
 *   skryptu albo z ekranu, który nie zapamiętał stanu. Zgłaszanie rozjazdu przy
 *   braku wiedzy byłoby fałszywym alarmem, a fałszywe alarmy uczą ignorować
 *   ostrzeżenia (ta sama zasada co próg 36 h przy kopiach zapasowych).
 * — **brak `updated_at` w bazie → NIE ma rozjazdu.** Nie ma z czym porównać.
 * — **znaczniki równe → NIE ma rozjazdu.** Oczywiste, ale to jest 99,9%
 *   wywołań i musi być tanie.
 *
 * Porównanie jest **tekstowe, nie przez `new Date()`**: Postgres oddaje
 * „2026-08-06 11:37:56.938+01" (spacja zamiast `T`, strefa bez dwukropka),
 * na czym `new Date()` daje `Invalid Date` — pamięć `znacznik-czasu-postgresa`.
 * Ta sama wartość wraca do przeglądarki i przychodzi z powrotem nietknięta,
 * więc porównanie znak w znak jest i poprawne, i najtańsze.
 */
export function rozjazdStanu(
  znanyStan: string | null | undefined,
  aktualny: unknown
): Rozjazd | null {
  const znany = typeof znanyStan === "string" ? znanyStan.trim() : "";
  if (!znany) return null;
  const teraz = typeof aktualny === "string" ? aktualny.trim() : aktualny instanceof Date ? aktualny.toISOString() : "";
  if (!teraz) return null;
  if (znany === teraz) return null;
  return { znany, aktualny: teraz };
}

/** Czyta znacznik z nagłówków żądania. */
export function odczytajZnanyStan(naglowki: { get(name: string): string | null }): string | null {
  const v = naglowki.get(NAGLOWEK_ZNANY_STAN);
  return v && v.trim() ? v.trim() : null;
}

/**
 * Zdanie dla właściciela. Jedno, nie dwa — mówi, że zapis SIĘ UDAŁ (bo się
 * udał, nic nie blokujemy) i co z tym zrobić.
 *
 * Nazwa rodzaju stoi **w nawiasie**, a zdanie zgadza się z rzeczownikiem
 * „rekord" — dokładnie ten sam zabieg co w `lib/brakRekordu.ts`. Powód jest
 * gramatyczny i wcale nie kosmetyczny: „oferta zmieniła się" i „projekt
 * zmienił się" mają różne końcówki, więc szablon z rodzajem w roli podmiotu
 * musiałby znać rodzaj gramatyczny każdej nazwy — albo produkować „projekt
 * zmieniła się".
 */
export function komunikatRozjazdu(rodzaj: string): string {
  return `Zapisano — ale ten rekord (${rodzaj}) zmienił się w międzyczasie w innym oknie panelu. Odśwież ekran, żeby zobaczyć całość.`;
}
