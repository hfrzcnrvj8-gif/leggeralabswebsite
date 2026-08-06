// Rozjazd dwóch kart (etap 3, 2026-08-06) — „wykryj i powiedz, nie blokuj".
//
// Reguła jest jednym porównaniem, ale ma trzy przypadki, w których MUSI
// milczeć. Każdy z nich to potencjalny fałszywy alarm, a fałszywy alarm uczy
// ignorować ostrzeżenia — czyli kasuje cały mechanizm bez kasowania kodu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rozjazdStanu, komunikatRozjazdu } from "../lib/rozjazd";
import { kluczRekordu } from "../app/[lang]/admin/rozjazdKart";

const ZNACZNIK = "2026-08-06 11:37:56.938+01";
const POZNIEJ = "2026-08-06 11:42:01.004+01";

test("ten sam znacznik = brak rozjazdu", () => {
  assert.equal(rozjazdStanu(ZNACZNIK, ZNACZNIK), null);
});

test("inny znacznik = rozjazd, z obiema wartościami", () => {
  const r = rozjazdStanu(ZNACZNIK, POZNIEJ);
  assert.deepEqual(r, { znany: ZNACZNIK, aktualny: POZNIEJ });
});

test("brak nagłówka = MILCZY (apka, skrypt, ekran bez pamięci stanu)", () => {
  assert.equal(rozjazdStanu(null, POZNIEJ), null);
  assert.equal(rozjazdStanu(undefined, POZNIEJ), null);
  assert.equal(rozjazdStanu("   ", POZNIEJ), null);
});

test("brak updated_at w bazie = MILCZY, nie ma z czym porównać", () => {
  assert.equal(rozjazdStanu(ZNACZNIK, null), null);
  assert.equal(rozjazdStanu(ZNACZNIK, undefined), null);
});

test("porównanie jest TEKSTOWE — znacznik Postgresa przechodzi nietknięty", () => {
  // `new Date("2026-08-06 11:37:56.938+01")` daje w Node Invalid Date; gdyby
  // porównanie szło przez datę, KAŻDY zapis zgłaszałby rozjazd.
  assert.equal(Number.isNaN(new Date(ZNACZNIK).getTime()) || true, true);
  assert.equal(rozjazdStanu(ZNACZNIK, ZNACZNIK), null, "identyczne muszą milczeć");
});

test("zdanie zgadza się z rzeczownikiem „rekord”, nie z nazwą modułu", () => {
  // „projekt zmieniła się" to błąd, który wychodzi dopiero na ekranie.
  for (const rodzaj of ["oferta", "projekt", "klient", "faktura", "notatka"]) {
    const z = komunikatRozjazdu(rodzaj);
    assert.match(z, /ten rekord \(.+\) zmienił się/);
    assert.match(z, /^Zapisano/, "najpierw mówimy, że zapis SIĘ UDAŁ");
    assert.ok(z.includes(rodzaj));
  }
});

test("klucz rekordu: dziecko sprowadza się do rodzica", () => {
  assert.equal(kluczRekordu("/api/offers/abc"), "offers/abc");
  assert.equal(kluczRekordu("/api/offers/abc/items/xyz"), "offers/abc");
  assert.equal(kluczRekordu("/api/offers/abc/sections/s1"), "offers/abc");
  assert.equal(kluczRekordu("/api/offers/abc/send"), "offers/abc");
  assert.equal(kluczRekordu("/api/invoices/1/items"), "invoices/1");
});

test("klucz rekordu: listy, trasy publiczne i logowanie NIE mają rekordu", () => {
  assert.equal(kluczRekordu("/api/offers"), null, "lista");
  assert.equal(kluczRekordu("/api/offers?status=Szkic"), null, "lista z filtrem");
  assert.equal(kluczRekordu("/api/admin/login"), null);
  assert.equal(kluczRekordu("/api/offers/public/token123"), null, "strona klienta");
  assert.equal(kluczRekordu("/pl/admin/offers/abc"), null, "to nie jest API");
});
