import { test } from "node:test";
import assert from "node:assert/strict";
import { snoozeOptions, sendLaterOptions } from "../lib/mail.ts";
import { warsawWallTimeToUtcISO, todayLocalISO } from "../lib/dates.ts";

// Bliźniak: Snooze.opcje / WysylkaPozniej.opcje (repo leggera-hub-ios).
// „Gdyby apka liczyła »jutro rano« inaczej niż panel, ta sama wiadomość
// odłożona z telefonu i z komputera poleciałaby o różnych porach."
//
// `now` wstrzykujemy jako konkretny moment UTC. Lipiec = czas letni Warszawy
// (UTC+2), więc 13:59Z = 15:59 ściennie, 14:00Z = 16:00 ściennie — to pozwala
// pinować próg co do minuty niezależnie od tego, kiedy test się uruchamia.
const ids = (arr: { id: string }[]) => arr.map((o) => o.id);

test("snooze: 'Później dziś' znika DOKŁADNIE o 16:00 (próg SNOOZE_LATER_TODAY_CUTOFF)", () => {
  assert.ok(ids(snoozeOptions(new Date("2026-07-15T13:59:00Z"))).includes("later_today")); // 15:59
  assert.ok(!ids(snoozeOptions(new Date("2026-07-15T14:00:00Z"))).includes("later_today")); // 16:00
});

test("snooze: 'Jutro rano' i 'Przyszły tydzień' są ZAWSZE", () => {
  for (const iso of ["2026-07-15T05:00:00Z", "2026-07-15T20:00:00Z"]) {
    const got = ids(snoozeOptions(new Date(iso)));
    assert.ok(got.includes("tomorrow_morning"), iso);
    assert.ok(got.includes("next_week"), iso);
  }
});

test("wysyłka później: 'Dziś po południu' znika DOKŁADNIE o 17:00", () => {
  assert.ok(ids(sendLaterOptions(new Date("2026-07-15T14:59:00Z"))).includes("today_afternoon")); // 16:59
  assert.ok(!ids(sendLaterOptions(new Date("2026-07-15T15:00:00Z"))).includes("today_afternoon")); // 17:00
});

test("'Później dziś' celuje w 18:00 ściennie DZISIAJ (etykieta = cel)", () => {
  // Uwaga: snoozeOptions bierze `today` z realnego zegara (tylko `nowMin` jest
  // wstrzykiwane), więc nie hardkodujemy godziny UTC — przeliczamy 18:00 tak
  // samo, jak robi to reguła. Pinuje, że later_today = 18:00 dziś, nie inna godz.
  const later = snoozeOptions(new Date("2026-07-15T10:00:00Z")).find((o) => o.id === "later_today");
  assert.ok(later);
  assert.equal(later!.label, "Później dziś (18:00)");
  assert.equal(later!.targetIso, warsawWallTimeToUtcISO(todayLocalISO(), "18:00"));
});
