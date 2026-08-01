/**
 * JEDEN SŁOWNIK WALUT dla całego produktu (Moduł 62, 2026-08-01).
 *
 * Skąd to się wzięło: waluty były wypisane DWA razy — `INVOICE_CURRENCIES`
 * w `lib/invoices.ts` i `OFFER_CURRENCIES` w `lib/offers.ts` — z identyczną
 * treścią i dwoma bliźniaczymi strażnikami (`isInvoiceCurrency`,
 * `isOfferCurrency`). Bliźniak nie jest problemem, dopóki oba są aktualne;
 * problemem stał się wtedy, gdy audyt Ofert dodał strażnika u siebie i
 * zostawił dziurę w trzech innych modułach na miesiąc (lekcja 4 briefu
 * Modułu 62). Katalog dostaje walutę właśnie teraz i byłby TRZECIĄ kopią.
 *
 * Nazwy modułowe (`INVOICE_CURRENCIES`, `OFFER_CURRENCIES`) zostają jako
 * re-eksporty tej listy — nic w kodzie nie musiało się przenosić, a dopisanie
 * waluty jest odtąd jedną zmianą w jednym pliku.
 */

/** Waluty dopuszczone na dokumentach i w katalogu. EUR odblokowuje kod QR do
 * przelewu SEPA (standard EPC069-12 jest zdefiniowany wyłącznie dla EUR). */
export const WALUTY = ["PLN", "EUR", "USD", "GBP"] as const;
export type Waluta = (typeof WALUTY)[number];

export const DOMYSLNA_WALUTA: Waluta = "PLN";

/** Strażnik waluty — `trim()` PRZED sprawdzeniem słownika, z tego samego
 * powodu co w `zeSlownika` (wartość oczywiście zamierzona ma przejść, genuinie
 * zła odbić się głośno). Zły kod waluty nie jest kosmetyką: `formatMoney`
 * rzuca wtedy `RangeError`, a rzucający formater wywala CAŁY ekran w error
 * boundary, nie jeden wiersz (zmierzone przy audycie Faktur). */
export function isWaluta(v: unknown): v is Waluta {
  return typeof v === "string" && (WALUTY as readonly string[]).includes(v.trim());
}
