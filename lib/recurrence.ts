// Powtarzanie — JEDEN mechanizm dla wydarzeń (`events`) i przypomnień
// (`reminders`). Decyzja właściciela z 2026-07-22: nie budujemy cykliczności
// osobno per moduł, bo to ta sama reguła, a dwie implementacje rozjechałyby
// się dokładnie tak, jak rozjechały się mapy kolorów statusu.
//
// Trzy decyzje właściciela, które ten plik realizuje:
//
// 1. MODEL: w bazie własny słownik (`powtarzanie` + `powtarzanie_do`), a RRULE
//    (RFC 5545) generujemy dopiero NA WYJŚCIU — w feedzie `.ics` i w
//    zaproszeniu `METHOD:REQUEST`. Dzięki temu klient dostaje prawdziwą serię
//    (jedno spotkanie z regułą, nie setka osobnych), a panel i apka nie muszą
//    umieć parsować RRULE. Każda pozycja słownika ma dokładny odpowiednik
//    w RRULE — patrz `CYKL_RRULE`.
// 2. WYJĄTKI: tylko „usuń to jedno wystąpienie" — lista pomijanych dat
//    (`powtarzanie_pominiete`), która w `.ics` schodzi jako jedna linia
//    `EXDATE`. Świadomie BEZ przenoszenia pojedynczego wystąpienia: to
//    wymagałoby `RECURRENCE-ID` i pytania „ta okazja czy cała seria?" przy
//    każdej edycji, nie tylko przy kasowaniu.
// 3. ROZWIJANIE: w bazie zostaje JEDEN wiersz-wzorzec, wystąpienia liczy
//    `rozwinWystapienia()` w locie, dla konkretnego zakresu dat. Kalendarz
//    panelu nadal robi jedno zapytanie na miesiąc.
//
// Świadomie NIE re-używamy `lib/recurring.ts` (faktury/koszty cykliczne): tam
// cron MATERIALIZUJE kolejny dokument, bo faktura musi powstać jako osobny,
// edytowalny byt. Wydarzenie w kalendarzu — nie musi. Wspólny jest za to duch
// `nextRunAfter()`: cykle miesięczne liczymy w miesiącach kalendarzowych, nie
// w dniach.

import { addDaysToISO, daysBetweenISO } from "./dates";

export const CYKLE = [
  "codziennie",
  "co_tydzien",
  "co_2_tygodnie",
  "co_miesiac",
  "co_kwartal",
  "co_rok",
] as const;

export type Cykl = (typeof CYKLE)[number];

/** Etykiety do UI. Bliźniak w apce: `Cykl.opis` w
 * `LeggeraHubCore/Models/Powtarzanie.swift` — **zmieniasz tu, zmień i tam**. */
export const CYKL_LABEL: Record<Cykl, string> = {
  codziennie: "Codziennie",
  co_tydzien: "Co tydzień",
  co_2_tygodnie: "Co 2 tygodnie",
  co_miesiac: "Co miesiąc",
  co_kwartal: "Co kwartał",
  co_rok: "Co rok",
};

/** Odpowiednik każdej pozycji słownika w RRULE (RFC 5545) — bez `UNTIL`,
 * które dokleja `rrule()`. To jest cała cena decyzji „własne pola + RRULE na
 * wyjściu": jedna mapa zamiast parsera. */
const CYKL_RRULE: Record<Cykl, string> = {
  codziennie: "FREQ=DAILY",
  co_tydzien: "FREQ=WEEKLY",
  co_2_tygodnie: "FREQ=WEEKLY;INTERVAL=2",
  co_miesiac: "FREQ=MONTHLY",
  co_kwartal: "FREQ=MONTHLY;INTERVAL=3",
  co_rok: "FREQ=YEARLY",
};

export function isCykl(v: unknown): v is Cykl {
  return typeof v === "string" && (CYKLE as readonly string[]).includes(v);
}

/** Normalizacja wejścia z API: pusty string / cokolwiek spoza słownika = brak
 * cyklu. Świadomie nie rzucamy błędem — „nie powtarza się" to poprawny stan,
 * a nie pomyłka wołającego. */
export function normalizujCykl(v: unknown): Cykl | null {
  return isCykl(v) ? v : null;
}

/** N-te wystąpienie serii, licząc od `startISO` (n = 0 to sam start).
 *
 * KAŻDE wystąpienie liczymy od startu, nigdy krok-po-kroku od poprzedniego —
 * i to jest cała ochrona przed pułapką „co miesiąc od 31.". Iteracja
 * przycinałaby 31 stycznia do 28 lutego, a potem liczyła dalej OD 28., więc
 * cała reszta roku wypadałaby 28. Złapane na żywo 2026-07-22: seria od
 * 31 stycznia pokazała w lipcu 28., zamiast 31.
 *
 * Cykle miesięczne liczone w miesiącach kalendarzowych (jak `nextRunAfter()`
 * w `lib/recurring.ts`) z przycięciem do ostatniego dnia miesiąca docelowego —
 * bez tego `Date` przeniósłby 31 lutego na 3 marca. */
export function wystapienieNr(startISO: string, cykl: Cykl, n: number): string {
  if (cykl === "codziennie") return addDaysToISO(startISO, n);
  if (cykl === "co_tydzien") return addDaysToISO(startISO, 7 * n);
  if (cykl === "co_2_tygodnie") return addDaysToISO(startISO, 14 * n);

  const miesiace = (cykl === "co_miesiac" ? 1 : cykl === "co_kwartal" ? 3 : 12) * n;
  const [y, m, d] = startISO.slice(0, 10).split("-").map(Number);
  const docelowyMiesiac = m - 1 + miesiace;
  const rok = y + Math.floor(docelowyMiesiac / 12);
  const mies = ((docelowyMiesiac % 12) + 12) % 12;
  // Dzień 0 kolejnego miesiąca = ostatni dzień tego miesiąca.
  const ostatni = new Date(rok, mies + 1, 0).getDate();
  const dzien = Math.min(d, ostatni);
  return `${rok}-${String(mies + 1).padStart(2, "0")}-${String(dzien).padStart(2, "0")}`;
}

/** Kolejne wystąpienie PO dacie `odISO`. Wygodny skrót na jeden krok — przy
 * seriach ZAWSZE licz przez `wystapienieNr()` od startu, patrz wyżej. */
export function nastepneWystapienie(odISO: string, cykl: Cykl): string {
  return wystapienieNr(odISO, cykl, 1);
}

/** Bezpiecznik: ile wystąpień wolno wyliczyć w jednym rozwinięciu. Widok
 * miesiąca potrzebuje najwyżej 31 (cykl dzienny), więc 800 to sufit na wypadek
 * zakresu wpisanego z palca, a nie realny limit czegokolwiek. */
const LIMIT_KROKOW = 800;

/** Numer pierwszego wystąpienia, które MOŻE wypaść nie wcześniej niż `odISO`.
 *
 * Liczony wprost, nie przez przewijanie serii od początku — inaczej codzienna
 * seria założona pięć lat temu wyczerpałaby limit kroków, zanim w ogóle
 * doszłaby do oglądanego miesiąca, i widok pokazałby PUSTO zamiast błędu.
 * Zaniżamy z premedytacją (dla cykli miesięcznych o jeden), bo wystąpienie
 * pominięte jest błędem, a jedno sprawdzone na zapas nie kosztuje nic. */
function pierwszyNumerOd(startISO: string, cykl: Cykl, odISO: string): number {
  if (odISO <= startISO) return 0;
  if (cykl === "codziennie" || cykl === "co_tydzien" || cykl === "co_2_tygodnie") {
    const krok = cykl === "codziennie" ? 1 : cykl === "co_tydzien" ? 7 : 14;
    return Math.max(0, Math.floor(daysBetweenISO(startISO, odISO) / krok));
  }
  const krokMiesiecy = cykl === "co_miesiac" ? 1 : cykl === "co_kwartal" ? 3 : 12;
  const [sy, sm] = startISO.split("-").map(Number);
  const [oy, om] = odISO.split("-").map(Number);
  const miesiecy = (oy - sy) * 12 + (om - sm);
  return Math.max(0, Math.floor(miesiecy / krokMiesiecy) - 1);
}

/** Rozdziela zapisane w bazie pominięte daty. W kolumnie siedzi zwykły TEXT
 * z datami po przecinku, nie `TEXT[]` — tablice Postgresa wracają z
 * `@neondatabase/serverless` i z PGlite w różnych kształtach, a lista kilku
 * dat nie jest warta tej niezgodności. */
export function pominieteZTekstu(v: string | null | undefined): string[] {
  if (!v) return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export function pominieteDoTekstu(daty: string[]): string | null {
  const czyste = Array.from(new Set(daty.filter(Boolean))).sort();
  return czyste.length ? czyste.join(",") : null;
}

export type Seria = {
  /** Data PIERWSZEGO wystąpienia — to samo, co `events.data` / `reminders.termin`. */
  start: string;
  cykl: Cykl;
  /** Ostatni dzień, w którym seria może wystąpić (włącznie). `null` = bez końca. */
  doISO: string | null;
  /** Daty wystąpień usuniętych pojedynczo. */
  pominiete: string[];
};

/** Daty wystąpień serii w zakresie [odISO, doISO] włącznie.
 *
 * Zakres jest OBOWIĄZKOWY — seria bez końca jest nieskończona, więc każdy
 * wołający musi powiedzieć, jak daleko patrzy. Wystąpienia z
 * `seria.pominiete` nie wracają wcale (to jest cały mechanizm „usuń to jedno
 * wystąpienie"). */
export function rozwinWystapienia(seria: Seria, odISO: string, doZakresuISO: string): string[] {
  const koniec = seria.doISO && seria.doISO < doZakresuISO ? seria.doISO : doZakresuISO;
  if (koniec < seria.start) return [];

  const pominiete = new Set(seria.pominiete);
  const wynik: string[] = [];
  const start = pierwszyNumerOd(seria.start, seria.cykl, odISO);
  for (let i = 0; i < LIMIT_KROKOW; i++) {
    const data = wystapienieNr(seria.start, seria.cykl, start + i);
    if (data > koniec) break;
    if (data >= odISO && !pominiete.has(data)) wynik.push(data);
  }
  return wynik;
}

/** Pierwsze wystąpienie serii nie wcześniejsze niż `odISO` — bez rozwijania
 * całego zakresu. Używa tego przesunięcie terminu przypomnienia po
 * odhaczeniu („zrobione na dziś" ≠ „seria skończona") oraz apka, gdy planuje
 * najbliższe alerty. `null` = seria się skończyła. */
export function pierwszeWystapienieOd(seria: Seria, odISO: string): string | null {
  const pominiete = new Set(seria.pominiete);
  const start = pierwszyNumerOd(seria.start, seria.cykl, odISO);
  for (let i = 0; i < LIMIT_KROKOW; i++) {
    const data = wystapienieNr(seria.start, seria.cykl, start + i);
    if (seria.doISO && data > seria.doISO) return null;
    if (data >= odISO && !pominiete.has(data)) return data;
  }
  return null;
}

/** Które to z kolei wystąpienie serii, licząc od 1 (`0` = data nie leży na
 * siatce serii). Liczone po SIATCE, bez oglądania się na pominięte — numer ma
 * być stabilny, a nie przenumerowywać całą serię po skasowaniu jednej okazji.
 * Do plakietki „3. wystąpienie". */
export function numerWystapienia(startISO: string, cykl: Cykl, dataISO: string): number {
  const od = pierwszyNumerOd(startISO, cykl, dataISO);
  // Kilka kroków w przód wystarczy: `pierwszyNumerOd` co najwyżej zaniża.
  for (let i = 0; i < 4; i++) {
    if (wystapienieNr(startISO, cykl, od + i) === dataISO) return od + i + 1;
  }
  return 0;
}

/** Treść linii `RRULE:` dla ICS — bez prefiksu. `UNTIL` w formacie DATE
 * (bez czasu), zgodnie z RFC 5545 dla serii liczonych po dniach. */
export function rrule(cykl: Cykl, doISO: string | null): string {
  const baza = CYKL_RRULE[cykl];
  return doISO ? `${baza};UNTIL=${doISO.replace(/-/g, "")}` : baza;
}

/** Rozdzielacz między id wzorca a datą wystąpienia w syntetycznym id, jakie
 * dostają rozwinięte wystąpienia (`<id-wzorca>~2026-08-19`).
 *
 * Po co w ogóle: kalendarz kluczuje wystąpienia po `id` (klucze Reacta, mapa
 * `layoutTimedEvents`, identyfikator lokalnego powiadomienia w apce). Cztery
 * wystąpienia cotygodniowej serii w jednym miesiącu miałyby to samo `id` i
 * zjadłyby się nawzajem. Znak `~` — bo nie występuje w UUID-ach ani w datach,
 * więc rozbiór jest jednoznaczny w obie strony. */
export const SEP_WYSTAPIENIA = "~";

export function idWystapienia(idWzorca: string, dataISO: string): string {
  return `${idWzorca}${SEP_WYSTAPIENIA}${dataISO}`;
}

/** Rozbiera syntetyczne id na wzorzec i datę wystąpienia. Zwykłe id (bez
 * separatora) wraca jako wzorzec bez daty — dzięki temu trasy API mogą wołać
 * to bezwarunkowo i nie muszą wiedzieć, czy dostały serię. */
export function rozbierzIdWystapienia(id: string): { idWzorca: string; wystapienie: string | null } {
  const i = id.indexOf(SEP_WYSTAPIENIA);
  if (i < 0) return { idWzorca: id, wystapienie: null };
  return { idWzorca: id.slice(0, i), wystapienie: id.slice(i + 1) };
}
