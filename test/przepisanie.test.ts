import { test } from "node:test";
import assert from "node:assert/strict";
import {
  POLA_DANYCH_KLIENTA,
  PUSTE_DANE_KLIENTA,
  czasRealizacjiOpis,
  czasRealizacjiTygodnie,
  naKolumnyDokumentu,
  roznicaDanychKlienta,
  scalDaneKlienta,
  terminZCzasuRealizacji,
  tytulProjektuZOferty,
  zDokumentu,
  zKlienta,
  zLeada,
} from "../lib/przepisanie";

/* Faza 1 planu zaplecza (docs/PLAN-ZAPLECZE.md). Te testy pilnują dokładnie
 * tego, co przejście „na sucho" 2026-08-02 zastało zepsute: przepisania,
 * które gubiło po drodze pola. Same trasy sprawdza `npm run przejscie` —
 * tutaj siedzą reguły, które da się sprawdzić bez bazy. */

const KLIENT = {
  nazwa: "Drukarnia Helios sp. z o.o.",
  nip: "6771234567",
  ulica: "ul. Nadwiślańska 14",
  kod: "30-701",
  miasto: "Kraków",
  kraj: "Polska",
  email: "m.zielinska@drukarniahelios.pl",
};

// ── Czytanie źródeł ────────────────────────────────────────────────────────

test("karta klienta przechodzi w komplecie — żadne pole nie ginie", () => {
  const d = zKlienta(KLIENT);
  for (const p of POLA_DANYCH_KLIENTA) {
    assert.ok(d[p], `puste pole „${p}” — dokładnie tak zginął e-mail na fakturze (B2)`);
  }
  assert.equal(d.nazwa, KLIENT.nazwa);
  assert.equal(d.email, KLIENT.email);
});

test("lead nie ma NIP-u, ale ma resztę adresu", () => {
  const d = zLeada({ firma: "Drukarnia Helios", ulica: "ul. Nadwiślańska 14", kod: "30-701", miasto: "Kraków", email: "m@z.pl" });
  assert.equal(d.nazwa, "Drukarnia Helios");
  assert.equal(d.nip, "");
  assert.equal(d.miasto, "Kraków");
});

test("dokument czyta własne kolumny klient_*", () => {
  const d = zDokumentu({ klient_nazwa: "X", klient_email: "a@b.pl", klient_miasto: "Kraków" });
  assert.equal(d.nazwa, "X");
  assert.equal(d.email, "a@b.pl");
  assert.equal(d.nip, "");
});

test("null i undefined nie wywracają odczytu", () => {
  assert.deepEqual(zKlienta(null), PUSTE_DANE_KLIENTA);
  assert.deepEqual(zLeada(undefined), PUSTE_DANE_KLIENTA);
  assert.deepEqual(zDokumentu({ klient_nazwa: null, klient_email: undefined }), PUSTE_DANE_KLIENTA);
});

// ── Mapa pól ───────────────────────────────────────────────────────────────

test("mapa na kolumny dokumentu obejmuje WSZYSTKIE pola kompletu", () => {
  const kolumny = naKolumnyDokumentu(zKlienta(KLIENT));
  for (const p of POLA_DANYCH_KLIENTA) {
    assert.ok(`klient_${p}` in kolumny, `mapa gubi „klient_${p}”`);
  }
  assert.equal(Object.keys(kolumny).length, POLA_DANYCH_KLIENTA.length);
});

// ── Scalanie: karta wygrywa, ale puste pole nie kasuje ─────────────────────

test("karta klienta nadpisuje to, co jest na dokumencie", () => {
  const naDok = { ...PUSTE_DANE_KLIENTA, nazwa: "Stara nazwa", ulica: "ul. Stara 1" };
  const out = scalDaneKlienta(zKlienta(KLIENT), naDok);
  assert.equal(out.nazwa, KLIENT.nazwa);
  assert.equal(out.ulica, KLIENT.ulica);
});

test("puste pole karty NIE kasuje tego, co wpisano ręcznie na dokumencie", () => {
  const karta = { ...zKlienta(KLIENT), nip: "" };
  const naDok = { ...PUSTE_DANE_KLIENTA, nip: "1234567890" };
  const out = scalDaneKlienta(karta, naDok);
  assert.equal(out.nip, "1234567890", "odświeżanie szkicu nie może cofać cudzej roboty");
});

test("różnica pokazuje dokładnie zmienione pola", () => {
  const a = zKlienta(KLIENT);
  const b = { ...a, ulica: "ul. Nadwiślańska 14 lok. 3" };
  assert.deepEqual(roznicaDanychKlienta(a, b), ["ulica"]);
  assert.deepEqual(roznicaDanychKlienta(a, { ...a }), []);
});

// ── Czas realizacji (B5) ───────────────────────────────────────────────────

test("czas realizacji przycina śmieci zamiast je zapisywać", () => {
  assert.equal(czasRealizacjiTygodnie("4"), 4);
  assert.equal(czasRealizacjiTygodnie(3.7), 3);
  assert.equal(czasRealizacjiTygodnie(-2), 0);
  assert.equal(czasRealizacjiTygodnie("cztery"), 0);
  assert.equal(czasRealizacjiTygodnie(null), 0);
  assert.equal(czasRealizacjiTygodnie(9999), 104);
});

test("polska odmiana tygodni", () => {
  assert.equal(czasRealizacjiOpis(1), "ok. 1 tydzień od akceptacji");
  assert.equal(czasRealizacjiOpis(3), "ok. 3 tygodnie od akceptacji");
  assert.equal(czasRealizacjiOpis(5), "ok. 5 tygodni od akceptacji");
  assert.equal(czasRealizacjiOpis(12), "ok. 12 tygodni od akceptacji");
  assert.equal(czasRealizacjiOpis(22), "ok. 22 tygodnie od akceptacji");
  assert.equal(czasRealizacjiOpis(0), "");
});

test("termin liczy się od dnia akceptacji, nie od dziś", () => {
  assert.equal(terminZCzasuRealizacji("2026-08-02", 4), "2026-08-30");
  assert.equal(terminZCzasuRealizacji("2026-08-02", 1), "2026-08-09");
});

test("termin radzi sobie ze znacznikiem z Postgresa (spacja, strefa bez dwukropka)", () => {
  // `new Date("2026-08-02 19:12:33+02")` oddaje Invalid Date — lekcja
  // `znacznik-czasu-postgresa`. Bierzemy samą część RRRR-MM-DD.
  assert.equal(terminZCzasuRealizacji("2026-08-02 19:12:33+02", 4), "2026-08-30");
});

test("termin przechodzi przez koniec miesiąca i roku", () => {
  assert.equal(terminZCzasuRealizacji("2026-12-20", 3), "2027-01-10");
  assert.equal(terminZCzasuRealizacji("2028-02-20", 2), "2028-03-05");
});

test("bez czasu realizacji albo bez daty akceptacji nie zmyślamy terminu", () => {
  assert.equal(terminZCzasuRealizacji("2026-08-02", 0), null);
  assert.equal(terminZCzasuRealizacji(null, 4), null);
  assert.equal(terminZCzasuRealizacji("", 4), null);
  assert.equal(terminZCzasuRealizacji("0202-08-02x", 4), null);
});

// ── Nazwa projektu (B6) ────────────────────────────────────────────────────

test("projekt nie nazywa się od słowa „Oferta”", () => {
  assert.equal(tytulProjektuZOferty("Oferta — Drukarnia Helios", "Drukarnia Helios"), "Drukarnia Helios");
  assert.equal(tytulProjektuZOferty("Oferta - Drukarnia Helios", "x"), "Drukarnia Helios");
  assert.equal(tytulProjektuZOferty("oferta – Helios", "x"), "Helios");
});

test("własny tytuł oferty zostaje nietknięty", () => {
  assert.equal(
    tytulProjektuZOferty("PoC lokalnego modelu do zapytań ofertowych", "Helios"),
    "PoC lokalnego modelu do zapytań ofertowych"
  );
});

test("gdy po zdjęciu przedrostka nie zostaje nic, wraca nazwa klienta", () => {
  assert.equal(tytulProjektuZOferty("Oferta — ", "Drukarnia Helios"), "Drukarnia Helios");
  assert.equal(tytulProjektuZOferty("", ""), "Projekt z oferty");
});
