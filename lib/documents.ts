// Wspólna logika dokumentów sprzedażowych (faktury, oferty) — bez "use
// client". Oba dokumenty są strukturalnie bardzo podobne (nabywca, pozycje,
// kwoty, język wydruku), więc to co się faktycznie powiela — język/locale,
// adres klienta z fallbackiem, formatowanie kwot/dat — żyje tutaj zamiast w
// obu modułach osobno. Reszta (statusy, sumy, specyficzne pola) zostaje w
// lib/invoices.ts / lib/offers.ts, bo tam się różnią.

export type DocLang = "pl" | "en" | "de";
export const DOC_LANGS: DocLang[] = ["pl", "en", "de"];
export const DOC_LANG_LABEL: Record<DocLang, string> = { pl: "Polski", en: "English", de: "Deutsch" };
export const DOC_LOCALE: Record<DocLang, string> = { pl: "pl-PL", en: "en-GB", de: "de-DE" };

/** Subtelny akcent marki na wydrukach (pasek u góry, "logo"-znaczek, kwota
 * końcowa) — fiolet → złoto, dwa nasycone kolory bez prawie-białego "ogona"
 * jak we `.text-liquid`, żeby zostać czytelnym na białym papierze. */
export const DOC_GRADIENT = "linear-gradient(120deg, #7C3AED 0%, #E0A93B 100%)";

export type ClientAddressLike = {
  klient_ulica: string;
  klient_kod: string;
  klient_miasto: string;
  klient_kraj: string;
  klient_adres: string;
};

/** Adres klienta jako linie do wydruku — preferuje pola strukturalne (ulica /
 * kod+miasto / kraj), a dla starszych rekordów bez nich spada na zlepione
 * pole `klient_adres`. */
export function clientAddressLines(c: ClientAddressLike): string[] {
  const lines: string[] = [];
  if (c.klient_ulica) lines.push(c.klient_ulica);
  const kodMiasto = [c.klient_kod, c.klient_miasto].filter(Boolean).join(" ");
  if (kodMiasto) lines.push(kodMiasto);
  if (c.klient_kraj) lines.push(c.klient_kraj);
  if (lines.length > 0) return lines;
  return c.klient_adres ? c.klient_adres.split("\n").filter(Boolean) : [];
}

/** Dodaje N dni do daty ISO (lub do dziś, gdy brak bazowej daty) — do
 * szybkiego ustawiania terminu/ważności bez ręcznego wyboru z koła dat. */
export function addDaysISO(baseIso: string | null, days: number): string {
  const base = baseIso ? new Date(`${baseIso.slice(0, 10)}T00:00:00`) : new Date();
  const d = new Date(base.getTime() + days * 86400000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Kwota sformatowana wg locale danego języka wydruku. */
export function docMoney(n: number, lang: DocLang, currency = "PLN"): string {
  return new Intl.NumberFormat(DOC_LOCALE[lang], { style: "currency", currency }).format(n);
}

/** Data (YYYY-MM-DD, ew. z częścią czasową) sformatowana wg locale danego
 * języka wydruku — "—" gdy brak. */
export function docDate(s: string | null, lang: DocLang): string {
  if (!s) return "—";
  const d = new Date(`${s.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(DOC_LOCALE[lang], { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Payload kodu QR wg standardu EPC069-12 ("EPC QR" / niem. "GiroCode") —
 * skanowalny przez większość europejskich aplikacji bankowych, wypełnia
 * odbiorcy gotowy przelew SEPA (IBAN, kwota, tytuł). Standard jest
 * zdefiniowany wyłącznie dla przelewów w EUR — dlatego używać tylko gdy
 * waluta faktury to EUR (patrz wywołanie w InvoicePrint.tsx). Zwraca `null`,
 * gdy brakuje danych wymaganych przez standard (IBAN, nazwa odbiorcy). */
export function buildEpcQrPayload(params: {
  beneficiaryName: string;
  iban: string;
  bic?: string;
  amountEur: number;
  remittanceInfo: string;
}): string | null {
  const iban = params.iban.replace(/\s+/g, "").toUpperCase();
  const name = params.beneficiaryName.trim().slice(0, 70);
  if (!iban || !name) return null;
  const bic = (params.bic ?? "").replace(/\s+/g, "").toUpperCase().slice(0, 11);
  const amount = `EUR${params.amountEur.toFixed(2)}`;
  const remittance = params.remittanceInfo.trim().slice(0, 140);
  return ["BCD", "002", "1", "SCT", bic, name, iban, amount, "", remittance, ""].join("\n");
}

/** Payload kodu QR wg polskiego standardu „2D" (Rekomendacja Związku Banków
 * Polskich) — rozpoznawany przez aplikacje mobilne większości polskich
 * banków (mBank, PKO/IKO, ING, Santander, Pekao i in.). W przeciwieństwie do
 * EPC069-12 (wyłącznie EUR) ten standard obsługuje przelewy w PLN — dlatego
 * używać tylko gdy waluta faktury to PLN (patrz wywołanie w
 * InvoicePrint.tsx). Pola rozdzielone znakiem "|": NIP odbiorcy (10 cyfr,
 * opcjonalnie), kod kraju, 26-cyfrowy NRB (= IBAN bez prefiksu "PL"), kwota w
 * groszach (min. 6 cyfr z zerami), nazwa odbiorcy (≤20 zn.), tytuł przelewu
 * (≤32 zn., wymagany), 3 pola zarezerwowane (nieużywane, puste). Max 160
 * znaków łącznie. Specyfikacja zweryfikowana wg kodu referencyjnej
 * biblioteki (github.com/MarcinOrlowski/bank-qrcode-formatter), zgodnej z
 * Rekomendacją ZBP. Zwraca `null`, gdy brakuje poprawnego NRB lub nazwy
 * odbiorcy. */
export function buildPolishQrPayload(params: {
  beneficiaryName: string;
  beneficiaryNip: string;
  /** IBAN (z prefiksem "PL") lub goły NRB — funkcja sama wytnie prefiks. */
  accountIban: string;
  amountPln: number;
  title: string;
}): string | null {
  const rawAccount = params.accountIban.replace(/\s+/g, "").toUpperCase();
  const nrb = (rawAccount.startsWith("PL") ? rawAccount.slice(2) : rawAccount).replace(/\D/g, "");
  const name = params.beneficiaryName.trim().slice(0, 20);
  if (nrb.length !== 26 || !name) return null;
  const nip = (params.beneficiaryNip || "").replace(/\D/g, "");
  const vatId = nip.length === 10 ? nip : "";
  const amountGrosz = Math.max(0, Math.round(params.amountPln * 100));
  const title = params.title.trim().slice(0, 32);
  if (!title) return null;
  const fields = [vatId, "PL", nrb, String(amountGrosz).padStart(6, "0"), name, title, "", "", ""];
  const result = fields.join("|");
  return result.length <= 160 ? result : null;
}
