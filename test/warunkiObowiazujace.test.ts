import { test } from "node:test";
import assert from "node:assert/strict";
import { warunkiZWierszy, zdanieWyrownaniaTerminu, type WierszUmowy } from "../lib/warunkiObowiazujace";
import { zdanieRozjazdFaktury } from "../lib/propozycje";

/** Scenariusz wprost z `docs/DRUGIE-PRZEJSCIE-NA-SUCHO.md` — te same daty
 *  i kwoty, żeby test mówił o czymś, co naprawdę się wydarzyło. */
const UMOWA: WierszUmowy = {
  id: "f3dd1500-0000-4000-8000-000000000001",
  typ: "umowa",
  status: "Podpisana",
  created_at: "2026-08-04 10:00:00+02",
  zakres_prac: "Automatyzacja fakturowania",
  cena: 11000,
  waluta: "PLN",
  termin_realizacji: "2026-08-25",
};

function aneks(nr: number, status: string, nadpisz: Partial<WierszUmowy> = {}): WierszUmowy {
  return {
    id: `f6526900-0000-4000-8000-00000000000${nr}`,
    typ: "aneks",
    status,
    created_at: "2026-08-04 12:00:00+02",
    aneks_nr: nr,
    zakres_prac: UMOWA.zakres_prac,
    cena: UMOWA.cena,
    waluta: "PLN",
    termin_realizacji: UMOWA.termin_realizacji,
    ...nadpisz,
  };
}

test("bez aneksów obowiązuje sama umowa", () => {
  const w = warunkiZWierszy(UMOWA, []);
  assert.equal(w.cena, 11000);
  assert.equal(w.termin_realizacji, "2026-08-25");
  assert.equal(w.zrodlo.typ, "umowa");
  assert.equal(w.aneksowPodpisanych, 0);
});

test("szkic aneksu NICZEGO nie zmienia", () => {
  // Wyliczenie dozwolonego (`status === "Podpisana"`), nie wykluczanie
  // zakazanego: szkic i wysłany-bez-podpisu to dwa różne stany i oba muszą
  // odpaść bez wymieniania ich z nazwy.
  const w = warunkiZWierszy(UMOWA, [aneks(1, "Szkic", { cena: 15000 }), aneks(2, "Wysłana", { cena: 99000 })]);
  assert.equal(w.cena, 11000);
  assert.equal(w.zrodlo.typ, "umowa");
});

test("obowiązuje ostatni PODPISANY aneks, nie ostatni jakikolwiek", () => {
  const w = warunkiZWierszy(UMOWA, [
    aneks(1, "Podpisana", { cena: 15000, termin_realizacji: "2026-09-15" }),
    aneks(2, "Szkic", { cena: 20000 }),
  ]);
  assert.equal(w.cena, 15000);
  assert.equal(w.termin_realizacji, "2026-09-15");
  assert.equal(w.zrodlo.aneksNr, 1);
  assert.equal(w.aneksowPodpisanych, 1);
});

test("kolejność wejściowa aneksów nie ma znaczenia", () => {
  // Wołający nie ma prawa musieć pamiętać o sortowaniu — inaczej reguła zacznie
  // żyć w kilku kopiach, tak jak żyła przed tym plikiem.
  const a1 = aneks(1, "Podpisana", { cena: 15000 });
  const a2 = aneks(2, "Podpisana", { cena: 18000, termin_realizacji: "2026-10-15" });
  assert.equal(warunkiZWierszy(UMOWA, [a2, a1]).cena, 18000);
  assert.equal(warunkiZWierszy(UMOWA, [a1, a2]).cena, 18000);
});

test("A7: źródło wskazuje aneks, umowa-matka zostaje osobno", () => {
  // Sedno znaleziska A7: aneks nr 2 cytuje warunki z aneksu nr 1, ale DOTYCZY
  // umowy. Pomylenie tych dwóch odpowiedzi dało dokument, który powoływał się
  // na umowę, w której cytowanej kwoty nie ma.
  const w = warunkiZWierszy(UMOWA, [aneks(1, "Podpisana", { cena: 15000, termin_realizacji: "2026-09-15" })]);
  assert.equal(w.zrodlo.typ, "aneks");
  assert.equal(w.zrodlo.opis, "Aneks nr 1 z 04.08.2026");
  assert.equal(w.zrodlo.reference, "ANEKS-1-UM-2026-F3DD15");
  assert.equal(w.umowa.reference, "UM-2026-F3DD15");
  assert.notEqual(w.zrodlo.reference, w.umowa.reference);
});

test("źródłem umowy jest ona sama — a nie „brak”", () => {
  const w = warunkiZWierszy(UMOWA, []);
  assert.equal(w.zrodlo.reference, w.umowa.reference);
  assert.equal(w.zrodlo.aneksNr, null);
  assert.ok(w.zrodlo.opis.startsWith("Umowa UM-2026-F3DD15"));
});

test("brak terminu w warunkach to null, nie pusty string", () => {
  // `wyrownajTerminProjektu` opiera się na tym rozróżnieniu: pusty string
  // przeszedłby dalej i skasował termin projektu.
  const w = warunkiZWierszy({ ...UMOWA, termin_realizacji: null }, []);
  assert.equal(w.termin_realizacji, null);
});

test("znacznik czasu z Postgresa nie psuje daty w opisie źródła", () => {
  // Spacja zamiast „T" i strefa bez dwukropka — `new Date()` oddaje na tym
  // `Invalid Date` (lekcja `znacznik-czasu-postgresa`).
  const w = warunkiZWierszy(UMOWA, [aneks(1, "Podpisana", { created_at: "2026-09-15 08:30:00+02", cena: 15000 })]);
  assert.equal(w.zrodlo.opis, "Aneks nr 1 z 15.09.2026");
});

test("A6: zdanie o wyrównaniu terminu mówi, CO na CO i z czego", () => {
  const zdanie = zdanieWyrownaniaTerminu({ przed: "2026-09-22", po: "2026-08-25", zrodloOpis: "Aneks nr 1 z 04.08.2026" });
  assert.ok(zdanie.includes("22.09.2026"));
  assert.ok(zdanie.includes("25.08.2026"));
  assert.ok(zdanie.includes("Aneks nr 1"));
});

test("A6: projekt bez terminu ma w śladzie „brak”, nie puste miejsce", () => {
  const zdanie = zdanieWyrownaniaTerminu({ przed: null, po: "2026-08-25", zrodloOpis: "Umowa UM-2026-F3DD15 z 04.08.2026" });
  assert.ok(zdanie.includes("brak → 25.08.2026"));
});

test("A8: zdanie propozycji podaje obie kwoty i kierunek różnicy", () => {
  // Dokładnie ta para liczb z drugiego przejścia: aneks 15 000, szkic 11 000.
  const zdanie = zdanieRozjazdFaktury("Aneks nr 1 z 04.08.2026", 15000, "FV 93/2026", 11000, 4000, "PLN");
  assert.ok(zdanie.includes("Aneks nr 1"));
  assert.ok(zdanie.includes("FV 93/2026"));
  assert.ok(zdanie.includes("dopisać pozycję wyrównującą"));
  assert.ok(zdanie.includes("+"));
  assert.ok(zdanie.endsWith("?"));
});

test("A8: obniżka wynagrodzenia daje minus, nie plus bez znaku", () => {
  const zdanie = zdanieRozjazdFaktury("Aneks nr 2 z 04.08.2026", 9000, "FV 93/2026", 11000, -2000, "PLN");
  assert.ok(zdanie.includes("−"));
  assert.ok(!zdanie.includes("+"));
});
