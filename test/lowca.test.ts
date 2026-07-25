import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ocenKandydata,
  ocenaZPunktow,
  wiekWMiesiacach,
  normalizujPkd,
  normalizujNazwe,
  sygnalyZeStrony,
  branzaZPkd,
  uzasadnienie,
  STRONA_NIE_ODPOWIEDZIALA,
  WAGI,
  PROG_A,
  PROG_B,
  MIN_WIEK_MIESIECY,
  type HunterInput,
} from "../lib/leadHunter.ts";
import { podejrzanyPrzebieg, PROG_PROBKI } from "../lib/leadHunterRun.ts";

// Sito „Łowcy leadów" (Moduł 52). To JEDYNA reguła biznesowa w tym module,
// która decyduje, kogo właściciel zobaczy w skrzynce — i jedyna, którą da się
// sprawdzić bez sieci i bez tokenu CEIDG. Każdy test pinuje arytmetykę
// (konkretne punkty, konkretny próg), nie tylko „nie rzuca wyjątkiem".

const DZIS = "2026-07-25";

/** Kandydat idealny: biuro rachunkowe z Radomia, VAT czynny, komplet
 * kontaktu, żywa strona z formularzem i cennikiem, 10 lat na rynku,
 * dwa adresy. Wszystkie testy niżej psują z niego jedną rzecz naraz. */
function wzorzec(zmiany: Partial<HunterInput> = {}): HunterInput {
  return {
    nazwa: "Biuro Rachunkowe Kowalska",
    nip: "7962345678",
    status: "AKTYWNY",
    pkdGlowny: "6920Z",
    pkd: ["6920Z", "8299Z"],
    dataRozpoczecia: "2016-03-01",
    telefon: "+48 600 100 200",
    email: "biuro@example.pl",
    www: "example.pl",
    miasto: "Radom",
    liczbaAdresow: 2,
    upadlosc: false,
    zakaz: false,
    statusVat: "Czynny",
    strona: {
      odpowiedziala: true,
      maFormularz: true,
      maEmailWTresci: true,
      maCennik: true,
      maKariere: false,
      wBudowie: false,
    },
    ...zmiany,
  };
}

/* ───────────────────────── dyskwalifikatory ───────────────────────── */

test("zawieszona firma nie wchodzi do skrzynki", () => {
  const w = ocenKandydata(wzorzec({ status: "ZAWIESZONY" }), DZIS);
  assert.equal(w.przyjety, false);
  assert.equal(w.przyjety === false && w.kodPowodu, "status_nieaktywny");
});

test("upadłość i zakaz działalności odrzucają", () => {
  assert.equal(ocenKandydata(wzorzec({ upadlosc: true }), DZIS).przyjety, false);
  assert.equal(ocenKandydata(wzorzec({ zakaz: true }), DZIS).przyjety, false);
});

test("brak JAKIEJKOLWIEK drogi kontaktu odrzuca — to jest ten śmieć z mapy", () => {
  const w = ocenKandydata(wzorzec({ telefon: "", email: "", www: "", strona: null }), DZIS);
  assert.equal(w.przyjety, false);
  assert.equal(w.przyjety === false && w.kodPowodu, "brak_kontaktu");
  // Ale SAM telefon już wystarczy, żeby przejść dalej.
  assert.equal(ocenKandydata(wzorzec({ email: "", www: "", strona: null }), DZIS).przyjety, true);
});

test("własna branża (62/63) odrzucana ZANIM sprawdzimy resztę", () => {
  // Firma IT z pełnym kontaktem i idealnym wiekiem — i tak odpada.
  const w = ocenKandydata(wzorzec({ pkdGlowny: "6201Z", pkd: ["6201Z", "6920Z"] }), DZIS);
  assert.equal(w.przyjety, false);
  assert.equal(w.przyjety === false && w.kodPowodu, "pkd_wlasna_branza");
});

test("PKD spoza listy docelowej odrzucane", () => {
  const w = ocenKandydata(wzorzec({ pkdGlowny: "4711Z", pkd: ["4711Z"] }), DZIS);
  assert.equal(w.przyjety, false);
  assert.equal(w.przyjety === false && w.kodPowodu, "pkd_poza_lista");
});

test("próg wieku: dzień przed progiem odpada, dzień po przechodzi", () => {
  // MIN_WIEK_MIESIECY = 18 → firma z 2025-01-25 ma na 2026-07-25 równo 18 msc.
  const rowno18 = ocenKandydata(wzorzec({ dataRozpoczecia: "2025-01-25" }), DZIS);
  assert.equal(rowno18.przyjety, true, "równo próg = wchodzi");
  const o_dzien_za_mlodo = ocenKandydata(wzorzec({ dataRozpoczecia: "2025-01-26" }), DZIS);
  assert.equal(o_dzien_za_mlodo.przyjety, false);
  assert.equal(o_dzien_za_mlodo.przyjety === false && o_dzien_za_mlodo.kodPowodu, "za_mloda");
  assert.equal(MIN_WIEK_MIESIECY, 18, "zmiana progu = świadome pokrętło, nie przypadek");
});

test("brak daty rozpoczęcia to NIE jest za młoda firma", () => {
  const w = ocenKandydata(wzorzec({ dataRozpoczecia: "" }), DZIS);
  assert.equal(w.przyjety, true);
  // …ale i punktu za „słodki wiek" nie dostaje.
  assert.ok(w.przyjety && !w.sygnaly.some((s) => s.kod === "wiek_slodki"));
});

/* ───────────────────────── punkty i ocena ───────────────────────── */

test("kandydat wzorcowy zbiera 120 pkt i ocenę A", () => {
  const w = ocenKandydata(wzorzec(), DZIS);
  assert.equal(w.przyjety, true);
  if (!w.przyjety) return;
  // 30 PKD + 15 VAT + 15 mail + 10 telefon + 10 www + 10 wiek + 5 adresy
  // + 5 blisko + 10 formularz + 10 cennik = 120, czyli maksimum sita.
  // Bez „tylko formularz”, bo e-mail jest.
  assert.equal(w.punkty, 120);
  assert.equal(w.ocena, "A");
  assert.equal(w.sygnaly.length, 10);
});

test("martwa strona odejmuje i nie dokłada sygnałów z treści", () => {
  const w = ocenKandydata(wzorzec({ strona: STRONA_NIE_ODPOWIEDZIALA }), DZIS);
  assert.ok(w.przyjety);
  if (!w.przyjety) return;
  // 120 − 10 (formularz) − 10 (cennik) − 15 (kara) = 85
  assert.equal(w.punkty, 85);
  assert.ok(w.sygnaly.some((s) => s.kod === "strona_martwa" && s.punkty === WAGI.stronaMartwa));
  assert.ok(!w.sygnaly.some((s) => s.kod === "formularz"));
});

test("„strona w budowie” liczy się jak martwa mimo kodu 200", () => {
  const w = ocenKandydata(
    wzorzec({ strona: { ...wzorzec().strona!, wBudowie: true } }),
    DZIS
  );
  assert.ok(w.przyjety && w.sygnaly.some((s) => s.kod === "strona_martwa"));
});

test("kara „tylko formularz” wchodzi tylko przy braku maila WSZĘDZIE", () => {
  const bezMaila = ocenKandydata(
    wzorzec({ email: "", strona: { ...wzorzec().strona!, maEmailWTresci: false } }),
    DZIS
  );
  assert.ok(bezMaila.przyjety && bezMaila.sygnaly.some((s) => s.kod === "tylko_formularz"));

  // Mail w treści strony (choć rejestr go nie podał) = kary nie ma.
  const mailWTresci = ocenKandydata(wzorzec({ email: "" }), DZIS);
  assert.ok(mailWTresci.przyjety && !mailWTresci.sygnaly.some((s) => s.kod === "tylko_formularz"));
});

test("firma bez strony nie dostaje kary za stronę", () => {
  const w = ocenKandydata(wzorzec({ www: "", strona: null }), DZIS);
  assert.ok(w.przyjety);
  if (!w.przyjety) return;
  assert.ok(!w.sygnaly.some((s) => s.kod.startsWith("strona") || s.kod === "tylko_formularz"));
  // 120 − 10 (www) − 10 (formularz) − 10 (cennik) = 90
  assert.equal(w.punkty, 90);
});

test("progi A/B/C pilnują granic co do punktu", () => {
  assert.equal(ocenaZPunktow(PROG_A), "A");
  assert.equal(ocenaZPunktow(PROG_A - 1), "B");
  assert.equal(ocenaZPunktow(PROG_B), "B");
  assert.equal(ocenaZPunktow(PROG_B - 1), "C");
});

test("„blisko” liczy miasta z ł w nazwie (Szydłowiec) — pułapka NFD", () => {
  const w = ocenKandydata(wzorzec({ miasto: "Szydłowiec" }), DZIS);
  assert.ok(w.przyjety && w.sygnaly.some((s) => s.kod === "blisko"));
  const daleko = ocenKandydata(wzorzec({ miasto: "Gdańsk" }), DZIS);
  assert.ok(daleko.przyjety && !daleko.sygnaly.some((s) => s.kod === "blisko"));
});

/* ───────────────────────── narzędzia ───────────────────────── */

test("normalizacja PKD zjada kropki i spacje", () => {
  assert.equal(normalizujPkd("69.20.Z"), "6920Z");
  assert.equal(normalizujPkd(" 6920 z "), "6920Z");
  // Zapis z kropkami MUSI trafiać w rdzeń — rejestr zwraca oba warianty.
  const w = ocenKandydata(wzorzec({ pkdGlowny: "69.20.Z", pkd: ["69.20.Z"] }), DZIS);
  assert.equal(w.przyjety, true);
});

test("normalizacja nazwy: ogonki, ł i „sp. z o.o.”", () => {
  assert.equal(normalizujNazwe("Kancelaria Radcy Prawnego Łuczyński"), "kancelaria radcy prawnego luczynski");
  assert.equal(normalizujNazwe("EFEKTA Sp. z o.o."), "efekta");
  assert.equal(normalizujNazwe("Żółć  Ćma"), "zolc cma");
});

test("wiek w pełnych miesiącach nie zaokrągla w górę", () => {
  assert.equal(wiekWMiesiacach("2026-06-25", "2026-07-25"), 1);
  assert.equal(wiekWMiesiacach("2026-06-26", "2026-07-25"), 0, "niepełny miesiąc się nie liczy");
  assert.equal(wiekWMiesiacach("2016-03-01", "2026-07-25"), 124);
  assert.equal(wiekWMiesiacach("", "2026-07-25"), null);
});

test("sygnały ze strony czyta się z surowego HTML", () => {
  const s = sygnalyZeStrony(`
    <html><body>
      <h2>Cennik usług</h2>
      <form action="/kontakt"><input name="mail"/></form>
      <a href="mailto:biuro@firma.pl">napisz</a>
      <a href="/kariera">Dołącz do zespołu</a>
    </body></html>`);
  assert.deepEqual(s, {
    odpowiedziala: true,
    maFormularz: true,
    maEmailWTresci: true,
    maCennik: true,
    maKariere: true,
    wBudowie: false,
  });
});

test("„strona w budowie” i pusta strona nie udają sygnałów", () => {
  assert.equal(sygnalyZeStrony("<html><body>Strona w budowie</body></html>").wBudowie, true);
  const pusta = sygnalyZeStrony("<html><body><p>Witamy</p></body></html>");
  assert.equal(pusta.maFormularz, false);
  assert.equal(pusta.maCennik, false);
  assert.equal(pusta.maEmailWTresci, false);
});

test("branża do leada bierze się z PKD, nie z nazwy firmy", () => {
  assert.equal(branzaZPkd(["6910Z"]), "Kancelaria prawna");
  assert.equal(branzaZPkd(["8621Z"]), "Praktyka lekarska / gabinet");
  assert.equal(branzaZPkd(["4711Z"]), "");
});

test("uzasadnienie sortuje od najmocniejszego i pokazuje znak", () => {
  const w = ocenKandydata(wzorzec({ strona: STRONA_NIE_ODPOWIEDZIALA }), DZIS);
  assert.ok(w.przyjety);
  if (!w.przyjety) return;
  const linie = uzasadnienie(w.sygnaly).split("\n");
  assert.match(linie[0], /^\+30 Branża docelowa/);
  assert.match(linie[linie.length - 1], /^-15 Strona nie odpowiada/);
});

/* ───────────── detektor cichej zmiany po stronie CEIDG ───────────── */

// Klient CEIDG czyta pola defensywnie: brakujące pole daje pustą wartość, a nie
// wyjątek. Gdyby rejestr przemianował `telefon`, dostawalibyśmy kandydatów bez
// kontaktu i uznawali to za chudy dzień — bez jednego błędu w logu. Ta reguła
// jest jedyną rzeczą, która taką zmianę zauważy.

test("mała próbka nigdy nie jest podejrzana", () => {
  // Przy trzech firmach 100% „bez kontaktu" nie znaczy nic.
  assert.equal(podejrzanyPrzebieg(3, 3), false);
  assert.equal(podejrzanyPrzebieg(PROG_PROBKI - 1, PROG_PROBKI - 1), false);
});

test("próg 80% liczony co do jednej firmy", () => {
  // 20 firm: 16 bez kontaktu = dokładnie 80% → alarm; 15 = 75% → cisza.
  assert.equal(podejrzanyPrzebieg(20, 16), true);
  assert.equal(podejrzanyPrzebieg(20, 15), false);
  assert.equal(podejrzanyPrzebieg(PROG_PROBKI, PROG_PROBKI), true, "równo próg próbki, komplet bez kontaktu");
});

test("normalny przebieg milczy", () => {
  // Realny rozkład: część JDG faktycznie nie publikuje kontaktu.
  assert.equal(podejrzanyPrzebieg(60, 12), false);
  assert.equal(podejrzanyPrzebieg(60, 0), false);
});
