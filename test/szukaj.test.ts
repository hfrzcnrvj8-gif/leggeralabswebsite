import { test } from "node:test";
import assert from "node:assert/strict";
import { zapytanieTsquery, pierwszeSlowo } from "../lib/szukaj";

// Moduł 56 — wyszukiwanie pełnotekstowe. Te testy pilnują JEDNEJ rzeczy:
// że z pola wyszukiwarki nigdy nie wyjdzie coś, co wysadzi `to_tsquery`.
// Reszta (czy indeks znajduje) wymaga bazy i sprawdzana jest uruchomieniem.

test("zwykła fraza staje się przedrostkami połączonymi przez AND", () => {
  assert.equal(zapytanieTsquery("eksport csv"), "eksport:* & csv:*");
});

test("polskie znaki przechodzą — ogonki normalizuje baza, nie ten kod", () => {
  assert.equal(zapytanieTsquery("zamówienie"), "zamówienie:*");
});

test("operatory to_tsquery są wycinane, nie przepuszczane", () => {
  // Bez tego „faktura & ” kończy się błędem SQL, a nie pustym wynikiem.
  assert.equal(zapytanieTsquery("faktura & | ! <->"), "faktura:*");
  assert.equal(zapytanieTsquery("(nawias)"), "nawias:*");
  assert.equal(zapytanieTsquery("cudzysłów ' \" `"), "cudzysłów:*");
});

test("jednoliterowe słowa wypadają — przedrostek `a:*` to pół bazy", () => {
  assert.equal(zapytanieTsquery("a w eksport"), "eksport:*");
});

test("fraza bez treści daje null, żeby trasa NIE odpytywała bazy", () => {
  assert.equal(zapytanieTsquery(""), null);
  assert.equal(zapytanieTsquery("   "), null);
  assert.equal(zapytanieTsquery("& | !"), null);
  assert.equal(zapytanieTsquery("a"), null);
});

test("wklejone zdanie jest przycinane do ośmiu słów", () => {
  const dlugie = "raz dwa trzy cztery piec szesc siedem osiem dziewiec dziesiec";
  const wynik = zapytanieTsquery(dlugie);
  assert.equal(wynik?.split(" & ").length, 8);
});

test("pierwsze słowo pomija zbyt krótkie — po nim baza wycina fragment", () => {
  assert.equal(pierwszeSlowo("w eksport csv"), "eksport");
  assert.equal(pierwszeSlowo("!!! ??? "), "");
});
