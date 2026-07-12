// KSeF (Krajowy System e-Faktur) — czysta logika, bez "use client",
// re-używana przez API routes i UI. Faza 2 planu: NA TYM ETAPIE wszystko jest
// OFFLINE — generujemy plik FA(3) i sprawdzamy go lokalnie, NIC nie wychodzi
// do sieci. Uwierzytelnianie/wysyłka to osobne, późniejsze kroki (3–5), które
// świadomie działają wyłącznie na środowisku testowym MF.
//
// Namespace i struktura wg oficjalnej dokumentacji MF (struktura logiczna
// FA(3), obowiązująca od 1 lutego 2026):
//   https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/struktura-logiczna-fa-3/

import {
  type Invoice,
  type InvoiceItem,
  type CompanySettings,
  invoiceTotals,
  itemNetto,
  itemVat,
  round2,
} from "./invoices";

// ---------------------------------------------------------------------------
// Krok 1 — fundament: stan KSeF przy fakturze
// ---------------------------------------------------------------------------

/** Status dokumentu w cyklu życia KSeF. Trzymany na fakturze (kolumna
 * `ksef_status`), domyślnie `nie_wyslano`. Świadomie prosty ciąg stanów —
 * bez modelu AI, wyłącznie deterministyczne przejścia sterowane odpowiedzią
 * systemu MF. */
export const KSEF_STATUSES = ["nie_wyslano", "wyslano", "przyjeto", "odrzucono"] as const;
export type KsefStatus = (typeof KSEF_STATUSES)[number];

export const KSEF_STATUS_LABEL: Record<KsefStatus, string> = {
  nie_wyslano: "Nie wysłano",
  wyslano: "Wysłano",
  przyjeto: "Przyjęto",
  odrzucono: "Odrzucono",
};

/** Klasy Tailwind do plakietki statusu — spójne z INVOICE_STATUS_CLASS. */
export const KSEF_STATUS_CLASS: Record<KsefStatus, string> = {
  nie_wyslano: "bg-[var(--hairline)] text-muted",
  wyslano: "bg-brand-cyan/15 text-brand-cyan",
  przyjeto: "bg-emerald-500/20 text-emerald-400 font-semibold",
  odrzucono: "bg-red-500/15 text-red-400",
};

/** Środowisko KSeF, do którego wysłano dokument. `test` = serwery testowe MF
 * (faktury sztuczne, bez mocy prawnej). `prod` odblokowywane wyłącznie po
 * rejestracji firmy — patrz PO_REJESTRACJI.md. NULL = nigdy nie wysłano. */
export const KSEF_TRYBY = ["test", "prod"] as const;
export type KsefTryb = (typeof KSEF_TRYBY)[number];

export const KSEF_TRYB_LABEL: Record<KsefTryb, string> = {
  test: "TRYB TESTOWY",
  prod: "Produkcja",
};

// ---------------------------------------------------------------------------
// Korekty (RodzajFaktury = KOR)
// ---------------------------------------------------------------------------

/** Typ skutku korekty w ewidencji VAT (FA(3) <TypKorekty>). Wybór ma
 * konsekwencje księgowe — dlatego jawny, z opisem po polsku dla właściciela. */
export const KOREKTA_TYPY = ["1", "2", "3"] as const;
export type KorektaTyp = (typeof KOREKTA_TYPY)[number];

export const KOREKTA_TYP_LABEL: Record<KorektaTyp, string> = {
  "1": "W dacie faktury pierwotnej (korekta błędu)",
  "2": "W dacie wystawienia korekty (przyczyna późniejsza — rabat, zwrot)",
  "3": "W innej dacie",
};

/** Dane faktury korygowanej potrzebne do zbudowania korekty FA(3). Wypełniane
 * przez route wysyłki z oryginalnej faktury (koryguje_id). */
export type CorrectionContext = {
  /** Numer faktury korygowanej — FA(3) NrFaKorygowanej. */
  originalNumer: string;
  /** Data wystawienia faktury korygowanej — FA(3) DataWystFaKorygowanej.
   * Może przyjść z bazy jako Date lub string (obsłużone przez dateStr). */
  originalDataWystawienia: unknown;
  /** Numer KSeF faktury korygowanej, jeśli była w KSeF (przyjęta). Null =
   * wystawiona poza KSeF → znacznik NrKSeFN. */
  originalKsefNumber: string | null;
  /** Pozycje faktury korygowanej (stan PRZED korektą) — do wierszy StanPrzed
   * oraz do wyliczenia RÓŻNICY w sumach P_13/P_14/P_15. */
  originalItems: InvoiceItem[];
  /** Typ skutku korekty (FA(3) TypKorekty): "1"/"2"/"3". */
  typKorekty: string;
};

// ---------------------------------------------------------------------------
// Krok 2 — generowanie pliku FA(3) (offline) + walidacja lokalna
// ---------------------------------------------------------------------------

/** Namespace docelowej struktury FA(3) (wzór MF z 25.06.2025). */
export const FA3_NAMESPACE = "http://crd.gov.pl/wzor/2025/06/25/13775/";

/** Mapowanie stawki VAT z pozycji (VAT_RATES: 23/8/5/0/zw/np) na indeks pola
 * podstawy P_13_x i kwoty podatku P_14_x w elemencie <Fa> FA(3):
 *   P_13_1 / P_14_1 — stawka podstawowa (23% lub 22%)
 *   P_13_2 / P_14_2 — pierwsza obniżona (8% lub 7%)
 *   P_13_3 / P_14_3 — druga obniżona (5%)
 *   P_13_4          — stawka 0% (krajowa, poza WDT/eksportem) — bez pola VAT
 *   P_13_6          — "np" (poza terytorium kraju)
 *   P_13_7          — zwolnione ("zw")
 * v1 (zwykła faktura sprzedażowa) obsługuje pewnie 23/8/5/0/zw; np i procedury
 * szczególne oznaczamy ostrzeżeniem w walidacji (wykraczają poza zakres v1). */
type Fa3RateSlot = { pFieldNetto: string; pFieldVat: string | null };
const FA3_RATE_SLOT: Record<string, Fa3RateSlot> = {
  "23": { pFieldNetto: "P_13_1", pFieldVat: "P_14_1" },
  "22": { pFieldNetto: "P_13_1", pFieldVat: "P_14_1" },
  "8": { pFieldNetto: "P_13_2", pFieldVat: "P_14_2" },
  "7": { pFieldNetto: "P_13_2", pFieldVat: "P_14_2" },
  "5": { pFieldNetto: "P_13_3", pFieldVat: "P_14_3" },
  "0": { pFieldNetto: "P_13_4", pFieldVat: null },
  np: { pFieldNetto: "P_13_6", pFieldVat: null },
  zw: { pFieldNetto: "P_13_7", pFieldVat: null },
};

/** Wartość pola P_12 (stawka VAT na wierszu) wg naszej stawki wewnętrznej.
 * FA(3) chce liczby bez znaku "%" dla stawek numerycznych oraz kodów
 * literowych "zw"/"np"/"oo" dla pozostałych. */
function p12Value(rate: string): string {
  if (rate === "zw" || rate === "np" || rate === "oo") return rate;
  return rate; // "23" / "8" / "5" / "0" — już w formacie oczekiwanym przez FA(3)
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Kwota w formacie FA(3): kropka dziesiętna, dokładnie 2 miejsca. */
function kwota(n: number): string {
  return round2(n).toFixed(2);
}

/** Ilość w formacie FA(3): kropka dziesiętna, bez zbędnych zer, min. 0 miejsc. */
function ilosc(n: number): string {
  return String(n);
}

/** Sam NIP jako ciąg cyfr (usuwa spacje, myślniki, prefiks "PL"). */
export function nipDigits(nip: string): string {
  return (nip || "").replace(/[^0-9]/g, "");
}

/** Kod kraju ISO 3166 z pola tekstowego (np. "Polska" → "PL"). Domyślnie PL,
 * gdy puste — najczęstszy przypadek dla v1 (faktury krajowe). */
function isoKraj(kraj: string): string {
  const k = (kraj || "").trim();
  if (!k) return "PL";
  if (/^[A-Za-z]{2}$/.test(k)) return k.toUpperCase();
  if (/polsk/i.test(k)) return "PL";
  return k.toUpperCase().slice(0, 2);
}

/** Składa pojedynczą linię AdresL1 FA(3) z ulicy + "kod miasto". */
function joinAdresL1(ulica: string, kod: string, miasto: string, fallback: string): string {
  const parts = [ulica, [kod, miasto].filter(Boolean).join(" ")]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  return parts.join(", ") || fallback || "";
}

/** Adres nabywcy jako pojedyncza linia AdresL1 FA(3) (ulica, kod miasto). */
function buyerAdresL1(inv: Invoice): string {
  return joinAdresL1(inv.klient_ulica, inv.klient_kod, inv.klient_miasto, inv.klient_adres);
}

/** Adres sprzedawcy jako pojedyncza linia AdresL1 FA(3) — preferuje pola
 * strukturalne, spada na stare jednoliniowe `adres`. */
function companyAdresL1(company: CompanySettings): string {
  return joinAdresL1(company.ulica, company.kod, company.miasto, company.adres);
}

/** Data do FA(3) w formacie YYYY-MM-DD. Odporna na to, że sterownik bazy
 * potrafi zwrócić kolumnę DATE jako obiekt `Date` (produkcja/neon), a nie jako
 * string (lokalny PGlite) — inaczej `xmlEscape` wywalał się na `Date.replace`. */
function dateStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

/** Pojedynczy węzeł XML z wcięciem (pomija puste wartości opcjonalne).
 * `String(value)` chroni przed wartościami nie-stringowymi z bazy (np. Date),
 * które inaczej wywalałyby `xmlEscape`. */
function tag(name: string, value: string | number, indent: string): string {
  return `${indent}<${name}>${typeof value === "number" ? value : xmlEscape(String(value))}</${name}>`;
}

/**
 * Buduje dokument FA(3) (XML) z istniejącej faktury. WYŁĄCZNIE lokalnie —
 * żadnego połączenia z siecią. Zakres v1: zwykła faktura sprzedażowa
 * (RodzajFaktury = VAT). Korekty/zaliczki/procedury szczególne dokładamy w
 * kolejnych iteracjach (patrz walidacja niżej — sygnalizuje, gdy faktura
 * wykracza poza v1).
 *
 * Uwaga: to jest wierne strukturalnie odwzorowanie FA(3), ale bajtowo-dokładna
 * zgodność z XSD (kolejność wszystkich pod-elementów Adnotacje itd.) jest
 * potwierdzana dopiero walidatorem MF na środowisku testowym (Krok 3+).
 */
export function buildFA3Xml(
  inv: Invoice,
  items: InvoiceItem[],
  company: CompanySettings,
  correction?: CorrectionContext
): string {
  // Dla korekty sumy P_13/P_14/P_15 to RÓŻNICA (po − przed): pozycje faktury
  // korygującej dodajemy ze znakiem +, pozycje faktury korygowanej ze znakiem −.
  // Dla zwykłej faktury po prostu sumujemy pozycje (bez odejmowania).
  const netByField = new Map<string, number>();
  const vatByField = new Map<string, number>();
  const touched = new Set<string>();
  const accumulate = (list: InvoiceItem[], sign: number) => {
    for (const it of list) {
      const slot = FA3_RATE_SLOT[it.vat_stawka] ?? FA3_RATE_SLOT["23"];
      netByField.set(slot.pFieldNetto, (netByField.get(slot.pFieldNetto) ?? 0) + sign * itemNetto(it));
      touched.add(slot.pFieldNetto);
      if (slot.pFieldVat) {
        vatByField.set(slot.pFieldVat, (vatByField.get(slot.pFieldVat) ?? 0) + sign * itemVat(it));
        touched.add(slot.pFieldVat);
      }
    }
  };
  accumulate(items, 1);
  if (correction) accumulate(correction.originalItems, -1);

  // P_15: dla korekty różnica brutto (po − przed), inaczej suma brutto faktury.
  const p15 = correction
    ? round2(invoiceTotals(items).brutto - invoiceTotals(correction.originalItems).brutto)
    : invoiceTotals(items).brutto;

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const L1 = "  ";
  const L2 = "    ";
  const L3 = "      ";

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<Faktura xmlns="${FA3_NAMESPACE}">`);

  // --- Nagłówek ---
  lines.push(`${L1}<Naglowek>`);
  lines.push(`${L2}<KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>`);
  lines.push(tag("WariantFormularza", 3, L2));
  lines.push(tag("DataWytworzeniaFa", now, L2));
  lines.push(`${L1}</Naglowek>`);

  // --- Podmiot1 (sprzedawca) ---
  lines.push(`${L1}<Podmiot1>`);
  lines.push(`${L2}<DaneIdentyfikacyjne>`);
  lines.push(tag("NIP", nipDigits(company.nip), L3));
  lines.push(tag("Nazwa", company.nazwa, L3));
  lines.push(`${L2}</DaneIdentyfikacyjne>`);
  lines.push(`${L2}<Adres>`);
  lines.push(tag("KodKraju", isoKraj(company.kraj), L3));
  lines.push(tag("AdresL1", companyAdresL1(company), L3));
  lines.push(`${L2}</Adres>`);
  lines.push(`${L1}</Podmiot1>`);

  // --- Podmiot2 (nabywca) ---
  lines.push(`${L1}<Podmiot2>`);
  lines.push(`${L2}<DaneIdentyfikacyjne>`);
  const buyerNip = nipDigits(inv.klient_nip);
  if (buyerNip) {
    lines.push(tag("NIP", buyerNip, L3));
  } else {
    // Brak identyfikatora podatkowego (np. osoba prywatna) — FA(3) dopuszcza
    // znacznik BrakID. Nabywcy zagranicznych z NrVatUE dołożymy poza v1.
    lines.push(tag("BrakID", 1, L3));
  }
  lines.push(tag("Nazwa", inv.klient_nazwa, L3));
  lines.push(`${L2}</DaneIdentyfikacyjne>`);
  const buyerL1 = buyerAdresL1(inv);
  if (buyerL1) {
    lines.push(`${L2}<Adres>`);
    lines.push(tag("KodKraju", isoKraj(inv.klient_kraj), L3));
    lines.push(tag("AdresL1", buyerL1, L3));
    lines.push(`${L2}</Adres>`);
  }
  // Wymagane w FA(3) znaczniki nabywcy (bez nich MF odrzuca — kod 450,
  // „Podmiot2 has incomplete content"). Oba dla zwykłego nabywcy = 2 („nie"):
  //   JST — czy nabywca jest jednostką podrzędną samorządu (1=tak, 2=nie)
  //   GV  — czy nabywca jest członkiem grupy VAT       (1=tak, 2=nie)
  lines.push(tag("JST", 2, L2));
  lines.push(tag("GV", 2, L2));
  lines.push(`${L1}</Podmiot2>`);

  // --- Fa (dane faktury) ---
  lines.push(`${L1}<Fa>`);
  lines.push(tag("KodWaluty", inv.waluta || "PLN", L2));
  lines.push(tag("P_1", dateStr(inv.data_wystawienia), L2));
  lines.push(tag("P_2", inv.numer || "", L2));
  if (inv.data_sprzedazy) lines.push(tag("P_6", dateStr(inv.data_sprzedazy), L2));

  // Podstawy i kwoty VAT w ustalonej kolejności pól FA(3). Emitujemy każde
  // pole „dotknięte" przez pozycje (dla korekty także z wartością 0.00, gdy
  // różnica wychodzi zerowa dla danej stawki — pole i tak wystąpiło).
  for (const f of ["P_13_1", "P_14_1", "P_13_2", "P_14_2", "P_13_3", "P_14_3", "P_13_4", "P_13_6", "P_13_7"]) {
    if (!touched.has(f)) continue;
    const isVat = f.startsWith("P_14");
    const val = (isVat ? vatByField.get(f) : netByField.get(f)) ?? 0;
    lines.push(tag(f, kwota(val), L2));
  }
  lines.push(tag("P_15", kwota(p15), L2));

  // Adnotacje — komplet obowiązkowych znaczników. Domyślnie "nie dotyczy" (2)
  // / znaczniki negatywne (1) dla zwykłej faktury krajowej v1.
  lines.push(`${L2}<Adnotacje>`);
  lines.push(tag("P_16", 2, L3)); // metoda kasowa: nie
  lines.push(tag("P_17", 2, L3)); // samofakturowanie: nie
  lines.push(tag("P_18", 2, L3)); // odwrotne obciążenie: nie
  lines.push(tag("P_18A", 2, L3)); // MPP: nie
  lines.push(`${L3}<Zwolnienie>`);
  lines.push(tag("P_19N", 1, L2 + L2)); // brak zwolnienia
  lines.push(`${L3}</Zwolnienie>`);
  lines.push(`${L3}<NoweSrodkiTransportu>`);
  lines.push(tag("P_22N", 1, L2 + L2)); // brak nowych środków transportu
  lines.push(`${L3}</NoweSrodkiTransportu>`);
  lines.push(tag("P_23", 2, L3)); // brak procedury art. 129
  lines.push(`${L3}<PMarzy>`);
  lines.push(tag("P_PMarzyN", 1, L2 + L2)); // brak procedury marży
  lines.push(`${L3}</PMarzy>`);
  lines.push(`${L2}</Adnotacje>`);

  lines.push(tag("RodzajFaktury", correction ? "KOR" : "VAT", L2));

  // Blok korekty (po RodzajFaktury, przed wierszami) — wymagany przez FA(3),
  // gdy RodzajFaktury=KOR. Kolejność elementów wg XSD: PrzyczynaKorekty,
  // TypKorekty, DaneFaKorygowanej.
  if (correction) {
    if (inv.przyczyna_korekty.trim()) lines.push(tag("PrzyczynaKorekty", inv.przyczyna_korekty.trim(), L2));
    lines.push(tag("TypKorekty", correction.typKorekty || "1", L2));
    lines.push(`${L2}<DaneFaKorygowanej>`);
    lines.push(tag("DataWystFaKorygowanej", dateStr(correction.originalDataWystawienia), L3));
    lines.push(tag("NrFaKorygowanej", correction.originalNumer, L3));
    if (correction.originalKsefNumber) {
      // Faktura korygowana była w KSeF: znacznik NrKSeF=1 + jej numer KSeF.
      lines.push(tag("NrKSeF", 1, L3));
      lines.push(tag("NrKSeFFaKorygowanej", correction.originalKsefNumber, L3));
    } else {
      // Faktura korygowana wystawiona poza KSeF.
      lines.push(tag("NrKSeFN", 1, L3));
    }
    lines.push(`${L2}</DaneFaKorygowanej>`);
  }

  // Wiersze faktury. Zwykły dokument = same pozycje. Korekta metodą „przed/po":
  // najpierw pozycje faktury korygowanej ze znacznikiem StanPrzed=1, potem
  // pozycje po korekcie — ciągła numeracja NrWierszaFa.
  const emitWiersz = (it: InvoiceItem, nr: number, stanPrzed: boolean) => {
    lines.push(`${L2}<FaWiersz>`);
    lines.push(tag("NrWierszaFa", nr, L3));
    lines.push(tag("P_7", it.nazwa, L3));
    lines.push(tag("P_8A", it.jednostka || "szt.", L3));
    lines.push(tag("P_8B", ilosc(it.ilosc), L3));
    lines.push(tag("P_9A", kwota(it.cena_netto), L3));
    lines.push(tag("P_11", kwota(itemNetto(it)), L3));
    lines.push(tag("P_12", p12Value(it.vat_stawka), L3));
    if (stanPrzed) lines.push(tag("StanPrzed", 1, L3));
    lines.push(`${L2}</FaWiersz>`);
  };

  let nrWiersza = 1;
  if (correction) {
    for (const it of correction.originalItems) emitWiersz(it, nrWiersza++, true);
  }
  for (const it of items) emitWiersz(it, nrWiersza++, false);

  lines.push(`${L1}</Fa>`);
  lines.push(`</Faktura>`);
  return lines.join("\n");
}

/** Wynik walidacji lokalnej: błędy blokują wysyłkę, ostrzeżenia informują o
 * przypadkach spoza zakresu v1 (do ręcznej weryfikacji). */
export type FA3Validation = { errors: string[]; warnings: string[] };

/**
 * Walidacja lokalna faktury pod kątem FA(3) — sprawdzana U SIEBIE, zanim
 * cokolwiek wyjdzie do systemu. To NIE jest pełna walidacja XSD (ta wymaga
 * schematu MF i osobnego walidatora — potwierdzimy ją walidatorem testowym MF
 * w Kroku 3+); to kontrola reguł biznesowych, które najczęściej wywalają
 * dokument: braki danych, niespójne sumy, przypadki poza zakresem v1. Zwraca
 * czytelne komunikaty PO POLSKU — które pole i dlaczego.
 */
export function validateForFA3(
  inv: Invoice,
  items: InvoiceItem[],
  company: CompanySettings,
  correction?: CorrectionContext
): FA3Validation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Sprzedawca (Podmiot1).
  if (!nipDigits(company.nip)) errors.push("Brak NIP sprzedawcy (Ustawienia firmy).");
  else if (nipDigits(company.nip).length !== 10) errors.push("NIP sprzedawcy musi mieć 10 cyfr.");
  if (!company.nazwa.trim()) errors.push("Brak nazwy sprzedawcy (Ustawienia firmy).");
  if (!companyAdresL1(company).trim()) errors.push("Brak adresu sprzedawcy (Ustawienia firmy).");

  // Nabywca (Podmiot2).
  if (!inv.klient_nazwa.trim()) errors.push("Brak nazwy nabywcy.");
  const buyerNip = nipDigits(inv.klient_nip);
  if (buyerNip && buyerNip.length !== 10) {
    errors.push("NIP nabywcy musi mieć 10 cyfr (albo zostaw puste dla osoby prywatnej).");
  }

  // Nagłówek faktury.
  if (!inv.numer) errors.push("Faktura nie ma numeru — najpierw ją wystaw.");
  if (!inv.data_wystawienia) errors.push("Brak daty wystawienia (P_1).");
  if (!inv.waluta) errors.push("Brak waluty (KodWaluty).");

  // Pozycje.
  if (items.length === 0) {
    errors.push("Faktura nie ma żadnej pozycji.");
  } else {
    items.forEach((it, i) => {
      const n = i + 1;
      if (!it.nazwa.trim()) errors.push(`Pozycja ${n}: brak nazwy (P_7).`);
      if (!(it.ilosc > 0)) errors.push(`Pozycja ${n}: ilość musi być większa od zera (P_8B).`);
      if (!FA3_RATE_SLOT[it.vat_stawka]) {
        warnings.push(`Pozycja ${n}: stawka "${it.vat_stawka}" wykracza poza zakres v1 — zweryfikuj ręcznie.`);
      }
    });
  }

  // Spójność sum: P_15 = netto + VAT (osobno dla stanu po korekcie / faktury).
  const totals = invoiceTotals(items);
  if (round2(totals.netto + totals.vat) !== totals.brutto) {
    errors.push("Suma brutto (P_15) nie zgadza się z sumą netto + VAT.");
  }

  // Korekta (RodzajFaktury = KOR) — wymagane dane faktury korygowanej.
  if (inv.koryguje_id) {
    if (!correction) {
      errors.push("Brak danych faktury korygowanej — nie można zbudować korekty do KSeF.");
    } else {
      if (!inv.przyczyna_korekty.trim()) errors.push("Podaj przyczynę korekty (wymagana przez KSeF).");
      if (!correction.originalNumer.trim()) errors.push("Faktura korygowana nie ma numeru.");
      if (!correction.originalDataWystawienia) errors.push("Brak daty wystawienia faktury korygowanej.");
      if (!(KOREKTA_TYPY as readonly string[]).includes(correction.typKorekty)) {
        errors.push("Nieprawidłowy typ korekty.");
      }
    }
  }

  // Przypadki poza zakresem v1 (RodzajFaktury = VAT).
  if (inv.typ_dokumentu !== "faktura") {
    warnings.push(`Typ "${inv.typ_dokumentu}" (proforma/zaliczkowa) nie jest jeszcze mapowany na FA(3) — v1 obejmuje zwykłą fakturę.`);
  }
  if ((inv.waluta || "PLN") !== "PLN") {
    warnings.push("Faktura w walucie obcej — kurs NBP i pola przeliczeniowe FA(3) dokładamy poza v1.");
  }

  return { errors, warnings };
}
