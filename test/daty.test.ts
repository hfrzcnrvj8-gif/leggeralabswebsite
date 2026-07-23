import { test } from "node:test";
import assert from "node:assert/strict";
import { daysBetweenISO, warsawNowMinutes, warsawWallTimeToUtcISO, daysSinceISO } from "../lib/dates.ts";

// daysBetweenISO to arytmetyka, na której od Audytu 6 stoi reguła „wymaga
// działania dziś" (isOverdue → daysSince → daysBetweenISO). Bliźniak w apce:
// LeadRules.dniOd liczy dni KALENDARZOWE Calendar-em — musi dać to samo, inaczej
// panel i telefon powiedzą o leadzie dwie różne rzeczy tuż po północy.

test("daysBetweenISO: dni kalendarzowe, ze znakiem", () => {
  assert.equal(daysBetweenISO("2026-07-19", "2026-07-23"), 4);
  assert.equal(daysBetweenISO("2026-07-23", "2026-07-23"), 0);
  assert.equal(daysBetweenISO("2026-07-23", "2026-07-19"), -4);
});

test("daysBetweenISO: granica miesiąca i rok przestępny", () => {
  assert.equal(daysBetweenISO("2026-07-31", "2026-08-01"), 1);
  assert.equal(daysBetweenISO("2024-02-28", "2024-03-01"), 2); // 2024 przestępny (29 lutego)
  assert.equal(daysBetweenISO("2025-02-28", "2025-03-01"), 1); // 2025 zwykły
});

test("daysBetweenISO to KALENDARZ, nie floor z godzin (sedno rozjazdu z apką)", () => {
  // Dwie DATY oddalone o 4 doby kalendarzowe = 4, niezależnie od strefy i pory
  // dnia. Gdyby ktoś wrócił do floor((now−UTCpółnoc)/24h), ten wynik
  // spadłby do 3 w oknie tuż po lokalnej północy — dokładnie tamten rozjazd.
  assert.equal(daysBetweenISO("2026-06-30", "2026-07-04"), 4);
});

test("warsawNowMinutes: minuty od północy ściennej, z DST", () => {
  assert.equal(warsawNowMinutes(new Date("2026-07-15T13:59:00Z")), 959); // lato +2 → 15:59
  assert.equal(warsawNowMinutes(new Date("2026-07-15T14:00:00Z")), 960); // 16:00
  assert.equal(warsawNowMinutes(new Date("2026-01-15T13:59:00Z")), 899); // zima +1 → 14:59
});

test("warsawWallTimeToUtcISO: godzina ścienna → UTC z uwzględnieniem DST", () => {
  assert.equal(warsawWallTimeToUtcISO("2026-07-15", "18:00"), "2026-07-15T16:00:00.000Z"); // lato −2
  assert.equal(warsawWallTimeToUtcISO("2026-01-15", "8:00"), "2026-01-15T07:00:00.000Z"); // zima −1
});

test("daysSinceISO: PEŁNE doby z realnego zegara (floor), nie kalendarz", () => {
  // Osobne od daysBetweenISO — źródło (received_at) niesie godzinę, więc
  // 3 doby i 23:59 to nadal 3, nie 4.
  assert.equal(daysSinceISO("2026-07-19T00:00:00Z", new Date("2026-07-23T00:00:00Z")), 4);
  assert.equal(daysSinceISO("2026-07-19T00:00:00Z", new Date("2026-07-22T23:59:00Z")), 3);
});
