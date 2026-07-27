import { test } from "node:test";
import assert from "node:assert/strict";
import { czyLiczycJakoOtwarcie } from "../lib/publicVisit";

/** Nagłówki jak z żądania — tylko `get`, bo tyle czyta badana funkcja. */
function naglowki(pary: Record<string, string>) {
  const dolne = new Map(Object.entries(pary).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (n: string) => dolne.get(n.toLowerCase()) ?? null };
}

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

test("człowiek w przeglądarce liczy się jako otwarcie", () => {
  assert.equal(czyLiczycJakoOtwarcie(naglowki({ "user-agent": CHROME })), true);
  assert.equal(czyLiczycJakoOtwarcie(naglowki({ "user-agent": SAFARI_IPHONE })), true);
});

test("prefetch przeglądarki nie liczy się, mimo zwykłego User-Agenta", () => {
  // To jest sedno: UA jest normalny, bo prefetch robi TA SAMA przeglądarka.
  // Rozstrzyga wyłącznie nagłówek zapowiadający.
  assert.equal(czyLiczycJakoOtwarcie(naglowki({ "user-agent": CHROME, "sec-purpose": "prefetch;prerender" })), false);
  assert.equal(czyLiczycJakoOtwarcie(naglowki({ "user-agent": CHROME, purpose: "prefetch" })), false);
  assert.equal(czyLiczycJakoOtwarcie(naglowki({ "user-agent": CHROME, "x-moz": "prefetch" })), false);
});

test("skanery bramek pocztowych nie liczą się jako otwarcie", () => {
  // Dokładnie ten przypadek, przez który właściciel dzwonił w próżnię:
  // link odwiedza zabezpieczenie poczty firmy klienta, zanim klient
  // zobaczy maila.
  for (const ua of [
    "Mozilla/5.0 (compatible; ProofpointURLDefense)",
    "Mimecast-Link-Protection/1.0",
    "BarracudaLinkProtect/2.1",
    "Mozilla/5.0 (compatible; safelinks-scanner)",
  ]) {
    assert.equal(czyLiczycJakoOtwarcie(naglowki({ "user-agent": ua })), false, ua);
  }
});

test("podglądy linków w komunikatorach nie liczą się jako otwarcie", () => {
  for (const ua of [
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "WhatsApp/2.23.20.0",
    "TelegramBot (like TwitterBot)",
    "facebookexternalhit/1.1",
    "Mozilla/5.0 (compatible; Discordbot/2.0)",
  ]) {
    assert.equal(czyLiczycJakoOtwarcie(naglowki({ "user-agent": ua })), false, ua);
  }
});

test("narzędzia i crawlery nie liczą się jako otwarcie", () => {
  for (const ua of ["curl/8.7.1", "Wget/1.21", "python-requests/2.31.0", "Googlebot/2.1", "HeadlessChrome/131.0.0.0"]) {
    assert.equal(czyLiczycJakoOtwarcie(naglowki({ "user-agent": ua })), false, ua);
  }
});

test("brak User-Agenta traktujemy jak automat", () => {
  assert.equal(czyLiczycJakoOtwarcie(naglowki({})), false);
  assert.equal(czyLiczycJakoOtwarcie(naglowki({ "user-agent": "   " })), false);
});

test("nieznana przeglądarka liczy się — przy wątpliwości wybieramy człowieka", () => {
  // Świadomie zachowawczo: przeoczony robot zawyża licznik o jeden,
  // przeoczony klient gubi jedyne powiadomienie w całym lejku.
  assert.equal(czyLiczycJakoOtwarcie(naglowki({ "user-agent": "Jakas/1.0 Nowa Przegladarka" })), true);
});

test("słowo „bot” w środku nazwy nie fałszuje wyniku", () => {
  // „Bota" w nazwie modelu telefonu albo w „Ubotu" nie ma być traktowane
  // jak crawler — stąd granica słowa we wzorcu.
  assert.equal(czyLiczycJakoOtwarcie(naglowki({ "user-agent": "Mozilla/5.0 (Linux; Sabotage 12) Mobile" })), true);
});
