import { test } from "node:test";
import assert from "node:assert/strict";
import { oczyscTekst } from "../lib/observability.ts";

// REGRESJA REALNEGO BŁĘDU (2026-07-22): przy odwrotnej kolejności wzorców
// telefon zjadał numer konta i z IBAN-a zostawało „PL611090101400000[telefon]"
// — 17 cyfr konta wyciekało do logu MIMO „oczyszczenia". Ten test czerwieni
// się, gdyby ktoś przestawił kolejność podstawień. Patrz [[kolejnosc-podstawien-pii]].

test("IBAN jest maskowany W CAŁOŚCI (nie zjadany przez wzorzec telefonu)", () => {
  const out = oczyscTekst("przelew na PL61109010140000071219812874 odrzucony");
  assert.equal(out, "przelew na [konto] odrzucony");
  assert.doesNotMatch(out, /\d{6}/); // żadna dłuższa grupa cyfr nie przeżyła
});

test("e-mail → [e-mail]", () => {
  assert.equal(oczyscTekst("nie mogę wysłać do jan.kowalski@firma.pl"), "nie mogę wysłać do [e-mail]");
});

test("NIP → [NIP]", () => {
  assert.equal(oczyscTekst("NIP 525-000-00-00 nieznany w VIES"), "NIP [NIP] nieznany w VIES");
});

test("telefon z kierunkowym i bez → [telefon]", () => {
  assert.equal(oczyscTekst("dzwoniłem 601 234 567 i +48 601 234 567"), "dzwoniłem [telefon] i [telefon]");
});

test("tekst bez danych osobowych zostaje nietknięty", () => {
  assert.equal(oczyscTekst("timeout po 30 s przy pobieraniu folderu"), "timeout po 30 s przy pobieraniu folderu");
});
