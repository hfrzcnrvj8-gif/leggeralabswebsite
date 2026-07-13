import { todayLocalISO, addDaysToISO } from "./dates";

// Nazwane HubEvent, żeby nie kolidować z wbudowanym DOM-owym typem Event.
export type HubEvent = {
  id: string;
  tytul: string;
  opis: string;
  data: string; // YYYY-MM-DD
  godzina: string | null; // "HH:MM" albo null (wydarzenie całodniowe)
  lead_id: string | null;
  project_id: string | null;
  client_id: string | null;
  /** Koniec zakresu wielodniowego wydarzenia (np. urlop, wyjazd), włącznie —
   * null = wydarzenie jednodniowe (dotychczasowe zachowanie). */
  data_koniec: string | null;
  /** Czas trwania w minutach — tylko ma sens, gdy `godzina` ustawiona; null =
   * nieznany (siatka godzinowa pokazuje wtedy domyślną 60-minutową belkę). */
  czas_trwania_min: number | null;
  created_at: string;
};

export function todayISO(): string {
  return todayLocalISO();
}

export function isPast(dateStr: string): boolean {
  return dateStr < todayISO();
}

/** Wszystkie dni [data, data_koniec] włącznie dla wydarzenia — pojedynczy
 * element, gdy `data_koniec` puste albo nie później niż `data` (literówka/
 * cofnięty zakres traktujemy jak wydarzenie jednodniowe). Limit 366 dni jako
 * zabezpieczenie przed absurdalnie długim zakresem zapychającym siatkę. */
export function expandEventDays(event: Pick<HubEvent, "data" | "data_koniec">): string[] {
  if (!event.data_koniec || event.data_koniec <= event.data) return [event.data];
  const days: string[] = [];
  let cursor = event.data;
  for (let i = 0; i < 366 && cursor <= event.data_koniec; i++) {
    days.push(cursor);
    cursor = addDaysToISO(cursor, 1);
  }
  return days;
}

/** "HH:MM" → minuty od północy; nieparsowalne wejście = 0. */
export function timeToMinutes(hhmm: string): number {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const DEFAULT_DURATION_MIN = 60;

/** Rozkłada wydarzenia z ustawioną godziną na kolumny siatki godzinowej —
 * klasyczny algorytm "kalendarzowy": nakładające się wydarzenia dostają
 * równe kolumny obok siebie (jak w Google Calendar/Notion Calendar), zamiast
 * się na sobie nakładać. Wydarzenia bez `godzina` nie są tu uwzględniane —
 * renderują się osobno w pasku "cały dzień". */
export function layoutTimedEvents<T extends { id: string; godzina: string | null; czas_trwania_min: number | null }>(
  events: T[]
): Map<string, { col: number; cols: number; startMin: number; endMin: number }> {
  type Item = { id: string; startMin: number; endMin: number; col: number };
  const timed = events.filter((e): e is T & { godzina: string } => Boolean(e.godzina));
  const sorted: Item[] = timed
    .map((e) => {
      const startMin = timeToMinutes(e.godzina);
      const endMin = startMin + (e.czas_trwania_min ?? DEFAULT_DURATION_MIN);
      return { id: e.id, startMin, endMin, col: 0 };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const result = new Map<string, { col: number; cols: number; startMin: number; endMin: number }>();
  let active: Item[] = [];
  let cluster: Item[] = [];

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const cols = Math.max(...cluster.map((c) => c.col)) + 1;
    cluster.forEach((c) => result.set(c.id, { col: c.col, cols, startMin: c.startMin, endMin: c.endMin }));
    cluster = [];
  };

  sorted.forEach((item) => {
    active = active.filter((a) => a.endMin > item.startMin);
    if (active.length === 0) flushCluster();
    const usedCols = new Set(active.map((a) => a.col));
    let col = 0;
    while (usedCols.has(col)) col++;
    item.col = col;
    active.push(item);
    cluster.push(item);
  });
  flushCluster();

  return result;
}

const WEEKDAY_NAMES: Record<string, number> = {
  poniedzialek: 0, poniedziałek: 0,
  wtorek: 1,
  sroda: 2, środa: 2, srode: 2, środę: 2,
  czwartek: 3,
  piatek: 4, piątek: 4,
  sobota: 5, sobote: 5, sobotę: 5,
  niedziela: 6, niedziele: 6, niedzielę: 6,
};

/** Deterministyczne (bez AI/LLM — zgodnie z zasadą projektu) rozpoznawanie
 * daty/godziny na początku/w treści szybko wpisanego tekstu, np. "jutro
 * 14:00 call z klientem" albo "w piątek o 10 przegląd". Rozpoznane frazy są
 * usuwane z tekstu — to, co zostanie, staje się tytułem wydarzenia. Zwraca
 * `date`/`time` jako `null`, gdy nic nie rozpoznano (wywołujący używa wtedy
 * dnia/godziny już wybranych w formularzu). */
export function parseQuickAdd(input: string, today: string): { title: string; date: string | null; time: string | null } {
  let text = input.trim();
  let date: string | null = null;

  const consume = (re: RegExp, handler: (m: RegExpMatchArray) => void): boolean => {
    const m = text.match(re);
    if (m && m.index === 0) {
      handler(m);
      text = text.slice(m[0].length).trim();
      return true;
    }
    return false;
  };

  // Kolejność ma znaczenie — bardziej specyficzne wzorce najpierw.
  consume(/^dzisiaj\b/i, () => { date = today; })
    || consume(/^dziś\b/i, () => { date = today; })
    || consume(/^pojutrze\b/i, () => { date = addDaysToISO(today, 2); })
    || consume(/^jutro\b/i, () => { date = addDaysToISO(today, 1); })
    || consume(/^za\s+tydzień\b/i, () => { date = addDaysToISO(today, 7); })
    || consume(/^za\s+(\d+)\s+tygodni(?:e|a)?\b/i, (m) => { date = addDaysToISO(today, 7 * Number(m[1])); })
    || consume(/^za\s+(\d+)\s+dni\b/i, (m) => { date = addDaysToISO(today, Number(m[1])); })
    || consume(/^(?:w|we)\s+(\p{L}+)\b/iu, (m) => {
      const idx = WEEKDAY_NAMES[m[1].toLowerCase()];
      if (idx === undefined) return;
      const [y, mo, d] = today.split("-").map(Number);
      const todayIdx = (new Date(y, mo - 1, d).getDay() + 6) % 7;
      const diff = (idx - todayIdx + 7) % 7;
      date = addDaysToISO(today, diff === 0 ? 7 : diff);
    })
    || consume(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\b/, (m) => {
      const day = Number(m[1]);
      const month = Number(m[2]);
      const year = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
      const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      date = !m[3] && candidate < today ? `${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : candidate;
    });

  // Godzina — gdziekolwiek w pozostałym tekście, nie tylko na początku.
  let time: string | null = null;
  const timeMatch = text.match(/\bo\s+(\d{1,2})(?:[:.](\d{2}))?\b|\b(\d{1,2}):(\d{2})\b/i);
  if (timeMatch && timeMatch.index !== undefined) {
    const h = Number(timeMatch[1] ?? timeMatch[3]);
    const mi = Number(timeMatch[2] ?? timeMatch[4] ?? 0);
    if (h >= 0 && h <= 23 && mi >= 0 && mi <= 59) {
      time = `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
      text = (text.slice(0, timeMatch.index) + text.slice(timeMatch.index + timeMatch[0].length)).replace(/\s+/g, " ").trim();
    }
  }

  return { title: text || input.trim(), date, time };
}

/** Ucieczka znaków specjalnych ICS (RFC 5545 §3.3.11) — backslash, przecinek,
 * średnik, nowa linia. */
function escapeICS(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Buduje plik .ics (RFC 5545) z ręcznych wydarzeń kalendarza — do
 * eksportu/subskrypcji w zewnętrznej aplikacji (Apple/Google Calendar), patrz
 * `GET /api/calendar/ics`. Świadomie tylko ręczne wydarzenia, nie wyliczone
 * terminy (płatności/kamienie/przypomnienia) — te żyją w swoich modułach i
 * nie są czymś, co warto subskrybować jako osobne zdarzenia kalendarzowe.
 * Wydarzenie z ustawioną `godzina` → DATE-TIME z realnym czasem trwania
 * (`czas_trwania_min`, domyślnie 60 min), jako "floating time" (bez `Z`/
 * `TZID`) — większość aplikacji kalendarzowych interpretuje to jako czas
 * lokalny urządzenia, co dla jednoosobowej firmy w jednej strefie czasowej
 * jest wystarczające bez dokładania pełnego bloku VTIMEZONE. Wydarzenie bez
 * godziny (całodniowe/wielodniowe) → DATE, jak dotychczas. */
export function buildICS(events: HubEvent[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const toBasic = (iso: string) => iso.replace(/-/g, "");
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Leggera Labs//Kalendarz//PL", "CALSCALE:GREGORIAN"];
  events.forEach((e) => {
    lines.push("BEGIN:VEVENT", `UID:${e.id}@leggeralabs.pl`, `DTSTAMP:${stamp}`);
    if (e.godzina) {
      const startMin = timeToMinutes(e.godzina);
      const endMin = startMin + (e.czas_trwania_min ?? DEFAULT_DURATION_MIN);
      const startTime = minutesToTime(startMin).replace(":", "") + "00";
      // Czas trwania może przenieść koniec na kolejny dzień (np. 23:30 + 90 min).
      const endDay = addDaysToISO(e.data, Math.floor(endMin / 1440));
      const endTime = minutesToTime(endMin % 1440).replace(":", "") + "00";
      lines.push(`DTSTART:${toBasic(e.data)}T${startTime}`, `DTEND:${toBasic(endDay)}T${endTime}`);
    } else {
      const endInclusive = e.data_koniec && e.data_koniec > e.data ? e.data_koniec : e.data;
      const endExclusive = addDaysToISO(endInclusive, 1); // DTEND w ICS jest wyłączny
      lines.push(`DTSTART;VALUE=DATE:${toBasic(e.data)}`, `DTEND;VALUE=DATE:${toBasic(endExclusive)}`);
    }
    lines.push(`SUMMARY:${escapeICS(e.tytul)}`);
    if (e.opis) lines.push(`DESCRIPTION:${escapeICS(e.opis)}`);
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
