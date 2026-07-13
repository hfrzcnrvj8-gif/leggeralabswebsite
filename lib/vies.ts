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

// ---------------------------------------------------------------------------
// Klient (przeglądarka): jeden helper dla przycisku „Szukaj po NIP / VAT-UE"
// w edytorach Faktur i Ofert. Rozgałęzia PL → Biała Lista MF, reszta UE →
// VIES, i zwraca gotowe pola nabywcy + komunikat. Uderza wyłącznie w wewnętrzne
// route'y (/api/mf, /api/vies), nie w zewnętrzne API bezpośrednio.
// ---------------------------------------------------------------------------

export type NipLookupFields = {
  klient_nazwa: string;
  klient_ulica: string;
  klient_kod: string;
  klient_miasto: string;
  klient_kraj?: string;
};

export type NipLookupResult =
  | { ok: true; fields: Partial<NipLookupFields>; message: string }
  | { ok: false; message: string };

/** Zostawia tylko niepuste pola — żeby wynik lookupu (np. VIES z krajów, które
 * ukrywają nazwę/adres) NIE kasował danych już wpisanych ręcznie na dokumencie. */
function nonEmpty(fields: NipLookupFields): Partial<NipLookupFields> {
  const out: Partial<NipLookupFields> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === "string" && v.trim()) out[k as keyof NipLookupFields] = v;
  }
  return out;
}

export async function lookupClientByNip(nipRaw: string): Promise<NipLookupResult> {
  const raw = (nipRaw ?? "").replace(/\s+/g, "").toUpperCase();
  if (!raw) return { ok: false, message: "Wpisz najpierw NIP lub numer VAT-UE." };
  const prefix = /^([A-Z]{2})(.+)$/.exec(raw);
  const useVies = Boolean(prefix && prefix[1] !== "PL" && VIES_COUNTRY_CODES.has(prefix[1]));
  try {
    if (useVies && prefix) {
      const res = await fetch(`/api/vies/${prefix[1]}/${encodeURIComponent(prefix[2])}`);
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        return { ok: false, message: d.error ?? "Nie udało się zweryfikować w VIES." };
      }
      const { subject } = (await res.json()) as {
        subject: { nazwa: string; ulica: string; kod: string; miasto: string; kraj: string };
      };
      return {
        ok: true,
        fields: nonEmpty({
          klient_nazwa: subject.nazwa,
          klient_ulica: subject.ulica,
          klient_kod: subject.kod,
          klient_miasto: subject.miasto,
          klient_kraj: subject.kraj,
        }),
        message: subject.nazwa
          ? "Uzupełniono dane z VIES."
          : `✓ Numer VAT-UE (${prefix[1]}) potwierdzony jako ważny. Ten kraj nie udostępnia przez VIES nazwy ani adresu — wpisz je ręcznie.`,
      };
    }
    const nip = raw.replace(/^PL/, "").replace(/\D/g, "");
    const res = await fetch(`/api/mf/nip/${nip}`);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, message: d.error ?? "Nie znaleziono podmiotu o tym NIP." };
    }
    const { subject } = (await res.json()) as { subject: { nazwa: string; ulica: string; kod: string; miasto: string } };
    return {
      ok: true,
      fields: nonEmpty({ klient_nazwa: subject.nazwa, klient_ulica: subject.ulica, klient_kod: subject.kod, klient_miasto: subject.miasto }),
      message: "Uzupełniono dane z Białej Listy MF.",
    };
  } catch {
    return { ok: false, message: "Błąd połączenia przy wyszukiwaniu podmiotu." };
  }
}

// ---------------------------------------------------------------------------
// Dostawca (Koszty, Moduł 9): analogiczny helper do lookupClientByNip, ale
// zwraca pola `dostawca_*` i — dla polskich NIP-ów — numery kont z Białej
// Listy (do weryfikacji `dostawca_konto` wpisanego ręcznie, patrz lib/mf.ts).
// Koszty nie mają pól adresowych dostawcy (nie są potrzebne na dokumencie
// zakupowym jak na wystawianej fakturze), więc autouzupełnia tylko nazwę.
// ---------------------------------------------------------------------------

/** Normalizuje numer konta do samych cyfr (bez spacji/prefiksu PL) — do
 * porównania numeru wpisanego ręcznie (zwykle z prefiksem PL i spacjami) z
 * numerami z Białej Listy (same cyfry, bez PL). */
export function normalizeAccountNumber(v: string): string {
  return v.toUpperCase().replace(/^PL/, "").replace(/\D/g, "");
}

export type SupplierLookupResult =
  | { ok: true; dostawca_nazwa: string; statusVat: string | null; numeryKont: string[]; message: string }
  | { ok: false; message: string };

export async function lookupSupplierByNip(nipRaw: string): Promise<SupplierLookupResult> {
  const raw = (nipRaw ?? "").replace(/\s+/g, "").toUpperCase();
  if (!raw) return { ok: false, message: "Wpisz najpierw NIP dostawcy." };
  const prefix = /^([A-Z]{2})(.+)$/.exec(raw);
  const useVies = Boolean(prefix && prefix[1] !== "PL" && VIES_COUNTRY_CODES.has(prefix[1]));
  try {
    if (useVies && prefix) {
      const res = await fetch(`/api/vies/${prefix[1]}/${encodeURIComponent(prefix[2])}`);
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        return { ok: false, message: d.error ?? "Nie udało się zweryfikować w VIES." };
      }
      const { subject } = (await res.json()) as { subject: { nazwa: string; kraj: string } };
      return {
        ok: true,
        dostawca_nazwa: subject.nazwa,
        statusVat: null,
        numeryKont: [],
        message: subject.nazwa
          ? "Uzupełniono nazwę z VIES. Biała Lista MF dotyczy tylko polskich NIP-ów — numer konta sprawdź ręcznie."
          : `✓ Numer VAT-UE (${prefix[1]}) potwierdzony jako ważny. Ten kraj nie udostępnia nazwy przez VIES.`,
      };
    }
    const nip = raw.replace(/^PL/, "").replace(/\D/g, "");
    const res = await fetch(`/api/mf/nip/${nip}`);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, message: d.error ?? "Nie znaleziono podmiotu o tym NIP." };
    }
    const { subject } = (await res.json()) as {
      subject: { nazwa: string; statusVat: string | null; numeryKont: string[] };
    };
    return {
      ok: true,
      dostawca_nazwa: subject.nazwa,
      statusVat: subject.statusVat,
      numeryKont: subject.numeryKont ?? [],
      message: "Uzupełniono dane z Białej Listy MF.",
    };
  } catch {
    return { ok: false, message: "Błąd połączenia przy wyszukiwaniu podmiotu." };
  }
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
