import { test } from "node:test";
import assert from "node:assert/strict";
import { documentYear } from "../lib/documents.ts";
import {
  offerReference,
  isOfferStatus,
  isOfferCurrency,
  rejectReasonLabel,
  weightedOfferValue,
  isOfferExpired,
  offerTotal,
  offerOptionalRest,
  offerSilenceDays,
  isOfferStale,
  offerLiczySieDoStatystyk,
  obliczZwrot,
} from "../lib/offers.ts";
import { podstawPola } from "../lib/offerTemplates.ts";
import {
  blokadaOferty,
  blokadaFaktury,
  blokadaUmowy,
  ruszaTresc,
  POLA_MIMO_BLOKADY_OFERTY,
} from "../lib/blokadaDokumentu.ts";
import { contractReference } from "../lib/contracts.ts";
import { domyslnaStawkaVat } from "../lib/offerAccept.ts";

// Moduł 57. Trzy rzeczy warte testu, bo każda po cichu psuła coś, czego nie
// widać na ekranie: rok w numerze dokumentu (Safari), walidacja statusu
// (wskaźniki) i domyślna stawka VAT (pieniądze na szkicu faktury).

test("rok dokumentu: znacznik z Postgresa, nie new Date()", () => {
  // Dokładnie ten format oddaje baza (zmierzone): spacja zamiast „T",
  // strefa bez dwukropka. Silnik dat Safari zwraca z tego Invalid Date.
  assert.equal(documentYear("2026-07-26 19:12:44.487+01"), "2026");
  assert.equal(documentYear("2026-07-26T19:12:44.487Z"), "2026");
  assert.equal(documentYear("1999-01-01 00:00:00+00"), "1999");
});

test("rok dokumentu: śmieci nie dają NaN", () => {
  const teraz = String(new Date().getFullYear());
  assert.equal(documentYear(null), teraz);
  assert.equal(documentYear(""), teraz);
  assert.equal(documentYear("brak-daty"), teraz);
});

test("referencje dokumentów mają rok i sześć znaków id", () => {
  const oferta = { id: "964be471-2ea4-4072-9c31-3f2b7920ac4d", created_at: "2026-07-26 19:12:44.487+01" };
  assert.equal(offerReference(oferta), "OF-2026-964BE4");
  assert.equal(
    contractReference({ id: "964be471-2ea4-4072-9c31-3f2b7920ac4d", typ: "umowa", created_at: "2026-07-26 19:12:44+01" }),
    "UM-2026-964BE4"
  );
  assert.equal(
    contractReference({ id: "964be471-2ea4-4072-9c31-3f2b7920ac4d", typ: "nda", created_at: "2026-07-26 19:12:44+01" }),
    "NDA-2026-964BE4"
  );
});

test("status oferty: tylko znane wartości", () => {
  assert.equal(isOfferStatus("Wysłana"), true);
  // Literówka bez ogonka przechodziła wcześniej przez PATCH i wypadała
  // ze WSZYSTKICH liczników naraz.
  assert.equal(isOfferStatus("Wyslana"), false);
  assert.equal(isOfferStatus(""), false);
  assert.equal(isOfferStatus(42), false);
});

test("waluta oferty: tylko z listy", () => {
  assert.equal(isOfferCurrency("PLN"), true);
  assert.equal(isOfferCurrency("EUR"), true);
  assert.equal(isOfferCurrency("BTC"), false);
});

test("domyślna stawka VAT wywiedziona z kraju", () => {
  assert.equal(domyslnaStawkaVat(""), "23");
  assert.equal(domyslnaStawkaVat(null), "23");
  assert.equal(domyslnaStawkaVat("Polska"), "23");
  assert.equal(domyslnaStawkaVat(" polska "), "23");
  assert.equal(domyslnaStawkaVat("PL"), "23");
  assert.equal(domyslnaStawkaVat("Niemcy"), "np");
  assert.equal(domyslnaStawkaVat("DE"), "np");
});

test("powód odrzucenia: powód, komentarz albo oba", () => {
  assert.equal(rejectReasonLabel("Za drogo", ""), "Za drogo");
  assert.equal(rejectReasonLabel("Za drogo", "budżet w Q4"), "Za drogo — budżet w Q4");
  assert.equal(rejectReasonLabel("", "sam komentarz"), "sam komentarz");
  assert.equal(rejectReasonLabel("", ""), "");
});

test("zamknięta oferta nie wchodzi do pipeline'u ani do przeterminowania", () => {
  assert.equal(weightedOfferValue("Wysłana", 1000), 500);
  assert.equal(weightedOfferValue("Szkic", 1000), 200);
  assert.equal(weightedOfferValue("Odrzucona", 1000), 0);
  assert.equal(isOfferExpired({ status: "Odrzucona", wazna_do: "2000-01-01" }), false);
  assert.equal(isOfferExpired({ status: "Wysłana", wazna_do: "2000-01-01" }), true);
  assert.equal(isOfferExpired({ status: "Wysłana", wazna_do: null }), false);
});

// ── Runda 2 Modułu 57 ─────────────────────────────────────────────────────

test("pozycje opcjonalne wchodzą do kwoty dopiero zaznaczone", () => {
  const items = [
    { ilosc: 1, cena: 12000 },
    { ilosc: 1, cena: 3900, opcjonalna: true, wybrana: false },
    { ilosc: 2, cena: 500, opcjonalna: true, wybrana: true },
  ];
  assert.equal(offerTotal(items), 13000);
  assert.equal(offerOptionalRest(items), 3900);
  // Pozycje bez tych pól (oferty sprzed zmiany) liczą się jak obowiązkowe.
  assert.equal(offerTotal([{ ilosc: 1, cena: 100 }]), 100);
});

test("cisza po wysyłce liczona od wyslana_at, tylko dla „Wysłana”", () => {
  const teraz = Date.parse("2026-07-26T12:00:00Z");
  const szesc = "2026-07-20 12:00:00+00";
  assert.equal(offerSilenceDays({ status: "Wysłana", wyslana_at: szesc }, teraz), 6);
  assert.equal(offerSilenceDays({ status: "Szkic", wyslana_at: szesc }, teraz), null);
  assert.equal(offerSilenceDays({ status: "Wysłana", wyslana_at: null }, teraz), null);
});

test("upomnienie: po progu tak, po przypomnieniu już nie", () => {
  const teraz = Date.parse("2026-07-26T12:00:00Z");
  const dawno = "2026-07-20 12:00:00+00";
  const wczoraj = "2026-07-25 12:00:00+00";
  assert.equal(isOfferStale({ status: "Wysłana", wyslana_at: dawno, przypomniano_at: null }, teraz), true);
  assert.equal(isOfferStale({ status: "Wysłana", wyslana_at: wczoraj, przypomniano_at: null }, teraz), false);
  // Raz przypomniane nie wraca — inaczej Pulpit prosiłby o to samo codziennie.
  assert.equal(isOfferStale({ status: "Wysłana", wyslana_at: dawno, przypomniano_at: wczoraj }, teraz), false);
});

test("oferta zastąpiona nowszą wersją wypada z liczników", () => {
  assert.equal(offerLiczySieDoStatystyk({ superseded_at: null }), true);
  assert.equal(offerLiczySieDoStatystyk({ superseded_at: "2026-07-26 12:00:00+00" }), false);
});

// ── Runda 3 ───────────────────────────────────────────────────────────────

test("zwrot: liczony z liczb właściciela, miesiące w GÓRĘ", () => {
  // 8 h × 120 zł = 960 zł/mies; 6000 / 960 = 6,25 → 7 miesięcy (ostrożnie).
  assert.deepEqual(obliczZwrot({ roi_godziny: 8, roi_stawka: 120 }, 6000), {
    oszczednoscMiesiac: 960,
    miesiecyDoZwrotu: 7,
    oszczednoscRok: 11520,
  });
});

test("zwrot: brak którejkolwiek liczby = brak bloku", () => {
  assert.equal(obliczZwrot({ roi_godziny: 0, roi_stawka: 120 }, 6000), null);
  assert.equal(obliczZwrot({ roi_godziny: 8, roi_stawka: 0 }, 6000), null);
  // Oferta bez kwoty: „zwrot w 0 miesięcy" byłby gorszy niż brak bloku.
  assert.equal(obliczZwrot({ roi_godziny: 8, roi_stawka: 120 }, 0), null);
});

test("pola scalane podstawiają się, nieznane zostają widoczne", () => {
  const w = { klient: "Nordwind Studio", kwota: "18 000,00 zł", wazna_do: "09.08.2026", dzis: "26.07.2026" };
  assert.equal(podstawPola("Dla {{klient}} za {{kwota}}.", w), "Dla Nordwind Studio za 18 000,00 zł.");
  assert.equal(podstawPola("Ważna do {{ wazna_do }}", w), "Ważna do 09.08.2026");
  // Literówka ma być WIDOCZNA, nie zamieniona w pustkę w ofercie do klienta.
  assert.equal(podstawPola("Cześć {{klientt}}", w), "Cześć {{klientt}}");
});

// ── Blokada dokumentów (2026-07-27) ───────────────────────────────────────

test("oferta: szkic wolny, wysłana zamknięta, zaakceptowana zamknięta na stałe", () => {
  assert.equal(blokadaOferty("Szkic").zablokowane, false);
  const wyslana = blokadaOferty("Wysłana");
  assert.equal(wyslana.zablokowane, true);
  assert.match(wyslana.zablokowane ? wyslana.komunikat : "", /Nowej wersji/);
  const zaakceptowana = blokadaOferty("Zaakceptowana");
  assert.equal(zaakceptowana.zablokowane, true);
  assert.match(zaakceptowana.zablokowane ? zaakceptowana.komunikat : "", /projekt i faktura/);
});

test("faktura zamyka się numerem, umowa podpisem", () => {
  assert.equal(blokadaFaktury(null).zablokowane, false);
  assert.equal(blokadaFaktury("   ").zablokowane, false);
  assert.equal(blokadaFaktury("FV 3/2026").zablokowane, true);
  assert.equal(blokadaUmowy("Wysłana").zablokowane, false);
  assert.equal(blokadaUmowy("Podpisana").zablokowane, true);
});

test("blokada nie zamyka pól, które nie są treścią dokumentu", () => {
  // Zamknięcie oferty statusem i przedłużenie ważności to praca handlowa,
  // nie zmiana tego, co klient przeczytał.
  assert.equal(ruszaTresc({ status: "Odrzucona", powod_odrzucenia: "Za drogo" }, POLA_MIMO_BLOKADY_OFERTY), false);
  assert.equal(ruszaTresc({ wazna_do: "2026-09-01" }, POLA_MIMO_BLOKADY_OFERTY), false);
  assert.equal(ruszaTresc({ tytul: "Nowy" }, POLA_MIMO_BLOKADY_OFERTY), true);
  assert.equal(ruszaTresc({ status: "Wysłana", tytul: "Nowy" }, POLA_MIMO_BLOKADY_OFERTY), true);
});
