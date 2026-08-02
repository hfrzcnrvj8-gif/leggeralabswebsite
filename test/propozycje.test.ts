import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REGULY_PROPOZYCJI,
  isRegulaPropozycji,
  kluczPropozycji,
  odfiltrujOdrzucone,
  zdanieKlientAktywny,
  zdanieOpiniaZamykaProjekt,
  zdanieWygranyLead,
  type Propozycja,
} from "../lib/propozycje";

/* Faza 3 planu zaplecza (docs/PLAN-ZAPLECZE.md) — „panel proponuje, właściciel
 * zatwierdza". Tu siedzi to, co da się sprawdzić bez bazy: treść zdania
 * i widoczność propozycji. Same reguły SQL i skutki sprawdza `npm run
 * przejscie` na żywych trasach.
 *
 * Dlaczego akurat te dwie rzeczy: w tej fazie wszystko, co widzi właściciel,
 * to JEDNO ZDANIE i dwa przyciski. Zdanie, które gubi nazwę albo datę, jest
 * całą awarią tej funkcji — nie ma drugiego miejsca, z którego dałoby się
 * dowiedzieć, czego propozycja dotyczy. */

// ── Zdania ─────────────────────────────────────────────────────────────────

test("zdanie o opinii nazywa projekt po tytule", () => {
  assert.equal(
    zdanieOpiniaZamykaProjekt("Automatyzacja ofertowania"),
    "Opinia o „Automatyzacja ofertowania” przyszła — zamknąć projekt jako „Wdrożone”?"
  );
});

test("zdanie o opinii nie zostawia pustego cudzysłowu, gdy projekt nie ma tytułu", () => {
  const z = zdanieOpiniaZamykaProjekt("   ");
  assert.ok(!z.includes("„”"), `puste miejsce na nazwę: ${z}`);
  assert.ok(z.includes("projekcie"), z);
});

test("zdanie o wygranym leadzie podaje, CO jest zaplanowane i na kiedy", () => {
  // Dosłowny przykład z planu — data po polsku, nie ISO z bazy.
  const z = zdanieWygranyLead("Drukarnia Helios", "2026-08-05", "Rozmowa wideo — pokazać demo");
  assert.ok(z.includes("Drukarnia Helios"), z);
  assert.ok(z.includes("Rozmowa wideo — pokazać demo"), z);
  assert.ok(z.includes("05.08.2026"), `data ma być po polsku, nie ISO: ${z}`);
  assert.ok(!z.includes("2026-08-05"), `surowa data z bazy przeciekła do zdania: ${z}`);
});

test("zdanie o wygranym leadzie działa też bez opisu działania", () => {
  const z = zdanieWygranyLead("Drukarnia Helios", "2026-08-05", "");
  assert.ok(z.includes("przypomnienie"), z);
  assert.ok(z.includes("05.08.2026"), z);
  // Bez opisu nie może zostać wiszący cudzysłów po „zaplanowane".
  assert.ok(!z.includes("„”"), z);
});

test("zdanie o wygranym leadzie nie wypisuje daty, której nie ma", () => {
  const z = zdanieWygranyLead("Drukarnia Helios", "", "Telefon kontrolny");
  assert.ok(!z.includes("na  "), z);
  assert.ok(!z.toLowerCase().includes("invalid"), `zła data przeciekła do zdania: ${z}`);
});

test("zdanie o kliencie podaje numer faktury, gdy jest", () => {
  assert.equal(
    zdanieKlientAktywny("Drukarnia Helios", "FV 93/2026"),
    "Drukarnia Helios zapłacił(a) fakturę FV 93/2026 — przestawić klienta na „Aktywny”?"
  );
});

test("zdanie o kliencie nie mówi o fakturze, której numeru nie zna", () => {
  const z = zdanieKlientAktywny("Drukarnia Helios", "");
  assert.ok(!z.includes("fakturę"), `wisząca „faktura” bez numeru: ${z}`);
  assert.ok(z.includes("Drukarnia Helios"), z);
  assert.ok(z.includes("Aktywny"), z);
});

// ── Widoczność ─────────────────────────────────────────────────────────────

const P = (regula: Propozycja["regula"], rekordId: string): Propozycja => ({
  regula,
  rekordId,
  modul: "projects",
  zdanie: "…",
  akcja: "…",
  link: "…",
});

test("odrzucona propozycja znika z listy", () => {
  const lista = [P("opinia-zamyka-projekt", "A"), P("opinia-zamyka-projekt", "B")];
  const zostaly = odfiltrujOdrzucone(lista, [kluczPropozycji("opinia-zamyka-projekt", "A")]);
  assert.deepEqual(zostaly.map((p) => p.rekordId), ["B"]);
});

test("odrzucenie dotyczy JEDNEJ pary reguła+rekord, nie całej reguły", () => {
  // Fałszywy alarm w drugą stronę: gdyby klucz był samą regułą, „nie teraz"
  // przy jednym projekcie wyciszyłoby propozycje dla wszystkich pozostałych.
  const lista = [P("opinia-zamyka-projekt", "A"), P("opinia-zamyka-projekt", "B")];
  const zostaly = odfiltrujOdrzucone(lista, ["opinia-zamyka-projekt"]);
  assert.equal(zostaly.length, 2);
});

test("odrzucenie nie przenosi się na inną regułę o tym samym rekordzie", () => {
  // Rekord może mieć to samo id w dwóch regułach tylko przypadkiem, ale gdyby
  // klucz był samym id, „nie teraz" u leada wyciszyłoby projekt o tym id.
  const lista = [P("opinia-zamyka-projekt", "A"), P("wygrany-lead-bez-przypomnienia", "A")];
  const zostaly = odfiltrujOdrzucone(lista, [kluczPropozycji("wygrany-lead-bez-przypomnienia", "A")]);
  assert.deepEqual(zostaly.map((p) => p.regula), ["opinia-zamyka-projekt"]);
});

test("pusta lista odrzuceń niczego nie zabiera", () => {
  const lista = [P("opinia-zamyka-projekt", "A")];
  assert.equal(odfiltrujOdrzucone(lista, []).length, 1);
});

// ── Strażnik reguły (trasa przyjmuje ją z zewnątrz) ────────────────────────

test("strażnik przepuszcza dokładnie znane reguły", () => {
  for (const r of REGULY_PROPOZYCJI) assert.ok(isRegulaPropozycji(r), r);
  assert.equal(isRegulaPropozycji("cokolwiek"), false);
  assert.equal(isRegulaPropozycji(""), false);
  assert.equal(isRegulaPropozycji(null), false);
  // Spacja na końcu — dokładnie ta pułapka, którą przy Projektach omijała
  // bramka umowy („W trakcie " przechodziło jako inny status).
  assert.equal(isRegulaPropozycji("opinia-zamyka-projekt "), false);
});
