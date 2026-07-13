// Czysta logika OCR paragonów/faktur zakupowych (Moduł 8) — prompt do modelu
// wizyjnego i walidacja jego odpowiedzi. Model zawsze tylko PROPONUJE wartości
// do formularza kosztu; właściciel edytuje/zatwierdza/zapisuje ręcznie (patrz
// CLAUDE.md — jedyny dopuszczony wyjątek od "zero AI w logice panelu").

import { isPlausibleDateString } from "./projects";
import { VAT_RATES, type VatRate } from "./costs";

/** Domyślny model wizyjny — najmniejszy/najszybszy z dostępnych na Macu
 * właściciela (patrz HUB_SETUP.md → "Infrastruktura AI"), świadomy wybór dla
 * krótszego czasu oczekiwania przy klikanym OCR. */
export const OCR_MODEL = "qwen3-vl:8b";

export const OCR_SYSTEM = `Jesteś asystentem odczytującym polskie paragony i faktury zakupowe ze zdjęcia/skanu.
Zwróć WYŁĄCZNIE czysty JSON (bez markdown, bez komentarzy, bez dodatkowego tekstu) o dokładnie takim kształcie:
{"dostawca": string, "kwota_netto": number, "vat_stawka": string, "data": string, "opis": string}

Zasady:
- "dostawca": nazwa sprzedawcy/firmy wystawiającej dokument.
- "kwota_netto": SUMA kwoty netto całego dokumentu (wszystkich pozycji razem) jako liczba (kropka jako separator dziesiętny), bez waluty.
- "vat_stawka": jedna z wartości: "23", "8", "5", "0", "zw", "np". Jeśli dokument ma WIĘCEJ NIŻ JEDNĄ stawkę VAT na różnych pozycjach, wybierz tę, na którą przypada NAJWIĘKSZA kwota netto (stawkę dominującą) — to tylko przybliżenie do poprawienia ręcznie, nie musi być matematycznie dokładne dla całego dokumentu.
- "data": data wystawienia/sprzedaży w formacie YYYY-MM-DD.
- "opis": krótki opis zakupu (np. nazwa towaru/usługi z dokumentu).
- Jeśli nie jesteś pewien wartości danego pola, zwróć dla niego pusty string "" — NIGDY nie zgaduj.`;

export const OCR_PROMPT = "Odczytaj dane z załączonego paragonu/faktury i zwróć JSON zgodnie z instrukcją.";

export type OcrSuggestion = {
  dostawca_nazwa: string;
  kwota_netto: number | null;
  vat_stawka: VatRate | null;
  data_wydatku: string;
  opis: string;
};

/** Parsuje i waliduje surową odpowiedź modelu. Pola, które nie przejdą
 * walidacji, zostają puste/null zamiast wpisywać śmieciową wartość do
 * formularza — właściciel uzupełnia je ręcznie jak dziś. Nigdy nie rzuca. */
export function parseOcrResponse(raw: string): OcrSuggestion {
  const empty: OcrSuggestion = { dostawca_nazwa: "", kwota_netto: null, vat_stawka: null, data_wydatku: "", opis: "" };

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return empty;
  }
  if (!parsed || typeof parsed !== "object") return empty;
  const obj = parsed as Record<string, unknown>;

  const dostawca = typeof obj.dostawca === "string" ? obj.dostawca.trim().slice(0, 300) : "";

  const kwotaRaw = obj.kwota_netto;
  const kwotaNum = typeof kwotaRaw === "number" ? kwotaRaw : typeof kwotaRaw === "string" ? Number(kwotaRaw.replace(",", ".")) : NaN;
  const kwota_netto = Number.isFinite(kwotaNum) && kwotaNum > 0 ? Math.round(kwotaNum * 100) / 100 : null;

  const vatRaw = typeof obj.vat_stawka === "string" ? obj.vat_stawka.trim() : "";
  const vat_stawka = (VAT_RATES as readonly string[]).includes(vatRaw) ? (vatRaw as VatRate) : null;

  const dataRaw = typeof obj.data === "string" ? obj.data.trim() : "";
  const data_wydatku = isPlausibleDateString(dataRaw) ? dataRaw : "";

  const opis = typeof obj.opis === "string" ? obj.opis.trim().slice(0, 500) : "";

  return { dostawca_nazwa: dostawca, kwota_netto, vat_stawka, data_wydatku, opis };
}
