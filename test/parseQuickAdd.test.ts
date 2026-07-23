import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuickAdd } from "../lib/events.ts";

// `today` jest wstrzykiwane, więc testy są deterministyczne bez czekania do
// jutra. 2026-07-23 to CZWARTEK (weekday 0=pon → 3) — potrzebne dla „w piątek"
// (jutro) i „w czwartek" (za tydzień, bo ta sama nazwa dnia co dziś).
const DZIS = "2026-07-23";

test("słowa względne: dziś/jutro/pojutrze/za N dni/za N tygodni", () => {
  assert.equal(parseQuickAdd("jutro 14:00 call z klientem", DZIS).date, "2026-07-24");
  assert.equal(parseQuickAdd("pojutrze", DZIS).date, "2026-07-25");
  assert.equal(parseQuickAdd("za 3 dni raport", DZIS).date, "2026-07-26");
  assert.equal(parseQuickAdd("za 2 tygodnie", DZIS).date, "2026-08-06");
  assert.equal(parseQuickAdd("za tydzień", DZIS).date, "2026-07-30");
});

test("godzina wyłuskiwana z tytułu, tytuł zostaje czysty", () => {
  const r = parseQuickAdd("jutro 14:00 call z klientem", DZIS);
  assert.equal(r.time, "14:00");
  assert.equal(r.title, "call z klientem");
});

test("godzina z 'o' i bez minut", () => {
  assert.equal(parseQuickAdd("w piątek o 10 przegląd", DZIS).time, "10:00");
});

test("dzień tygodnia: 'w piątek' = najbliższy piątek", () => {
  // dziś czwartek → piątek to jutro
  assert.equal(parseQuickAdd("w piątek o 10 przegląd", DZIS).date, "2026-07-24");
});

test("ta sama nazwa dnia co dziś znaczy ZA TYDZIEŃ, nie dziś", () => {
  // dziś czwartek → „w czwartek" = +7, nie 0 (bliźniak: Kalendarz.swift l.366)
  assert.equal(parseQuickAdd("w czwartek retro", DZIS).date, "2026-07-30");
});

test("data DD.MM w przeszłości → przeskok na przyszły rok", () => {
  assert.equal(parseQuickAdd("1.01 sylwester", DZIS).date, "2027-01-01");
  assert.equal(parseQuickAdd("12.08 audyt", DZIS).date, "2026-08-12");
});

test("guard 'w <słowo>': fraza nie będąca dniem NIE jest zjadana z tytułu", () => {
  // Bez akceptującego guarda „w kosmosie" znikało z tytułu jako rzekoma data.
  const r = parseQuickAdd("w kosmosie konferencja", DZIS);
  assert.equal(r.date, null);
  assert.equal(r.title, "w kosmosie konferencja");
});

test("brak rozpoznanej daty → tytuł = całe wejście, date/time null", () => {
  const r = parseQuickAdd("spotkanie za rogiem", DZIS);
  assert.equal(r.date, null);
  assert.equal(r.time, null);
  assert.equal(r.title, "spotkanie za rogiem");
});

test("godziny/minuty poza zakresem są ignorowane jako czas", () => {
  // 25:00 nie jest godziną — nie wolno jej wziąć za time
  assert.equal(parseQuickAdd("spotkanie o 25", DZIS).time, null);
});
