import { test } from "node:test";
import assert from "node:assert/strict";
import {
  czytajPolaKosztu,
  czytajPolaCyklu,
  normalizeCostRow,
  kursDoPln,
  wPln,
  dniPoTerminieKosztu,
  vatDoOdliczenia,
  maPrzelicznik,
  MAX_KWOTA_KOSZTU,
  MAX_KURS,
} from "../lib/costs.ts";

/*
 * Bramka zapisu kosztów (Moduł 63). Stawka jest tu KSIĘGOWA, nie kosmetyczna:
 * zła liczba w koszcie nie wygląda na złą i wychodzi dopiero przy rozliczeniu.
 * Każdy test niżej odpowiada jednej rzeczy, którą sonda `curl` zmierzyła na
 * żywym serwerze przed poprawką — test pilnuje, żeby nie wróciła.
 */

test("vat_odliczenie_procent: śmieć NIE zamienia się w najkorzystniejsze 100%", () => {
  // Zmierzone przed poprawką: koszt z ustawionym 0% (reprezentacja) po
  // PATCH {"vat_odliczenie_procent":999} wracał na 100% i oddawał {"ok":true}.
  const w = czytajPolaKosztu({ vat_odliczenie_procent: 999 }, { vat_odliczenie_procent: 0 });
  assert.equal(w.pola, undefined);
  assert.match(w.blad ?? "", /odliczenia VAT/i);
  // A wartość ze słownika ma przejść i NIE zostać nadpisana istniejącą.
  assert.equal(czytajPolaKosztu({ vat_odliczenie_procent: 50 }, { vat_odliczenie_procent: 0 }).pola?.vat_odliczenie_procent, 50);
});

test("słowniki: śmieć odbija się błędem, nie podmienia na wartość domyślną", () => {
  assert.match(czytajPolaKosztu({ kategoria: "CO-TO-JEST" }).blad ?? "", /kategoria/i);
  assert.match(czytajPolaKosztu({ vat_stawka: "999" }).blad ?? "", /VAT/);
  assert.match(czytajPolaKosztu({ status: "Prawie" }).blad ?? "", /status/i);
  assert.match(czytajPolaKosztu({ metoda_platnosci: "karat" }).blad ?? "", /metoda/i);
  assert.match(czytajPolaKosztu({ waluta: "BITCOIN" }).blad ?? "", /waluta/i);
});

test("metoda płatności: pustka jest poprawna, literówka nie", () => {
  assert.equal(czytajPolaKosztu({ metoda_platnosci: "" }).pola?.metoda_platnosci, null);
  assert.equal(czytajPolaKosztu({ metoda_platnosci: null }).pola?.metoda_platnosci, null);
  assert.equal(czytajPolaKosztu({ metoda_platnosci: " karta " }).pola?.metoda_platnosci, "karta");
});

test("kwota: absurd odbija się, ujemna przechodzi (korekta zakupowa)", () => {
  assert.match(czytajPolaKosztu({ kwota_netto: 9e15 }).blad ?? "", /sufit/);
  assert.match(czytajPolaKosztu({ kwota_netto: "abc" }).blad ?? "", /nie jest liczb/);
  // Faktura korygująca od dostawcy ma kwotę ujemną i musi dać się zapisać.
  assert.equal(czytajPolaKosztu({ kwota_netto: -5000 }).pola?.kwota_netto, -5000);
  assert.equal(czytajPolaKosztu({ kwota_netto: MAX_KWOTA_KOSZTU }).pola?.kwota_netto, MAX_KWOTA_KOSZTU);
});

test("waluta obca WYMAGA kursu — jedynka nie podstawia się po cichu", () => {
  // To jest cały sens kolumny: 100 EUR z kursem 1 to 100 zł, czyli błąd
  // o rząd wielkości, którego nikt nie zobaczy w interfejsie.
  assert.match(czytajPolaKosztu({ waluta: "EUR", kwota_netto: 100 }).blad ?? "", /kursu/i);
  assert.match(czytajPolaKosztu({ waluta: "EUR", kurs_pln: 0 }).blad ?? "", /kursu/i);
  assert.match(czytajPolaKosztu({ waluta: "EUR", kurs_pln: -4 }).blad ?? "", /kursu/i);
  assert.match(czytajPolaKosztu({ waluta: "EUR", kurs_pln: MAX_KURS + 1 }).blad ?? "", /nierealny/);
  assert.equal(czytajPolaKosztu({ waluta: "EUR", kurs_pln: 4.31 }).pola?.kurs_pln, 4.31);
});

test("PLN nigdy nie ma kursu — nawet gdy ktoś go przyśle", () => {
  assert.equal(czytajPolaKosztu({ waluta: "PLN", kurs_pln: 4.31 }).pola?.kurs_pln, null);
  // Powrót z EUR na PLN kasuje kurs, zamiast zostawiać martwe 4,31.
  assert.equal(czytajPolaKosztu({ waluta: "PLN" }, { waluta: "EUR", kurs_pln: 4.31 }).pola?.kurs_pln, null);
});

test("daty: rok „0202” odbija się błędem (pułapka <input type=\"date\">)", () => {
  assert.match(czytajPolaKosztu({ data_wydatku: "0202-01-01" }).blad ?? "", /Data wydatku/);
  assert.match(czytajPolaKosztu({ termin_platnosci: "0202-01-01" }).blad ?? "", /Termin/);
  // Ta sama pułapka w polu, które steruje automatem generującym koszty.
  assert.match(czytajPolaCyklu({ nazwa: "X", next_run: "0202-01-01" }).blad ?? "", /Data następnego/);
  assert.equal(czytajPolaCyklu({ nazwa: "X", next_run: "2026-09-01" }).pola?.next_run, "2026-09-01");
});

test("daty: pusty string kasuje datę, brak klucza jej nie rusza", () => {
  assert.equal(czytajPolaKosztu({ termin_platnosci: "" }, { termin_platnosci: "2026-08-10" }).pola?.termin_platnosci, null);
  assert.equal(czytajPolaKosztu({}, { termin_platnosci: "2026-08-10" }).pola?.termin_platnosci, "2026-08-10");
});

test("PATCH jest NAPRAWDĘ częściowy — jedno pole nie kasuje reszty", () => {
  // Katalog (Moduł 62) zachowywał się tu jak PUT i cicho kasował wszystko,
  // czego nie przysłano. Sonda pokazała, że koszt był pod tym względem
  // poprawny — ten test pilnuje, żeby przepisanie trasy tego nie zepsuło.
  const istniejacy = {
    dostawca_nazwa: "Vercel",
    kategoria: "Subskrypcje" as const,
    kwota_netto: 80,
    vat_stawka: "23" as const,
    waluta: "EUR" as const,
    kurs_pln: 4.31,
    vat_odliczenie_procent: 50,
    status: "Nieopłacony" as const,
    termin_platnosci: "2026-08-20",
    numer_faktury: "FV/7/2026",
  };
  const w = czytajPolaKosztu({ opis: "tylko opis" }, istniejacy);
  assert.equal(w.pola?.opis, "tylko opis");
  assert.equal(w.pola?.dostawca_nazwa, "Vercel");
  assert.equal(w.pola?.kategoria, "Subskrypcje");
  assert.equal(w.pola?.kwota_netto, 80);
  assert.equal(w.pola?.waluta, "EUR");
  assert.equal(w.pola?.kurs_pln, 4.31);
  assert.equal(w.pola?.vat_odliczenie_procent, 50);
  assert.equal(w.pola?.termin_platnosci, "2026-08-20");
  assert.equal(w.pola?.numer_faktury, "FV/7/2026");
});

test("odczyt: wiersz ze śmieciami z bazy daje się bezpiecznie pokazać", () => {
  // Bramka zapisu nie naprawia tego, co już siedzi w bazie sprzed modułu.
  const r = normalizeCostRow({
    kategoria: "CO-TO-JEST",
    vat_stawka: "999",
    status: "Prawie",
    metoda_platnosci: "karat",
    waluta: "BITCOIN",
    kurs_pln: "nonsens",
    kwota_netto: "abc",
    kwota_brutto: null,
    vat_odliczenie_procent: 999,
  });
  assert.equal(r.kategoria, "Inne");
  assert.equal(r.vat_stawka, "23");
  assert.equal(r.status, "Nieopłacony");
  assert.equal(r.metoda_platnosci, null);
  // Nieznana waluta czyta się jako PLN — `formatMoney` na nieznanym kodzie
  // rzuca RangeError i wywala CAŁY ekran w error boundary, nie jeden wiersz.
  assert.equal(r.waluta, "PLN");
  assert.equal(r.kurs_pln, null);
  assert.equal(r.kwota_netto, 0);
  assert.equal(r.kwota_brutto, 0);
  assert.equal(r.vat_odliczenie_procent, 100);
});

test("przeliczenie na PLN: koszt w PLN nie jest ruszany", () => {
  assert.equal(kursDoPln(null), 1);
  assert.equal(kursDoPln(0), 1);
  assert.equal(kursDoPln(4.31), 4.31);
  assert.equal(wPln(100, null), 100);
  assert.equal(wPln(100, 4.31), 431);
  // Zaokrąglenie do grosza, nie do pełnych złotych.
  assert.equal(wPln(80.5, 4.3123), 347.14);
});

test("po terminie: liczone kalendarzowo, opłacony nigdy nie jest spóźniony", () => {
  const nieoplacony = { termin_platnosci: "2026-08-01", status: "Nieopłacony" as const };
  assert.equal(dniPoTerminieKosztu(nieoplacony, "2026-08-01"), 0);
  assert.equal(dniPoTerminieKosztu(nieoplacony, "2026-08-15"), 14);
  assert.equal(dniPoTerminieKosztu(nieoplacony, "2026-07-25"), -7);
  // Opłacony i „bez terminu" dają null — data gaśnie do szarości bez warunku
  // w widoku.
  assert.equal(dniPoTerminieKosztu({ termin_platnosci: "2026-08-01", status: "Opłacony" }, "2026-09-01"), null);
  assert.equal(dniPoTerminieKosztu({ termin_platnosci: null, status: "Nieopłacony" }, "2026-09-01"), null);
});

test("koszt z KSeF w obcej walucie BEZ kursu: nie da się przeliczyć, ale da się edytować", () => {
  // KSeF oddaje walutę faktury, ale nie zawsze kurs. Taki koszt nie może
  // wejść do sum (kurs 1 zaniżyłby go o rząd wielkości)…
  assert.equal(maPrzelicznik("EUR", null), false);
  assert.equal(maPrzelicznik("PLN", null), true);
  assert.equal(maPrzelicznik("EUR", 4.31), true);
  assert.equal(maPrzelicznik("EUR", 0), false);

  // …ale bramka NIE może go zamurować: zmiana kategorii czy powiązania musi
  // przejść, inaczej rekordu nie da się w ogóle ruszyć bez wpisania kursu.
  const zKsef = { waluta: "EUR" as const, kurs_pln: null, kategoria: "Inne" as const };
  const w = czytajPolaKosztu({ kategoria: "Usługi" }, zKsef);
  assert.equal(w.blad, undefined);
  assert.equal(w.pola?.kategoria, "Usługi");
  assert.equal(w.pola?.kurs_pln, null);

  // Ale gdy żądanie DOTYKA waluty albo kursu — kurs staje się wymagany.
  assert.match(czytajPolaKosztu({ waluta: "EUR" }, zKsef).blad ?? "", /kursu/i);
  assert.match(czytajPolaKosztu({ kurs_pln: "" }, zKsef).blad ?? "", /kursu/i);
  assert.equal(czytajPolaKosztu({ kurs_pln: 4.31 }, zKsef).pola?.kurs_pln, 4.31);
});

test("VAT do odliczenia liczy się od procentu, nie od stawki", () => {
  assert.equal(vatDoOdliczenia(1000, "23", 100), 230);
  assert.equal(vatDoOdliczenia(1000, "23", 50), 115);
  assert.equal(vatDoOdliczenia(1000, "23", 0), 0);
  assert.equal(vatDoOdliczenia(1000, "zw", 100), 0);
});

test("szablon cykliczny: nazwa wymagana, słowniki pilnowane", () => {
  assert.match(czytajPolaCyklu({}).blad ?? "", /nazwę/i);
  assert.match(czytajPolaCyklu({ nazwa: "X", cykl: "co-wtorek" }).blad ?? "", /cykl/i);
  assert.match(czytajPolaCyklu({ nazwa: "X", waluta: "BITCOIN" }).blad ?? "", /waluta/i);
  const w = czytajPolaCyklu({ nazwa: " Hosting ", waluta: "EUR", next_run: "2026-09-01" });
  assert.equal(w.pola?.nazwa, "Hosting");
  assert.equal(w.pola?.waluta, "EUR");
  // Szablon NIE ma kursu — kurs jest z konkretnego dnia, a szablon nie zna dnia,
  // w którym wygeneruje kolejny koszt.
  assert.equal("kurs_pln" in (w.pola ?? {}), false);
});
