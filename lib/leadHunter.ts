/**
 * „Łowca leadów" (Moduł 52) — SITO. Czysta logika, zero sieci, zero bazy,
 * zero AI. To jest jedyne miejsce, które decyduje, czy firma z rejestru trafi
 * do skrzynki kandydatów i z jaką oceną.
 *
 * **Dlaczego deterministyczne.** Zasada z `CLAUDE.md`: żaden model nie
 * decyduje o wpuszczeniu leada. Model (Ollama) może najwyżej napisać zdanie
 * „co tu da się zautomatyzować" PO tym, jak właściciel kandydata przyjmie —
 * patrz `lib/leadHunterHook.ts`. Tutaj są wyłącznie stałe i `if`-y.
 *
 * **Dlaczego osobny plik bez importu `lib/db`.** Ten sam podział co
 * `lib/leads.ts` ↔ trasy: reguły mają dać się przetestować (`npm test`) bez
 * bazy i bez sieci. Cała warstwa I/O siedzi w `lib/ceidg.ts` i
 * `lib/leadHunterRun.ts`.
 *
 * **Wszystkie liczby niżej to POKRĘTŁA, wolno je kręcić.** Moduł jest
 * zaprojektowany tak, żeby kalibracja polegała na zmianie kilku stałych w tym
 * pliku, a nie na przebudowie. Dwa liczniki, po których poznasz, że pora
 * pokręcić (Statystyki → „Łowca leadów"):
 *   1. konwersja per ocena A/B/C — jeśli „A" nie konwertuje lepiej niż „B",
 *      wagi są źle rozłożone,
 *   2. top powodów odrzucenia — jeśli 30× „za mała firma", to próg wieku albo
 *      lista PKD jest źle ustawiona.
 */

/** Kandydat po etapie zbierania (E1) i wzbogacania (E2/E3) — wejście sita. */
export type HunterInput = {
  nazwa: string;
  nip: string;
  /** Status z CEIDG: AKTYWNY / ZAWIESZONY / WYKRESLONY / … */
  status: string;
  /** Główny kod PKD, w formacie „6920Z" albo „69.20.Z" — normalizujemy sami. */
  pkdGlowny: string;
  /** Wszystkie kody PKD firmy (razem z głównym). */
  pkd: string[];
  /** Data rozpoczęcia działalności („YYYY-MM-DD"), pusta gdy rejestr nie podał. */
  dataRozpoczecia: string;
  telefon: string;
  email: string;
  www: string;
  miasto: string;
  /** Ile adresów działalności zwrócił rejestr (1 = tylko główny). */
  liczbaAdresow: number;
  /** Upadłość / zakaz prowadzenia działalności z CEIDG. */
  upadlosc: boolean;
  zakaz: boolean;
  /** `statusVat` z Białej listy MF: „Czynny" / „Zwolniony" / null (nie znaleziono). */
  statusVat: string | null;
  /** Sygnały ze strony głównej (E3) — `null`, gdy strony nie było czym pobrać. */
  strona: WebsiteSignals | null;
};

/** Wynik pobrania strony głównej firmy — same fakty, bez interpretacji.
 * Interpretację (punkty) robi `ocenKandydata`. */
export type WebsiteSignals = {
  /** Strona odpowiedziała kodem 2xx i dało się ją przeczytać. */
  odpowiedziala: boolean;
  maFormularz: boolean;
  maEmailWTresci: boolean;
  maCennik: boolean;
  maKariere: boolean;
  wBudowie: boolean;
};

/** Pojedynczy dopasowany sygnał — to jest „dlaczego" pokazywane właścicielowi
 * przy kandydacie. Bez tego sortowanie jest czarną skrzynką, której nikt nie
 * zaufa (ustalenie z briefu Modułu 52). */
export type Sygnal = {
  /** Stabilny klucz — po nim liczymy statystyki, więc NIE zmieniaj istniejących. */
  kod: string;
  opis: string;
  punkty: number;
};

export type Ocena = "A" | "B" | "C";

export type WynikSita =
  | { przyjety: false; powod: string; kodPowodu: string }
  | { przyjety: true; punkty: number; ocena: Ocena; sygnaly: Sygnal[] };

/* ────────────────────────── POKRĘTŁA ────────────────────────── */

/** PKD rdzenia docelowego: powtarzalna papierkowa robota + własny budżet.
 * Prefiksy, nie pełne kody — „6920" łapie 6920Z. */
export const PKD_RDZEN: { prefiks: string; nazwa: string }[] = [
  { prefiks: "6920", nazwa: "Biuro rachunkowe / doradztwo podatkowe" },
  { prefiks: "6910", nazwa: "Kancelaria prawna" },
  { prefiks: "862", nazwa: "Praktyka lekarska / gabinet" },
  { prefiks: "683", nazwa: "Biuro nieruchomości / zarządzanie" },
  { prefiks: "7022", nazwa: "Doradztwo w zakresie prowadzenia działalności" },
];

/** PKD własnej branży — konkurencja albo zrobią to sobie sami. Dyskwalifikacja,
 * nie ujemne punkty: nie ma sensu ich nawet wzbogacać (kosztuje limit CEIDG). */
export const PKD_WLASNA_BRANZA = ["62", "63"];

/** Minimalny wiek firmy w miesiącach. Młodsza nie ma jeszcze ani procesów do
 * zautomatyzowania, ani budżetu. Pokrętło: jeśli powód odrzucenia „za wcześnie
 * na automatyzację" wypłynie na szczyt listy, obniż. */
export const MIN_WIEK_MIESIECY = 18;

/** Wiek „w sam raz" — firma ma nawyki i pieniądze, a jeszcze nie ma działu IT. */
export const WIEK_SLODKI_OD_LAT = 3;
export const WIEK_SLODKI_DO_LAT = 15;

/** Miasta, z których dojazd na spotkanie na żywo jest realny (decyzja
 * właściciela: obszar = Mazowsze, ale punkt za bliskość zostaje). Porównanie
 * po znormalizowanej nazwie miasta. */
export const MIASTA_BLISKIE = ["radom", "przysucha", "warszawa", "grojec", "szydlowiec", "zwolen", "bialobrzegi"];

/** Wagi. Suma możliwa do zebrania: 30+15+15+10+10+10+10+10+5+5 = 120. */
export const WAGI = {
  pkdRdzen: 30,
  vatCzynny: 15,
  email: 15,
  wiekSlodki: 10,
  www: 10,
  telefon: 10,
  formularz: 10,
  cennik: 10,
  wieleAdresow: 5,
  blisko: 5,
  stronaMartwa: -15,
  tylkoFormularz: -10,
} as const;

/** Progi ocen. „C" jest widoczne (na końcu, domyślnie zwinięte) — ukrycie
 * zamieniłoby sito w czarną skrzynkę. */
export const PROG_A = 70;
export const PROG_B = 45;

/* ────────────────────────── narzędzia ────────────────────────── */

/** „69.20.Z" / „6920Z" / " 6920 z " → „6920Z". Rejestr bywa niekonsekwentny,
 * a porównanie prefiksem wymaga jednego kształtu. */
export function normalizujPkd(kod: string): string {
  return (kod || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/** Tekst bez polskich ogonków, małymi literami.
 *
 * `normalize("NFD")` rozkłada ą/ć/ę/ń/ó/ś/ź/ż na literę + znak łączący, ale
 * **NIE rozkłada „ł"** — to osobny znak Unicode bez postaci złożonej. Bez
 * jawnego podstawienia „Szydłowiec" wychodziło „szyd owiec" i nie trafiało w
 * listę miast, a „dołącz do zespołu" nie łapało się na sygnał kariery. */
export function bezOgonkow(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Nazwa firmy do porównań (duplikaty, czarna lista) — bez polskich znaków,
 * interpunkcji i wielkości liter. Ta sama filozofia co `normalizeCompanyName`
 * w `lib/leads.ts`; osobna kopia, bo tamta jest prywatna i służy MIĘKKIEMU
 * ostrzeżeniu, a ta jest kluczem zapisywanym do bazy (czarna lista) — zmiana
 * jednej nie może po cichu przestawić drugiej. */
export function normalizujNazwe(s: string): string {
  return (
    bezOgonkow(s)
      // Interpunkcja NAJPIERW: „sp. z o.o." ma kropki w środku, więc wzorzec
      // formy prawnej puszczony przed ich usunięciem nie trafiał w nic —
      // złapane testem, nie okiem.
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\bsp\s+z\s+o\s+o\b/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Wiek firmy w pełnych miesiącach na dzień `dzisiaj` („YYYY-MM-DD").
 * Zwraca `null`, gdy rejestr nie podał daty rozpoczęcia — brak daty NIE jest
 * powodem odrzucenia (patrz `ocenKandydata`), tylko brakiem punktów. */
export function wiekWMiesiacach(dataRozpoczecia: string, dzisiaj: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dataRozpoczecia || "").slice(0, 10));
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dzisiaj.slice(0, 10));
  if (!m || !d) return null;
  const rokStart = Number(m[1]);
  const miesiacStart = Number(m[2]);
  const dzienStart = Number(m[3]);
  const rokTeraz = Number(d[1]);
  const miesiacTeraz = Number(d[2]);
  const dzienTeraz = Number(d[3]);
  let msc = (rokTeraz - rokStart) * 12 + (miesiacTeraz - miesiacStart);
  // Niepełny miesiąc się nie liczy — inaczej firma założona 30 dni temu
  // raportowałaby „1 miesiąc" mimo że jeszcze go nie skończyła.
  if (dzienTeraz < dzienStart) msc -= 1;
  return msc;
}

/** Czy którykolwiek kod PKD firmy zaczyna się od podanego prefiksu. */
function pkdPasuje(pkd: string[], prefiks: string): boolean {
  const p = normalizujPkd(prefiks);
  return pkd.some((k) => normalizujPkd(k).startsWith(p));
}

/** Nazwa branży do pola `branza` leada — z pierwszego pasującego PKD rdzenia,
 * a gdy żaden nie pasuje (nie powinno się zdarzyć, bo to dyskwalifikator),
 * pusty string zamiast zgadywania. */
export function branzaZPkd(pkd: string[]): string {
  for (const wpis of PKD_RDZEN) {
    if (pkdPasuje(pkd, wpis.prefiks)) return wpis.nazwa;
  }
  return "";
}

/* ────────────────────────── sygnały ze strony (E3) ────────────────────────── */

/** Deterministyczny odczyt sygnałów ze strony głównej firmy. Wejściem jest
 * SUROWY HTML — celowo, żeby dało się to przetestować bez sieci.
 *
 * Świadomie prymitywne wyrażenia zamiast parsera DOM: szukamy obecności
 * pewnych rzeczy, nie ich struktury, a każdy parser to kolejna zależność do
 * pilnowania. Fałszywe trafienie kosztuje 10 punktów, nie decyzję biznesową. */
export function sygnalyZeStrony(html: string): WebsiteSignals {
  const t = (html || "").toLowerCase();
  // Diakrytyki lecą precz, żeby jedno wyrażenie łapało wariant z ogonkami i
  // bez nich („dołącz"/„dolacz", „kariera"/„kariera").
  const bez = bezOgonkow(t);
  return {
    odpowiedziala: true,
    maFormularz: /<form[\s>]/.test(t) || /\btype=["']?submit/.test(t) || /formularz kontaktowy/.test(bez),
    maEmailWTresci: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(t) || /mailto:/.test(t),
    maCennik: /\bcennik\b|\bcennik/.test(bez) || /\babonament/.test(bez) || /\bpakiet(y|ow|ach)?\b/.test(bez) || /\bpricing\b/.test(bez),
    maKariere: /\bkarier[ay]\b/.test(bez) || /\bdolacz do (nas|zespolu)\b/.test(bez) || /\boferty pracy\b/.test(bez) || /\brekrutacj/.test(bez),
    wBudowie: /\bstrona w budowie\b/.test(bez) || /\bw przebudowie\b/.test(bez) || /\bunder construction\b/.test(bez) || /\bcoming soon\b/.test(bez),
  };
}

/** Strona, której nie udało się pobrać (timeout, 404, robots.txt zabronił).
 * Osobna stała, żeby „nie sprawdzaliśmy" (`strona === null`) nie mieszało się
 * z „sprawdziliśmy i nie odpowiada" (−15 pkt). */
export const STRONA_NIE_ODPOWIEDZIALA: WebsiteSignals = {
  odpowiedziala: false,
  maFormularz: false,
  maEmailWTresci: false,
  maCennik: false,
  maKariere: false,
  wBudowie: false,
};

/* ────────────────────────── sito ────────────────────────── */

/** Powody odrzucenia przez SITO (nie przez właściciela) — stabilne kody, po
 * nich liczy się statystyka „co najczęściej odsiewamy". */
export const POWODY_SITA: Record<string, string> = {
  status_nieaktywny: "Firma nie jest aktywna w CEIDG (zawieszona / wykreślona)",
  upadlosc: "Upadłość albo zakaz prowadzenia działalności",
  brak_kontaktu: "Żadnej drogi kontaktu: ani telefon, ani e-mail, ani strona",
  pkd_wlasna_branza: "Własna branża (IT/software) — konkurencja albo zrobią to sami",
  pkd_poza_lista: "PKD spoza listy docelowej",
  za_mloda: "Firma młodsza niż próg wieku — nie ma jeszcze procesów ani budżetu",
};

/** Powody, których używa WŁAŚCICIEL, odrzucając kandydata ręcznie. Krótka,
 * zamknięta lista — wolny tekst nie da się policzyć, a to właśnie ta lista
 * jest drugim licznikiem pętli poprawy. */
export const POWODY_ODRZUCENIA = [
  "Za mała firma",
  "Nie ta branża",
  "Brak sensownego kontaktu",
  "Konkurencja / robi to samo",
  "Już z nimi rozmawiałem",
  "Za daleko",
  "Inny powód",
] as const;

export type PowodOdrzucenia = (typeof POWODY_ODRZUCENIA)[number];

/** Ocena litera z punktów. Wydzielone, bo używa jej też przeliczanie
 * historycznych kandydatów po zmianie wag. */
export function ocenaZPunktow(punkty: number): Ocena {
  if (punkty >= PROG_A) return "A";
  if (punkty >= PROG_B) return "B";
  return "C";
}

/**
 * Serce modułu: dyskwalifikatory → punkty → ocena → uzasadnienie.
 *
 * `dzisiaj` podawane z zewnątrz („YYYY-MM-DD”), a nie brane z `new Date()` —
 * inaczej testu wieku firmy nie dałoby się napisać bez podmieniania zegara.
 *
 * Duplikaty (NIP/nazwa już w `leads`/`clients`) i czarna lista NIE są
 * sprawdzane tutaj: wymagają bazy, a ten plik ma zostać czysty. Odsiewa je
 * `lib/leadHunterRun.ts` PRZED wzbogacaniem — czyli zanim zapłacimy za nie
 * limitem CEIDG.
 */
export function ocenKandydata(k: HunterInput, dzisiaj: string): WynikSita {
  /* ── A. Dyskwalifikatory ── */

  if ((k.status || "").toUpperCase() !== "AKTYWNY") {
    return { przyjety: false, kodPowodu: "status_nieaktywny", powod: POWODY_SITA.status_nieaktywny };
  }
  if (k.upadlosc || k.zakaz) {
    return { przyjety: false, kodPowodu: "upadlosc", powod: POWODY_SITA.upadlosc };
  }

  const wszystkiePkd = [k.pkdGlowny, ...k.pkd].filter(Boolean);
  if (PKD_WLASNA_BRANZA.some((p) => pkdPasuje(wszystkiePkd, p))) {
    return { przyjety: false, kodPowodu: "pkd_wlasna_branza", powod: POWODY_SITA.pkd_wlasna_branza };
  }

  const wpisRdzenia = PKD_RDZEN.find((w) => pkdPasuje(wszystkiePkd, w.prefiks));
  if (!wpisRdzenia) {
    return { przyjety: false, kodPowodu: "pkd_poza_lista", powod: POWODY_SITA.pkd_poza_lista };
  }

  // Brak JAKIEJKOLWIEK drogi kontaktu po całym wzbogaceniu. To jest dokładnie
  // ten śmieć, który dziś produkuje generator z mapy (OSM daje samą nazwę).
  const maTelefon = Boolean(k.telefon.trim());
  const maEmail = Boolean(k.email.trim());
  const maWww = Boolean(k.www.trim());
  if (!maTelefon && !maEmail && !maWww) {
    return { przyjety: false, kodPowodu: "brak_kontaktu", powod: POWODY_SITA.brak_kontaktu };
  }

  const wiekMsc = wiekWMiesiacach(k.dataRozpoczecia, dzisiaj);
  // Brak daty ≠ za młoda. Rejestr czasem jej nie podaje, a odrzucanie z tego
  // powodu wyrzucałoby firmy o nieznanym, nie o złym wieku.
  if (wiekMsc !== null && wiekMsc < MIN_WIEK_MIESIECY) {
    return { przyjety: false, kodPowodu: "za_mloda", powod: POWODY_SITA.za_mloda };
  }

  /* ── B. Punkty ── */

  const sygnaly: Sygnal[] = [];
  const dodaj = (kod: string, opis: string, punkty: number) => sygnaly.push({ kod, opis, punkty });

  dodaj("pkd_rdzen", `Branża docelowa: ${wpisRdzenia.nazwa}`, WAGI.pkdRdzen);

  if ((k.statusVat || "").toLowerCase().startsWith("czynny")) {
    dodaj("vat_czynny", "Czynny podatnik VAT — firma realnie handluje", WAGI.vatCzynny);
  }
  if (maEmail) dodaj("email", "Publiczny e-mail — da się napisać bez formularza", WAGI.email);
  if (maTelefon) dodaj("telefon", "Publiczny telefon", WAGI.telefon);
  if (maWww) dodaj("www", "Ma stronę WWW", WAGI.www);

  if (wiekMsc !== null) {
    const lata = Math.floor(wiekMsc / 12);
    if (lata >= WIEK_SLODKI_OD_LAT && lata <= WIEK_SLODKI_DO_LAT) {
      dodaj("wiek_slodki", `Na rynku ${lata} lat — ma nawyki i budżet, nie ma działu IT`, WAGI.wiekSlodki);
    }
  }

  if (k.liczbaAdresow > 1) {
    dodaj("wiele_adresow", `${k.liczbaAdresow} adresy działalności — jakaś skala`, WAGI.wieleAdresow);
  }

  if (MIASTA_BLISKIE.includes(normalizujNazwe(k.miasto))) {
    dodaj("blisko", `${k.miasto} — spotkanie na żywo realne`, WAGI.blisko);
  }

  if (k.strona) {
    if (!k.strona.odpowiedziala || k.strona.wBudowie) {
      dodaj(
        "strona_martwa",
        k.strona.wBudowie ? "Strona „w budowie”" : "Strona nie odpowiada",
        WAGI.stronaMartwa
      );
    } else {
      if (k.strona.maFormularz) {
        dodaj("formularz", "Formularz kontaktowy — powtarzalne zapytania do obsłużenia", WAGI.formularz);
      }
      if (k.strona.maCennik) {
        dodaj("cennik", "Cennik / abonament / pakiety — powtarzalna usługa", WAGI.cennik);
      }
      // Formularz zamiast maila = trudniej dotrzeć. Liczy się TYLKO gdy strona
      // żyje i faktycznie ma formularz — inaczej karalibyśmy firmę, która po
      // prostu nie ma strony (i już nie dostała +10/+15 za www/e-mail).
      if (k.strona.maFormularz && !maEmail && !k.strona.maEmailWTresci) {
        dodaj("tylko_formularz", "Tylko formularz, żadnego adresu e-mail", WAGI.tylkoFormularz);
      }
    }
  }

  const punkty = sygnaly.reduce((s, x) => s + x.punkty, 0);
  return { przyjety: true, punkty, ocena: ocenaZPunktow(punkty), sygnaly };
}

/** Jednolinijkowe „dlaczego" do notatki leada i do maila — sygnały dodatnie
 * najpierw, ujemne na końcu, każdy z punktami. */
export function uzasadnienie(sygnaly: Sygnal[]): string {
  return [...sygnaly]
    .sort((a, b) => b.punkty - a.punkty)
    .map((s) => `${s.punkty > 0 ? "+" : ""}${s.punkty} ${s.opis}`)
    .join("\n");
}
