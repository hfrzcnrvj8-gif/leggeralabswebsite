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
