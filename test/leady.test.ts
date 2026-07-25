import { test } from "node:test";
import assert from "node:assert/strict";
import { isOverdue, overdueReason, DNI_CISZY_W_OTWARTYM, type Lead } from "../lib/leads.ts";
import { todayLocalISO, addDaysToISO } from "../lib/dates.ts";

// `isOverdue` to JEDYNE źródło trzech rzeczy naraz: banera „wymaga działania
// dziś" w panelu, sekcji w porannym mailu i filtru w apce. Bliźniak w Swifcie
// to `LeadRules.wymagaDzialania` (repo leggera-hub-ios) — te dwie funkcje MUSZĄ
// liczyć to samo, bo inaczej panel i telefon mówią o tym samym leadzie dwie
// różne rzeczy. Ten plik pinuje arytmetykę progów po stronie panelu.

/** Data sprzed `n` dni jako „YYYY-MM-DD" — **tym samym kalendarzem, którego
 * używa sama reguła**.
 *
 * Dwa podejścia już tu poległy i oba dawały ten sam objaw: cztery testy na
 * czerwono bez jednej zmiany w kodzie.
 *   1. `toISOString()` liczyło w UTC — sypało się lokalnie po północy.
 *   2. Czas maszyny — sypało się na runnerze GitHuba, który stoi w UTC:
 *      o 22:00 UTC w Warszawie jest już następny dzień, a `todayLocalISO()`
 *      jest przypięte do `Europe/Warsaw`, nie do strefy maszyny.
 *
 * Stąd trzecie i ostatnie: liczymy `todayLocalISO()` + `addDaysToISO()`, czyli
 * dokładnie tymi funkcjami, którymi liczy `isOverdue`. Test nie ma własnego
 * pojęcia „dziś" — pyta o nie ten sam kalendarz co reguła.
 */
function dniTemu(n: number): string {
  return addDaysToISO(todayLocalISO(), -n);
}

function lead(zmiany: Partial<Lead> = {}): Lead {
  return {
    id: "x", firma: "Testowa", osoba_kontaktowa: "", branza: "", kontakt: "",
    telefon: "", email: "", www: "", linkedin_url: "", ulica: "", kod: "", miasto: "", kraj: "",
    zrodlo_kategoria: "Ręcznie dodane", zrodlo: "", status: "Do kontaktu",
    ostatni_kontakt: null, next_followup: null, next_action: "", ostatni_kanal: null,
    notatki: "", client_id: null, created_at: dniTemu(1), updated_at: dniTemu(1),
    ...zmiany,
  };
}

/* ───────────── reguły, które istniały wcześniej ───────────── */

test("nowe zgłoszenie ze strony woła zawsze", () => {
  assert.equal(isOverdue(lead({ status: "Nowe zgłoszenie ze strony" })), true);
});

test("ręczne przypomnienie bije wszystkie reguły automatyczne", () => {
  assert.equal(isOverdue(lead({ next_followup: dniTemu(0) })), true, "dziś = tak");
  assert.equal(isOverdue(lead({ next_followup: dniTemu(-3) })), false, "za trzy dni = jeszcze nie");
  // Nawet przy świeżym leadzie, który bez daty milczałby.
  assert.equal(isOverdue(lead({ created_at: dniTemu(0), next_followup: dniTemu(0) })), true);
});

test("cisza po „Napisano” to nadal 4 dni, nie 14", () => {
  const s = "Napisano - czeka na odpowiedź";
  assert.equal(isOverdue(lead({ status: s, ostatni_kontakt: dniTemu(3) })), false);
  assert.equal(isOverdue(lead({ status: s, ostatni_kontakt: dniTemu(4) })), true);
});

test("zamknięte statusy milczą, ale „Odrzucone” honoruje ręczną datę", () => {
  assert.equal(isOverdue(lead({ status: "Zamknięte - sukces", created_at: dniTemu(400) })), false);
  assert.equal(isOverdue(lead({ status: "Odrzucone / brak zainteresowania", created_at: dniTemu(400) })), false);
  assert.equal(
    isOverdue(lead({ status: "Odrzucone / brak zainteresowania", next_followup: dniTemu(0) })),
    true,
    "„wróć za parę miesięcy” MUSI zadziałać"
  );
  assert.equal(
    isOverdue(lead({ status: "Zamknięte - sukces", next_followup: dniTemu(0) })),
    false,
    "po wygranej kontakt prowadzi nurture, nie ta reguła"
  );
});

/* ───────────── cisza w otwartym statusie (Moduł 52) ───────────── */

// Do 2026-07-25 lead w „Rozmowa umówiona" mógł stać miesiącami i NIC o nim nie
// przypominało. Przy kilkunastu kandydatach dziennie z łowcy to był największy
// wyciek konwersji w module.

test("otwarty status budzi się dokładnie w dniu progu", () => {
  for (const status of ["Do kontaktu", "Przypomnienie wysłane", "Rozmowa umówiona", "Pilotaż w trakcie"]) {
    assert.equal(
      isOverdue(lead({ status, ostatni_kontakt: dniTemu(DNI_CISZY_W_OTWARTYM - 1) })),
      false,
      `${status}: dzień przed progiem ma milczeć`
    );
    assert.equal(
      isOverdue(lead({ status, ostatni_kontakt: dniTemu(DNI_CISZY_W_OTWARTYM) })),
      true,
      `${status}: w dniu progu ma zawołać`
    );
  }
  assert.equal(DNI_CISZY_W_OTWARTYM, 14, "zmiana progu = świadome pokrętło, nie przypadek");
});

test("lead, do którego NIGDY się nie odezwano, liczy ciszę od utworzenia", () => {
  // Ta gałąź istnieje po to, żeby lead bez ani jednego kontaktu nie milczał
  // wiecznie — a to jest dokładnie ten, o którym najłatwiej zapomnieć.
  assert.equal(isOverdue(lead({ ostatni_kontakt: null, created_at: dniTemu(13) })), false);
  assert.equal(isOverdue(lead({ ostatni_kontakt: null, created_at: dniTemu(14) })), true);
});

test("świeżo przyjęty kandydat łowcy woła od razu przez next_followup", () => {
  // Tak wygląda lead tworzony przez POST /api/leads/candidates/:id/take.
  const k = lead({
    status: "Do kontaktu",
    zrodlo_kategoria: "Automatyczne wyszukiwanie",
    next_followup: dniTemu(0),
    next_action: "pierwszy kontakt — kandydat łowcy, ocena A",
    created_at: dniTemu(0),
  });
  assert.equal(isOverdue(k), true);
  assert.match(overdueReason(k), /pierwszy kontakt — kandydat łowcy/);
});

test("powód mówi, CO się stało — inaczej dla ciszy, inaczej dla braku kontaktu", () => {
  assert.match(
    overdueReason(lead({ status: "Rozmowa umówiona", ostatni_kontakt: dniTemu(20) })),
    /cisza od 20 dni/
  );
  assert.match(
    overdueReason(lead({ ostatni_kontakt: null, created_at: dniTemu(30) })),
    /30 dni w rejestrze i ani jednego kontaktu/
  );
});
