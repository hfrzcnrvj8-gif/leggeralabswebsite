import { test } from "node:test";
import assert from "node:assert/strict";
import { waLink, lastPhoneDigits } from "../lib/contact.ts";

// Bliźniak w apce: Kontakty.whatsApp / Kontakty.telefon (repo leggera-hub-ios).
// Progi (8 / 9 / 10–15 cyfr) i prefiks 48 muszą być IDENTYCZNE po obu stronach.

test("numer 9-cyfrowy bez prefiksu = krajowy (+48)", () => {
  assert.equal(waLink("600 348 168"), "https://wa.me/48600348168");
  assert.equal(waLink("600-348-168"), "https://wa.me/48600348168");
});

test("prefiks + / 00 zachowany, bez doklejania 48", () => {
  assert.equal(waLink("+48 600 348 168"), "https://wa.me/48600348168");
  assert.equal(waLink("0048600348168"), "https://wa.me/48600348168");
  assert.equal(waLink("+1 202 555 0134"), "https://wa.me/12025550134");
});

test("wiodące zera krajowego numeru są ścinane", () => {
  assert.equal(waLink("0600348168"), "https://wa.me/48600348168");
});

test("numer 10–15 cyfr bez prefiksu bierzemy jak jest (nie doklejamy 48)", () => {
  assert.equal(waLink("1202555013"), "https://wa.me/1202555013");
});

test("za krótki / pusty / śmieciowy → null (UI nie pokazuje przycisku)", () => {
  assert.equal(waLink("1234567"), null); // 7 cyfr, bez prefiksu i nie 9
  assert.equal(waLink(""), null);
  assert.equal(waLink("   "), null);
  assert.equal(waLink("+123"), null); // po '+' mniej niż 8 cyfr
});

test("lastPhoneDigits: ostatnie 9 cyfr niezależnie od formatu", () => {
  assert.equal(lastPhoneDigits("+48 600-348-168"), "600348168");
  assert.equal(lastPhoneDigits("48 600 348 168"), "600348168");
  assert.equal(lastPhoneDigits("600348168"), "600348168");
});
