import { test } from "node:test";
import assert from "node:assert/strict";
import { contractDraftAgeDays, isContractForgottenDraft, isContractStale } from "../lib/contracts";
import { isProjectAtRisk, isProjectOverdue, type Project } from "../lib/projects";
import { isSystemowyWpis } from "../lib/leads";

/* Krok 4 planu `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md` — „porażka jest zdarzeniem
 * jak każde inne" (B1, B2, B4).
 *
 * Testy pilnują tu jednej rzeczy: **że nowe reguły MILCZĄ na normalnej pracy**.
 * To jest cała stawka tego kroku. Reguła, która świeci zawsze, nie jest
 * pół-działająca — jest gorsza od jej braku, bo uczy ignorować cały ekran.
 * Same skutki na żywych trasach sprawdza `npm run przejscie`. */

const umowa = (p: Partial<{ status: string; klient_nazwa: string; created_at: string; sent_at: string | null }> = {}) => ({
  status: "Szkic",
  klient_nazwa: "Chłodnie Wisła",
  created_at: "2026-08-01T10:00:00Z",
  sent_at: null as string | null,
  ...p,
});

// ── B4: „zacząłem i zapomniałem" to INNE pytanie niż „wysłałem i czekam" ────

test("szkic z treścią sprzed dziś to zapomniany dokument", () => {
  assert.equal(isContractForgottenDraft(umowa(), "2026-08-05"), true);
});

test("szkic założony DZIŚ milczy — właśnie nad nim pracujesz", () => {
  assert.equal(isContractForgottenDraft(umowa({ created_at: "2026-08-05T09:00:00Z" }), "2026-08-05"), false);
});

test("pusty formularz bez kontrahenta to nie zapomniana robota", () => {
  assert.equal(isContractForgottenDraft(umowa({ klient_nazwa: "   " }), "2026-08-05"), false);
});

test("dokument wysłany NIE jest zapomnianym szkicem — od tego jest isContractStale", () => {
  const wyslana = umowa({ status: "Wysłana", sent_at: "2026-07-20T10:00:00Z" });
  assert.equal(isContractForgottenDraft(wyslana, "2026-08-05"), false);
  // …i odwrotnie: szkic nigdy nie jest „cichy po wysyłce", bo nigdzie nie
  // poszedł. Dwie rozłączne listy, dwa różne pytania — plan mylił je ze sobą.
  assert.equal(isContractStale(umowa(), Date.parse("2026-08-05T10:00:00Z")), false);
});

test("wiek szkicu liczony w dniach kalendarzowych", () => {
  assert.equal(contractDraftAgeDays({ created_at: "2026-08-01T23:30:00Z" }, "2026-08-05"), 4);
  assert.equal(contractDraftAgeDays({ created_at: "2026-08-05T00:10:00Z" }, "2026-08-05"), 0);
});

// ── B2: zdrowie projektu ma być widoczne, ale nie ma świecić bez końca ──────

const projekt = (p: Partial<Project> = {}): Project =>
  ({ id: "p1", tytul: "Automatyzacja", status: "W trakcie", zdrowie: "Na dobrej drodze", termin: null, ...p }) as Project;

test("projekt zerwany i w toku zgłasza się sam", () => {
  assert.equal(isProjectAtRisk(projekt({ zdrowie: "Zerwany" })), true);
  assert.equal(isProjectAtRisk(projekt({ zdrowie: "Zagrożony" })), true);
});

test("projekt na dobrej drodze milczy", () => {
  assert.equal(isProjectAtRisk(projekt()), false);
});

test("po wstrzymaniu albo wdrożeniu przestaje świecić — decyzja już zapadła", () => {
  assert.equal(isProjectAtRisk(projekt({ zdrowie: "Zerwany", status: "Wstrzymane" })), false);
  assert.equal(isProjectAtRisk(projekt({ zdrowie: "Zagrożony", status: "Wdrożone" })), false);
});

test("wstrzymany projekt nie nagabuje o termin", () => {
  // Do kroku 4 `isProjectOverdue` pomijał tylko „Wdrożone", więc projekt
  // świadomie odłożony na półkę dalej wisiał na Pulpicie jako zaległy —
  // wbrew temu, co instrukcja w panelu obiecuje od dawna.
  assert.equal(isProjectOverdue(projekt({ status: "Wstrzymane", termin: "2020-01-01" })), false);
  assert.equal(isProjectOverdue(projekt({ status: "W trakcie", termin: "2020-01-01" })), true);
});

// ── B1: wpis systemowy odróżnia się od notatki ─────────────────────────────

test("wpis systemowy poznaje się po niepustym kind", () => {
  assert.equal(isSystemowyWpis({ kind: "offer_rejected" }), true);
  assert.equal(isSystemowyWpis({ kind: null }), false);
  // Pusty string z bazy to NIE jest rodzaj zdarzenia — `kind !== null`
  // uznałoby taki wiersz za systemowy i zabrałoby właścicielowi kosz.
  assert.equal(isSystemowyWpis({ kind: "" }), false);
  assert.equal(isSystemowyWpis({ kind: "   " }), false);
});
