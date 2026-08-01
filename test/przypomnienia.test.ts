import { test } from "node:test";
import assert from "node:assert/strict";
import { dniLezenia, seriaMaPrzyszlosc, isOverdue, PROG_LEZY_DNI, type Reminder } from "../lib/reminders.ts";

/*
 * Przypomnienia (Moduł 66). Wyróżnik tego modułu: **to jedyne miejsce
 * w panelu, w którym data nie tylko OPISUJE, ale URUCHAMIA.** Zły termin
 * w koszcie maluje wiersz na pomarańczowo; zły termin tutaj decyduje, czy
 * powiadomienie przyjdzie dziś, za rok, czy nigdy.
 *
 * Drugi wyróżnik: termin jest OPCJONALNY — „bez terminu" jest POPRAWNYM
 * stanem, nie brakiem danych (decyzja właściciela z 2026-07-22). Połowa
 * testów niżej pilnuje właśnie tego, żeby `null` nie zaczął gdzieś znaczyć
 * „dziś" albo „przeterminowane".
 *
 * Każdy test odpowiada jednej rzeczy zmierzonej sondą na żywym serwerze
 * 2026-08-01.
 */

/** Minimalny rekord — testy podmieniają tylko to, co badają. */
function przyklad(pola: Partial<Reminder> = {}): Reminder {
  return {
    id: "r1",
    tytul: "cokolwiek",
    notatka: "",
    termin: null,
    godzina: null,
    priorytet: 0,
    ukonczone: false,
    ukonczone_at: null,
    lista_id: null,
    lead_id: null,
    client_id: null,
    project_id: null,
    created_at: "2026-08-01 12:00:00+02",
    flaga: false,
    parent_id: null,
    lokalizacja: null,
    lokalizacja_lat: null,
    lokalizacja_lon: null,
    lokalizacja_promien: null,
    przy_wyjsciu: false,
    powtarzanie: null,
    powtarzanie_do: null,
    powtarzanie_od: null,
    ...pola,
  };
}

// ─── Termin `null` nie jest zaległością ───────────────────────────────────
//
// Najważniejszy test w tym pliku. „Kiedyś przejrzeć backupy" ma prawo leżeć
// i NIE MOŻE świecić na czerwono — inaczej lista zaległości przestaje znaczyć
// „masz coś po terminie" i uczy ignorowania czerwieni.

test("bez terminu nigdy nie jest po terminie", () => {
  assert.equal(isOverdue(przyklad({ termin: null }), "2026-08-01"), false);
  // Także wtedy, gdy „dziś" jest odległe — brak terminu nie starzeje się
  // w zaległość z upływem czasu.
  assert.equal(isOverdue(przyklad({ termin: null }), "2099-12-31"), false);
});

test("ukończone nigdy nie jest po terminie, choćby termin dawno minął", () => {
  assert.equal(isOverdue(przyklad({ termin: "2020-01-01", ukonczone: true }), "2026-08-01"), false);
  assert.equal(isOverdue(przyklad({ termin: "2020-01-01", ukonczone: false }), "2026-08-01"), true);
});

test("termin DZISIEJSZY to jeszcze nie zaległość", () => {
  // Granica liczona kalendarzowo, przez porównanie stringów — nie przez
  // odejmowanie milisekund po UTC. Apka robi dokładnie to samo
  // (`Przypomnienie.poTerminie`), więc ta sama sprawa nie może wyglądać
  // inaczej na telefonie i na biurku (pamięć `audyt-6-kod`).
  assert.equal(isOverdue(przyklad({ termin: "2026-08-01" }), "2026-08-01"), false);
  assert.equal(isOverdue(przyklad({ termin: "2026-07-31" }), "2026-08-01"), true);
});

// ─── „leży od…" — jedyne, co pilnuje spraw bez terminu ────────────────────

test("sygnał leżenia milczy przed progiem i odzywa się po nim", () => {
  const teraz = new Date("2026-08-01T12:00:00Z");
  const oIleDni = (dni: number) =>
    przyklad({ created_at: new Date(teraz.getTime() - dni * 86400000).toISOString() });

  assert.equal(dniLezenia(oIleDni(1), teraz), null);
  assert.equal(dniLezenia(oIleDni(PROG_LEZY_DNI - 1), teraz), null);
  assert.equal(dniLezenia(oIleDni(PROG_LEZY_DNI), teraz), PROG_LEZY_DNI);
  assert.equal(dniLezenia(oIleDni(400), teraz), 400);
});

test("sygnał leżenia dotyczy WYŁĄCZNIE spraw bez terminu i nieukończonych", () => {
  const teraz = new Date("2026-08-01T12:00:00Z");
  const stare = new Date(teraz.getTime() - 200 * 86400000).toISOString();

  // Z terminem: pilnuje go zaległość, licznik dni byłby drugim sygnałem
  // o tym samym.
  assert.equal(dniLezenia(przyklad({ created_at: stare, termin: "2026-09-01" }), teraz), null);
  // Odhaczone: nie leży, tylko jest zrobione.
  assert.equal(dniLezenia(przyklad({ created_at: stare, ukonczone: true }), teraz), null);
  // Bez terminu i nieukończone — jedyny przypadek, w którym cokolwiek mówimy.
  assert.equal(dniLezenia(przyklad({ created_at: stare }), teraz), 200);
});

test("znacznik czasu z Postgresa (spacja zamiast T) daje się odczytać", () => {
  // `new Date()` w przeglądarce nie musi zjeść „2026-01-01 12:00:00+01",
  // a wtedy licznik po cichu milczy zamiast liczyć (pamięć
  // `znacznik-czasu-postgresa`). Idzie przez `parsePgTimestamp`.
  const teraz = new Date("2026-08-01T12:00:00Z");
  assert.equal(dniLezenia(przyklad({ created_at: "2026-01-01 12:00:00+01" }), teraz), 212);
  // Nieczytelny znacznik = milczenie, nie NaN.
  assert.equal(dniLezenia(przyklad({ created_at: "bzdura" }), teraz), null);
});

// ─── Seria, która nie ma już kiedy wystąpić ───────────────────────────────
//
// Zmierzone sondą: `powtarzanie_do` wcześniejsze niż `termin` zapisuje się bez
// błędu, i tak samo przechodzi przesunięcie terminu za datę końca. Zapis jest
// UPRAWNIONY (decyzja właściciela z 2026-08-01), więc jedyną obroną jest
// powiedzenie o tym wprost — a do tego trzeba to najpierw poprawnie rozpoznać.

test("seria bez daty końca zawsze ma przyszłość", () => {
  assert.equal(
    seriaMaPrzyszlosc(przyklad({ termin: "2026-09-01", powtarzanie: "co_miesiac", powtarzanie_do: null })),
    true
  );
});

test("koniec serii PRZED terminem = brak przyszłości", () => {
  assert.equal(
    seriaMaPrzyszlosc(
      przyklad({ termin: "2026-09-01", powtarzanie: "co_tydzien", powtarzanie_do: "2026-08-01", powtarzanie_od: "2026-09-01" })
    ),
    false
  );
});

test("koniec PO terminie, ale przed kolejnym krokiem rytmu = brak przyszłości", () => {
  // Podchwytliwy przypadek: koniec serii jest PÓŹNIEJSZY niż termin, więc
  // porównanie dwóch dat powiedziałoby „wszystko gra". A między 1 a 15 września
  // nie mieści się ani jeden krok miesięczny — kolejne wystąpienie wypada
  // 1 października, czyli już po końcu.
  assert.equal(
    seriaMaPrzyszlosc(
      przyklad({ termin: "2026-09-01", powtarzanie: "co_miesiac", powtarzanie_do: "2026-09-15", powtarzanie_od: "2026-09-01" })
    ),
    false
  );
  // Ten sam układ z końcem po 1 października — seria żyje.
  assert.equal(
    seriaMaPrzyszlosc(
      przyklad({ termin: "2026-09-01", powtarzanie: "co_miesiac", powtarzanie_do: "2026-10-05", powtarzanie_od: "2026-09-01" })
    ),
    true
  );
});

test("brak cyklu albo brak terminu = nie ma o czym mówić", () => {
  assert.equal(seriaMaPrzyszlosc(przyklad({ termin: "2026-09-01", powtarzanie: null })), false);
  assert.equal(seriaMaPrzyszlosc(przyklad({ termin: null, powtarzanie: "co_miesiac" })), false);
  // Klucz spoza słownika (literówka „co tydzień" zamiast `co_tydzien`) —
  // trasa zapisu już go nie przyjmie, ale odczyt musi być odporny na to,
  // co siedzi w bazie od wcześniej.
  assert.equal(seriaMaPrzyszlosc(przyklad({ termin: "2026-09-01", powtarzanie: "co tydzień" })), false);
});

test("rytm liczy się od KOTWICY, nie od bieżącego terminu", () => {
  // Seria „co miesiąc od 31 stycznia", przesunięta odhaczeniami na 30 września
  // (luty przyciął ją do 28/29). Gdyby przyszłość liczyć od terminu, kolejnym
  // krokiem byłby 30 października — a rytm należy do 31. dnia miesiąca.
  // Koniec ustawiony na 31 października rozstrzyga, która wersja obowiązuje.
  assert.equal(
    seriaMaPrzyszlosc(
      przyklad({
        termin: "2026-09-30",
        powtarzanie: "co_miesiac",
        powtarzanie_od: "2026-01-31",
        powtarzanie_do: "2026-10-31",
      })
    ),
    true
  );
});
