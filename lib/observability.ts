// Obserwowalność — czysta logika (Audyt 4, 2026-07-22).
//
// Bez bazy i bez Reacta, dokładnie jak lib/backup.ts: tę samą regułę ma móc
// policzyć panel, trasa API i apka. Zero AI — „czy automat jest zdrowy"
// wynika wyłącznie z daty ostatniego udanego przebiegu i tego, czy ostatni
// przebieg się powiódł.
//
// Ten plik odpowiada na dwa pytania Audytu 4:
//   1. co MA trafiać do logu, a co nie  → oczyscTekst(), WAGA
//   2. kiedy automat jest do zgłoszenia → AUTOMATY + ocenAutomat()

import { parsePgTimestamp } from "./dates";
import { opisWieku } from "./backup";

// ─────────────────────────────────────────────────────────────────────────
// Reguła: co trafia do logu
// ─────────────────────────────────────────────────────────────────────────

/** Waga zdarzenia. Rozróżnienie „błąd" od „sytuacji przewidzianej" jest tu
 * regułą, nie ozdobą: inwentarz z 2026-07-22 pokazał, że z 95 miejsc
 * logujących błędy tylko ~25 to rzeczy, które nie naprawią się same.
 * Reszta to `catch` wokół rzeczy opcjonalnych (brak Ollamy w env, VIES nie
 * odpowiada) albo kroki, które powtórzy następny przebieg (backfille).
 * Gdyby wszystko było „błędem", alarm zacząłby kłamać w pierwszym tygodniu. */
export type Waga =
  /** Coś się zepsuło i samo się nie naprawi. Tylko to może wywołać alarm. */
  | "blad"
  /** Przewidziane i obsłużone — zapisujemy dla kontekstu, nigdy nie alarmujemy. */
  | "ostrzezenie";

/** Ile znaków komunikatu zapisujemy. Dłuższe i tak nikt nie przeczyta,
 * a ślady stosu potrafią ciągnąć się kilobajtami. */
const MAX_KOMUNIKAT = 500;
const MAX_SZCZEGOLY = 2000;

/**
 * Usuwa z tekstu dane osobowe, ZANIM trafi do bazy.
 *
 * **Log jest zbiorem danych osobowych** (Audyt 2 — RODO). Komunikaty błędów
 * w tym projekcie regularnie niosą adresy e-mail (cała Poczta), numery NIP
 * (VIES, KSeF) i telefony (Telefonia) — bo tak brzmią komunikaty bibliotek.
 * Bez tego filtru `error_log` po miesiącu byłby nieudokumentowanym zbiorem
 * danych klientów, którego nikt nie objąłby prawem do usunięcia.
 *
 * Zamieniamy na etykietę zamiast wycinać, żeby komunikat dalej dało się
 * zrozumieć: „nie mogę wysłać do [e-mail]" niesie tę samą diagnozę co wersja
 * z adresem, a nie jest już daną osobową.
 */
export function oczyscTekst(tekst: string): string {
  return (
    tekst
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[e-mail]")
      // KOLEJNOŚĆ JEST TU REGUŁĄ, NIE STYLEM. Numer konta musi iść PRZED
      // telefonem i NIP-em, bo tamte wzorce pasują do jego fragmentów.
      // Przy odwrotnej kolejności (tak było w pierwszej wersji, złapane
      // testem 2026-07-22) z IBAN-a zostawało „PL611090101400000[telefon]" —
      // czyli 17 cyfr numeru konta wyciekało do logu mimo „oczyszczenia".
      // Zawsze od najdłuższego wzorca do najkrótszego.
      .replace(/\bPL\s?\d{2}(?:[\s-]?\d{4}){6}\b/gi, "[konto]")
      // Telefon: 9–11 cyfr w typowym grupowaniu, opcjonalnie z kierunkowym.
      .replace(/\+\d{2}[-\s]?\d{3}[-\s]?\d{3}[-\s]?\d{3}\b/g, "[telefon]")
      // NIP: 10 cyfr, także z myślnikami/spacjami (525-000-00-00).
      .replace(/\b\d{3}[-\s]?\d{3}[-\s]?\d{2}[-\s]?\d{2}\b/g, "[NIP]")
      // Telefon bez kierunkowego (601 234 567) — po NIP-ie, bo oba to
      // 9–10 cyfr i rozróżnia je wyłącznie grupowanie.
      .replace(/\b\d{3}[-\s]\d{3}[-\s]\d{3}\b/g, "[telefon]")
  );
}

/** Komunikat gotowy do zapisania: oczyszczony i przycięty. */
export function przygotujKomunikat(tekst: string): string {
  return oczyscTekst(tekst).slice(0, MAX_KOMUNIKAT);
}

export function przygotujSzczegoly(tekst: string): string {
  return oczyscTekst(tekst).slice(0, MAX_SZCZEGOLY);
}

/** Czytelny opis błędu z czegokolwiek, co wpadło do `catch`. */
export function opisBledu(e: unknown): string {
  if (e instanceof Error) return e.message || e.name;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e).slice(0, MAX_KOMUNIKAT);
  } catch {
    return "Nieznany błąd.";
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Rejestr automatów — „każdy proces, który chodzi bez patrzenia, musi umieć
// się poskarżyć"
// ─────────────────────────────────────────────────────────────────────────

/** Jeden automat chodzący bez nadzoru. */
export type Automat = {
  klucz: string;
  /** Nazwa dla właściciela, nie dla programisty. */
  nazwa: string;
  /** Co przestaje działać, gdy ten automat stanie — to zdanie trafia do
   *  maila alarmowego, więc ma mówić o skutku, nie o mechanizmie. */
  skutek: string;
  /** Po ilu godzinach bez UDANEGO przebiegu uznajemy, że stanął. */
  progGodzin: number;
};

/**
 * **Progi są celowo luźne**, tą samą decyzją co `BACKUP_STALE_HOURS = 36`:
 * automaty chodzą raz na dobę, więc przy progu 24 h każde przesunięcie
 * (dłuższy przebieg, przestój Vercela) dawałoby fałszywy alarm. Fałszywe
 * alarmy uczą ignorowania — a te mają zadziałać raz na rok.
 *
 * Kopie zapasowe NIE są tu wymienione świadomie: mają własny, sprawdzony
 * mechanizm (`lib/backup.ts`, `backup_runs`) i własny meldunek z NAS-a.
 * Dublowanie go tutaj dałoby dwa alarmy o tej samej awarii.
 */
export const AUTOMATY: Automat[] = [
  {
    klucz: "raport-dzienny",
    nazwa: "Dzienny raport",
    skutek:
      "Przestajesz dostawać poranny mail — a to jest jedyny kanał, którym docierają do Ciebie ostrzeżenia o kopiach zapasowych i zaległych fakturach.",
    progGodzin: 36,
  },
  {
    klucz: "sync-poczty",
    nazwa: "Pobieranie poczty",
    skutek: "Nowe wiadomości nie pojawiają się w panelu. Wygląda to tak, jakby nikt nie pisał.",
    progGodzin: 36,
  },
  {
    klucz: "kolejka-wysylki",
    nazwa: "Kolejka wysyłki odłożonej",
    skutek: "Maile zaplanowane na później nie wychodzą do klientów.",
    progGodzin: 36,
  },
  {
    klucz: "faktury-cykliczne",
    nazwa: "Faktury i koszty cykliczne",
    skutek: "Szkice faktur cyklicznych przestają się generować — łatwo przeoczyć niewystawioną fakturę.",
    progGodzin: 36,
  },
];

export function automat(klucz: string): Automat | null {
  return AUTOMATY.find((a) => a.klucz === klucz) ?? null;
}

/** Ostatnie przebiegi jednego automatu, najnowszy pierwszy. */
export type AutomationRun = {
  id: string;
  klucz: string;
  ok: boolean;
  powod: string;
  trwalo_ms: number | null;
  created_at: string;
};

export type StanAutomatu =
  | { stan: "ok"; automat: Automat; opis: string }
  /** Nigdy nie przyszedł meldunek — automat jeszcze nie chodził. */
  | { stan: "brak"; automat: Automat; opis: string }
  /** Ostatni przebieg się nie udał — mamy powód do pokazania. */
  | { stan: "blad"; automat: Automat; opis: string; powod: string }
  /** Nic nie zgłosiło porażki, ale od udanego przebiegu minęło za dużo —
   *  czyli automat prawdopodobnie w ogóle nie chodzi. To NAJWAŻNIEJSZY
   *  przypadek: cichy zgon nie generuje żadnego błędu do złapania. */
  | { stan: "przestarzale"; automat: Automat; opis: string };

function godzinTemu(iso: string, teraz: Date): number {
  // parsePgTimestamp, NIE `new Date()` — Postgres zwraca „2026-07-20
  // 08:55:44.709+01" (spacja, strefa bez dwukropka). Ta sama pułapka
  // wywróciła ocenę kopii 2026-07-20 („Infinity dni temu").
  const d = parsePgTimestamp(iso);
  if (!d) return Number.POSITIVE_INFINITY;
  return (teraz.getTime() - d.getTime()) / 3_600_000;
}

/**
 * Ocenia jeden automat na podstawie jego historii (najnowszy pierwszy).
 *
 * **Kolejność warunków jest regułą, nie stylem** — dokładnie jak w
 * `ocenKopie()`: nieudany OSTATNI przebieg bije świeżość, bo znaczy „właśnie
 * się zepsuło", a nie „wczoraj było dobrze".
 */
export function ocenAutomat(a: Automat, runs: AutomationRun[], teraz: Date = new Date()): StanAutomatu {
  const wlasne = runs.filter((r) => r.klucz === a.klucz);
  if (wlasne.length === 0) {
    return { stan: "brak", automat: a, opis: `${a.nazwa}: nie odnotowano jeszcze żadnego przebiegu.` };
  }

  const ostatni = wlasne[0];
  if (!ostatni.ok) {
    return {
      stan: "blad",
      automat: a,
      opis: `${a.nazwa}: ostatni przebieg się nie udał.`,
      powod: ostatni.powod || "Automat nie podał powodu.",
    };
  }

  const ostatniUdany = wlasne.find((r) => r.ok);
  const wiek = ostatniUdany ? godzinTemu(ostatniUdany.created_at, teraz) : Number.POSITIVE_INFINITY;
  if (wiek > a.progGodzin) {
    return {
      stan: "przestarzale",
      automat: a,
      opis: `${a.nazwa}: ostatni udany przebieg ${opisWieku(wiek)}. Automat prawdopodobnie przestał chodzić.`,
    };
  }

  return { stan: "ok", automat: a, opis: `${a.nazwa}: ${opisWieku(wiek)}.` };
}

export function ocenAutomaty(runs: AutomationRun[], teraz: Date = new Date()): StanAutomatu[] {
  return AUTOMATY.map((a) => ocenAutomat(a, runs, teraz));
}

/** Czy stan wymaga uwagi właściciela.
 *
 * „brak" NIE wymaga uwagi: świeżo wdrożony automat, który jeszcze nie
 * zdążył się wykonać, nie jest awarią — a alarm przy pierwszym wdrożeniu
 * nauczyłby ignorowania na starcie. */
export function wymagaUwagi(s: StanAutomatu): boolean {
  return s.stan === "blad" || s.stan === "przestarzale";
}
