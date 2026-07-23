import { test } from "node:test";
import assert from "node:assert/strict";
import { wystapienieNr, nastepneWystapienie } from "../lib/recurrence.ts";

// REGRESJA REALNEGO BŁĘDU (2026-07-22): seria „co miesiąc od 31." pokazywała
// w lipcu 28., nie 31. Powód: iteracja krok-po-kroku przycinała 31 stycznia do
// 28 lutego i liczyła dalej OD 28. Naprawa: każde wystąpienie liczone OD STARTU.
// Bliźniak w apce: Powtarzanie.swift. Patrz [[powtarzanie-wydarzen-przypomnien]].

test("co miesiąc od 31 stycznia — luty przycięty, ale marzec znów 31", () => {
  assert.equal(wystapienieNr("2026-01-31", "co_miesiac", 0), "2026-01-31");
  assert.equal(wystapienieNr("2026-01-31", "co_miesiac", 1), "2026-02-28"); // przycięcie
  assert.equal(wystapienieNr("2026-01-31", "co_miesiac", 2), "2026-03-31"); // NIE 28 — liczone od startu
  assert.equal(wystapienieNr("2026-01-31", "co_miesiac", 6), "2026-07-31"); // sedno buga
});

test("rok przestępny: 31 stycznia + 1 miesiąc = 29 lutego w 2024", () => {
  assert.equal(wystapienieNr("2024-01-31", "co_miesiac", 1), "2024-02-29");
});

test("cykle dzienne/tygodniowe/2-tygodniowe", () => {
  assert.equal(wystapienieNr("2026-07-01", "codziennie", 5), "2026-07-06");
  assert.equal(wystapienieNr("2026-07-01", "co_tydzien", 2), "2026-07-15");
  assert.equal(wystapienieNr("2026-07-01", "co_2_tygodnie", 2), "2026-07-29");
});

test("kwartał i rok przez granicę roku", () => {
  assert.equal(wystapienieNr("2026-11-15", "co_kwartal", 1), "2027-02-15");
  assert.equal(wystapienieNr("2026-12-31", "co_rok", 1), "2027-12-31");
});

test("nastepneWystapienie = wystapienieNr(...,1)", () => {
  assert.equal(nastepneWystapienie("2026-01-31", "co_miesiac"), "2026-02-28");
});
