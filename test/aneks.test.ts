import { test } from "node:test";
import assert from "node:assert/strict";
import { roznicaAneksu, aneksReference, type PoprzednieWarunki } from "../lib/contracts";

const BAZA: PoprzednieWarunki = {
  reference: "UM-2026-A1B2C3",
  zawarta: "2026-07-12 10:00:00+01",
  zakres_prac: "Wdrożenie automatyzacji fakturowania",
  cena: 5000,
  waluta: "PLN",
  termin_realizacji: "2026-09-30",
};

/** Aneks z warunkami — domyślnie identycznymi z umową-matką. */
function aneks(nadpisz: Partial<Parameters<typeof roznicaAneksu>[1]> = {}) {
  return {
    zakres_prac: BAZA.zakres_prac,
    cena: BAZA.cena,
    waluta: BAZA.waluta,
    termin_realizacji: BAZA.termin_realizacji,
    ...nadpisz,
  } as Parameters<typeof roznicaAneksu>[1];
}

test("aneks bez zmian nie ma treści", () => {
  // Stan poprawny i ważny: świeżo sporządzony aneks startuje z warunkami
  // umowy. Trasa wysyłki odmawia wysłania takiego dokumentu.
  assert.deepEqual(roznicaAneksu(BAZA, aneks()), []);
});

test("zmiana ceny daje jedną pozycję „było → jest”", () => {
  const z = roznicaAneksu(BAZA, aneks({ cena: 7000 }));
  assert.equal(z.length, 1);
  assert.deepEqual(z[0], { pole: "cena", bylo: 5000, jest: 7000 });
});

test("zmiana kilku warunków naraz daje pozycję na każdy", () => {
  const z = roznicaAneksu(BAZA, aneks({ cena: 7000, termin_realizacji: "2026-10-31" }));
  assert.equal(z.length, 2);
  assert.deepEqual(
    z.map((x) => x.pole),
    ["cena", "termin_realizacji"]
  );
});

test("NUMERIC z Postgresa nie udaje zmiany ceny", () => {
  // Postgres oddaje NUMERIC jako string „5000.00". Porównanie tekstowe
  // pokazałoby zmianę ceny w aneksie, który ceny nie ruszał — czyli
  // wydrukowałoby klientowi „było 5000, jest 5000" do podpisu.
  const z = roznicaAneksu({ ...BAZA, cena: "5000.00" as unknown as number }, aneks());
  assert.deepEqual(z, []);
});

test("DATE z częścią czasową nie udaje zmiany terminu", () => {
  // Kolumna DATE potrafi wrócić jako „2026-09-30T00:00:00.000Z".
  const z = roznicaAneksu(BAZA, aneks({ termin_realizacji: "2026-09-30T00:00:00.000Z" }));
  assert.deepEqual(z, []);
});

test("same białe znaki w zakresie prac to nie zmiana", () => {
  const z = roznicaAneksu(BAZA, aneks({ zakres_prac: `  ${BAZA.zakres_prac}\n` }));
  assert.deepEqual(z, []);
});

test("usunięcie terminu jest zmianą, nie brakiem zmiany", () => {
  const z = roznicaAneksu(BAZA, aneks({ termin_realizacji: null }));
  assert.equal(z.length, 1);
  assert.deepEqual(z[0], { pole: "termin_realizacji", bylo: "2026-09-30", jest: null });
});

test("dodanie terminu tam, gdzie go nie było, też jest zmianą", () => {
  const z = roznicaAneksu({ ...BAZA, termin_realizacji: null }, aneks({ termin_realizacji: "2026-11-15" }));
  assert.deepEqual(z[0], { pole: "termin_realizacji", bylo: null, jest: "2026-11-15" });
});

test("pusta waluta liczy się jak PLN po obu stronach", () => {
  const z = roznicaAneksu({ ...BAZA, waluta: "" }, aneks({ waluta: "PLN" }));
  assert.deepEqual(z, []);
});

test("referencja aneksu mówi, który to i do czego", () => {
  assert.equal(aneksReference(2, "UM-2026-A1B2C3"), "ANEKS-2-UM-2026-A1B2C3");
});
