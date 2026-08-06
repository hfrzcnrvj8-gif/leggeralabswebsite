// Straż sesji (etap 3, 2026-08-06) — kogo w ogóle dotyczy.
//
// Reguła jest jednym warunkiem, ale ma cztery wyjątki i każdy z nich powstał
// z konkretnego powodu (patrz `strazSesji.ts`). Wyjątek bez testu to wyjątek,
// który następna poprawka skasuje bez objawu: strażnik zacząłby zapalać pasek
// „sesja wygasła" przy BŁĘDNYM HAŚLE na ekranie logowania.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dotyczyZapisuPanelu } from "../app/[lang]/admin/strazSesji";

test("zapis do /api liczy się — niezależnie od metody", () => {
  for (const m of ["POST", "PATCH", "PUT", "DELETE", "patch"]) {
    assert.equal(dotyczyZapisuPanelu("/api/offers/1", { method: m }), true, m);
  }
});

test("odczyt się NIE liczy — ma własną drogę (pobierzJSON)", () => {
  assert.equal(dotyczyZapisuPanelu("/api/offers", { method: "GET" }), false);
  assert.equal(dotyczyZapisuPanelu("/api/offers"), false, "brak metody = GET");
  assert.equal(dotyczyZapisuPanelu("/api/offers", { method: "HEAD" }), false);
});

test("401 z logowania to BŁĘDNE HASŁO, nie wygasła sesja", () => {
  assert.equal(dotyczyZapisuPanelu("/api/admin/login", { method: "POST" }), false);
  assert.equal(dotyczyZapisuPanelu("/api/admin/logout", { method: "POST" }), false);
});

test("adresy spoza /api nie mówią nic o naszej sesji", () => {
  assert.equal(dotyczyZapisuPanelu("/pl/admin", { method: "POST" }), false);
  assert.equal(dotyczyZapisuPanelu("https://api.resend.com/emails", { method: "POST" }), false);
});

test("Request zamiast stringa — metoda z obiektu, nie z init", () => {
  const zadanie = { url: "http://localhost:3000/api/notes/1", method: "PATCH" } as unknown as Request;
  assert.equal(dotyczyZapisuPanelu(zadanie), true);
  const odczyt = { url: "http://localhost:3000/api/notes/1", method: "GET" } as unknown as Request;
  assert.equal(dotyczyZapisuPanelu(odczyt), false);
});
