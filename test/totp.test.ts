import { test } from "node:test";
import assert from "node:assert/strict";
import { base32Encode, kodDlaOkna, sprawdzKod, numerOkna, CYFR, OKNO_SEKUND } from "../lib/totp.ts";

// Silnik 2FA własny (bez biblioteki, Moduł 41). To on strzeże dostępu do
// wszystkich danych klientów — złamanie = utrata logowania. Pinujemy go
// WEKTORAMI RFC 6238 (sekret ASCII "12345678901234567890"), 6 cyfr = ostatnie
// 6 z oficjalnych 8-cyfrowych wektorów. Patrz [[modul-41-totp]].

const SEK = base32Encode(Buffer.from("12345678901234567890"));

test("wektory RFC 6238 (6-cyfrowe obcięcie)", () => {
  assert.equal(kodDlaOkna(SEK, 1), "287082"); // T=59 s
  assert.equal(kodDlaOkna(SEK, 37037036), "081804"); // T=1111111109
  assert.equal(kodDlaOkna(SEK, 37037037), "050471"); // T=1111111111
  assert.equal(kodDlaOkna(SEK, 41152263), "005924"); // T=1234567890 (test zera wiodącego)
  assert.equal(kodDlaOkna(SEK, 66666666), "279037"); // T=2000000000
});

test("stałe silnika są tym, co zakładają aplikacje (6 cyfr / 30 s)", () => {
  assert.equal(CYFR, 6);
  assert.equal(OKNO_SEKUND, 30);
});

test("sprawdzKod: bieżący pasuje, zły odpada", () => {
  const teraz = 59_000;
  const kod = kodDlaOkna(SEK, numerOkna(teraz));
  assert.equal(sprawdzKod(SEK, kod, teraz), 1); // zwraca numer okna
  assert.equal(sprawdzKod(SEK, "000000", teraz), null);
  assert.equal(sprawdzKod(SEK, "abc", teraz), null); // nie 6 cyfr
});

test("tolerancja zegara: ±1 okno OK, dalej NIE", () => {
  const teraz = 59_000;
  const kod = kodDlaOkna(SEK, numerOkna(teraz));
  assert.equal(sprawdzKod(SEK, kod, teraz + 30_000), 1); // sąsiednie okno — wciąż łapane
  assert.equal(sprawdzKod(SEK, kod, teraz + 120_000), null); // 4 okna dalej — odrzucone
});
