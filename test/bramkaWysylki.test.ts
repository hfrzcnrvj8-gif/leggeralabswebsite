import { test } from "node:test";
import assert from "node:assert/strict";
import {
  komunikatBramki,
  mimoOstrzezen,
  odmowaBramki,
  sprawdzDokumentPrzedWysylka,
  sprawdzMailPrzedWysylka,
  sprzeczneTerminy,
  wzmiankiOTerminie,
} from "../lib/bramkaWysylki";

/* Faza 2 planu zaplecza (docs/PLAN-ZAPLECZE.md). Te testy pilnują reguł
 * bramki wysyłki — czyli tego, czego NIE sprawdzało żadne z czterech miejsc
 * wysyłających dokumenty do klienta.
 *
 * Każdy przypadek niżej wyszedł z ręcznego przejścia 2026-08-02 z kodem 200:
 * nie ma tu ani jednej sytuacji wymyślonej przy biurku. Same trasy sprawdza
 * `npm run przejscie` — tutaj siedzą reguły, które da się sprawdzić bez bazy.
 *
 * `id` zastrzeżenia jest częścią kontraktu, nie ozdobą: to po nim rozróżnia
 * się POWÓD odmowy. Pierwsza wersja przejścia uznała lukę A2 za naprawioną,
 * bo `/send` zwróciło 400 — ale z powodu pustego e-maila klienta. */

const WYSTAWCA = {
  nazwa: "Leggera Labs Patryk Piecyk",
  nip: "6771234567",
  ulica: "ul. Kalwaryjska 33/5",
  kod: "30-504",
  miasto: "Kraków",
  kraj: "PL",
  email: "kontakt@leggeralabs.pl",
  adres: "",
};

const KLIENT_NA_DOKUMENCIE = {
  klient_nazwa: "Drukarnia Helios sp. z o.o.",
  klient_nip: "1234567890",
  klient_ulica: "ul. Nadwiślańska 14",
  klient_kod: "30-701",
  klient_miasto: "Kraków",
  klient_email: "m.zielinska@drukarniahelios.pl",
  klient_adres: "",
};

const POZYCJA = { nazwa: "Audyt procesów", ilosc: 1, cena: 3000 };
const SEKCJA = { tytul: "Zakres", tresc: "Przegląd procesów i danych." };

const ofertaGotowa = () =>
  sprawdzDokumentPrzedWysylka({
    rodzaj: "oferta",
    dokument: { ...KLIENT_NA_DOKUMENCIE, tytul: "PoC AI" },
    wystawca: WYSTAWCA,
    pozycje: [POZYCJA],
    sekcje: [SEKCJA],
  });

const ids = (z: { id: string }[]) => z.map((x) => x.id);

// ── Punkt odniesienia ──────────────────────────────────────────────────────

test("kompletna oferta wychodzi bez jednego zastrzeżenia", () => {
  const w = ofertaGotowa();
  assert.deepEqual(ids(w.blokady), []);
  assert.deepEqual(ids(w.ostrzezenia), []);
  assert.equal(w.wolnoWyslac, true);
});

// ── A2: wystawca ───────────────────────────────────────────────────────────

test("A2 — dokument bez nazwy i NIP-u wystawcy nie wychodzi", () => {
  const w = sprawdzDokumentPrzedWysylka({
    rodzaj: "oferta",
    dokument: { ...KLIENT_NA_DOKUMENCIE },
    wystawca: { ...WYSTAWCA, nazwa: "", nip: "" },
    pozycje: [POZYCJA],
    sekcje: [SEKCJA],
  });
  assert.ok(ids(w.blokady).includes("wystawca-bez-nazwy"));
  assert.ok(ids(w.blokady).includes("wystawca-bez-nip"));
  assert.equal(w.wolnoWyslac, false);
});

test("A2 — brak ustawień firmy w ogóle to też brak wystawcy, nie wyjątek", () => {
  const w = sprawdzDokumentPrzedWysylka({
    rodzaj: "faktura",
    dokument: { ...KLIENT_NA_DOKUMENCIE, numer: "7/2026" },
    wystawca: null,
  });
  assert.ok(ids(w.blokady).includes("wystawca-bez-nazwy"));
});

test("odmowa rozróżnia POWÓD: brak wystawcy to nie brak maila klienta", () => {
  const bezWystawcy = sprawdzDokumentPrzedWysylka({
    rodzaj: "oferta",
    dokument: { ...KLIENT_NA_DOKUMENCIE },
    wystawca: { ...WYSTAWCA, nazwa: "", nip: "" },
    pozycje: [POZYCJA],
    sekcje: [SEKCJA],
  });
  // Ten sam dokument ma komplet danych klienta — więc gdyby bramka mówiła
  // tylko „nie wolno", nie dałoby się odróżnić tych dwóch odmów. Właśnie na
  // tym poległa pierwsza wersja przejścia.
  assert.equal(ids(bezWystawcy.blokady).includes("odbiorca-bez-emaila"), false);

  const bezMaila = sprawdzDokumentPrzedWysylka({
    rodzaj: "oferta",
    dokument: { ...KLIENT_NA_DOKUMENCIE, klient_email: "" },
    wystawca: WYSTAWCA,
    pozycje: [POZYCJA],
    sekcje: [SEKCJA],
  });
  assert.deepEqual(ids(bezMaila.blokady), ["odbiorca-bez-emaila"]);
});

// ── A3: adres ──────────────────────────────────────────────────────────────

test("A3 — adres wystawcy: blokada na umowie i fakturze, ostrzeżenie na ofercie", () => {
  const bezAdresu = { ...WYSTAWCA, ulica: "", kod: "", miasto: "", adres: "" };

  const oferta = sprawdzDokumentPrzedWysylka({
    rodzaj: "oferta",
    dokument: { ...KLIENT_NA_DOKUMENCIE },
    wystawca: bezAdresu,
    pozycje: [POZYCJA],
    sekcje: [SEKCJA],
  });
  assert.ok(ids(oferta.ostrzezenia).includes("wystawca-bez-adresu"));
  assert.equal(oferta.wolnoWyslac, true, "oferta niczego nie rozstrzyga — to niechlujstwo, nie wada dokumentu");

  const umowa = sprawdzDokumentPrzedWysylka({
    rodzaj: "umowa",
    dokument: { ...KLIENT_NA_DOKUMENCIE, typ: "umowa", zakres_prac: "Audyt i PoC" },
    wystawca: bezAdresu,
  });
  assert.ok(ids(umowa.blokady).includes("wystawca-bez-adresu"), "umowa IDENTYFIKUJE strony");

  const faktura = sprawdzDokumentPrzedWysylka({
    rodzaj: "faktura",
    dokument: { ...KLIENT_NA_DOKUMENCIE, numer: "7/2026" },
    wystawca: bezAdresu,
  });
  assert.ok(ids(faktura.blokady).includes("wystawca-bez-adresu"));
});

test("stary, jednoliniowy adres wystawcy wystarcza — nie każemy przepisywać danych", () => {
  const w = sprawdzDokumentPrzedWysylka({
    rodzaj: "umowa",
    dokument: { ...KLIENT_NA_DOKUMENCIE, typ: "umowa", zakres_prac: "Audyt" },
    wystawca: { ...WYSTAWCA, ulica: "", kod: "", miasto: "", adres: "ul. Kalwaryjska 33/5\n30-504 Kraków" },
  });
  assert.equal(ids(w.blokady).includes("wystawca-bez-adresu"), false);
});

test("umowa bez adresu drugiej strony nie wychodzi", () => {
  const w = sprawdzDokumentPrzedWysylka({
    rodzaj: "umowa",
    dokument: { ...KLIENT_NA_DOKUMENCIE, klient_ulica: "", klient_miasto: "", typ: "umowa", zakres_prac: "Audyt" },
    wystawca: WYSTAWCA,
  });
  assert.ok(ids(w.blokady).includes("odbiorca-bez-adresu"));
});

// ── A4: sprzeczne terminy ──────────────────────────────────────────────────

test("A4 — dwa różne czasy realizacji w jednym dokumencie to ostrzeżenie", () => {
  const w = sprawdzDokumentPrzedWysylka({
    rodzaj: "oferta",
    dokument: {
      ...KLIENT_NA_DOKUMENCIE,
      // Dokładnie ten przypadek: szablon „Audyt / PoC AI" dopisał do Uwag
      // 2 tygodnie, a sekcja „Terminy" mówiła 3. Wydruk zawierał oba zdania.
      uwagi: "Czas realizacji: ok. 2 tygodnie od akceptacji.",
    },
    wystawca: WYSTAWCA,
    pozycje: [POZYCJA],
    sekcje: [{ tytul: "Terminy", tresc: "Realizacja: 3 tygodnie od podpisania umowy." }],
  });
  assert.deepEqual(ids(w.ostrzezenia), ["sprzeczne-terminy"]);
  assert.equal(w.wolnoWyslac, true, "to ostrzeżenie, nie blokada — czasem właściciel ma rację, a panel nie");
});

test("A4 — pole „Czas realizacji” liczy się jako jeden z terminów", () => {
  const z = sprzeczneTerminy(["Realizacja: 3 tygodnie od akceptacji."], 4);
  assert.equal(z.length, 1);
  assert.match(z[0].tekst, /3 tygodnie/);
  assert.match(z[0].tekst, /4 tyg/);
});

test("ten sam termin powiedziany dwa razy nie jest sprzecznością", () => {
  assert.deepEqual(sprzeczneTerminy(["Termin realizacji: 2 tygodnie.", "Realizacja: 14 dni od akceptacji."]), []);
});

test("liczba bez kontekstu terminu nie robi fałszywego alarmu", () => {
  // „5 dni na uwagi" i „2 tygodnie realizacji" to nie są dwa terminy tej
  // samej rzeczy. Fałszywy alarm usypia czujność skuteczniej niż jego brak.
  const w = sprzeczneTerminy(["Realizacja: 2 tygodnie od akceptacji.", "Gwarancja obejmuje 12 miesięcy wsparcia."]);
  assert.deepEqual(w, []);
});

test("wzmianki o terminie sprowadzają się do dni", () => {
  const w = wzmiankiOTerminie("Termin realizacji: 2 tygodnie. Wdrożenie: 30 dni.");
  assert.deepEqual(
    w.map((x) => x.dni),
    [14, 30]
  );
});

// ── Treść dokumentu ────────────────────────────────────────────────────────

test("oferta bez sekcji ostrzega, że wyjdzie jako sam cennik", () => {
  const w = sprawdzDokumentPrzedWysylka({
    rodzaj: "oferta",
    dokument: { ...KLIENT_NA_DOKUMENCIE },
    wystawca: WYSTAWCA,
    pozycje: [POZYCJA],
    sekcje: [],
  });
  assert.deepEqual(ids(w.ostrzezenia), ["oferta-bez-sekcji"]);
});

test("oferta bez pozycji I bez sekcji to pusta kartka — blokada", () => {
  const w = sprawdzDokumentPrzedWysylka({
    rodzaj: "oferta",
    dokument: { ...KLIENT_NA_DOKUMENCIE },
    wystawca: WYSTAWCA,
    pozycje: [],
    sekcje: [],
  });
  assert.ok(ids(w.blokady).includes("oferta-pusta"));
  assert.equal(ids(w.ostrzezenia).includes("oferta-bez-sekcji"), false, "nie mówimy dwa razy o tym samym");
});

test("umowa bez zakresu prac nie idzie do podpisu — ale NDA już tak", () => {
  const umowa = sprawdzDokumentPrzedWysylka({
    rodzaj: "umowa",
    dokument: { ...KLIENT_NA_DOKUMENCIE, typ: "umowa", zakres_prac: "" },
    wystawca: WYSTAWCA,
  });
  assert.ok(ids(umowa.blokady).includes("umowa-bez-zakresu"));

  const nda = sprawdzDokumentPrzedWysylka({
    rodzaj: "umowa",
    dokument: { ...KLIENT_NA_DOKUMENCIE, typ: "nda", zakres_prac: "" },
    wystawca: WYSTAWCA,
  });
  assert.equal(ids(nda.blokady).includes("umowa-bez-zakresu"), false, "NDA nie ma zakresu prac z definicji");
});

test("szkicu faktury nie da się wysłać — numer nadaje wystawienie", () => {
  const w = sprawdzDokumentPrzedWysylka({
    rodzaj: "faktura",
    dokument: { ...KLIENT_NA_DOKUMENCIE, numer: "" },
    wystawca: WYSTAWCA,
  });
  assert.ok(ids(w.blokady).includes("faktura-bez-numeru"));
});

// ── A1: mail ───────────────────────────────────────────────────────────────

test("A1 — mail z niewypełnionym nawiasem nie wychodzi", () => {
  // To jest DOSŁOWNIE to, co poszło do klienta 2026-08-02, kodem 200.
  const w = sprawdzMailPrzedWysylka({
    tresc: "Projekt zakończony — dziękuję za współpracę!\n\nPozdrawiam,\n[Twoje imię]",
  });
  assert.deepEqual(ids(w.blokady), ["mail-z-nawiasami"]);
  assert.match(w.blokady[0].tekst, /\[Twoje imię\]/, "komunikat ma pokazać, KTÓRY nawias został");
  assert.equal(w.wolnoWyslac, false);
});

test("A1 — mail z podstawionym imieniem przechodzi", () => {
  const w = sprawdzMailPrzedWysylka({
    tresc: "Projekt zakończony — dziękuję za współpracę!\n\nPozdrawiam,\nPatryk Piecyk",
    statusProjektu: "Wdrożone",
  });
  assert.equal(w.wolnoWyslac, true);
  assert.deepEqual(ids(w.ostrzezenia), []);
});

test("mail mówiący „zakończony” przy projekcie w trakcie to ostrzeżenie, nie blokada", () => {
  const w = sprawdzMailPrzedWysylka({
    tresc: "Projekt jest zakończony — dziękuję!\n\nPozdrawiam,\nPatryk Piecyk",
    statusProjektu: "W trakcie",
  });
  assert.deepEqual(ids(w.ostrzezenia), ["mail-mowi-zakonczony"]);
  assert.equal(w.wolnoWyslac, true);
});

test("pusta treść maila to blokada, a nie cicha wysyłka pustki", () => {
  assert.deepEqual(ids(sprawdzMailPrzedWysylka({ tresc: "   " }).blokady), ["mail-pusty"]);
});

// ── Odmowa trasy ───────────────────────────────────────────────────────────

test("blokada daje 400, same ostrzeżenia 409, a zgoda przepuszcza", () => {
  const zBlokada = sprawdzMailPrzedWysylka({ tresc: "Cześć [imię]" });
  assert.equal(odmowaBramki(zBlokada, false)?.status, 400);
  // „Wyślij mimo to" NIE może obchodzić blokady — inaczej okno w panelu
  // byłoby furtką dookoła reguły, której trasa ma pilnować.
  assert.equal(odmowaBramki(zBlokada, true)?.status, 400);

  const zOstrzezeniem = sprawdzMailPrzedWysylka({
    tresc: "Projekt zakończony.\nPozdrawiam,\nPatryk Piecyk",
    statusProjektu: "W trakcie",
  });
  assert.equal(odmowaBramki(zOstrzezeniem, false)?.status, 409);
  assert.equal(odmowaBramki(zOstrzezeniem, true), null, "zgoda przepuszcza ostrzeżenia");

  assert.equal(odmowaBramki(ofertaGotowa(), false), null);
});

test("odmowa niesie całą listę, także ostrzeżenia obok blokady", () => {
  const w = sprawdzDokumentPrzedWysylka({
    rodzaj: "oferta",
    dokument: { ...KLIENT_NA_DOKUMENCIE, klient_email: "" },
    wystawca: WYSTAWCA,
    pozycje: [POZYCJA],
    sekcje: [],
  });
  const o = odmowaBramki(w, false);
  assert.equal(o?.status, 400);
  assert.ok(o?.bramka.ostrzezenia.length, "poprawiając blokadę, właściciel ma widzieć resztę od razu");
  // Komunikat 400 mówi o blokadzie, nie o ostrzeżeniu — inaczej odmowa
  // brzmiałaby jak czepianie się o brak sekcji.
  assert.match(o!.error, /e-?mail/i);
});

test("zgodę „mimo ostrzeżeń” czyta się tylko z jawnego `true`", () => {
  assert.equal(mimoOstrzezen({ mimo_ostrzezen: true }), true);
  assert.equal(mimoOstrzezen({ mimo_ostrzezen: "true" }), false);
  assert.equal(mimoOstrzezen({}), false);
  assert.equal(mimoOstrzezen(null), false);
});

test("komunikat jednym zdaniem mówi, ile jeszcze rzeczy czeka", () => {
  assert.equal(komunikatBramki({ blokady: [], ostrzezenia: [], wolnoWyslac: true }), "");
  const w = sprawdzDokumentPrzedWysylka({
    rodzaj: "faktura",
    dokument: { klient_nazwa: "", klient_email: "", klient_ulica: "", klient_adres: "", numer: "" },
    wystawca: null,
  });
  assert.match(komunikatBramki(w), /i \d+ inne rzeczy/);
});
