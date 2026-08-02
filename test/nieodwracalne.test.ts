import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DZIALANIA_NIEODWRACALNE,
  NAGLOWEK_FRAZY,
  NAGLOWEK_POTWIERDZENIA,
  frazaSieZgadza,
  jestDzialaniemNieodwracalnym,
  normalizujFraze,
  odczytajPotwierdzenie,
  odmowaPotwierdzenia,
  type IdDzialania,
} from "../lib/nieodwracalne";

/* Faza 4 planu zaplecza (docs/PLAN-ZAPLECZE.md) — „co nieodwracalne, to pyta".
 *
 * Tu siedzi wszystko, co da się sprawdzić bez bazy: sama reguła potwierdzenia,
 * porównanie przepisanej frazy i kształt odmowy. Że TRASY naprawdę odmawiają,
 * sprawdza sonda w `npm run przejscie` — bo tego nie udowodni żaden test
 * jednostkowy, a to jest cała treść tej fazy (patrz Faza 2: bramka działała
 * tylko tam, gdzie ktoś zajrzał). */

/** Nagłówki żądania w postaci, jakiej oczekuje `odczytajPotwierdzenie`. */
function naglowki(wpisy: Record<string, string>) {
  const m = new Map(Object.entries(wpisy).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (n: string) => m.get(n.toLowerCase()) ?? null };
}

// ── Sama lista ─────────────────────────────────────────────────────────────

test("każde działanie o poziomie „mocne” mówi, co przepisać", () => {
  for (const [id, opis] of Object.entries(DZIALANIA_NIEODWRACALNE)) {
    assert.equal(opis.id, id, `wpis „${id}” ma w środku inne id: ${opis.id}`);
    if (opis.poziom === "mocne") {
      assert.ok(opis.coPrzepisac, `„${id}” wymaga przepisania, ale nie mówi czego`);
    }
  }
});

test("skutek każdego działania mówi coś konkretnego, nie „nie można cofnąć”", () => {
  // Zdanie, które nie mówi CO się stanie, nie jest barierą — jest formalnością
  // do odklikania. To była cała treść znaleziska D1.
  for (const [id, opis] of Object.entries(DZIALANIA_NIEODWRACALNE)) {
    assert.ok(opis.skutek.length > 40, `„${id}” ma skutek zbyt ogólny: ${opis.skutek}`);
    assert.ok(opis.przycisk.toLowerCase() !== "ok", `„${id}” ma przycisk „OK” zamiast czasownika`);
  }
});

test("wystawienie faktury i KSeF są na liście, i to jako „mocne”", () => {
  // Sedno D1: to były działania bez ŻADNEJ bariery.
  assert.equal(DZIALANIA_NIEODWRACALNE["faktura-wystaw"].poziom, "mocne");
  assert.equal(DZIALANIA_NIEODWRACALNE["ksef-wyslij"].poziom, "mocne");
});

test("„oznacz umowę jako podpisaną” NIE jest na liście", () => {
  // Druga połowa D1: działanie odwracalne, które pytało. Reguła działa w obie
  // strony — co odwracalne, nie pyta.
  assert.equal(jestDzialaniemNieodwracalnym("umowa-podpisana"), false);
  assert.equal(jestDzialaniemNieodwracalnym("faktura-wystaw"), true);
});

// ── Odczyt z nagłówków ─────────────────────────────────────────────────────

test("brak nagłówków to brak potwierdzenia, nie błąd", () => {
  assert.deepEqual(odczytajPotwierdzenie(naglowki({})), { dzialanie: null, fraza: null });
});

test("fraza z polskimi znakami przechodzi przez nagłówek bez zmiany", () => {
  // Ta wartość jedzie przez dwa języki: `encodeURIComponent` w przeglądarce
  // i `decodeURIComponent` na serwerze. Pamięć („escapowanie przez dwa
  // języki") mówi, że taki rozjazd potrafi nie dać żadnego objawu.
  const oryginal = "Wdrożenie w Łodzi — część II";
  const odczyt = odczytajPotwierdzenie(
    naglowki({
      [NAGLOWEK_POTWIERDZENIA]: "projekt-usun",
      [NAGLOWEK_FRAZY]: encodeURIComponent(oryginal),
    })
  );
  assert.equal(odczyt.dzialanie, "projekt-usun");
  assert.equal(odczyt.fraza, oryginal);
});

test("popsute kodowanie frazy traktujemy jak brak frazy, nie jak awarię", () => {
  const odczyt = odczytajPotwierdzenie(
    naglowki({ [NAGLOWEK_POTWIERDZENIA]: "klient-usun", [NAGLOWEK_FRAZY]: "%E0%A4%A" })
  );
  assert.equal(odczyt.dzialanie, "klient-usun");
  assert.equal(odczyt.fraza, null);
});

// ── Porównanie frazy ───────────────────────────────────────────────────────

test("wielkość liter i nadmiarowe spacje nie przeszkadzają", () => {
  assert.ok(frazaSieZgadza("  kowalski   sp. z O.O.  ", "Kowalski Sp. z o.o."));
});

test("„Lodz” zamiast „Łódź” się NIE zgadza", () => {
  // Test na fałszywy alarm w drugą stronę: gdyby normalizacja zjadała ogonki,
  // mocne potwierdzenie przechodziłoby bez czytania — czyli nie byłoby mocne.
  assert.equal(frazaSieZgadza("Lodz", "Łódź"), false);
});

test("to samo „ł” w dwóch postaciach Unicode to ta sama fraza", () => {
  const nfc = "Łódź".normalize("NFC");
  const nfd = "Łódź".normalize("NFD");
  assert.notEqual(nfc, nfd, "test straciłby sens, gdyby obie postaci były identyczne");
  assert.ok(frazaSieZgadza(nfd, nfc));
});

test("normalizacja pustych wartości nie wywraca się na null/undefined", () => {
  assert.equal(normalizujFraze(null), "");
  assert.equal(normalizujFraze(undefined), "");
  assert.equal(normalizujFraze("   "), "");
});

// ── Odmowa ─────────────────────────────────────────────────────────────────

test("bez potwierdzenia trasa odmawia — 428 i powód „brak-potwierdzenia”", () => {
  const o = odmowaPotwierdzenia("faktura-wystaw", { dzialanie: null, fraza: null }, "Testowa Firma");
  assert.ok(o);
  assert.equal(o.status, 428);
  assert.equal(o.potwierdzenie.powod, "brak-potwierdzenia");
  // Komunikat ma nieść skutek, bo apka bez wsparcia dla tej fazy pokaże
  // dokładnie to zdanie i nic więcej.
  assert.ok(o.error.includes("numer"), `komunikat nie mówi, co się stanie: ${o.error}`);
});

test("zgoda na jedno działanie nie jest zgodą na inne", () => {
  const o = odmowaPotwierdzenia("klient-usun", { dzialanie: "faktura-wyslij", fraza: null }, "Testowa Firma");
  assert.ok(o);
  assert.equal(o.potwierdzenie.powod, "inne-dzialanie");
});

test("odpowiedź 428 NIE zdradza frazy, którą trzeba przepisać", () => {
  // Gdyby zdradzała, mocne potwierdzenie byłoby formalnością: wystarczyłoby
  // przepisać wartość z odmowy do kolejnego żądania.
  const o = odmowaPotwierdzenia("klient-usun", { dzialanie: null, fraza: null }, "Testowa Firma Sp. z o.o.");
  assert.ok(o);
  const cala = JSON.stringify(o);
  assert.ok(!cala.includes("Testowa Firma"), `odmowa zawiera wymaganą frazę: ${cala}`);
  assert.equal(o.potwierdzenie.coPrzepisac, "nazwę klienta");
});

test("mocne potwierdzenie bez przepisanej frazy nie przechodzi", () => {
  const o = odmowaPotwierdzenia("projekt-usun", { dzialanie: "projekt-usun", fraza: null }, "Wdrożenie A");
  assert.ok(o);
  assert.equal(o.potwierdzenie.powod, "fraza-sie-nie-zgadza");
});

test("mocne potwierdzenie z poprawną frazą przechodzi", () => {
  const o = odmowaPotwierdzenia("projekt-usun", { dzialanie: "projekt-usun", fraza: "wdrożenie a" }, "Wdrożenie A");
  assert.equal(o, null);
});

test("zwykłe potwierdzenie nie wymaga frazy", () => {
  assert.equal(odmowaPotwierdzenia("lead-usun", { dzialanie: "lead-usun", fraza: null }), null);
});

test("rekord bez nazwy da się usunąć — mocne schodzi wtedy do zwykłej zgody", () => {
  // Bez tego klient bez nazwy albo projekt bez tytułu byłyby nieusuwalne na
  // zawsze: nie ma czego przepisać, więc żadna fraza nigdy by się nie zgodziła.
  assert.equal(odmowaPotwierdzenia("klient-usun", { dzialanie: "klient-usun", fraza: null }, "  "), null);

  const bezZgody = odmowaPotwierdzenia("klient-usun", { dzialanie: null, fraza: null }, null);
  assert.ok(bezZgody, "sama zgoda nadal jest wymagana");
  assert.equal(bezZgody.potwierdzenie.poziom, "zwykle");
  assert.equal(bezZgody.potwierdzenie.coPrzepisac, undefined);
});

test("każde działanie z listy odmawia, gdy żądanie nie niesie zgody", () => {
  // Sonda w miniaturze: żadne działanie nie może przechodzić „samo z siebie”.
  for (const id of Object.keys(DZIALANIA_NIEODWRACALNE) as IdDzialania[]) {
    const o = odmowaPotwierdzenia(id, { dzialanie: null, fraza: null }, "cokolwiek");
    assert.ok(o, `„${id}” przeszło bez potwierdzenia`);
    assert.equal(o.status, 428);
  }
});
