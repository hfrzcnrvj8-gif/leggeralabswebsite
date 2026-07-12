// Walidacja i autouzupełnianie danych kontrahenta z UE przez VIES (VAT
// Information Exchange System) — unijny system sprawdzania numerów VAT-UE.
// Uzupełnia to Białą Listę MF (lib/mf.ts), która działa tylko dla polskich
// NIP-ów. UWAGA: VIES zwraca nazwę/adres NIEJEDNOLICIE — część krajów je
// ujawnia (np. IE, IT), część suppresuje jako "---" (np. DE); walidacja
// (valid) działa zawsze, autouzupełnienie zależnie od kraju.

export type ViesSubject = {
  /** Czy numer VAT jest aktywny/zarejestrowany w VIES. */
  valid: boolean;
  nazwa: string;
  ulica: string;
  kod: string;
  miasto: string;
  /** Kod kraju ISO (prefiks numeru), np. "IE", "DE". */
  kraj: string;
};

/** Kody krajów UE używane w VIES (z osobliwościami: EL = Grecja, XI = Irlandia
 * Płn.). Polska świadomie jest tu pominięta — dla PL używamy Białej Listy MF. */
export const VIES_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "ES", "FI", "FR", "HR",
  "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "RO", "SE", "SI", "SK", "XI",
]);

/** Najlepszy możliwy podział adresu VIES (jedno- lub wieloliniowy) na
 * ulicę / kod / miasto. Formaty różnią się między krajami, więc gdy nie da się
 * pewnie wyłuskać kodu pocztowego — całość ląduje w „ulica", resztę użytkownik
 * poprawia ręcznie. */
function splitViesAddress(address: string): { ulica: string; kod: string; miasto: string } {
  const flat = address.replace(/\s*\n\s*/g, ", ").replace(/\s+/g, " ").trim();
  if (!flat) return { ulica: "", kod: "", miasto: "" };
  // Próba: „…ulica…, KOD MIASTO" na końcu (kod = 4–6 znaków z cyframi, ew. z
  // literami/myślnikiem jak w NL/PL); działa dla części krajów.
  const m = /^(.*?),?\s*([A-Z]{0,2}[- ]?\d{2}[- ]?\d{2,3}(?:[- ]?[A-Z]{2})?)\s+(.+)$/.exec(flat);
  if (m) return { ulica: m[1].replace(/,\s*$/, "").trim(), kod: m[2].trim(), miasto: m[3].trim() };
  return { ulica: flat, kod: "", miasto: "" };
}

/** Sprawdza numer VAT-UE w VIES i zwraca dane podmiotu. Zwraca null przy
 * błędzie połączenia/nieprawidłowym wejściu; `valid=false`, gdy numer istnieje
 * w zapytaniu, ale VIES uznał go za nieaktywny. */
export async function lookupVies(countryCode: string, vatNumber: string): Promise<ViesSubject | null> {
  const cc = countryCode.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  const vat = vatNumber.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (cc.length !== 2 || !vat) return null;
  try {
    const res = await fetch("https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ countryCode: cc, vatNumber: vat }),
    });
    if (!res.ok) {
      console.error("[VIES] HTTP", res.status, await res.text().catch(() => ""));
      return null;
    }
    const j = (await res.json()) as Record<string, unknown>;
    // "---" oznacza dane ukryte przez dany kraj — traktujemy jak puste.
    const clean = (v: unknown) => {
      const s = typeof v === "string" ? v.trim() : "";
      return s === "---" ? "" : s;
    };
    const { ulica, kod, miasto } = splitViesAddress(clean(j.address));
    return { valid: Boolean(j.valid), nazwa: clean(j.name), ulica, kod, miasto, kraj: cc };
  } catch (e) {
    console.error("[VIES] fetch failed", e);
    return null;
  }
}
