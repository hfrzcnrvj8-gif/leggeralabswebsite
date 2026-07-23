import { test } from "node:test";
import assert from "node:assert/strict";
import { ocenKopie, opisWieku, kopieWymagajaUwagi, BACKUP_STALE_HOURS, type BackupRun } from "../lib/backup.ts";

// Reguła nadzoru z Audytu 3/4. Nie dubluje się z apką, ale jej cichy błąd
// byłby drogi (patrz `odtworz.sh` mówiący „Gotowe" mimo 0 tabel). Kolejność
// warunków i próg 36 h to REGUŁA, nie styl — pinujemy jedno i drugie.

const TERAZ = new Date("2026-07-23T10:00:00Z");
function run(godzTemu: number, ok: boolean, powod = ""): BackupRun {
  const iso = new Date(TERAZ.getTime() - godzTemu * 3_600_000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", "+00"); // format zbliżony do tego, co oddaje Postgres
  return { id: "x", ok, host: "nas", powod, tabel: 50, rozmiar_bajtow: 1, trwalo_sekund: 1, created_at: iso };
}

test("brak przebiegów → 'brak' (kopie nieuruchomione)", () => {
  assert.equal(ocenKopie([], TERAZ).stan, "brak");
});

test("świeża udana kopia → 'ok'", () => {
  assert.equal(ocenKopie([run(2, true)], TERAZ).stan, "ok");
});

test("NIEUDANY ostatni przebieg bije świeżą udaną (kolejność = reguła)", () => {
  // wczorajsza się udała, ale ostatnia padła → to znaczy, że jutro kopii nie
  // będzie. Odwrotna kolejność ukryłaby awarię na dobę.
  const stan = ocenKopie([run(1, false, "złe hasło"), run(25, true)], TERAZ);
  assert.equal(stan.stan, "blad");
  assert.equal(stan.stan === "blad" && stan.powod, "złe hasło");
});

test("próg nieaktualności = 36 h, ostro (35 h OK, 37 h przestarzałe)", () => {
  assert.equal(BACKUP_STALE_HOURS, 36);
  assert.equal(ocenKopie([run(35, true)], TERAZ).stan, "ok");
  assert.equal(ocenKopie([run(37, true)], TERAZ).stan, "przestarzale");
});

test("nieczytelny znacznik czasu → NIE milczy (fail-safe alarmuje)", () => {
  const zly: BackupRun = { ...run(2, true), created_at: "to-nie-jest-data" };
  // parsePgTimestamp → null → wiek Infinity → przestarzałe, nie „ok"
  assert.equal(ocenKopie([zly], TERAZ).stan, "przestarzale");
});

test("opisWieku: granice słowne", () => {
  assert.equal(opisWieku(0.5), "przed chwilą");
  assert.equal(opisWieku(5), "5 godz. temu");
  assert.equal(opisWieku(30), "wczoraj");
  assert.equal(opisWieku(72), "3 dni temu");
});

test("kopieWymagajaUwagi: Pulpit milczy tylko przy 'ok'", () => {
  assert.equal(kopieWymagajaUwagi(ocenKopie([run(2, true)], TERAZ)), false);
  assert.equal(kopieWymagajaUwagi(ocenKopie([run(37, true)], TERAZ)), true);
  assert.equal(kopieWymagajaUwagi(ocenKopie([], TERAZ)), true);
});
