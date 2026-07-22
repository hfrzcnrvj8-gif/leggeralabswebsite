// Przypomnienia — czysta logika (bez "use client"), re-używana przez API
// routes i UI, zgodnie z architekturą modułów z CLAUDE.md.
//
// Moduł powstał 2026-07-22 wg `docs/natywna-aplikacja/26-brief-przypomnienia-i-dalsze.md`.
// Wzorzec: Apple Reminders. Świadoma różnica wobec `events` (Kalendarz):
// przypomnienie MOŻE nie mieć terminu — „kiedyś to zrobię" jest pełnoprawnym
// stanem, podczas gdy wydarzenie bez daty nie ma sensu.

export type ReminderList = {
  id: string;
  nazwa: string;
  /** Klucz z `REMINDER_LIST_COLORS` — nie hex. Panel i apka mają własne mapy
   * na swoje palety, więc w bazie siedzi NAZWA koloru, nie jego zapis. */
  kolor: string;
  kolejnosc: number;
  created_at: string;
  /** Pole POCHODNE — doklejane w GET /api/reminders/lists, nie kolumna. */
  liczba_nieukonczonych?: number;
};

export type Reminder = {
  id: string;
  tytul: string;
  notatka: string;
  /** `YYYY-MM-DD` albo null. Null = przypomnienie bez terminu. */
  termin: string | null;
  /** `HH:MM` albo null. Bez `termin` nie ma sensu i API je wtedy czyści. */
  godzina: string | null;
  /** 0 = brak, 1 = niski, 2 = średni, 3 = wysoki (wykrzykniki Apple'a). */
  priorytet: number;
  ukonczone: boolean;
  ukonczone_at: string | null;
  lista_id: string | null;
  lead_id: string | null;
  client_id: string | null;
  project_id: string | null;
  created_at: string;

  /* ── Dokładka „jak w Apple Reminders" (2026-07-22) ────────────────────── */

  /** Oś NIEZALEŻNA od priorytetu: „wróć do tego". Apple trzyma je osobno
   * i słusznie — „pilne" i „oznaczone" to nie to samo pytanie. */
  flaga: boolean;
  /** Zadanie podrzędne: id rodzica. `null` = pozycja najwyższego poziomu. */
  parent_id: string | null;
  /** Nazwa miejsca do CZYTANIA. Bez `lat`+`lon` geofence nie ruszy — wtedy to
   * tylko notatka „gdzie", a nie obietnica powiadomienia. */
  lokalizacja: string | null;
  lokalizacja_lat: number | null;
  lokalizacja_lon: number | null;
  /** Metry. `null` = apka bierze swój domyślny (100 m). */
  lokalizacja_promien: number | null;
  /** `false` = alarm przy wejściu w obszar, `true` = przy wyjściu. */
  przy_wyjsciu: boolean;

  /* ── Powtarzanie (2026-07-22) ─────────────────────────────────────────── */

  /** Klucz ze słownika `CYKLE` (`lib/recurrence.ts` — TEN SAM, co w
   * Kalendarzu) albo null. Widoczne jest zawsze JEDNO wystąpienie: `termin`.
   * Odhaczenie zamyka wystąpienie, nie serię — `ukonczone` wraca na false,
   * a `termin` przeskakuje na kolejny cykl (wzorzec Apple Reminders, decyzja
   * właściciela z 2026-07-22). Gdy seria się kończy (`powtarzanie_do`),
   * odhaczenie działa normalnie: zadanie zostaje ukończone na dobre. */
  powtarzanie: string | null;
  /** Ostatni dzień serii włącznie; null = bez końca. */
  powtarzanie_do: string | null;
  /** Kotwica rytmu — data, od której liczą się kolejne wystąpienia. Osobno od
   * `termin`, który przy każdym odhaczeniu skacze do przodu; bez tego seria
   * „co miesiąc od 31." przykleiłaby się do 28. po pierwszym lutym. */
  powtarzanie_od: string | null;

  /** Pole POCHODNE — podzadania doklejane w GET, nie kolumna. */
  podzadania?: Reminder[];

  /* Pola POCHODNE — z JOIN-a w GET /api/reminders. Nie odsyłaj ich PATCH-em. */
  lista_nazwa?: string | null;
  lista_kolor?: string | null;
};

/** Paleta do wyboru przy zakładaniu listy. Nazwy kolorów, nie hexy — patrz
 * komentarz przy `ReminderList.kolor`. Trzon to paleta marki
 * (`tailwind.config.ts`), reszta dobrana tak, żeby dało się odróżnić kilka
 * list na jednym ekranie telefonu. */
export const REMINDER_LIST_COLORS = [
  "purple",
  "pink",
  "gold",
  "cyan",
  "green",
  "blue",
  "orange",
  "szary",
] as const;

export type ReminderListColor = (typeof REMINDER_LIST_COLORS)[number];

export const DEFAULT_LIST_COLOR: ReminderListColor = "purple";

/** Klasy Tailwinda kropki/pigułki listy w panelu. Odpowiednik `Theme.swift`
 * po stronie apki — **zmieniasz tu, zmień i tam**, inaczej ta sama lista ma
 * dwa kolory zależnie od urządzenia (ta sama pułapka co przy statusach
 * projektu, patrz `PROJECT_STATUS_CLASS` w `lib/projects.ts`). */
export const REMINDER_LIST_COLOR_CLASS: Record<string, string> = {
  purple: "bg-brand-purple/20 text-brand-purple",
  pink: "bg-brand-pink/20 text-brand-pink",
  gold: "bg-brand-gold/20 text-brand-gold",
  cyan: "bg-brand-cyan/20 text-brand-cyan",
  green: "bg-emerald-500/20 text-emerald-400",
  blue: "bg-sky-500/20 text-sky-400",
  orange: "bg-orange-500/20 text-orange-400",
  szary: "bg-[var(--hairline)] text-muted",
};

/** Sam kolor tekstu/kropki — tam, gdzie tło pigułki byłoby za ciężkie. */
export const REMINDER_LIST_DOT_CLASS: Record<string, string> = {
  purple: "bg-brand-purple",
  pink: "bg-brand-pink",
  gold: "bg-brand-gold",
  cyan: "bg-brand-cyan",
  green: "bg-emerald-400",
  blue: "bg-sky-400",
  orange: "bg-orange-400",
  szary: "bg-[var(--hairline)]",
};

export function listColorClass(kolor: string | null | undefined): string {
  return REMINDER_LIST_COLOR_CLASS[kolor ?? ""] ?? REMINDER_LIST_COLOR_CLASS[DEFAULT_LIST_COLOR];
}

export function listDotClass(kolor: string | null | undefined): string {
  return REMINDER_LIST_DOT_CLASS[kolor ?? ""] ?? REMINDER_LIST_DOT_CLASS[DEFAULT_LIST_COLOR];
}

export function isReminderListColor(v: unknown): v is ReminderListColor {
  return typeof v === "string" && (REMINDER_LIST_COLORS as readonly string[]).includes(v);
}

export const PRIORITY_LABEL: Record<number, string> = {
  0: "Brak",
  1: "Niski",
  2: "Średni",
  3: "Wysoki",
};

/** Wykrzykniki jak w Apple Reminders — `!`, `!!`, `!!!`. Puste dla 0.
 * Złoto („wymaga ruchu") nadaje panel/apka, tu zostaje sam znak. */
export function priorityMark(priorytet: number): string {
  if (priorytet <= 0) return "";
  return "!".repeat(Math.min(3, priorytet));
}

export function normalizePriority(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.min(3, Math.max(0, Math.round(v)));
}

/** Domyślny promień geofence w metrach. 100 m to kompromis Apple'a: mniej
 * gubi wejścia przy słabym GPS-ie w mieście, więcej alarmuje, zanim realnie
 * dojdziesz na miejsce. */
export const DOMYSLNY_PROMIEN_M = 100;

/** Czy da się z tego zrobić geofence. Sama nazwa miejsca NIE wystarczy —
 * bez współrzędnych apka nie ma czego pilnować i nie wolno jej obiecywać
 * powiadomienia. */
export function maGeofence(r: Pick<Reminder, "lokalizacja_lat" | "lokalizacja_lon">): boolean {
  return typeof r.lokalizacja_lat === "number" && typeof r.lokalizacja_lon === "number";
}

/** `HH:MM` — ten sam kształt, co `events.godzina`. */
export function isPlausibleTimeString(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** Czy przypomnienie jest po terminie. Bez terminu — nigdy (to nie zaległość,
 * tylko świadomie odłożona sprawa). Ukończone — nigdy. Reguła jest
 * DETERMINISTYCZNA, zgodnie z `CLAUDE.md`. */
export function isOverdue(r: Reminder, dzisISO: string): boolean {
  if (r.ukonczone || !r.termin) return false;
  return r.termin < dzisISO;
}

/** Kolejność listy: nieukończone przed ukończonymi, potem termin (bez terminu
 * na koniec), potem priorytet malejąco, na końcu data utworzenia. Ta sama
 * reguła musi obowiązywać w apce — inaczej ta sama lista wygląda inaczej na
 * telefonie i na biurku. */
export function compareReminders(a: Reminder, b: Reminder): number {
  if (a.ukonczone !== b.ukonczone) return a.ukonczone ? 1 : -1;
  if ((a.termin ?? "") !== (b.termin ?? "")) {
    if (!a.termin) return 1;
    if (!b.termin) return -1;
    return a.termin < b.termin ? -1 : 1;
  }
  if (a.priorytet !== b.priorytet) return b.priorytet - a.priorytet;
  return a.created_at < b.created_at ? -1 : 1;
}
