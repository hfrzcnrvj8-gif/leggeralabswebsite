import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlausibleDateString } from "../lib/projects.ts";

// Pułapka z CLAUDE.md: natywny <input type="date"> potrafi zapisać niepełny
// rok („0202" / „202"), gdy pole straci fokus w trakcie wpisywania. Ta walidacja
// (klient + serwer) to blokuje. Bliźniak w apce: LeadRules.czyDataSensowna.

test("poprawna data 2000–2100 przechodzi", () => {
  assert.equal(isPlausibleDateString("2026-07-23"), true);
  assert.equal(isPlausibleDateString("2000-01-01"), true);
  assert.equal(isPlausibleDateString("2100-12-31"), true);
});

test("niepełny / szalony rok odpada (sedno pułapki 0202)", () => {
  assert.equal(isPlausibleDateString("0202-07-23"), false);
  assert.equal(isPlausibleDateString("202-07-23"), false); // 3 cyfry roku
  assert.equal(isPlausibleDateString("1999-12-31"), false);
  assert.equal(isPlausibleDateString("2101-01-01"), false);
});

test("zły format odpada", () => {
  assert.equal(isPlausibleDateString("2026-7-3"), false); // bez zer wiodących
  assert.equal(isPlausibleDateString("23.07.2026"), false);
  assert.equal(isPlausibleDateString(""), false);
  assert.equal(isPlausibleDateString("2026-07-23T10:00"), false);
});
