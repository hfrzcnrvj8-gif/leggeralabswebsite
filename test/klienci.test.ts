import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isClientOverdue,
  clientOverdueReason,
  clientRhythmOverdue,
  clientSilenceDays,
  type Client,
} from "../lib/clients";
import { todayLocalISO } from "../lib/dates";

/** Reguła ciszy u klienta jest INNA niż u leada: nie ma progu dla wszystkich,
 * pilnujemy tylko tych, przy których właściciel sam ustawił rytm. Te testy
 * pinują właśnie tę różnicę — najłatwiej ją zgubić przy „ujednolicaniu". */

function klient(pola: Partial<Client>): Client {
  return {
    id: "x",
    nazwa: "Testowy",
    nip: "",
    ulica: "",
    kod: "",
    miasto: "",
    kraj: "",
    email: "",
    telefon: "",
    www: "",
    linkedin_url: "",
    osoba_kontaktowa: "",
    zrodlo: "",
    zrodlo_kategoria: "",
    branza: "",
    status: "Aktywny",
    ostatni_kontakt: null,
    next_followup: null,
    next_action: "",
    rytm_kontaktu_mies: null,
    ostatni_kanal: null,
    notatki: "",
    lead_id: null,
    created_at: todayLocalISO(),
    updated_at: todayLocalISO(),
    avg_rating: null,
    ...pola,
  };
}

/** `n` dni temu jako ISO — do ustawiania ostatniego kontaktu w przeszłości. */
function dniTemu(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

test("bez rytmu i bez przypomnienia klient nigdy nie jest zaległy", () => {
  const c = klient({ ostatni_kontakt: dniTemu(900) });
  assert.equal(isClientOverdue(c), false);
});

test("ustawione przypomnienie na dziś zapala klienta", () => {
  const c = klient({ next_followup: todayLocalISO() });
  assert.equal(isClientOverdue(c), true);
  assert.match(clientOverdueReason(c), /przypomnienie/);
});

test("rytm kwartalny: 89 dni ciszy jeszcze nie, 90 już tak", () => {
  const przed = klient({ rytm_kontaktu_mies: 3, ostatni_kontakt: dniTemu(89) });
  const po = klient({ rytm_kontaktu_mies: 3, ostatni_kontakt: dniTemu(90) });
  assert.equal(clientRhythmOverdue(przed), false);
  assert.equal(clientRhythmOverdue(po), true);
  assert.equal(isClientOverdue(po), true);
  assert.match(clientOverdueReason(po), /rytm kontaktu/);
});

test("klient bez ANI JEDNEGO kontaktu liczy ciszę od utworzenia", () => {
  const c = klient({ rytm_kontaktu_mies: 1, ostatni_kontakt: null, created_at: dniTemu(40) });
  assert.equal(clientSilenceDays(c), 40);
  assert.equal(isClientOverdue(c), true);
});

test("status Stracony nie zapala się nigdy, choćby rytm dawno minął", () => {
  const c = klient({ status: "Stracony", rytm_kontaktu_mies: 1, ostatni_kontakt: dniTemu(400) });
  assert.equal(isClientOverdue(c), false);
});

test("rytm 0 albo ujemny traktujemy jak brak rytmu", () => {
  const c = klient({ rytm_kontaktu_mies: 0, ostatni_kontakt: dniTemu(400) });
  assert.equal(clientRhythmOverdue(c), false);
});
