import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blokadaStatusuUmowy,
  blokadaUmowy,
  POLA_MIMO_BLOKADY_UMOWY,
  ruszaTresc,
} from "../lib/blokadaDokumentu";
import { CONTRACT_ZAWSZE_ZYWE, CONTRACT_MIGAWKA_POLA } from "../lib/contracts";

/* Reguły z audytu Modułu 11 (2026-07-27). Wszystkie trzy powstały po sondzie
 * po REALNYCH trasach — przegląd kodu przepuszczał je bez zająknięcia. */

test("podpisany dokument jest zablokowany także wtedy, gdy status ktoś zmienił", () => {
  // To jest ta dziura: sonda wysłała PATCH {status:"Szkic"} na podpisanej
  // umowie (200), a zaraz potem PATCH {cena:1} — też 200.
  assert.equal(blokadaUmowy("Szkic", "umowa", "2026-07-27 10:00:00+01").zablokowane, true);
  assert.equal(blokadaUmowy("Podpisana", "umowa", null).zablokowane, true);
  assert.equal(blokadaUmowy("Wysłana", "umowa", null).zablokowane, false);
});

test("komunikat blokady odsyła tam, gdzie droga wyjścia naprawdę istnieje", () => {
  const umowa = blokadaUmowy("Podpisana", "umowa");
  const nda = blokadaUmowy("Podpisana", "nda");
  const aneks = blokadaUmowy("Podpisana", "aneks");
  assert.ok(umowa.zablokowane && umowa.komunikat.includes("aneks"));
  // Nad NDA „zrób aneks" byłoby złą radą — NDA się nie aneksuje (409 z trasy).
  assert.ok(nda.zablokowane && !nda.komunikat.includes("Sporządź aneks"));
  // Aneksu do aneksu nie ma — kolejny robi się do umowy.
  assert.ok(aneks.zablokowane && aneks.komunikat.includes("następnym aneksem"));
});

test("na „Podpisana” nie przechodzi się statusem, a z „Podpisana” nie schodzi wcale", () => {
  // Podpis to `accepted_at`, nie etykieta: dokument z pigułką „Podpisana”
  // i pustą datą kłamie na wydruku i wypada z retencji dowodu e-podpisu.
  assert.equal(blokadaStatusuUmowy("Podpisana", false).zablokowane, true);
  assert.equal(blokadaStatusuUmowy("Szkic", true).zablokowane, true);
  assert.equal(blokadaStatusuUmowy("Odrzucona", true).zablokowane, true);
  // Dokument w grze zamyka się normalnie.
  assert.equal(blokadaStatusuUmowy("Odrzucona", false).zablokowane, false);
  assert.equal(blokadaStatusuUmowy("Wysłana", false).zablokowane, false);
});

test("status i powiązania zostają wolne mimo blokady, treść nie", () => {
  assert.equal(ruszaTresc({ status: "Odrzucona" }, POLA_MIMO_BLOKADY_UMOWY), false);
  assert.equal(ruszaTresc({ client_id: "x", project_id: "y" }, POLA_MIMO_BLOKADY_UMOWY), false);
  assert.equal(ruszaTresc({ cena: 1 }, POLA_MIMO_BLOKADY_UMOWY), true);
  assert.equal(ruszaTresc({ status: "Szkic", zakres_prac: "inny" }, POLA_MIMO_BLOKADY_UMOWY), true);
});

test("migawka i pola żywe nie zachodzą na siebie", () => {
  // Gdyby to samo pole trafiło na obie listy, kolejność scalania decydowałaby
  // po cichu, które wygra — a to jest dokładnie ta pułapka, na której poległa
  // pierwsza wersja migawki oferty.
  const wspolne = CONTRACT_MIGAWKA_POLA.filter((p) => (CONTRACT_ZAWSZE_ZYWE as readonly string[]).includes(p));
  assert.deepEqual(wspolne, []);
  // Kotwice, bez których dokument u drugiej strony przestaje być dowodem.
  for (const pole of ["zakres_prac", "cena", "waluta", "termin_realizacji", "klient_nazwa"]) {
    assert.ok((CONTRACT_MIGAWKA_POLA as readonly string[]).includes(pole), `${pole} musi być w migawce`);
  }
  for (const pole of ["status", "accepted_at", "accepted_by_name", "share_revoked_at"]) {
    assert.ok((CONTRACT_ZAWSZE_ZYWE as readonly string[]).includes(pole), `${pole} musi zostać żywe`);
  }
});
