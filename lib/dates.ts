// Wspólna funkcja "dzisiejsza data" — bez "use client", używana zarówno w
// czystej logice (lib/*.ts) jak i w API routes / komponentach klienckich.

/** Dzisiejsza data w strefie Europe/Warsaw jako "YYYY-MM-DD". Świadomie NIE
 * `new Date().toISOString().slice(0, 10)` (to UTC) ani `d.getFullYear()`/
 * `d.getDate()` (to strefa czasowa procesu — na Vercelu domyślnie też UTC,
 * nie polska) — oba dają błędny wynik w oknie ok. 00:00–02:00 czasu
 * polskiego (w zależności od czasu letniego/zimowego), gdzie coś z
 * terminem "dziś" wygląda jeszcze jak "jutro" wg UTC. Intl z jawną strefą
 * czasową działa poprawnie niezależnie od strefy procesu i przechodzi przez
 * zmiany czasu letniego automatycznie. */
export function todayLocalISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "dateStr + N dni" jako "YYYY-MM-DD" — czysta arytmetyka dat w UTC (nie
 * realny zegar), więc odporne na przesunięcia stref/DST. Współdzielone przez
 * `addDaysLocalISO` (poniżej) i kalendarz (nawigacja tydzień/dzień, zakresy
 * wydarzeń wielodniowych). */
export function addDaysToISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(dt);
}

/** "Dziś + N dni" jako "YYYY-MM-DD" — do szybkich chipów przypomnień
 * (jutro/za 3 dni/za tydzień). */
export function addDaysLocalISO(days: number): string {
  return addDaysToISO(todayLocalISO(), days);
}

/** Liczba dni między dwiema datami ISO ("YYYY-MM-DD"), jako `b - a` — czysta
 * arytmetyka dat w UTC (nie realny zegar), spójna z `addDaysToISO`. Dodatnia,
 * gdy `b` jest późniejsze niż `a` (np. "ile dni po terminie płatności" =
 * `daysBetweenISO(termin, dziś)`). */
export function daysBetweenISO(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** Czy tekst jest godziną „HH:MM". Odpowiednik `isPlausibleDateString()` dla
 * pory dnia — i z tego samego powodu: kolumna `godzina` jest w bazie TEXT-em,
 * więc bez tej bramki wchodzi do niej dowolny napis.
 *
 * Mieszka TUTAJ, a nie w `lib/reminders.ts` (gdzie powstał przy Module 66),
 * bo pilnują nią godziny TRZY moduły — Przypomnienia, Kalendarz i Notatnik
 * („Do kalendarza"). Audyt Notatnika 2026-08-02 zastał go wołanego wyłącznie
 * przez Przypomnienia: `{"godzina":"trzynasta"}` przechodziło przez
 * `POST /api/notes/:id/schedule` i lądowało w wydarzeniu kalendarza. */
export function isPlausibleTimeString(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** "HH:MM" czasu ściennego Europe/Warsaw danego dnia → poprawny UTC ISO, z
 * uwzględnieniem czasu letniego/zimowego (do snoozeOptions() w lib/mail.ts).
 * Metoda: sformatuj "przybliżony" znacznik (tak jakby podana data+godzina
 * była UTC) w strefie Warszawy z `timeZoneName: "shortOffset"`, odczytaj
 * offset ("GMT+1"/"GMT+2") i odejmij go od surowego znacznika. Bezpieczne dla
 * stałych godzin snooze (8:00/9:00/18:00) — nie trafiają w samą noc zmiany
 * czasu. Brak biblioteki stref czasowych w projekcie — stąd Intl zamiast
 * gotowej funkcji. */
export function warsawWallTimeToUtcISO(dateISO: string, hhmm: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const offsetStr =
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Warsaw", timeZoneName: "shortOffset" })
      .formatToParts(guess)
      .find((p) => p.type === "timeZoneName")?.value || "GMT+1";
  const offsetHours = Number(offsetStr.replace("GMT", "")) || 1;
  return new Date(guess.getTime() - offsetHours * 3600000).toISOString();
}

/** Minuty od północy "teraz" w Europe/Warsaw — do progu "Później dziś" w
 * snoozeOptions() (lib/mail.ts). */
export function warsawNowMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hh * 60 + mm;
}

/** Liczba PEŁNYCH dni od znacznika czasu (TIMESTAMPTZ) do "teraz" — w
 * odróżnieniu od daysBetweenISO() (daty "YYYY-MM-DD", arytmetyka
 * kalendarzowa w UTC) ta liczy z realnego zegara, bo źródło (np.
 * `received_at`) niesie też godzinę i minutę. Do wyświetlania "cisza od N
 * dni" (nudge, Moduł 4f, lib/mail.ts). */
export function daysSinceISO(iso: string, now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000);
}

/**
 * Parsuje TIMESTAMPTZ tak, jak NAPRAWDĘ zwraca go sterownik Neona.
 *
 * Postgres oddaje `2026-07-20 08:55:44.709+01`: **spacja zamiast `T`**
 * i **strefa bez dwukropka**. `new Date()` w JS nie zjada ani jednego, ani
 * drugiego — zwraca `Invalid Date`, po cichu.
 *
 * Dlaczego to ma osobną funkcję i komentarz: ta sama pułapka wyszła już raz
 * po stronie apki (Faza 5, `Daty.zZnacznika` — licznik stopera startowałby od
 * północy) i drugi raz przy kopiach zapasowych 2026-07-20, gdzie objawiła się
 * najgorzej z możliwych: Pulpit pokazał „kopie są przestarzałe, ostatnia
 * Infinity dni temu" **sekundę po udanej kopii**. Fałszywy alarm w mechanizmie
 * ostrzegawczym jest gorszy niż brak mechanizmu — uczy ignorowania ostrzeżeń.
 *
 * Zwraca `null` zamiast `Invalid Date`, żeby wołający MUSIAŁ obsłużyć
 * przypadek „nie dało się odczytać", a nie dostał w wyniku `NaN`.
 */
export function parsePgTimestamp(wartosc: string | null | undefined): Date | null {
  if (!wartosc) return null;

  let s = wartosc.trim().replace(" ", "T");
  // Strefa bez dwukropka (`+01`, `+0100`) → postać, którą rozumie JS.
  s = s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2").replace(/([+-]\d{2})$/, "$1:00");

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Data po polsku ("21.07.2026") — jedyna droga, którą data z bazy ma prawo
 * trafić przed oczy człowieka. `CLAUDE.md` mówi to wprost: nigdy surowego ISO.
 *
 * Mieszkała w `lib/projects.ts` (tam powstała, przy datach kamieni milowych)
 * i dlatego omijały ją moduły, które nie chciały ciągnąć całych Projektów —
 * m.in. szablony maili windykacyjnych, które wysyłały klientowi `2026-07-21`,
 * podczas gdy dokument wezwania obok drukował `21.07.2026` (znalezisko A5
 * z drugiego przejścia). `lib/projects.ts` re-eksportuje ją dalej, więc
 * kilkadziesiąt istniejących importów zostaje bez zmian.
 *
 * Pusty wynik dla braku daty jest świadomy: wołający sam decyduje, czy
 * w puste miejsce wstawić „—”, czy pominąć całe zdanie.
 */
export function formatPlDate(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(`${s.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Data + godzina po polsku ("16.07.2026, 18:00") — jak formatPlDate(),
 * ale z godziną; do TIMESTAMPTZ-ów jak snooze_until, gdzie sama data
 * nie wystarcza. */
export function formatPlDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  // Przez `parsePgTimestamp`, nie przez samo `new Date()`: znacznik z Neona ma
  // SPACJĘ zamiast „T" i strefę bez dwukropka. Node akurat to zjada, ale
  // przeglądarki nie muszą — a ta funkcja renderuje się po stronie KLIENTA
  // (Safari ma tu własne zdanie; stąd „OF-NaN" w Ofertach). Awaria byłaby
  // cicha: `Invalid Date` → zwracamy surowy string i na ekranie staje zapis
  // z bazy. Jedna wspólna droga zamiast dwóch (pamięć `znacznik-czasu-postgresa`).
  const d = parsePgTimestamp(iso);
  if (!d) return iso;
  return d.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** "dziś" / "wczoraj" / "N dni temu" — ludzka forma liczby dni (Moduł 34).
 *
 * Osobno od `daysSince()`, które zwraca samą liczbę: kolumna "DNI" w tabeli
 * chce liczby, a zdanie w dymku chce zdania. Bez tego dymek mówił "0 dni temu",
 * co brzmi jak usterka, a nie jak "dziś". Nie myl z `formatPlDate()`
 * (lib/projects.ts) — tamto formatuje datę, to formatuje dystans w czasie.
 */
export function daysAgoLabel(d: number | null | undefined): string | null {
  if (d === null || d === undefined) return null;
  if (d <= 0) return "dziś";
  if (d === 1) return "wczoraj";
  return `${d} dni temu`;
}

/**
 * Polska odmiana rzeczownika przez liczbę — trzy formy, nie dwie.
 *
 * Powstało przy audycie Faktur (2026-07-31): kafel zaległości pisał „3 faktur
 * po terminie", bo warunek rozróżniał tylko 1 od reszty. W panelu pisanym
 * po polsku dla jednego czytelnika to widać od razu.
 *
 * @example odmienPl(3, "faktura", "faktury", "faktur") // "faktury"
 */
export function odmienPl(n: number, jedna: string, dwie: string, wiele: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return jedna;
  const reszta10 = abs % 10;
  const reszta100 = abs % 100;
  // 12–14 idą jak „wiele" mimo końcówki 2–4 („12 faktur", nie „12 faktury").
  if (reszta10 >= 2 && reszta10 <= 4 && !(reszta100 >= 12 && reszta100 <= 14)) return dwie;
  return wiele;
}
