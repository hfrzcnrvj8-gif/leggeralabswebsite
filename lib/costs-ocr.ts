// Czysta logika OCR paragonów/faktur zakupowych (Moduł 8) — prompt do modelu
// wizyjnego i walidacja jego odpowiedzi. Model zawsze tylko PROPONUJE wartości
// do formularza kosztu; właściciel edytuje/zatwierdza/zapisuje ręcznie (patrz
// CLAUDE.md — jedyny dopuszczony wyjątek od "zero AI w logice panelu").

import { isPlausibleDateString } from "./projects";
import { VAT_RATES, type VatRate } from "./costs";
import { vatFraction, round2 } from "./invoices";

/** Domyślny model wizyjny — najmniejszy/najszybszy z dostępnych na Macu
 * właściciela (patrz HUB_SETUP.md → "Infrastruktura AI"), świadomy wybór dla
 * krótszego czasu oczekiwania przy klikanym OCR. */
export const OCR_MODEL = "qwen3-vl:8b";

export const OCR_SYSTEM = `Jesteś asystentem odczytującym polskie paragony i faktury zakupowe ze zdjęcia/skanu.
Zwróć WYŁĄCZNIE czysty JSON (bez markdown, bez komentarzy, bez dodatkowego tekstu) o dokładnie takim kształcie:
{"dostawca": string, "nip": string, "numer_faktury": string, "kwota_netto": number, "kwota_brutto": number, "vat_stawka": string, "data": string, "termin_platnosci": string, "opis": string}

Zasady:
- "dostawca": nazwa sprzedawcy/firmy wystawiającej dokument.
- "nip": NIP sprzedawcy (10 cyfr, może być z myślnikami/spacjami na dokumencie — Ty zwróć same cyfry). To NIP SPRZEDAWCY (wystawcy dokumentu), nie nabywcy.
- "numer_faktury": numer dokumentu widoczny na fakturze/paragonie (np. "FV/123/2026", "2026/07/0042") — dokładnie tak, jak jest wydrukowany, bez zmian formatu.
- "kwota_netto": SUMA kwoty netto całego dokumentu (wszystkich pozycji razem) jako liczba (kropka jako separator dziesiętny), bez waluty.
- "kwota_brutto": SUMA "Do zapłaty"/kwoty brutto całego dokumentu jako liczba — to zwykle największa, wytłuszczona kwota na dokumencie.
- "vat_stawka": jedna z wartości: "23", "8", "5", "0", "zw", "np". Jeśli dokument ma WIĘCEJ NIŻ JEDNĄ stawkę VAT na różnych pozycjach, wybierz tę, na którą przypada NAJWIĘKSZA kwota netto (stawkę dominującą) — to tylko przybliżenie do poprawienia ręcznie, nie musi być matematycznie dokładne dla całego dokumentu.
- "data": data wystawienia/sprzedaży w formacie YYYY-MM-DD.
- "termin_platnosci": termin/data płatności w formacie YYYY-MM-DD, jeśli podana na dokumencie (często osobna od daty wystawienia).
- "opis": krótki opis zakupu (np. nazwa towaru/usługi z dokumentu).
- Jeśli nie jesteś pewien wartości danego pola, zwróć dla niego pusty string "" — NIGDY nie zgaduj.`;

export const OCR_PROMPT = "Odczytaj dane z załączonego paragonu/faktury i zwróć JSON zgodnie z instrukcją.";

export type OcrSuggestion = {
  dostawca_nazwa: string;
  dostawca_nip: string;
  numer_faktury: string;
  kwota_netto: number | null;
  vat_stawka: VatRate | null;
  data_wydatku: string;
  data_platnosci: string;
  opis: string;
};

/** Zwraca liczbę z pola modelu (liczba albo string z przecinkiem/kropką),
 * albo null jeśli nie da się bezpiecznie sparsować na sensowną wartość. */
function parsePositiveAmount(raw: unknown): number | null {
  const num = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.replace(",", ".")) : NaN;
  return Number.isFinite(num) && num > 0 ? round2(num) : null;
}

/** Dobiera stawkę VAT z VAT_RATES, która najlepiej odtwarza rzeczywistą
 * kwotę brutto z dokumentu — dokładniejsze niż poleganie na tym, którą
 * stawkę model "uznał" za dominującą, zwłaszcza przy fakturach z
 * mieszanymi stawkami (np. usługi telekomunikacyjne 8%+23%). Używane
 * tylko gdy model zwrócił też kwota_brutto; w przeciwnym razie zostaje
 * przy stawce wskazanej wprost przez model. */
function bestFitVatRate(netto: number, brutto: number, modelGuess: VatRate | null): VatRate | null {
  let best: VatRate | null = modelGuess;
  let bestDiff = modelGuess ? Math.abs(round2(netto * (1 + vatFraction(modelGuess))) - brutto) : Infinity;
  for (const rate of VAT_RATES) {
    const diff = Math.abs(round2(netto * (1 + vatFraction(rate))) - brutto);
    if (diff < bestDiff) {
      best = rate;
      bestDiff = diff;
    }
  }
  return best;
}

/** Parsuje i waliduje surową odpowiedź modelu. Pola, które nie przejdą
 * walidacji, zostają puste/null zamiast wpisywać śmieciową wartość do
 * formularza — właściciel uzupełnia je ręcznie jak dziś. Nigdy nie rzuca. */
export function parseOcrResponse(raw: string): OcrSuggestion {
  const empty: OcrSuggestion = {
    dostawca_nazwa: "",
    dostawca_nip: "",
    numer_faktury: "",
    kwota_netto: null,
    vat_stawka: null,
    data_wydatku: "",
    data_platnosci: "",
    opis: "",
  };

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

  const nipDigits = typeof obj.nip === "string" ? obj.nip.replace(/\D/g, "") : "";
  const dostawca_nip = nipDigits.length === 10 ? nipDigits : "";

  const numer_faktury = typeof obj.numer_faktury === "string" ? obj.numer_faktury.trim().slice(0, 100) : "";

  const kwota_netto = parsePositiveAmount(obj.kwota_netto);
  const kwota_brutto = parsePositiveAmount(obj.kwota_brutto);

  const vatRaw = typeof obj.vat_stawka === "string" ? obj.vat_stawka.trim() : "";
  const vatGuess = (VAT_RATES as readonly string[]).includes(vatRaw) ? (vatRaw as VatRate) : null;
  // Jeśli model podał też kwota_brutto, dopasuj stawkę matematycznie zamiast
  // ufać wyborowi modelu — patrz komentarz przy bestFitVatRate.
  const vat_stawka = kwota_netto != null && kwota_brutto != null ? bestFitVatRate(kwota_netto, kwota_brutto, vatGuess) : vatGuess;

  const dataRaw = typeof obj.data === "string" ? obj.data.trim() : "";
  const data_wydatku = isPlausibleDateString(dataRaw) ? dataRaw : "";

  const terminRaw = typeof obj.termin_platnosci === "string" ? obj.termin_platnosci.trim() : "";
  const data_platnosci = isPlausibleDateString(terminRaw) ? terminRaw : "";

  const opis = typeof obj.opis === "string" ? obj.opis.trim().slice(0, 500) : "";

  return { dostawca_nazwa: dostawca, dostawca_nip, numer_faktury, kwota_netto, vat_stawka, data_wydatku, data_platnosci, opis };
}
