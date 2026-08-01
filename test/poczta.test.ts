import { test } from "node:test";
import assert from "node:assert/strict";
import { naglowekJednowierszowy, parseAddressList, extractEmailAddress, isPlausibleTimestamp } from "../lib/mail.ts";
import { odciskWysylki } from "../lib/mailGuard.ts";

/*
 * Poczta (Moduł 65). Stawka jest tu inna niż w każdym innym module panelu:
 * zła liczba w koszcie jest poprawialna do końca roku podatkowego, a mail
 * wysłany do klienta nie jest poprawialny nigdy. Każdy test niżej odpowiada
 * jednej rzeczy zmierzonej sondą na żywym serwerze.
 */

// ─── Wstrzyknięcie nagłówka SMTP ──────────────────────────────────────────
//
// Zmierzone: nodemailer sam zwija nową linię w spację, więc dziury NIE MA.
// Ale to gwarancja POŻYCZONA od biblioteki — znika przy podbiciu jej wersji,
// bez żadnego objawu u nas. naglowekJednowierszowy() czyni ją naszą.

test("temat: nowa linia nie może wnieść drugiego nagłówka", () => {
  assert.equal(naglowekJednowierszowy("Oferta\nBcc: obcy@zly.pl"), "Oferta Bcc: obcy@zly.pl");
  assert.equal(naglowekJednowierszowy("Oferta\r\nBcc: obcy@zly.pl"), "Oferta Bcc: obcy@zly.pl");
  // Ciąg nowych linii to JEDNA spacja, nie kilka — inaczej temat rozjeżdża się
  // wizualnie u odbiorcy przy wklejeniu tekstu z pustym wierszem.
  assert.equal(naglowekJednowierszowy("A\n\n\nB"), "A B");
  assert.equal(naglowekJednowierszowy(""), "");
});

test("adres odbiorcy nie przepuszcza znaku nowej linii", () => {
  // Druga droga do tego samego celu: gdyby adres niósł nową linię, trafiłaby
  // do koperty SMTP. Wyrażenie w extractEmailAddress() wyklucza białe znaki.
  assert.equal(extractEmailAddress("a@b.pl\nBcc: obcy@zly.pl"), "a@b.pl");
  assert.equal(extractEmailAddress("niepoprawny"), "");
  assert.equal(extractEmailAddress("@"), "");
});

test("lista odbiorców: nazwa z przecinkiem nie gubi adresu", () => {
  // Zmierzone sondą: '"Kowalski, Jan" <jan@b.pl>' rozpada się na przecinku,
  // ale człon bez "@" odpada, więc zostaje właściwy adres.
  assert.deepEqual(parseAddressList('"Kowalski, Jan" <jan@b.pl>'), ["jan@b.pl"]);
  assert.deepEqual(parseAddressList("a@b.pl; c@d.pl"), ["a@b.pl", "c@d.pl"]);
  assert.deepEqual(parseAddressList("niepoprawny"), []);
});

test("data wysyłki: rok „0202” odpada tak samo jak w reszcie panelu", () => {
  assert.equal(isPlausibleTimestamp("0202-12-01T10:00:00Z"), false);
  assert.equal(isPlausibleTimestamp("jutro"), false);
  assert.equal(isPlausibleTimestamp("2026-12-01T10:00:00Z"), true);
});

// ─── Bezpiecznik podwójnej wysyłki ────────────────────────────────────────
//
// Odcisk musi być IDENTYCZNY dla pierwszej próby i dla ponowienia po zerwanym
// żądaniu — inaczej bezpiecznik nie zadziała dokładnie w tym jednym przypadku,
// dla którego powstał (telefon zrywa po swoim limicie, serwer kończy wysyłkę).

test("odcisk: ponowienie tej samej wiadomości daje ten sam odcisk", () => {
  const a = odciskWysylki({ sciezka: "reply:abc", to: ["klient@firma.pl"], subject: "Re: Oferta", text: "Dzień dobry" });
  const b = odciskWysylki({ sciezka: "reply:abc", to: ["klient@firma.pl"], subject: "Re: Oferta", text: "Dzień dobry" });
  assert.equal(a, b);
});

test("odcisk: kolejność i wielkość liter adresów nie tworzy nowej wiadomości", () => {
  const a = odciskWysylki({ sciezka: "compose", to: ["a@x.pl", "b@x.pl"], subject: "T", text: "treść" });
  const b = odciskWysylki({ sciezka: "compose", to: ["B@X.pl", " a@x.pl "], subject: "T", text: "treść" });
  assert.equal(a, b);
});

test("odcisk: inna treść, inny odbiorca albo inna ścieżka to INNA wiadomość", () => {
  const baza: Parameters<typeof odciskWysylki>[0] = { sciezka: "compose", to: ["a@x.pl"], subject: "T", text: "treść" };
  const inny = (z: Partial<typeof baza>) => odciskWysylki({ ...baza, ...z });
  assert.notEqual(inny({}), inny({ text: "inna treść" }));
  assert.notEqual(inny({}), inny({ to: ["b@x.pl"] }));
  assert.notEqual(inny({}), inny({ subject: "Inny temat" }));
  // Ta sama treść wysłana jako odpowiedź i jako nowa wiadomość to dwie różne
  // rzeczy — bezpiecznik nie może blokować jednej przez drugą.
  assert.notEqual(inny({}), inny({ sciezka: "reply:abc" }));
  // UDW liczy się tak samo jak DW: dopisanie kogoś w kopii to nowa wiadomość.
  assert.notEqual(inny({}), inny({ bcc: ["szef@x.pl"] }));
});

test("odcisk: sama spacja na końcu treści to wciąż ta sama wiadomość", () => {
  const a = odciskWysylki({ sciezka: "compose", to: ["a@x.pl"], subject: "T", text: "treść" });
  const b = odciskWysylki({ sciezka: "compose", to: ["a@x.pl"], subject: " T ", text: "treść\n" });
  assert.equal(a, b);
});
