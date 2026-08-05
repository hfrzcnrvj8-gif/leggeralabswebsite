// Faktury cykliczne — szablon, z którego cron codziennie generuje kolejną
// fakturę (szkic) gdy nadejdzie `next_run`. Bez integracji płatności
// automatycznych — właściciel i tak musi ręcznie wystawić/wysłać wygenerowany
// szkic, to tylko oszczędza przepisywanie tych samych pozycji co miesiąc.

import type { InvoiceLang } from "./invoices";
import { todayLocalISO } from "./dates";

export const RECURRING_CYCLES = ["miesiecznie", "kwartalnie", "rocznie"] as const;
export type RecurringCycle = (typeof RECURRING_CYCLES)[number];
export const RECURRING_CYCLE_LABEL: Record<RecurringCycle, string> = {
  miesiecznie: "Co miesiąc",
  kwartalnie: "Co kwartał",
  rocznie: "Co rok",
};

export type RecurringItem = {
  nazwa: string;
  ilosc: number;
  jednostka: string;
  cena_netto: number;
  vat_stawka: string;
};

export type RecurringInvoice = {
  id: string;
  nazwa: string;
  klient_nazwa: string;
  klient_nip: string;
  klient_ulica: string;
  klient_kod: string;
  klient_miasto: string;
  klient_kraj: string;
  klient_email: string;
  waluta: string;
  jezyk: InvoiceLang;
  termin_dni: number;
  pozycje: RecurringItem[];
  cykl: RecurringCycle;
  next_run: string;
  /** Dzień, od którego liczy się rytm serii — patrz `nextRunFromAnchor()`.
   * Może być `null` w szablonach sprzed migracji z 2026-08-05; do odczytu
   * używaj `kotwicaSerii()`, nie tego pola wprost. */
  kotwica: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Ile miesięcy kalendarzowych ma jeden krok danego cyklu. */
function krokMiesiecy(cykl: RecurringCycle): number {
  return cykl === "miesiecznie" ? 1 : cykl === "kwartalnie" ? 3 : 12;
}

/** N-te wystąpienie serii, licząc od KOTWICY (`n = 0` to sama kotwica).
 *
 * Bliźniak `wystapienieNr()` z `lib/recurrence.ts` (wydarzenia i przypomnienia)
 * — ta sama arytmetyka, bo to ten sam problem. Dwie rzeczy, których nie wolno
 * tu zgubić, obie kupione bólem w Kalendarzu 2026-07-22:
 *
 * 1. **Przycięcie do ostatniego dnia miesiąca docelowego.** `Date.setMonth()`
 *    NIE obcina — przelewa: 31 stycznia + 1 miesiąc daje `3 marca`. Do
 *    2026-08-05 komentarz nad tą funkcją obiecywał „naturalne obcięcie przez
 *    `Date`", którego `Date` nie robi, a komentarz w `recurrence.ts` wskazywał
 *    na tę funkcję jako na wzór. Zmierzone: seria „co miesiąc od 31." po pół
 *    roku wystawiała się 3. dnia miesiąca.
 * 2. **Liczenie od kotwicy, nie krok po kroku.** Samo przycięcie nie wystarcza:
 *    iteracja przytnie 31 stycznia do 28 lutego, a potem policzy dalej OD 28.,
 *    więc reszta roku wypadnie 28. Dryf jest jednokierunkowy i nigdy nie wraca. */
export function wystapienieNr(kotwicaIso: string, cykl: RecurringCycle, n: number): string {
  const [y, m, d] = kotwicaIso.slice(0, 10).split("-").map(Number);
  const docelowy = m - 1 + krokMiesiecy(cykl) * n;
  const rok = y + Math.floor(docelowy / 12);
  const mies = ((docelowy % 12) + 12) % 12;
  // Dzień 0 kolejnego miesiąca = ostatni dzień tego miesiąca.
  const ostatni = new Date(rok, mies + 1, 0).getDate();
  const dzien = Math.min(d, ostatni);
  return `${rok}-${String(mies + 1).padStart(2, "0")}-${String(dzien).padStart(2, "0")}`;
}

/** Pierwsze wystąpienie serii PÓŹNIEJSZE niż `poIso`, liczone od kotwicy.
 *
 * To jest funkcja, której ma używać cron. Wcześniej liczył
 * `nextRunAfter(today, cykl)` — czyli od DNIA NADROBIENIA, nie od kotwicy —
 * więc każde opóźnienie crona (awaria, nieustawiony `CRON_SECRET`, limity
 * Vercela) przesuwało całą serię NA STAŁE. Faktura „co miesiąc 1." po jednym
 * nadrobieniu 5. dnia wystawiała się już zawsze 5.
 *
 * Szuka wprost, nie przewijaniem serii od początku: szablon założony pięć lat
 * temu ma dostać odpowiedź w jednym kroku, nie w sześćdziesięciu. */
export function nextRunFromAnchor(kotwicaIso: string, cykl: RecurringCycle, poIso: string): string {
  const kotwica = kotwicaIso.slice(0, 10);
  const po = poIso.slice(0, 10);
  if (po < kotwica) return kotwica;
  const [ky, km] = kotwica.split("-").map(Number);
  const [py, pm] = po.split("-").map(Number);
  const krok = krokMiesiecy(cykl);
  // Zaniżamy o jeden i dopychamy pętlą — ta sama ostrożność, co w
  // `recurrence.ts`: wystąpienie POMINIĘTE jest błędem (faktura, która nie
  // wyszła), a jedno sprawdzone na zapas nie kosztuje nic.
  let n = Math.max(0, Math.floor(((py - ky) * 12 + (pm - km)) / krok) - 1);
  // Sufit pętli: przy kroku miesięcznym to ponad 8 lat dopychania ponad
  // oszacowanie, czyli sytuacja niemożliwa — pętla ma się skończyć nawet
  // przy dacie wpisanej z palca, zamiast wisieć.
  for (let i = 0; i < 100 && wystapienieNr(kotwica, cykl, n) <= po; i++) n += 1;
  return wystapienieNr(kotwica, cykl, n);
}

/** Kotwica serii z wiersza bazy, z bezpiecznym odwrotem na `next_run`.
 *
 * Kolumna `kotwica` jest typu `DATE`, a ten wraca w RÓŻNYCH kształtach
 * zależnie od sterownika: `neon()` oddaje string `YYYY-MM-DD`, PGlite potrafi
 * oddać `Date`. Bez normalizacji `String(new Date(...)).slice(0,10)` dałoby
 * „Fri Jul 11" — datę, którą Postgres odrzuci (ta sama pułapka, co przy
 * `normalizeDbDate` w wystawianiu faktury i przy [[znacznik-czasu-postgresa]]).
 *
 * Odwrót na `next_run` obsługuje szablony sprzed migracji kotwicy — backfill
 * je uzupełnia, ale trasa nie ma prawa policzyć „NaN", jeśli któryś umknie. */
export function kotwicaSerii(kotwica: unknown, nextRun: unknown): string {
  const iso = (v: unknown): string | null => {
    if (v == null) return null;
    const s = v instanceof Date
      ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`
      : String(v).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };
  return iso(kotwica) ?? iso(nextRun) ?? todayLocalISO();
}

/** Kolejny termin PO dacie `fromIso` — jeden krok cyklu.
 *
 * Wygodny skrót; przy seriach ZAWSZE licz przez `nextRunFromAnchor()` od
 * kotwicy, patrz uzasadnienie przy `wystapienieNr()`. */
export function nextRunAfter(fromIso: string, cykl: RecurringCycle): string {
  return wystapienieNr(fromIso, cykl, 1);
}

export function todayISO(): string {
  return todayLocalISO();
}
