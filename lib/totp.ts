// Drugi składnik logowania — silnik TOTP (Moduł 41, 2026-07-22).
//
// **Czysta arytmetyka, zero zależności od bazy i od Reacta** — dzięki temu
// da się ją sprawdzić w oderwaniu od panelu (i tak została sprawdzona:
// wektory z RFC 6238 niżej). Wszystko, co dotyka bazy, siedzi w
// `lib/twoFactor.ts`.
//
// Świadomie bez nowej biblioteki. TOTP to trzydzieści linii nad wbudowanym
// `createHmac` — dokładanie zależności z npm do funkcji, która strzeże
// dostępu do wszystkich danych klientów, byłoby wymianą trzydziestu
// czytelnych linii na cudzy łańcuch aktualizacji.

import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** Długość okna w sekundach. 30 s to wartość, którą zakładają wszystkie
 * aplikacje uwierzytelniające (Google Authenticator, 1Password, Apple
 * Hasła) — nie jest konfigurowalna, bo zmiana zepsułaby zeskanowane kody. */
export const OKNO_SEKUND = 30;

/** Ile cyfr ma kod. Jak wyżej — 6 to założenie po stronie aplikacji. */
export const CYFR = 6;

/**
 * Tolerancja rozjazdu zegara, w oknach w każdą stronę.
 *
 * `1` = przyjmujemy kod bieżący, poprzedni i następny (łącznie 90 s).
 * **Nie zwiększaj.** Każde dodatkowe okno mnoży liczbę kodów, które w danej
 * chwili pasują — a to jedyna liczba, która osłabia sześciocyfrowy sekret
 * po stronie serwera. 90 s wystarcza na zegar telefonu rozjechany o minutę
 * i na wolne przepisywanie kodu z ekranu.
 */
export const TOLERANCJA_OKIEN = 1;

// ── Base32 (RFC 4648) ───────────────────────────────────────────────────────
// Aplikacje uwierzytelniające przyjmują sekret wyłącznie w base32 — i to bez
// dopełnienia „=", które część z nich odrzuca.

const ALFABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(dane: Buffer): string {
  let bity = 0;
  let wartosc = 0;
  let wynik = "";
  for (const bajt of dane) {
    wartosc = (wartosc << 8) | bajt;
    bity += 8;
    while (bity >= 5) {
      bity -= 5;
      wynik += ALFABET[(wartosc >>> bity) & 31];
    }
  }
  if (bity > 0) wynik += ALFABET[(wartosc << (5 - bity)) & 31];
  return wynik;
}

export function base32Decode(tekst: string): Buffer {
  // Spacje i małe litery zdarzają się przy ręcznym przepisywaniu sekretu —
  // to jest droga powrotu numer 2 (menedżer haseł na Macu), więc musi
  // wybaczać formatowanie.
  const czysty = tekst.replace(/[\s-]/g, "").replace(/=+$/, "").toUpperCase();
  let bity = 0;
  let wartosc = 0;
  const bajty: number[] = [];
  for (const znak of czysty) {
    const i = ALFABET.indexOf(znak);
    if (i < 0) throw new Error("Sekret zawiera znak spoza base32.");
    wartosc = (wartosc << 5) | i;
    bity += 5;
    if (bity >= 8) {
      bajty.push((wartosc >>> (bity - 8)) & 255);
      bity -= 8;
    }
  }
  return Buffer.from(bajty);
}

/** Nowy sekret: 20 losowych bajtów (160 bitów, tyle co klucz HMAC-SHA1). */
export function nowySekret(): string {
  return base32Encode(randomBytes(20));
}

// ── Sam kod ─────────────────────────────────────────────────────────────────

/** Numer okna, w którym mieści się dany moment (domyślnie: teraz). */
export function numerOkna(momentMs: number = Date.now()): number {
  return Math.floor(momentMs / 1000 / OKNO_SEKUND);
}

/**
 * Kod dla konkretnego okna. Publiczna, bo weryfikacja lokalna (i test)
 * potrzebują tej samej funkcji, którą liczy telefon.
 *
 * HMAC-SHA1 nad ośmiobajtowym numerem okna, potem „dynamiczne obcięcie"
 * z RFC 4226: ostatnie cztery bity wskazują, od którego bajtu wziąć liczbę.
 */
export function kodDlaOkna(sekretBase32: string, okno: number): string {
  const licznik = Buffer.alloc(8);
  // Numer okna nie zmieści się w 32 bitach dopiero za ~4000 lat, ale
  // zapisujemy go rzetelnie na 64 bitach — tak mówi specyfikacja i tak
  // liczy telefon.
  licznik.writeBigUInt64BE(BigInt(okno));
  const hmac = createHmac("sha1", base32Decode(sekretBase32)).update(licznik).digest();
  const przesuniecie = hmac[hmac.length - 1] & 0x0f;
  const liczba =
    ((hmac[przesuniecie] & 0x7f) << 24) |
    ((hmac[przesuniecie + 1] & 0xff) << 16) |
    ((hmac[przesuniecie + 2] & 0xff) << 8) |
    (hmac[przesuniecie + 3] & 0xff);
  return String(liczba % 10 ** CYFR).padStart(CYFR, "0");
}

/** Kod „na teraz" — do podglądu i do testów, nigdy do porównania z wejściem
 * użytkownika (od tego jest `sprawdzKod`, które porównuje w stałym czasie). */
export function kodTeraz(sekretBase32: string, momentMs: number = Date.now()): string {
  return kodDlaOkna(sekretBase32, numerOkna(momentMs));
}

/** Porównanie w stałym czasie — wzorem `safeEqual` z `lib/auth.ts`. Różnica
 * długości daje `false` przed porównaniem, bo `timingSafeEqual` rzuca
 * wyjątkiem na buforach różnej długości. */
function rowneStalyCzas(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Sprawdza kod z tolerancją ±`TOLERANCJA_OKIEN`.
 *
 * Zwraca **numer okna**, w którym kod pasował (albo `null`) — i to nie jest
 * szczegół: wywołujący musi zapamiętać tę parę (okno + kod), żeby ten sam
 * kod podsłuchany przez ramię nie wszedł drugi raz w tym samym oknie.
 *
 * Pętla świadomie NIE przerywa na pierwszym trafieniu: przy `return` ze
 * środka czas odpowiedzi zdradzałby, o ile rozjechał się zegar. Koszt to
 * trzy HMAC-i zamiast średnio dwóch.
 */
export function sprawdzKod(
  sekretBase32: string,
  kod: string,
  momentMs: number = Date.now()
): number | null {
  const czysty = kod.replace(/\s/g, "");
  if (!/^\d{6}$/.test(czysty)) return null;
  const teraz = numerOkna(momentMs);
  let trafione: number | null = null;
  for (let d = -TOLERANCJA_OKIEN; d <= TOLERANCJA_OKIEN; d++) {
    if (rowneStalyCzas(kodDlaOkna(sekretBase32, teraz + d), czysty)) trafione = teraz + d;
  }
  return trafione;
}

// ── Adres otpauth:// (to, co koduje kod QR) ─────────────────────────────────

/**
 * Adres, który aplikacja uwierzytelniająca czyta z kodu QR.
 *
 * `issuer` pojawia się dwa razy (w etykiecie i w parametrze) — tak wygląda
 * konwencja Google Authenticator i bez powtórzenia część aplikacji pokazuje
 * wpis bez nazwy usługi, jako gołe „Leggera".
 */
export function adresOtpauth(sekretBase32: string, konto = "admin", wydawca = "Leggera Hub"): string {
  const etykieta = encodeURIComponent(`${wydawca}:${konto}`);
  const parametry = new URLSearchParams({
    secret: sekretBase32,
    issuer: wydawca,
    algorithm: "SHA1",
    digits: String(CYFR),
    period: String(OKNO_SEKUND),
  });
  return `otpauth://totp/${etykieta}?${parametry.toString()}`;
}

/** Sekret w porcjach po 4 znaki — do przepisania ręcznie do menedżera haseł
 * (droga powrotu numer 2). `base32Decode` i tak ignoruje spacje. */
export function sekretDoPrzepisania(sekretBase32: string): string {
  return (sekretBase32.match(/.{1,4}/g) ?? []).join(" ");
}

// ── Kody zapasowe ───────────────────────────────────────────────────────────

/** Ile kodów zapasowych wydajemy naraz. */
export const KODOW_ZAPASOWYCH = 8;

/**
 * Kod zapasowy: 10 cyfr w dwóch grupach („12345-67890").
 *
 * Cyfry, nie litery — właściciel ma je **przepisać z kartki**, często
 * w pośpiechu i prawdopodobnie z telefonu, na którym nie ma już aplikacji
 * uwierzytelniającej. Alfabet bez „0/O" i „1/l" rozwiązuje ten sam problem,
 * ale cyfry rozwiązują go w całości i wpisuje się je klawiaturą numeryczną.
 * 10 cyfr = 10 miliardów kombinacji, a kodów jest osiem i chroni je ten sam
 * hamulec co kod z aplikacji.
 */
export function nowyKodZapasowy(): string {
  const cyfry = Array.from({ length: 10 }, () => randomInt(0, 10)).join("");
  return `${cyfry.slice(0, 5)}-${cyfry.slice(5)}`;
}

/** Do porównania z bazą: same cyfry, bez myślnika i spacji. Właściciel może
 * wpisać kod z myślnikiem albo bez — jedno i drugie ma działać. */
export function znormalizujKodZapasowy(kod: string): string {
  return kod.replace(/\D/g, "");
}
