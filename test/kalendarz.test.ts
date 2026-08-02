import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EVENT_LIMITS,
  odczytajLiczbeWydarzenia,
  odczytajOpcjonalnyTekst,
  odczytajTekstWydarzenia,
} from "../lib/events.ts";
import { dobierz, opisKlienta, znormalizuj, DOMYSLNE_WEJSCIE } from "../lib/dobor.ts";

/*
 * Kalendarz i Kalkulator (audyt 2026-08-02) — dwa ostatnie wiersze tabeli
 * Modułu 59.
 *
 * Wyróżnik Kalendarza: **wydarzenie ma najwięcej pól ze wszystkich rekordów
 * panelu** (czternaście kolumn), a `PATCH` zapisywał je pole po polu, bez
 * jednej fazy sprawdzania z przodu. Skutek zmierzony sondą: ciało
 * `{"tytul":"PO","data":"0202-01-01"}` zapisywało tytuł i oddawało 400 —
 * panel mówił „nie udało się zaktualizować", a zmiana częściowo weszła.
 * Do tego pięć pól przyjmowało śmieć i cicho go PODMIENIAŁO na `null`,
 * a dwa cicho ODMAWIAŁY zapisu z `{"ok":true}`.
 *
 * Wyróżnik Kalkulatora: to jedyny ekran panelu, którego wynik **wychodzi na
 * zewnątrz jako dokument dla klienta**, a nie zostaje w bazie. Rozjazd między
 * liczbą użytą do wyliczenia a liczbą wydrukowaną w nagłówku jest tam
 * kosztowniejszy niż gdziekolwiek indziej.
 *
 * Każdy test odpowiada jednej rzeczy zmierzonej sondą na żywym serwerze.
 */

/* ── Kalendarz: kształt pól ──────────────────────────────────────────────── */

test("liczba w polu tekstowym to BŁĄD, nie polecenie wyczyszczenia", () => {
  // Sonda: {"tytul": 123} zostawiało PUSTY tytuł i oddawało {"ok":true},
  // czyli pustą pastylkę w siatce dnia, nie do odróżnienia od sąsiadów.
  assert.equal(odczytajTekstWydarzenia({ tytul: 123 }, "tytul").rodzaj, "blad");
  assert.equal(odczytajTekstWydarzenia({ opis: 42 }, "opis").rodzaj, "blad");
  assert.equal(odczytajTekstWydarzenia({ lokalizacja: 999 }, "lokalizacja").rodzaj, "blad");
});

test("liczba w polu daty to BŁĄD, nie ciche pominięcie zapisu", () => {
  // Sonda: {"data": 20260901} oddawało {"ok":true} i NIE zmieniało daty —
  // warunek `typeof === "string"` wypadał z gałęzi i nikt się nie dowiadywał.
  assert.equal(odczytajOpcjonalnyTekst({ data: 20260901 }, "data").rodzaj, "blad");
  assert.equal(odczytajOpcjonalnyTekst({ powtarzanie_do: 20261231 }, "powtarzanie_do").rodzaj, "blad");
});

test("brak pola w ciele to NIE to samo, co pole puste", () => {
  // Bez tego rozróżnienia PATCH jednym polem zerowałby wszystkie pozostałe.
  assert.equal(odczytajTekstWydarzenia({}, "opis").rodzaj, "brak");
  assert.equal(odczytajOpcjonalnyTekst({ tytul: "x" }, "godzina").rodzaj, "brak");
  assert.equal(odczytajLiczbeWydarzenia({}, "alert_minut_przed", 0, 43200).rodzaj, "brak");
});

test("null i pusty napis zdejmują pole — to jedyne dwie drogi do pustki", () => {
  assert.deepEqual(odczytajOpcjonalnyTekst({ godzina: null }, "godzina"), { rodzaj: "zdejmij" });
  assert.deepEqual(odczytajOpcjonalnyTekst({ godzina: "" }, "godzina"), { rodzaj: "zdejmij" });
  assert.deepEqual(odczytajOpcjonalnyTekst({ godzina: "   " }, "godzina"), { rodzaj: "zdejmij" });
  assert.deepEqual(odczytajLiczbeWydarzenia({ alert_minut_przed: null }, "alert_minut_przed", 0, 43200), {
    rodzaj: "zdejmij",
  });
});

test("śmieć w polu liczbowym NIE zamienia się w brak alertu", () => {
  // Sonda: {"alert_minut_przed": "pietnascie"} zdejmowało alert i oddawało
  // {"ok":true}. W polu, które steruje powiadomieniem, cicha zamiana śmiecia
  // na „nigdy" jest najgorszą z możliwych podmian (ta sama lekcja, co przy
  // `termin` w Przypomnieniach).
  assert.equal(odczytajLiczbeWydarzenia({ alert_minut_przed: "pietnascie" }, "alert_minut_przed", 0, 43200).rodzaj, "blad");
  assert.equal(odczytajLiczbeWydarzenia({ czas_trwania_min: "godzina" }, "czas_trwania_min", 1, 1440).rodzaj, "blad");
  assert.equal(odczytajLiczbeWydarzenia({ czas_trwania_min: NaN }, "czas_trwania_min", 1, 1440).rodzaj, "blad");
});

test("liczba spoza skali to ODMOWA z zakresem, nie przycięcie do null", () => {
  const w = odczytajLiczbeWydarzenia({ czas_trwania_min: 99999 }, "czas_trwania_min", 1, 1440);
  assert.equal(w.rodzaj, "blad");
  assert.match(w.rodzaj === "blad" ? w.powod : "", /1–1440/);
  assert.equal(odczytajLiczbeWydarzenia({ czas_trwania_min: 0 }, "czas_trwania_min", 1, 1440).rodzaj, "blad");
  // Wartość ze skali przechodzi i jest zaokrąglana, nie odrzucana.
  assert.deepEqual(odczytajLiczbeWydarzenia({ czas_trwania_min: 45.4 }, "czas_trwania_min", 1, 1440), {
    rodzaj: "ustaw",
    wartosc: 45,
  });
});

test("sufit długości jest JEDEN dla POST i PATCH, a przekroczenie to 400", () => {
  // Sonda: POST tnął tytuł na 300 znaków po cichu, PATCH nie tnął wcale —
  // ta sama treść dwiema drogami wychodziła różnej długości.
  const dlugi = "a".repeat(EVENT_LIMITS.tytul + 1);
  const w = odczytajTekstWydarzenia({ tytul: dlugi }, "tytul");
  assert.equal(w.rodzaj, "blad");
  assert.match(w.rodzaj === "blad" ? w.powod : "", /301/);
  // Dokładnie na sufit wchodzi bez zastrzeżeń.
  assert.equal(odczytajTekstWydarzenia({ tytul: "a".repeat(EVENT_LIMITS.tytul) }, "tytul").rodzaj, "ustaw");
});

test("tekst jest przycinany z białych znaków, nie zapisywany surowo", () => {
  assert.deepEqual(odczytajTekstWydarzenia({ tytul: "  Spotkanie  " }, "tytul"), {
    rodzaj: "ustaw",
    wartosc: "Spotkanie",
  });
});

/* ── Kalkulator: jedne liczby dla wyniku i dla wydruku ───────────────────── */

test("szczyt większy od liczby użytkowników jest przycinany RAZ, dla obu dróg", () => {
  // Zmierzone: `dobierz()` liczyło z min(szczyt, użytkownicy), a `opisKlienta()`
  // z surowego `szczyt`. Odpowiedź „5 użytkowników, 50 równoczesnych" dawała
  // wydruk DLA KLIENTA mówiący „(50 równoczesnych)" nad rekomendacją policzoną
  // dla pięciu — Tier 2 zamiast Tier 3, czyli trzykrotnie niższa cena.
  const w = { ...DOMYSLNE_WEJSCIE, uzytkownicy: 5, szczyt: 50 };
  assert.deepEqual(znormalizuj(w), { uzytk: 5, szczyt: 5, ragGB: 20, przycietySzczyt: true });
  assert.match(opisKlienta(w), /5 użytkowników \(5 równoczesnych\)/);
  assert.match(dobierz(w).opisWejscia, /5 naraz z 5 os\./);
});

test("przycięcie szczytu zostawia WIDOCZNY ślad w notatkach", () => {
  // Cicha podmiana zamieniona na ostrzeżenie: pole formularza dalej pokazuje
  // liczbę, której wynik nie użył, więc musi o tym powiedzieć wprost.
  const notatki = dobierz({ ...DOMYSLNE_WEJSCIE, uzytkownicy: 5, szczyt: 50 }).notatki;
  const ostrzezenie = notatki.find((n) => n.typ === "ostrzezenie" && /Równoczesnych podano więcej/.test(n.tekst));
  assert.ok(ostrzezenie, "brak ostrzeżenia o przyciętym szczycie");
  assert.match(ostrzezenie!.tekst, /liczę dla 5/);
  // Bez przycięcia notatki nie ma — ostrzeżenie ma być rzadkie, nie stałe.
  assert.ok(!dobierz(DOMYSLNE_WEJSCIE).notatki.some((n) => /Równoczesnych podano więcej/.test(n.tekst)));
});

test("odpowiedzi bez sensu nie wywracają doboru, tylko go zawężają", () => {
  // Zero i wartości ujemne przychodzą z pustego pola liczbowego (`+"" === 0`).
  const w = { ...DOMYSLNE_WEJSCIE, uzytkownicy: 0, szczyt: 0, ragGB: -5 };
  assert.deepEqual(znormalizuj(w), { uzytk: 1, szczyt: 1, ragGB: 0, przycietySzczyt: false });
  const r = dobierz(w);
  assert.ok(r.tier >= 1 && r.tier <= 3);
  assert.ok(r.kosztMin > 0 && r.kosztMax >= r.kosztMin);
});

test("ankieta bez zaznaczonego zadania mówi „ogólne”, a nie pustkę", () => {
  const r = dobierz({ ...DOMYSLNE_WEJSCIE, zadania: [] });
  assert.match(r.opisWejscia, /^ogólne/);
  assert.match(opisKlienta({ ...DOMYSLNE_WEJSCIE, zadania: [] }), /zadania: ogólne/);
});
