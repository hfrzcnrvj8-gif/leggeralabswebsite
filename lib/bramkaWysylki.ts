/**
 * Jedna bramka „czy to wolno wysłać" — Faza 2 planu `docs/PLAN-ZAPLECZE.md`.
 *
 * ── PO CO TO POWSTAŁO ─────────────────────────────────────────────────────
 * Każde miejsce sprawdzało przed wysyłką co innego, a razem nie sprawdzały
 * tego, co najważniejsze. Wynik przejścia „na sucho" z 2026-08-02
 * (`docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md`):
 *
 * - **A1** mail zamykający wyszedł do klienta dosłownie z „[Twoje imię]"
 *   i „[uzupełnij, jeśli jest plan…]" — trasa `request-review` nie sprawdzała
 *   NICZEGO poza tym, czy treść jest niepusta,
 * - **A2** oferta poszła i została zaakceptowana z blokiem `WYSTAWCA` równym
 *   „—" — bo wysyłkę blokował brak e-maila KLIENTA, a nie brak wystawcy,
 * - **A3** adres wystawcy drukowała faktura, ale nie oferta i nie umowa,
 * - **A4** szablon dopisał „ok. 2 tygodnie", sekcja „Terminy" mówiła 3 —
 *   i wydruk zawierał oba zdania, bez jednego słowa ostrzeżenia.
 *
 * Wszystkie cztery wyszły z kodem 200. Dlatego bramka jest osobną, czystą
 * funkcją, a nie kolejnym `if` w trasie: cztery trasy pytają ją o to samo
 * i dostają tę samą odpowiedź.
 *
 * ── DLACZEGO LISTA, A NIE `true`/`false` ──────────────────────────────────
 * Bo część rzeczy to **blokada** (dokument bez wystawcy nie ma prawa wyjść),
 * a część **ostrzeżenie** (dwa różne terminy w jednym dokumencie — czasem
 * właściciel ma rację, a panel nie). Decyzja właściciela z 2026-08-02:
 * ostrzeżenie przechodzi się jednym kliknięciem „Wyślij mimo to", blokady
 * nie przechodzi się wcale.
 *
 * ── DLACZEGO TEN PLIK NIE IMPORTUJE `lib/db.ts` ───────────────────────────
 * Ten sam zestaw reguł liczy trasa (żeby odmówić naprawdę) i edytor (żeby
 * pokazać pasek, zanim właściciel kliknie „Wyślij"). Import `db.ts`
 * uniemożliwiłby użycie w komponencie `"use client"` — a wtedy reguły
 * rozjechałyby się na dwie kopie, dokładnie tak jak mapa pól klienta
 * rozjechała się na pięć (patrz `lib/przepisanie.ts`).
 *
 * **Blokada w interfejsie nie jest blokadą** (audyt Modułu 57) — dlatego
 * trasa woła to samo, co edytor, i to trasa mówi ostatnie słowo.
 */

const tekst = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

// ── Kształt odpowiedzi ─────────────────────────────────────────────────────

export type PowagaZastrzezenia = "blokada" | "ostrzezenie";

export type Zastrzezenie = {
  /** Stabilny identyfikator reguły — po nim testy i sonda przejścia
   *  rozpoznają POWÓD odmowy, nie sam kod HTTP. Pierwsza wersja przejścia
   *  uznała lukę A2 za naprawioną, bo `/send` zwróciło 400 — ale z powodu
   *  pustego e-maila klienta. Sprawdzaj powód, nie kod. */
  id: string;
  powaga: PowagaZastrzezenia;
  /** Co jest nie tak — zdanie po ludzku, nie nazwa kolumny. */
  tekst: string;
  /** Gdzie to poprawić — jedno zdanie, bo „Dane firmy" siedzą w module
   *  Faktury i nikt tego nie zgadnie z poziomu oferty (znalezisko A2). */
  gdzie?: string;
};

export type WynikBramki = {
  blokady: Zastrzezenie[];
  ostrzezenia: Zastrzezenie[];
  /** Brak blokad. Ostrzeżenia NIE odbierają zgody — od nich jest „mimo to". */
  wolnoWyslac: boolean;
};

function zbierz(z: Zastrzezenie[]): WynikBramki {
  const blokady = z.filter((x) => x.powaga === "blokada");
  const ostrzezenia = z.filter((x) => x.powaga === "ostrzezenie");
  return { blokady, ostrzezenia, wolnoWyslac: blokady.length === 0 };
}

/** Jedno zdanie z całej listy — do `toast()` i do odpowiedzi trasy, gdzie
 *  nie ma miejsca na listę. Kolejność: blokady przed ostrzeżeniami. */
export function komunikatBramki(w: WynikBramki): string {
  const z = [...w.blokady, ...w.ostrzezenia];
  if (z.length === 0) return "";
  if (z.length === 1) return z[0].tekst;
  return `${z[0].tekst} (i ${z.length - 1} ${z.length === 2 ? "inna rzecz" : "inne rzeczy"})`;
}

// ── Odmowa po stronie trasy ────────────────────────────────────────────────

export type OdmowaBramki = { status: 400 | 409; error: string; bramka: WynikBramki };

/**
 * Zamienia wynik bramki na odmowę trasy — albo `null`, gdy wolno wysłać.
 *
 * Dwa kody, bo to dwie różne sytuacje dla wołającego:
 * - **400** — blokada. Nie da się przejść, trzeba poprawić dokument.
 * - **409** — same ostrzeżenia i wołający ich jeszcze nie widział. Panel
 *   pokazuje listę i powtarza żądanie z `mimo_ostrzezen: true` (decyzja
 *   właściciela: „Wyślij mimo to" jednym kliknięciem).
 *
 * Ostrzeżenia jadą też w odpowiedzi 400 — poprawiając blokadę, właściciel
 * ma od razu widzieć całą listę, a nie odkrywać ją kolejnymi próbami.
 */
export function odmowaBramki(w: WynikBramki, mimoOstrzezen: boolean): OdmowaBramki | null {
  if (w.blokady.length > 0) {
    return { status: 400, error: komunikatBramki({ ...w, ostrzezenia: [] }), bramka: w };
  }
  if (w.ostrzezenia.length > 0 && !mimoOstrzezen) {
    return { status: 409, error: komunikatBramki(w), bramka: w };
  }
  return null;
}

/** Czy żądanie niesie zgodę „wyślij mimo ostrzeżeń". Jedno miejsce, bo cztery
 *  trasy czytają to z ciała żądania, którego wcześniej w ogóle nie miały. */
export function mimoOstrzezen(body: unknown): boolean {
  return !!(body && typeof body === "object" && (body as Record<string, unknown>).mimo_ostrzezen === true);
}

// ── Co bramka dostaje na wejściu ───────────────────────────────────────────

export type RodzajWysylki = "oferta" | "umowa" | "faktura";

const NAZWA_RODZAJU: Record<RodzajWysylki, string> = {
  oferta: "Oferta",
  umowa: "Dokument",
  faktura: "Faktura",
};

/** Gdzie mieszkają dane wystawcy — powtarzane w kilku komunikatach, bo to
 *  jedyny nieoczywisty adres w całym panelu (znalezisko A2: „ikona banku bez
 *  podpisu w pasku narzędzi modułu Faktury"). */
const GDZIE_DANE_FIRMY = "Faktury → Dane firmy (ikona banku w pasku narzędzi)";

export type WejscieBramki = {
  rodzaj: RodzajWysylki;
  /** Wiersz dokumentu — kolumny `klient_*`, `typ`, `numer`, `uwagi`… */
  dokument: Record<string, unknown>;
  /** Wiersz `company_settings`. `null` = ustawienia w ogóle nie istnieją. */
  wystawca: Record<string, unknown> | null;
  /** Pozycje cennika (oferta). */
  pozycje?: Record<string, unknown>[];
  /** Sekcje opisowe (oferta). */
  sekcje?: Record<string, unknown>[];
};

// ── Reguły: wystawca ───────────────────────────────────────────────────────

/**
 * Dane naszej strony. Wspólne dla wszystkich trzech rodzajów, bo anonimowy
 * dokument jest anonimowy niezależnie od tego, co na nim napisano.
 *
 * Adres jest blokadą na umowie i fakturze (oba dokumenty IDENTYFIKUJĄ strony
 * — faktura z mocy przepisu, umowa z natury), a ostrzeżeniem na ofercie:
 * oferta niczego nie rozstrzyga, więc brak adresu jest niechlujstwem, a nie
 * wadą dokumentu.
 */
function reguleWystawcy(w: Record<string, unknown> | null, rodzaj: RodzajWysylki): Zastrzezenie[] {
  const z: Zastrzezenie[] = [];
  const nazwa = tekst(w?.nazwa);
  const nip = tekst(w?.nip);
  const maAdres =
    !!(tekst(w?.ulica) && (tekst(w?.kod) || tekst(w?.miasto))) || !!tekst(w?.adres);

  if (!nazwa) {
    z.push({
      id: "wystawca-bez-nazwy",
      powaga: "blokada",
      tekst: `${NAZWA_RODZAJU[rodzaj]} wyszłaby do klienta bez nazwy wystawcy — w rubryce „Wystawca” stanie „—”.`,
      gdzie: GDZIE_DANE_FIRMY,
    });
  }
  if (!nip) {
    z.push({
      id: "wystawca-bez-nip",
      powaga: "blokada",
      tekst: "Wystawca nie ma NIP-u — dokument nie identyfikuje strony, która go wystawiła.",
      gdzie: GDZIE_DANE_FIRMY,
    });
  }
  if (!maAdres) {
    z.push({
      id: "wystawca-bez-adresu",
      powaga: rodzaj === "oferta" ? "ostrzezenie" : "blokada",
      tekst:
        rodzaj === "faktura"
          ? "Wystawca nie ma adresu — faktura bez adresu sprzedawcy jest wadliwa."
          : rodzaj === "umowa"
            ? "Wystawca nie ma adresu — dokument identyfikuje strony, więc adres wykonawcy musi na nim być."
            : "Wystawca nie ma adresu — oferta pokaże samą nazwę i NIP.",
      gdzie: GDZIE_DANE_FIRMY,
    });
  }
  return z;
}

// ── Reguły: odbiorca ───────────────────────────────────────────────────────

function reguleOdbiorcy(d: Record<string, unknown>, rodzaj: RodzajWysylki): Zastrzezenie[] {
  const z: Zastrzezenie[] = [];
  const nazwa = tekst(d.klient_nazwa);
  const email = tekst(d.klient_email);
  const maAdres = !!(tekst(d.klient_ulica) && (tekst(d.klient_kod) || tekst(d.klient_miasto))) || !!tekst(d.klient_adres);

  if (!nazwa) {
    z.push({
      id: "odbiorca-bez-nazwy",
      powaga: "blokada",
      tekst: "Dokument nie ma nazwy odbiorcy — nie wiadomo, do kogo jest zaadresowany.",
      gdzie: "pole „Powiązany klient” w edytorze",
    });
  }
  // Mail jest jedyną drogą, którą ten dokument wychodzi — bez adresu nie ma
  // dokąd go wysłać. To sprawdzenie stało dotąd w trzech trasach osobno,
  // każda z własnym komunikatem.
  if (!email) {
    z.push({
      id: "odbiorca-bez-emaila",
      powaga: "blokada",
      tekst:
        rodzaj === "faktura"
          ? "Brak adresu e-mail nabywcy — nie ma dokąd wysłać faktury."
          : "Brak adresu e-mail klienta — nie ma dokąd wysłać dokumentu.",
      gdzie: "pole „E-mail” w edytorze albo karta klienta",
    });
  }
  if (!maAdres) {
    z.push({
      id: "odbiorca-bez-adresu",
      powaga: rodzaj === "oferta" ? "ostrzezenie" : "blokada",
      tekst:
        rodzaj === "oferta"
          ? "Odbiorca nie ma adresu — oferta będzie zaadresowana do samej nazwy firmy."
          : "Odbiorca nie ma adresu — dokument identyfikuje strony, więc adres musi na nim być.",
      gdzie: "karta klienta (adres dociąga się do dokumentu-szkicu sam)",
    });
  }
  return z;
}

// ── Reguły: sprzeczne terminy (A4) ─────────────────────────────────────────

/** Zdanie mówi o terminie dopiero wtedy, gdy mówi o terminie. Bez tego filtru
 *  „5 dni na uwagi" i „2 tygodnie realizacji" wyglądają jak sprzeczność. */
const KONTEKST_TERMINU = /(realizacj|wdro[żz]|termin|wykonani|dostarcz|harmonogram|zako[ńn]cz)/i;

/** „ok. 2 tygodnie", „14 dni", „1 miesiąc". Świadomie bez słownych liczebników
 *  („dwa tygodnie") — wpisujemy je cyframi, a zgadywanie form fleksyjnych
 *  dałoby fałszywe alarmy, czyli dokładnie to, co usypia czujność. */
const WZORZEC_CZASU = /(\d{1,3})\s*(tygodni\w*|tyg\.?|dni\w*|dzie[ńn]|miesi[ąa]c\w*|mies\.?)/gi;

const DNI_W_JEDNOSTCE: [RegExp, number][] = [
  [/^tyg/i, 7],
  [/^(dni|dzie)/i, 1],
  [/^mies/i, 30],
];

export type WzmiankaOTerminie = { dni: number; fraza: string };

/**
 * Wyciąga z tekstu wszystkie wzmianki o czasie realizacji, sprowadzone do dni.
 *
 * Miesiąc liczymy jako 30 dni świadomie: to porównanie ma odpowiedzieć na
 * pytanie „czy dokument mówi dwie różne rzeczy", a nie policzyć datę. Datę
 * liczy `terminZCzasuRealizacji` z `lib/przepisanie.ts`, kalendarzowo.
 */
export function wzmiankiOTerminie(tresc: string): WzmiankaOTerminie[] {
  const out: WzmiankaOTerminie[] = [];
  // Linia, a w niej OKNO wokół liczby — nie „zdanie".
  //
  // Pierwsza wersja dzieliła tekst na zdania po kropce i przegapiła dokładnie
  // ten przypadek, dla którego powstała: „Czas realizacji: ok. 2 tygodnie od
  // akceptacji" rozpada się na kropce w „ok." i fragment z liczbą traci słowo
  // „realizacji". Test to złapał, kod nie pokazywał tego wcale.
  for (const linia of tekst(tresc).split("\n")) {
    for (const m of linia.matchAll(WZORZEC_CZASU)) {
      const liczba = Number(m[1]);
      if (!Number.isFinite(liczba) || liczba <= 0) continue;
      const mnoznik = DNI_W_JEDNOSTCE.find(([re]) => re.test(m[2]))?.[1];
      if (!mnoznik) continue;
      const od = Math.max(0, (m.index ?? 0) - 60);
      if (!KONTEKST_TERMINU.test(linia.slice(od, (m.index ?? 0) + m[0].length + 20))) continue;
      out.push({ dni: liczba * mnoznik, fraza: m[0].trim() });
    }
  }
  return out;
}

/**
 * Ostrzeżenie, gdy jeden dokument podaje dwa różne czasy realizacji.
 *
 * Znalezisko A4 w czystej postaci: szablon „Audyt / PoC AI" dopisał do Uwag
 * „Czas realizacji: ok. 2 tygodnie od akceptacji", a sekcja „Terminy" mówiła
 * 3 tygodnie — i wydruk zawierał oba zdania. Nic tego nie sygnalizowało.
 */
export function sprzeczneTerminy(teksty: (string | null | undefined)[], tygodnieZPola?: unknown): Zastrzezenie[] {
  const wzmianki = teksty.flatMap((t) => wzmiankiOTerminie(tekst(t)));
  const zPola = Math.trunc(Number(tygodnieZPola));
  if (Number.isFinite(zPola) && zPola > 0) {
    wzmianki.push({ dni: zPola * 7, fraza: `${zPola} tyg. (pole „Czas realizacji”)` });
  }

  const wgDni = new Map<number, string>();
  for (const w of wzmianki) if (!wgDni.has(w.dni)) wgDni.set(w.dni, w.fraza);
  if (wgDni.size < 2) return [];

  const frazy = [...wgDni.entries()].sort((a, b) => a[0] - b[0]).map(([, f]) => `„${f}”`);
  return [
    {
      id: "sprzeczne-terminy",
      powaga: "ostrzezenie",
      tekst: `Dokument podaje dwa różne czasy realizacji: ${frazy.join(" i ")}. Klient przeczyta oba.`,
      gdzie: "Uwagi, sekcje opisowe i karta „Realizacja” w edytorze",
    },
  ];
}

// ── Reguły: treść dokumentu ────────────────────────────────────────────────

function reguleTresci(we: WejscieBramki): Zastrzezenie[] {
  const z: Zastrzezenie[] = [];
  const d = we.dokument;

  if (we.rodzaj === "oferta") {
    const pozycje = we.pozycje ?? [];
    const sekcje = we.sekcje ?? [];
    if (pozycje.length === 0 && sekcje.length === 0) {
      z.push({
        id: "oferta-pusta",
        powaga: "blokada",
        tekst: "Oferta nie ma ani jednej pozycji i ani jednej sekcji — klient dostałby pustą kartkę.",
        gdzie: "karty „Pozycje” i „Sekcje” w edytorze oferty",
      });
    } else if (sekcje.length === 0) {
      // Panel mówił to już wcześniej w edytorze — ale nie mówił tego przy
      // wysyłce, więc szablon zostawiał ofertę dokładnie w tym stanie, przed
      // którym panel ostrzega (druga część znaleziska A4).
      z.push({
        id: "oferta-bez-sekcji",
        powaga: "ostrzezenie",
        tekst: "Oferta nie ma ani jednej sekcji opisowej — wyjdzie jako sam cennik.",
        gdzie: "karta „Sekcje” w edytorze oferty",
      });
    }
    z.push(
      ...sprzeczneTerminy(
        [tekst(d.uwagi), ...(we.sekcje ?? []).map((s) => tekst(s.tresc))],
        d.czas_realizacji_tygodnie
      )
    );
  }

  if (we.rodzaj === "umowa") {
    // Tylko `typ = 'umowa'`: NDA nie ma zakresu prac, a DPA opisuje
    // powierzenie danych, nie robotę do wykonania.
    if (tekst(d.typ) === "umowa" && !tekst(d.zakres_prac)) {
      z.push({
        id: "umowa-bez-zakresu",
        powaga: "blokada",
        tekst: "Umowa nie ma zakresu prac — druga strona podpisałaby zobowiązanie bez przedmiotu.",
        gdzie: "pole „Zakres prac” w edytorze umowy",
      });
    }
    z.push(...sprzeczneTerminy([tekst(d.zakres_prac), tekst(d.uwagi)]));
  }

  if (we.rodzaj === "faktura") {
    // Numer nadaje dopiero wystawienie — szkic nie jest dokumentem księgowym.
    if (!tekst(d.numer)) {
      z.push({
        id: "faktura-bez-numeru",
        powaga: "blokada",
        tekst: "Wystaw najpierw fakturę — szkicu bez numeru nie da się wysłać klientowi.",
        gdzie: "przycisk „Wystaw” w edytorze faktury",
      });
    }
  }

  return z;
}

// ── Wejście główne: dokument ───────────────────────────────────────────────

/**
 * Co jest nie tak z tym dokumentem, zanim wyjdzie do klienta.
 *
 * Woła to trasa (`POST /api/<moduł>/[id]/send`) i edytor (pasek + okno przed
 * wysyłką). Ta sama odpowiedź w obu miejscach jest całym sensem tego pliku.
 */
export function sprawdzDokumentPrzedWysylka(we: WejscieBramki): WynikBramki {
  return zbierz([
    ...reguleWystawcy(we.wystawca, we.rodzaj),
    ...reguleOdbiorcy(we.dokument, we.rodzaj),
    ...reguleTresci(we),
  ]);
}

// ── Wejście główne: mail pisany ręcznie ────────────────────────────────────

/** Nawias kwadratowy z treścią w środku — „[Twoje imię]", „[uzupełnij…]".
 *  Ograniczony do jednej linii i 120 znaków, żeby nie łapać nawiasów, które
 *  ktoś świadomie wpisał wokół dłuższego fragmentu. */
const NIEWYPELNIONY_NAWIAS = /\[[^\]\n]{1,120}\]/g;

/** Mail twierdzi, że projekt się skończył. */
const MOWI_O_ZAKONCZENIU = /(zako[ńn]czon|zamkni[ęe]t|uko[ńn]czon|complete|abgeschlossen)/i;

export type WejscieBramkiMaila = {
  tresc: string;
  /** Status projektu, którego mail dotyczy — `null`, gdy mail nie dotyczy
   *  żadnego projektu (wtedy reguła o „zakończonym" nie ma czego porównać). */
  statusProjektu?: string | null;
};

/**
 * Co jest nie tak z tym mailem, zanim wyjdzie.
 *
 * Znalezisko A1, najpoważniejsze z całego przejścia: do klienta poszło
 * dosłownie „Pozdrawiam, [Twoje imię]". Jedno kliknięcie, bez ostrzeżenia,
 * kod 200. Panel ZNAŁ imię właściciela — siedzi w „Danych firmy" — i go nie
 * użył. Od Fazy 2 szkic dostaje je od razu (`lib/projects.ts`), a wszystko,
 * czego nie da się podstawić automatycznie, zatrzymuje wysyłkę tutaj.
 */
export function sprawdzMailPrzedWysylka(we: WejscieBramkiMaila): WynikBramki {
  const z: Zastrzezenie[] = [];
  const tresc = tekst(we.tresc);

  if (!tresc) {
    z.push({ id: "mail-pusty", powaga: "blokada", tekst: "Wiadomość jest pusta." });
    return zbierz(z);
  }

  const nawiasy = [...tresc.matchAll(NIEWYPELNIONY_NAWIAS)].map((m) => m[0]);
  if (nawiasy.length > 0) {
    const przyklady = [...new Set(nawiasy)].slice(0, 3).join(", ");
    z.push({
      id: "mail-z-nawiasami",
      powaga: "blokada",
      tekst:
        `W treści zostały niewypełnione miejsca do uzupełnienia: ${przyklady}` +
        (new Set(nawiasy).size > 3 ? " …" : "") +
        ". Klient przeczyta je dosłownie.",
      gdzie: "pole treści wiadomości",
    });
  }

  const status = tekst(we.statusProjektu);
  if (status && status !== "Wdrożone" && MOWI_O_ZAKONCZENIU.test(tresc)) {
    z.push({
      id: "mail-mowi-zakonczony",
      powaga: "ostrzezenie",
      tekst: `Wiadomość mówi o zakończeniu, a projekt ma status „${status}”.`,
      gdzie: "status projektu na tablicy",
    });
  }

  return zbierz(z);
}
