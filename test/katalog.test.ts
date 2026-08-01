import { test } from "node:test";
import assert from "node:assert/strict";
import {
  czytajPolaKatalogu,
  normalizeCatalogRow,
  catalogMargin,
  catalogMarginPercent,
  hasPriceRange,
  MAX_KWOTA_KATALOGU,
} from "../lib/catalog.ts";

// Bramka zapisu katalogu (Moduł 62). Stawka jest taka sama jak przy fakturach,
// tylko trudniejsza do zauważenia: katalog to DRUGA POŁOWA każdej marży, a trzy
// z czterech cichych podmian nie dawały w interfejsie żadnego objawu (zła
// kategoria i zły VAT wyglądają na wybrane świadomie, a odwrotne widełki UI po
// prostu ukrywa). Sonda `curl` sprawdziła to raz — test pilnuje, żeby nie
// wróciło.

test("słowniki: śmieć odbija się błędem, nie podmienia na wartość domyślną", () => {
  assert.equal(czytajPolaKatalogu({ nazwa: "X", kategoria: "hopla" }).pola, undefined);
  assert.match(czytajPolaKatalogu({ nazwa: "X", kategoria: "hopla" }).blad ?? "", /kategoria/i);
  assert.match(czytajPolaKatalogu({ nazwa: "X", vat_stawka: "999" }).blad ?? "", /VAT/);
  assert.match(czytajPolaKatalogu({ nazwa: "X", waluta: "BITCOIN" }).blad ?? "", /waluta/i);
});

test("spacja wokół wartości ze słownika ma przejść, nie odbić się", () => {
  const w = czytajPolaKatalogu({ nazwa: "X", kategoria: " gpu ", waluta: " EUR ", vat_stawka: " zw " });
  assert.equal(w.pola?.kategoria, "gpu");
  assert.equal(w.pola?.waluta, "EUR");
  assert.equal(w.pola?.vat_stawka, "zw");
});

test("liczby: ujemna CENA wolno (rabat), ujemny KOSZT nie", () => {
  assert.equal(czytajPolaKatalogu({ nazwa: "Rabat", cena_netto: -500 }).pola?.cena_netto, -500);
  assert.match(czytajPolaKatalogu({ nazwa: "X", koszt_zakupu: -1 }).blad ?? "", /ujemn/);
});

test("liczby: absurd i tekst odbijają się błędem", () => {
  assert.match(czytajPolaKatalogu({ nazwa: "X", cena_netto: 1e30 }).blad ?? "", /sufit/);
  assert.match(czytajPolaKatalogu({ nazwa: "X", cena_netto: "abc" }).blad ?? "", /nie jest liczb/);
  assert.equal(czytajPolaKatalogu({ nazwa: "X", cena_netto: MAX_KWOTA_KATALOGU }).blad, undefined);
});

test("przecinek dziesiętny z polskiej klawiatury to liczba, nie śmieć", () => {
  assert.equal(czytajPolaKatalogu({ nazwa: "X", cena_netto: "1200,50" }).pola?.cena_netto, 1200.5);
});

test("widełki odwrotne odbijają się (dotąd UI po prostu je UKRYWAŁ)", () => {
  assert.match(czytajPolaKatalogu({ nazwa: "X", cena_min: 9000, cena_max: 100 }).blad ?? "", /widełek/);
  assert.equal(czytajPolaKatalogu({ nazwa: "X", cena_min: 100, cena_max: 9000 }).blad, undefined);
});

test("pusto ≠ zero: brak kosztu zakupu to `null`, czyli marża nieznana", () => {
  const w = czytajPolaKatalogu({ nazwa: "X", koszt_zakupu: "" });
  assert.equal(w.pola?.koszt_zakupu, null);
  assert.equal(catalogMargin(1000, null), null);
  assert.equal(catalogMargin(1000, 0), 1000);
});

test("PATCH jest CZĘŚCIOWY: pole spoza ciała żądania zostaje nietknięte", () => {
  const istniejaca = czytajPolaKatalogu({
    nazwa: "Serwer",
    waluta: "EUR",
    jednostka: "kpl.",
    cena_min: 100,
    cena_max: 200,
    koszt_zakupu: 50,
  }).pola!;
  // Klient, który o walucie nie wie (starsza wersja apki) — przysyła samą nazwę.
  const po = czytajPolaKatalogu({ nazwa: "Serwer 2" }, istniejaca).pola!;
  assert.equal(po.nazwa, "Serwer 2");
  assert.equal(po.waluta, "EUR");
  assert.equal(po.jednostka, "kpl.");
  assert.equal(po.cena_min, 100);
  assert.equal(po.koszt_zakupu, 50);
});

test("odczyt jest odporny na to, co siedzi w bazie od wcześniej", () => {
  // Nieznana waluta czyta się jako PLN — `formatMoney` na złym kodzie RZUCA,
  // a rzucający formater wywala CAŁY ekran, nie jeden wiersz.
  assert.equal(normalizeCatalogRow({ id: "1", waluta: "BITCOIN-I-" }).waluta, "PLN");
  assert.equal(normalizeCatalogRow({ id: "1", waluta: "EUR" }).waluta, "EUR");
  assert.equal(normalizeCatalogRow({ id: "1", vat_stawka: "999" }).vat_stawka, "23");
  assert.equal(normalizeCatalogRow({ id: "1", cena_netto: "nie-liczba" }).cena_netto, 0);
  assert.equal(normalizeCatalogRow({ id: "1", koszt_zakupu: "nie-liczba" }).koszt_zakupu, null);
});

test("marża procentowa liczy się OD CENY SPRZEDAŻY i widzi stratę", () => {
  assert.equal(catalogMarginPercent(1000, 250), 75);
  assert.equal(catalogMarginPercent(1000, 4000), -300);
  assert.equal(catalogMarginPercent(0, 100), null);
  assert.equal(hasPriceRange(100, 90), false);
});
