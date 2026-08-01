import { test } from "node:test";
import assert from "node:assert/strict";
import { odczytajTekst, odczytajFlage, NOTE_LIMITS } from "../lib/notes.ts";
import { isPlausibleTimeString } from "../lib/dates.ts";

/*
 * Notatnik (audyt 2026-08-02). Wyróżnik tego modułu: **treść jest jedyną
 * wartością rekordu.** W koszcie czy fakturze śmieć w polu psuje liczbę,
 * którą widać obok innych liczb; tutaj śmieć w polu `tresc` kasuje jedyne,
 * co w notatce jest — i to bez śladu, bo notatnik nie ma sum kontrolnych,
 * na których dałoby się zauważyć ubytek.
 *
 * Dokładnie to zastała sonda: `PATCH {"tresc": 12345}` odpowiadało
 * `{"ok":true}` i zostawiało PUSTĄ treść, bo `typeof v === "string" ? v : ""`
 * traktowało „to nie jest tekst" jako „użytkownik chce wyczyścić". Poniższe
 * testy pilnują, żeby te dwie intencje nie wróciły do jednego worka.
 *
 * Każdy test odpowiada jednej rzeczy zmierzonej sondą na żywym serwerze.
 */

test("liczba w polu tekstowym to BŁĄD, nie polecenie wyczyszczenia", () => {
  // Sonda: {"tresc": 12345} kasowało treść i oddawało {"ok":true}.
  assert.equal(odczytajTekst({ tresc: 12345 }, "tresc").rodzaj, "blad");
  assert.equal(odczytajTekst({ tytul: [] }, "tytul").rodzaj, "blad");
  assert.equal(odczytajTekst({ tagi: {} }, "tagi").rodzaj, "blad");
});

test("null czyści pole — to jedyna droga do pustki", () => {
  const w = odczytajTekst({ tresc: null }, "tresc");
  assert.deepEqual(w, { rodzaj: "ustaw", wartosc: "" });
});

test("brak pola w ciele to NIE to samo, co pole puste", () => {
  // Bez tego rozróżnienia PATCH jednym polem zerowałby wszystkie pozostałe.
  assert.equal(odczytajTekst({}, "tresc").rodzaj, "brak");
  assert.equal(odczytajTekst({ tytul: "x" }, "tresc").rodzaj, "brak");
});

test("treść zachowuje wcięcia i puste linie, tytuł jest przycinany", () => {
  // W notatce układ tekstu jest częścią zapisu, w tytule to przypadek.
  const tresc = odczytajTekst({ tresc: "  wcięcie\n\n  i pusta linia  " }, "tresc", { przytnij: false });
  assert.deepEqual(tresc, { rodzaj: "ustaw", wartosc: "  wcięcie\n\n  i pusta linia  " });
  const tytul = odczytajTekst({ tytul: "  Spotkanie  " }, "tytul");
  assert.deepEqual(tytul, { rodzaj: "ustaw", wartosc: "Spotkanie" });
});

test("tekst ponad sufit to 400, nie ciche przycięcie", () => {
  // Sonda: POST z 20 000 znaków zapisywał 8000 i oddawał {"ok":true} —
  // wklejona notatka gubiła końcówkę bez ostrzeżenia.
  const zaDlugie = "x".repeat(NOTE_LIMITS.tresc + 1);
  const w = odczytajTekst({ tresc: zaDlugie }, "tresc", { przytnij: false });
  assert.equal(w.rodzaj, "blad");
  assert.match(w.rodzaj === "blad" ? w.powod : "", /limit/);
});

test("dokładnie na sufitcie jeszcze przechodzi", () => {
  const rowno = "x".repeat(NOTE_LIMITS.tresc);
  assert.equal(odczytajTekst({ tresc: rowno }, "tresc", { przytnij: false }).rodzaj, "ustaw");
});

test("flaga przyjmuje WYŁĄCZNIE true/false", () => {
  // Sonda: {"pinned":"tak"} znaczyło „odepnij" — śmieć zamieniał się
  // w przeciwieństwo intencji, i to z {"ok":true}.
  assert.equal(odczytajFlage({ pinned: "tak" }, "pinned").rodzaj, "blad");
  assert.equal(odczytajFlage({ archived: 1 }, "archived").rodzaj, "blad");
  assert.equal(odczytajFlage({ pinned: null }, "pinned").rodzaj, "blad");
  assert.deepEqual(odczytajFlage({ pinned: false }, "pinned"), { rodzaj: "ustaw", wartosc: false });
  assert.deepEqual(odczytajFlage({ pinned: true }, "pinned"), { rodzaj: "ustaw", wartosc: true });
  assert.equal(odczytajFlage({}, "pinned").rodzaj, "brak");
});

test("godzina wpisywana słowem nie wchodzi do kalendarza", () => {
  // Sonda: {"godzina":"trzynasta"} przechodziło przez „Do kalendarza"
  // i lądowało w wydarzeniu — kolumna jest TEXT-em, baza tego nie łapie.
  assert.equal(isPlausibleTimeString("trzynasta"), false);
  assert.equal(isPlausibleTimeString("25:00"), false);
  assert.equal(isPlausibleTimeString("13:60"), false);
  assert.equal(isPlausibleTimeString("9:00"), false);
  assert.equal(isPlausibleTimeString("13:00"), true);
  assert.equal(isPlausibleTimeString("00:00"), true);
  assert.equal(isPlausibleTimeString("23:59"), true);
});
