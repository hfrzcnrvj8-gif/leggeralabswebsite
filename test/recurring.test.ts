import { test } from "node:test";
import assert from "node:assert/strict";
import { wystapienieNr, nextRunAfter, nextRunFromAnchor } from "../lib/recurring.ts";

// REGRESJA REALNEGO BŁĘDU (2026-08-05, trzecie przejście — drugi rok obrotowy).
//
// To jest DRUGIE wystąpienie tej samej pułapki, co w `recurrence.test.ts`:
// tam dotyczyła wydarzeń i przypomnień i została naprawiona 2026-07-22, tu
// dotyczyła FAKTUR i KOSZTÓW cyklicznych i przetrwała o dwa tygodnie dłużej.
//
// Oba komentarze w kodzie twierdziły, że ochrona jest:
//  - `recurring.ts` obiecywał „naturalne obcięcie w krótszych miesiącach przez
//    `Date`" — `Date` nie obcina, tylko PRZELEWA (31.01 + 1 mies = 3 marca);
//  - `recurrence.ts` wskazywał na `nextRunAfter()` jako na wzór do naśladowania.
// Zmierzone sondą: „co miesiąc od 31." po sześciu krokach crona wystawiało się
// 3. dnia miesiąca. Dryf jest jednokierunkowy i nigdy nie wraca.

test("co miesiąc od 31 stycznia — luty przycięty, ale marzec znów 31", () => {
  assert.equal(wystapienieNr("2026-01-31", "miesiecznie", 0), "2026-01-31");
  assert.equal(wystapienieNr("2026-01-31", "miesiecznie", 1), "2026-02-28"); // przycięcie, NIE 3 marca
  assert.equal(wystapienieNr("2026-01-31", "miesiecznie", 2), "2026-03-31"); // NIE 28 — liczone od kotwicy
  assert.equal(wystapienieNr("2026-01-31", "miesiecznie", 6), "2026-07-31"); // sedno buga
});

test("rok przestępny", () => {
  assert.equal(wystapienieNr("2024-01-31", "miesiecznie", 1), "2024-02-29");
  assert.equal(wystapienieNr("2028-02-29", "rocznie", 1), "2029-02-28"); // NIE 1 marca
});

test("kwartalnie i rocznie przez koniec roku", () => {
  assert.equal(wystapienieNr("2026-11-30", "kwartalnie", 1), "2027-02-28"); // NIE 2 marca
  assert.equal(wystapienieNr("2026-12-31", "miesiecznie", 1), "2027-01-31");
  assert.equal(wystapienieNr("2026-12-31", "rocznie", 1), "2027-12-31");
  assert.equal(wystapienieNr("2026-10-31", "kwartalnie", 1), "2027-01-31");
});

test("nextRunAfter to jeden krok od podanej daty", () => {
  assert.equal(nextRunAfter("2026-01-31", "miesiecznie"), "2026-02-28");
  assert.equal(nextRunAfter("2026-12-31", "miesiecznie"), "2027-01-31");
});

// ── Kotwica: cron nie ma prawa przesunąć serii, gdy raz się spóźni ─────────

test("cron nadrabiający po terminie NIE przesuwa serii", () => {
  // Kotwica 1. dnia miesiąca. Cron miał zadziałać 1 marca, zadziałał 5 marca
  // (awaria, nieustawiony CRON_SECRET, limity Vercela). Następny termin ma być
  // 1 KWIETNIA, nie 5 kwietnia.
  assert.equal(nextRunFromAnchor("2026-01-01", "miesiecznie", "2026-03-05"), "2026-04-01");
  // Nawet po długiej przerwie seria wraca na swój dzień.
  assert.equal(nextRunFromAnchor("2026-01-01", "miesiecznie", "2026-09-17"), "2026-10-01");
});

test("kotwica na 31. — nadrabianie trafia w ostatni dzień krótkiego miesiąca", () => {
  assert.equal(nextRunFromAnchor("2026-01-31", "miesiecznie", "2026-02-01"), "2026-02-28");
  assert.equal(nextRunFromAnchor("2026-01-31", "miesiecznie", "2026-02-28"), "2026-03-31");
});

test("data przed kotwicą oddaje samą kotwicę", () => {
  assert.equal(nextRunFromAnchor("2026-06-01", "miesiecznie", "2026-01-01"), "2026-06-01");
});

test("wynik jest zawsze PÓŹNIEJSZY niż data odniesienia", () => {
  // Warunek graniczny: „po" równe wystąpieniu nie może oddać tego samego dnia,
  // inaczej cron wygenerowałby ten sam dokument drugi raz nazajutrz.
  assert.equal(nextRunFromAnchor("2026-01-01", "miesiecznie", "2026-01-01"), "2026-02-01");
  assert.equal(nextRunFromAnchor("2026-01-01", "kwartalnie", "2026-04-01"), "2026-07-01");
  assert.equal(nextRunFromAnchor("2026-01-01", "rocznie", "2027-01-01"), "2028-01-01");
});

test("przez przełom roku, wszystkie trzy cykle", () => {
  assert.equal(nextRunFromAnchor("2026-11-15", "miesiecznie", "2026-12-20"), "2027-01-15");
  assert.equal(nextRunFromAnchor("2026-11-15", "kwartalnie", "2026-12-20"), "2027-02-15");
  assert.equal(nextRunFromAnchor("2026-11-15", "rocznie", "2026-12-20"), "2027-11-15");
});
