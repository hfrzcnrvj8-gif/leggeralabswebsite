import { test } from "node:test";
import assert from "node:assert/strict";
import { itemNetto, itemVat, itemBrutto, unitBrutto, nettoFromUnitBrutto, invoiceTotals, totalPaid, vatFraction, round2 } from "../lib/invoices.ts";

// To są PIENIĄDZE — czysta matematyka faktury, wysoka stawka błędu. Nie dubluje
// się z apką (apka bierze kwoty zawsze z API, nigdy nie liczy w Swifcie —
// [[apka-faktury-oferty-faza10]]), ale cichy błąd zaokrąglenia byłby kosztowny.

test("pozycja: netto z rabatem, VAT, brutto", () => {
  assert.equal(itemNetto({ ilosc: 2, cena_netto: 100, rabat_procent: 10 }), 180);
  assert.equal(itemVat({ ilosc: 1, cena_netto: 100, vat_stawka: "23" }), 23);
  assert.equal(itemBrutto({ ilosc: 1, cena_netto: 100, vat_stawka: "23" }), 123);
});

test("stawki zwolnione/np/0 → VAT zero", () => {
  assert.equal(vatFraction("zw"), 0);
  assert.equal(vatFraction("np"), 0);
  assert.equal(vatFraction("0"), 0);
  assert.equal(vatFraction("23"), 0.23);
  assert.equal(itemBrutto({ ilosc: 1, cena_netto: 100, vat_stawka: "zw" }), 100);
});

test("brutto↔netto to podróż w obie strony (bez dryfu groszy)", () => {
  assert.equal(unitBrutto({ cena_netto: 100, vat_stawka: "23" }), 123);
  assert.equal(nettoFromUnitBrutto(123, "23"), 100);
});

test("sumy całej faktury (netto/VAT/brutto)", () => {
  const t = invoiceTotals([
    { ilosc: 2, cena_netto: 100, vat_stawka: "23" },
    { ilosc: 1, cena_netto: 50, vat_stawka: "8", rabat_procent: 10 },
  ]);
  assert.deepEqual(t, { netto: 245, vat: 49.6, brutto: 294.6 });
});

test("suma wpłat zaokrąglana do grosza", () => {
  assert.equal(totalPaid([{ kwota: 100.005 }, { kwota: 50 }]), 150.01);
});

test("round2: zaokrąglenie do dwóch miejsc", () => {
  assert.equal(round2(0.1 + 0.2), 0.3); // klasyczna pułapka zmiennoprzecinkowa
});
