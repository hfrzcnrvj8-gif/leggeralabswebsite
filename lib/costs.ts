// Czysta logika modułu Koszty — bez "use client", re-używana przez UI i
// serwerowe route'y. Wzorowane na lib/invoices.ts (dokument finansowy z
// kwotami/VAT/statusem), ale odwrotny kierunek: to faktury PRZYCHODZĄCE od
// dostawców (wydatki firmy), nie sprzedażowe. Waluta od Modułu 63 (2026-08-01)
// — wcześniej świadomie tylko PLN, ale faktura od zagranicznego dostawcy
// (chmura, licencje, sprzęt z UE) to najbardziej naturalny koszt tej firmy.

/** Dozwolone typy plików załącznika (skan/PDF faktury od dostawcy) i limit
 * rozmiaru — pilnowane też po stronie API (app/api/costs/[id]/attachment). */
export const ATTACHMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024; // 8 MB — skan/PDF faktury, nie duży plik

import { formatMoney, round2, VAT_RATES, vatFraction, zeSlownika, type VatRate } from "./invoices";
import { RECURRING_CYCLES, type RecurringCycle } from "./recurring";
import { mapaStanow } from "./kolorStanu";
import { isPlausibleDateString } from "./projects";
import { WALUTY, DOMYSLNA_WALUTA, isWaluta, type Waluta } from "./waluty";

export { formatMoney, round2, VAT_RATES, type VatRate };
export { WALUTY, DOMYSLNA_WALUTA, isWaluta, type Waluta };

export const COST_CATEGORIES = [
  "Usługi",
  "Sprzęt",
  "Subskrypcje",
  "Biuro",
  "Marketing",
  "Podatki i ZUS",
  "Inne",
] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export type CostStatus = "Nieopłacony" | "Opłacony";
export const COST_STATUSES: CostStatus[] = ["Nieopłacony", "Opłacony"];

/* Wspólna skala (Moduł 59, `lib/kolorStanu.ts`). „Nieopłacony" przechodzi
 * z szarości na złoto: to nie jest „nic się nie dzieje", tylko rachunek, który
 * czeka na MÓJ przelew. Świadomie NIE czerwień — nieopłacony koszt to zdrowy,
 * normalny stan przez większość jego życia. */
export const COST_STATUS_CLASS: Record<string, string> = mapaStanow({
  Nieopłacony: "mojRuch",
  Opłacony: "sukces",
});

/** Moduł 9 (branżowy standard) — jak koszt został/zostanie zapłacony. Czysta
 * etykieta do raportowania i uzgadniania z wyciągiem bankowym, wzorem
 * Ramp/Expensify/QuickBooks — świadomie NIE inicjuje żadnej płatności (patrz
 * docs/plany-modulow/09-koszty-branzowy-standard.md, sekcja "poza zakresem").
 * NULL/"" = nieustawiona (koszty sprzed tej funkcji, albo jeszcze niezdecydowane). */
export const PAYMENT_METHODS = ["przelew", "karta", "gotowka", "blik", "paypal", "apple_pay"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  przelew: "Przelew",
  karta: "Karta",
  gotowka: "Gotówka",
  blik: "BLIK",
  paypal: "PayPal",
  apple_pay: "Apple Pay",
};

/* Ikona metody płatności: `<PaymentMethodIcon method={…} />` w
 * `app/[lang]/admin/icons.tsx` (Moduł 33). Kolory zostają niżej. */

export const PAYMENT_METHOD_CLASS: Record<PaymentMethod, string> = {
  przelew: "bg-brand-cyan/15 text-brand-cyan",
  karta: "bg-brand-purple/15 text-brand-purple",
  gotowka: "bg-emerald-500/15 text-emerald-400",
  blik: "bg-brand-gold/15 text-brand-gold",
  paypal: "bg-blue-500/15 text-blue-400",
  apple_pay: "bg-[var(--hairline)] text-[var(--fg)]",
};

/** Moduł 9, fundamenty zgodności — próg amortyzacji (art. 22k ustawy o PIT):
 * sprzęt/środki trwałe powyżej tej kwoty netto co do zasady NIE wchodzą
 * jednorazowo w koszty, tylko przez amortyzację. Tylko miękka podpowiedź w
 * UI — panel niczego nie blokuje ani nie rozlicza automatycznie. */
export const AMORTYZACJA_PROG_NETTO = 10000;

/** Procent VAT do odliczenia — domyślnie 100%; 50% dla samochodów mieszanego
 * użytku, 0% dla reprezentacji (art. 86a i art. 88 ust. 1 pkt 2 ustawy o
 * VAT). Właściciel wybiera sam z trzech typowych wartości — panel niczego
 * nie zgaduje po kategorii/opisie. */
export const VAT_ODLICZENIE_OPTIONS = [100, 50, 0] as const;
export const VAT_ODLICZENIE_LABEL: Record<number, string> = {
  100: "100% (pełne odliczenie)",
  50: "50% (np. samochód mieszanego użytku)",
  0: "0% (np. reprezentacja)",
};

export type Cost = {
  id: string;
  dostawca_nazwa: string;
  dostawca_nip: string;
  kategoria: CostCategory | string;
  opis: string;
  data_wydatku: string;
  kwota_netto: number;
  vat_stawka: VatRate | string;
  kwota_brutto: number;
  /** Waluta faktury od dostawcy (Moduł 63). Do 2026-08-01 każdy koszt był
   * milcząco w złotówkach, a faktura za chmurę/licencje wpisywała się jako
   * gołe liczby i wchodziła do sum, jakby to były złote. */
  waluta: Waluta | string;
  /** Kurs do PLN z dnia poprzedzającego wystawienie (tak liczy to ustawa
   * o VAT, art. 31a). `null` dla kosztów w PLN — patrz `kursDoPln()`.
   * Sumy i analityka liczą `kwota * COALESCE(kurs_pln, 1)`. */
  kurs_pln: number | null;
  status: CostStatus;
  /** Do kiedy zapłacić — RÓŻNE od `data_platnosci` (kiedy zapłacono).
   * Bez tego pola nieopłacona faktura od dostawcy mogła leżeć dowolnie długo
   * i nic o niej nie przypominało (Moduł 63). NULL = brak terminu. */
  termin_platnosci: string | null;
  data_platnosci: string | null;
  project_id: string | null;
  /** Moduł 22 — klient/lead wprost na koszcie, niezależnie od projektu.
   * Relacja wyłączna: ustawiony jest co najwyżej jeden z nich. */
  client_id: string | null;
  lead_id: string | null;
  /** Jak koszt został/zostanie zapłacony — patrz PAYMENT_METHODS. NULL = nieustawiona. */
  metoda_platnosci: PaymentMethod | string | null;
  /** Numer konta dostawcy (IBAN) — do „Kopiuj dane do przelewu", nie do
   * inicjowania płatności (panel nigdy nie przenosi pieniędzy). */
  dostawca_konto: string;
  /** Numer faktury/dokumentu od dostawcy — ustawowy element faktury VAT
   * (art. 106e) i osobne pole w rejestrze zakupów JPK_V7. Puste = brak
   * (np. paragon bez numeru albo koszt wprowadzony przed tą funkcją). */
  numer_faktury: string;
  /** Data OTRZYMANIA faktury — osobna od `data_wydatku` (data wystawienia).
   * Liczy się dla terminu odliczenia VAT, jeśli różni się od daty
   * wystawienia. NULL = nieustawiona (opcjonalna, nie każdy koszt wymaga
   * rozróżnienia obu dat). */
  data_wplywu: string | null;
  /** Procent VAT do odliczenia — patrz VAT_ODLICZENIE_OPTIONS. */
  vat_odliczenie_procent: number;
  /** Właściciel świadomie wyciszył ostrzeżenie o możliwym duplikacie tego
   * kosztu (ten sam NIP+kwota+data co inny wpis) — nie pokazuj go ponownie. */
  duplikat_potwierdzony: boolean;
  created_at: string;
  updated_at: string;
  /** Dołączane w GET /api/costs (JOIN z projects) — tylko do wyświetlenia. */
  project_tytul?: string | null;
  /** Nazwa/typ MIME załącznika — same dane pliku (`zalacznik_dane`, base64)
   * NIE są tu zwracane (bloatowałyby listę/edytor); pobierane osobno przez
   * GET /api/costs/:id/attachment. Pusta nazwa = brak załącznika. */
  zalacznik_nazwa: string;
  zalacznik_typ: string;
  /** Numer KSeF faktury zakupowej, gdy koszt powstał z automatycznego importu
   * z KSeF (Faza 3, część 2). NULL = koszt wprowadzony ręcznie. */
  ksef_numer: string | null;
  ksef_tryb: string | null;
};

/** Odgaduje etykietę stawki VAT (jedną z VAT_RATES) z kwot netto/VAT pobranych
 * z KSeF — do wyświetlenia w edytorze. Faktura zakupowa może mieszać stawki;
 * w bazie i tak trzymamy dokładne kwoty netto/brutto z KSeF, a ta etykieta jest
 * tylko poglądowa (właściciel może ją poprawić). */
export function guessVatRate(netto: number, vat: number): VatRate {
  if (!(netto > 0)) return vat > 0 ? "23" : "zw";
  const pct = Math.round((vat / netto) * 100);
  const match = (VAT_RATES as readonly string[]).find((r) => r === String(pct));
  return (match as VatRate) ?? "23";
}

/** Kwota brutto z netto + stawki VAT (np. dla auto-przeliczenia w edytorze). */
export function costBrutto(netto: number, vatStawka: string): number {
  return round2(netto * (1 + vatFraction(vatStawka)));
}

/** Kwota VAT faktycznie do odliczenia — kwota VAT z dokumentu pomnożona
 * przez `vat_odliczenie_procent` (100/50/0, patrz VAT_ODLICZENIE_OPTIONS). */
export function vatDoOdliczenia(netto: number, vatStawka: string, procent: number): number {
  const kwotaVat = costBrutto(netto, vatStawka) - netto;
  return round2((kwotaVat * procent) / 100);
}

/** Kurs użyty do przeliczenia na PLN. Koszt w złotych nie ma kursu (`null`) —
 * i to jest różnica ISTOTNA, nie kosmetyczna: `null` znaczy „nie dotyczy",
 * a zapisane `1` przy walucie obcej znaczyłoby „1 EUR = 1 PLN", czyli cichy
 * błąd o rząd wielkości. Dlatego bramka wymaga kursu wprost dla każdej waluty
 * innej niż PLN, zamiast podstawiać jedynkę. */
export function kursDoPln(kurs: number | null | undefined): number {
  return typeof kurs === "number" && Number.isFinite(kurs) && kurs > 0 ? kurs : 1;
}

/** Kwota przeliczona na złote — jedyna postać, w której wolno KOSZTY SUMOWAĆ.
 * Sumowanie surowych `kwota_brutto` dodawało euro do złotówek. */
export function wPln(kwota: number, kurs: number | null | undefined): number {
  return round2(kwota * kursDoPln(kurs));
}

/**
 * Czy ten koszt w ogóle DA SIĘ przeliczyć na złote.
 *
 * Istnieje przez import z KSeF: rządowe API oddaje walutę faktury, ale nie
 * zawsze kurs, więc może powstać koszt „100 EUR, kurs nieznany". Takiego
 * kosztu NIE wolno wliczyć do sum — `kursDoPln` zwróciłby wtedy 1, czyli
 * policzyłby 100 EUR jako 100 zł. Lepiej pokazać sumę z adnotacją „2 koszty
 * bez kursu, nie wliczone" niż sumę zaniżoną o rząd wielkości bez śladu.
 */
export function maPrzelicznik(waluta: string | null | undefined, kurs: number | null | undefined): boolean {
  return (waluta ?? DOMYSLNA_WALUTA) === DOMYSLNA_WALUTA || (typeof kurs === "number" && Number.isFinite(kurs) && kurs > 0);
}

/** Ile dni minęło od terminu płatności — dodatnie = po terminie, `null` gdy
 * terminu nie ma albo koszt jest już opłacony (opłacony nie bywa spóźniony).
 * Liczone KALENDARZOWO, po dniach lokalnych — tą samą arytmetyką co reszta
 * produktu (`daysBetweenISO`, ustalenie Audytu 6), a nie przez różnicę
 * milisekund, która myli się o dobę przy zmianie czasu. */
export function dniPoTerminieKosztu(
  cost: Pick<Cost, "termin_platnosci" | "status">,
  dzisISO: string
): number | null {
  if (!cost.termin_platnosci || cost.status === "Opłacony") return null;
  const termin = String(cost.termin_platnosci).slice(0, 10);
  if (!isPlausibleDateString(termin) || !isPlausibleDateString(dzisISO)) return null;
  return daysBetweenISO(termin, dzisISO);
}

/** Różnica w pełnych dobach kalendarzowych między dwiema datami ISO. */
function daysBetweenISO(od: string, doDaty: string): number {
  const a = Date.UTC(Number(od.slice(0, 4)), Number(od.slice(5, 7)) - 1, Number(od.slice(8, 10)));
  const b = Date.UTC(Number(doDaty.slice(0, 4)), Number(doDaty.slice(5, 7)) - 1, Number(doDaty.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

/** Szablon kosztu cyklicznego (abonament/subskrypcja) — wzorem
 * `RecurringInvoice` (lib/recurring.ts), ale generuje SZKICE kosztów, nie
 * faktur. Dzienny raport (app/api/leads/notify) tworzy nowy koszt-szkic, gdy
 * nadejdzie `next_run`; właściciel i tak musi ręcznie sprawdzić/opłacić. */
export type RecurringCost = {
  id: string;
  nazwa: string;
  dostawca_nazwa: string;
  dostawca_nip: string;
  dostawca_konto: string;
  kategoria: CostCategory | string;
  opis: string;
  kwota_netto: number;
  vat_stawka: VatRate | string;
  /** Waluta abonamentu (Moduł 63) — subskrypcje SaaS to najczęstszy koszt
   * w obcej walucie. Kursu tu NIE ma świadomie: kurs jest z konkretnego dnia,
   * a szablon nie zna dnia, w którym wygeneruje kolejny koszt. */
  waluta: Waluta | string;
  metoda_platnosci: PaymentMethod | string | null;
  project_id: string | null;
  cykl: RecurringCycle;
  next_run: string;
  /** Kotwica rytmu serii — bliźniak pola w `RecurringInvoice`, patrz
   * `kotwicaSerii()` w lib/recurring.ts. */
  kotwica: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/* ───────────────────────── BRAMKA ZAPISU (Moduł 63) ─────────────────────────
 *
 * Do 2026-08-01 obie trasy kosztów robiły to samo, co Faktury i Katalog przed
 * swoimi audytami: brały śmieć, podmieniały go na wartość domyślną i
 * odpowiadały `{"ok":true}`. Zmierzone sondą, na żywym serwerze:
 *
 *   POST {"kategoria":"CO-TO-JEST","vat_stawka":"999","kwota_netto":-5000}
 *        → 200, zapisane: kategoria "Inne", VAT "23", brutto −6150
 *   PATCH {"vat_odliczenie_procent":999} na koszcie z ustawionym 0%
 *        → 200, zapisane: 100
 *   POST /api/recurring-costs {"next_run":"0202-01-01"}
 *        → 200, zapisane dosłownie (pułapka „0202" z CLAUDE.md, tyle że
 *          w polu, które steruje AUTOMATEM tworzącym koszty)
 *   POST {"kwota_netto":9e15} → 200; analityka pokazała potem 1,1e16
 *
 * Najgroźniejsza jest ta druga. `vat_odliczenie_procent` to pole o skutku
 * podatkowym: właściciel oznacza koszt reprezentacyjny jako „0% — nie odliczam
 * VAT-u", a śmieciowy zapis po cichu przestawia go na „100% — odliczam
 * całość", czyli dokładnie na wartość najkorzystniejszą i najtrudniejszą do
 * obrony przy kontroli. W interfejsie wygląda to na świadomy wybór.
 *
 * Dlatego bramka stoi w TRASIE, nie w formularzu — formularz wysyła tylko to,
 * co sam narysował, a apka, import KSeF i OCR wysyłają, co chcą.
 */

/** Sufit kwoty — bariera absurdu, nie limit biznesowy (patrz sonda: 9e15
 * przechodziło i zatruwało wykres wszystkich kategorii naraz). */
export const MAX_KWOTA_KOSZTU = 100_000_000;

/** Sufit kursu. Najsłabsza realna waluta świata ma do PLN kurs rzędu setnych;
 * najmocniejsze — kilkunastu. Tysiąc to z ogromnym zapasem „ktoś się pomylił
 * o rzędy wielkości albo wpisał kwotę zamiast kursu". */
export const MAX_KURS = 1000;

export type PolaKosztu = {
  dostawca_nazwa: string;
  dostawca_nip: string;
  dostawca_konto: string;
  numer_faktury: string;
  kategoria: CostCategory;
  opis: string;
  kwota_netto: number;
  vat_stawka: VatRate;
  waluta: Waluta;
  kurs_pln: number | null;
  status: CostStatus;
  metoda_platnosci: PaymentMethod | null;
  vat_odliczenie_procent: number;
  data_wydatku: string | null;
  data_wplywu: string | null;
  termin_platnosci: string | null;
  data_platnosci: string | null;
};

type WynikPol<T> = { pola: T; blad?: undefined } | { pola?: undefined; blad: string };

/** Kwota: śmieć → błąd, NIE ciche zero.
 *
 * Ujemna przechodzi ŚWIADOMIE: faktura korygująca od dostawcy („korekta
 * w minus", zwrot towaru, rabat potransakcyjny) jest realnym dokumentem
 * zakupowym i musi dać się zapisać. Zatruta analityka z sondy brała się
 * z RZĘDU WIELKOŚCI (9e15), nie ze znaku — i to sufit odcina. */
function kwota(v: unknown, etykieta: string): number | string {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", ".").trim());
  if (!Number.isFinite(n)) return `${etykieta}: „${String(v).slice(0, 30)}" to nie jest liczba.`;
  if (Math.abs(n) > MAX_KWOTA_KOSZTU) return `${etykieta} przekracza rozsądny sufit (100 mln).`;
  return n;
}

/** Data opcjonalna: pusto → `null`, śmieć → błąd. Rok spoza 2000–2100 jest
 * śmieciem — to pułapka `<input type="date">` z CLAUDE.md („0202" zamiast
 * „2026", gdy pole straci fokus w trakcie pisania).
 *
 * Zwraca obiekt, a nie sam string: poprawna data i komunikat błędu są OBIE
 * typu `string`, więc rozróżnianie ich po typie działałoby tylko dopóty,
 * dopóki komunikat nie wygląda jak data. */
type WynikDaty = { ok: true; v: string | null } | { ok: false; blad: string };

function data(v: unknown, etykieta: string): WynikDaty {
  if (v == null) return { ok: true, v: null };
  if (typeof v !== "string") return { ok: false, blad: `${etykieta}: nieczytelna data.` };
  const t = v.trim().slice(0, 10);
  if (!t) return { ok: true, v: null };
  if (!isPlausibleDateString(t)) return { ok: false, blad: `${etykieta}: „${t}” to nie jest poprawna data.` };
  return { ok: true, v: t };
}

/** Odczyt daty z ciała żądania albo z istniejącego rekordu (częściowy PATCH). */
function dataPola(
  ma: (k: string) => boolean,
  body: Record<string, unknown>,
  klucz: string,
  etykieta: string,
  poprzednia: string | null | undefined
): WynikDaty {
  if (!ma(klucz)) return { ok: true, v: poprzednia ?? null };
  return data(body[klucz], etykieta);
}

/**
 * Czyta i WALIDUJE pola kosztu — jedno miejsce dla `POST` i `PATCH`.
 *
 * `istniejacy` (tylko przy `PATCH`) daje prawdziwą częściowość: **klucza nie
 * ma w ciele → pole zostaje takie, jakie było**. Sonda potwierdziła, że stary
 * `PATCH` kosztu był pod tym względem poprawny (w odróżnieniu od Katalogu)
 * i ta własność ma taka zostać — dlatego jest tu testem, a nie założeniem.
 */
export function czytajPolaKosztu(
  body: Record<string, unknown>,
  istniejacy?: Partial<PolaKosztu>
): WynikPol<PolaKosztu> {
  const ma = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const tekst = (k: string, limit: number): string =>
    ma(k)
      ? typeof body[k] === "string"
        ? (body[k] as string).slice(0, limit)
        : ""
      : ((istniejacy?.[k as keyof PolaKosztu] as string) ?? "");

  const kategoria = ma("kategoria") ? zeSlownika(COST_CATEGORIES, body.kategoria) : (istniejacy?.kategoria ?? "Inne");
  if (!kategoria) return { blad: `Nieznana kategoria kosztu. Dozwolone: ${COST_CATEGORIES.join(", ")}.` };

  const vat = ma("vat_stawka") ? zeSlownika(VAT_RATES, body.vat_stawka) : (istniejacy?.vat_stawka ?? "23");
  if (!vat) return { blad: `Nieznana stawka VAT. Dozwolone: ${VAT_RATES.join(", ")}.` };

  const status = ma("status") ? zeSlownika(COST_STATUSES, body.status) : (istniejacy?.status ?? "Nieopłacony");
  if (!status) return { blad: `Nieznany status kosztu. Dozwolone: ${COST_STATUSES.join(", ")}.` };

  // Metoda płatności ma dozwoloną PUSTKĘ (nie każdy koszt jest już zapłacony),
  // więc `null`/"" to poprawna wartość — ale „karat" zamiast „karta" już nie.
  let metoda: PaymentMethod | null;
  if (ma("metoda_platnosci")) {
    const surowa = body.metoda_platnosci;
    if (surowa == null || surowa === "") metoda = null;
    else {
      const m = zeSlownika(PAYMENT_METHODS, surowa);
      if (!m) return { blad: `Nieznana metoda płatności. Dozwolone: ${PAYMENT_METHODS.join(", ")}.` };
      metoda = m;
    }
  } else metoda = istniejacy?.metoda_platnosci ?? null;

  const waluta = ma("waluta")
    ? isWaluta(body.waluta)
      ? (String(body.waluta).trim() as Waluta)
      : null
    : (istniejacy?.waluta ?? DOMYSLNA_WALUTA);
  if (!waluta) return { blad: `Nieznana waluta. Dozwolone: ${WALUTY.join(", ")}.` };

  // Odliczenie VAT — pole o skutku podatkowym, więc śmieć NIE ma prawa
  // zamienić się w najkorzystniejszą wartość (patrz nagłówek sekcji).
  let odliczenie: number;
  if (ma("vat_odliczenie_procent")) {
    const n = Number(body.vat_odliczenie_procent);
    if (!(VAT_ODLICZENIE_OPTIONS as readonly number[]).includes(n))
      return { blad: `Procent odliczenia VAT może wynosić ${VAT_ODLICZENIE_OPTIONS.join(", ")} — nie „${String(body.vat_odliczenie_procent).slice(0, 20)}”.` };
    odliczenie = n;
  } else odliczenie = istniejacy?.vat_odliczenie_procent ?? 100;

  const netto = ma("kwota_netto") ? kwota(body.kwota_netto, "Kwota netto") : (istniejacy?.kwota_netto ?? 0);
  if (typeof netto === "string") return { blad: netto };

  // Kurs: wymagany dla każdej waluty innej niż PLN i ZAKAZANY dla PLN.
  // Podstawienie jedynki przy EUR byłoby cichym błędem o rząd wielkości.
  //
  // Jeden wyjątek: koszt, który PRZYSZEDŁ już bez kursu (import z KSeF oddaje
  // walutę faktury, ale nie zawsze kurs) i którego waluty ani kursu to żądanie
  // nie dotyka. Inaczej bramka zamurowałaby taki rekord — nie dałoby się przy
  // nim zmienić nawet kategorii ani powiązania, dopóki właściciel nie wpisze
  // kursu. Taki koszt jest widoczny jako niekompletny i NIE wchodzi do sum
  // (patrz `maPrzelicznik`), więc nie kłamie po cichu.
  let kurs: number | null;
  const dotykaWaluty = ma("waluta") || ma("kurs_pln");
  if (waluta === DOMYSLNA_WALUTA) kurs = null;
  else if (!dotykaWaluty && istniejacy?.kurs_pln == null) kurs = null;
  else {
    const surowy = ma("kurs_pln") ? body.kurs_pln : istniejacy?.kurs_pln;
    const n = typeof surowy === "number" ? surowy : Number(String(surowy ?? "").replace(",", ".").trim());
    if (!Number.isFinite(n) || n <= 0)
      return { blad: `Koszt w walucie ${waluta} wymaga kursu do PLN (kurs z dnia poprzedzającego wystawienie faktury).` };
    if (n > MAX_KURS) return { blad: `Kurs ${n} jest nierealny — sprawdź, czy nie wpisano kwoty zamiast kursu.` };
    kurs = n;
  }

  const dWydatku = dataPola(ma, body, "data_wydatku", "Data wydatku", istniejacy?.data_wydatku);
  if (!dWydatku.ok) return { blad: dWydatku.blad };
  const dWplywu = dataPola(ma, body, "data_wplywu", "Data wpływu", istniejacy?.data_wplywu);
  if (!dWplywu.ok) return { blad: dWplywu.blad };
  const dTermin = dataPola(ma, body, "termin_platnosci", "Termin płatności", istniejacy?.termin_platnosci);
  if (!dTermin.ok) return { blad: dTermin.blad };
  const dPlatnosci = dataPola(ma, body, "data_platnosci", "Data zapłaty", istniejacy?.data_platnosci);
  if (!dPlatnosci.ok) return { blad: dPlatnosci.blad };

  return {
    pola: {
      dostawca_nazwa: tekst("dostawca_nazwa", 300),
      dostawca_nip: tekst("dostawca_nip", 30),
      dostawca_konto: tekst("dostawca_konto", 40),
      numer_faktury: tekst("numer_faktury", 100),
      kategoria,
      opis: tekst("opis", 2000),
      kwota_netto: netto,
      vat_stawka: vat,
      waluta,
      kurs_pln: kurs,
      status,
      metoda_platnosci: metoda,
      vat_odliczenie_procent: odliczenie,
      data_wydatku: dWydatku.v,
      data_wplywu: dWplywu.v,
      termin_platnosci: dTermin.v,
      data_platnosci: dPlatnosci.v,
    },
  };
}

/**
 * Odporność po stronie ODCZYTU — osobno od bramki zapisu, bo bramka nie
 * naprawia tego, co już siedzi w bazie (lekcja 3 briefu). Wiersze zapisane
 * przed tym modułem mają w słownikach dowolne śmieci; każdy z nich musi dać
 * się bezpiecznie pokazać. Nieznana waluta czyta się jako PLN — bo dokładnie
 * to znaczyły wszystkie wiersze sprzed Modułu 63, a `formatMoney` na nieznanym
 * kodzie RZUCA i wywala cały ekran w error boundary, nie jeden wiersz.
 */
export function normalizeCostRow(r: Record<string, unknown>): Record<string, unknown> {
  const liczba = (v: unknown, domyslnie: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : domyslnie;
  };
  const kurs = Number(r.kurs_pln);
  return {
    ...r,
    kategoria: zeSlownika(COST_CATEGORIES, r.kategoria) ?? "Inne",
    vat_stawka: zeSlownika(VAT_RATES, r.vat_stawka) ?? "23",
    status: zeSlownika(COST_STATUSES, r.status) ?? "Nieopłacony",
    metoda_platnosci: zeSlownika(PAYMENT_METHODS, r.metoda_platnosci),
    waluta: isWaluta(r.waluta) ? String(r.waluta).trim() : DOMYSLNA_WALUTA,
    kurs_pln: Number.isFinite(kurs) && kurs > 0 ? kurs : null,
    kwota_netto: liczba(r.kwota_netto, 0),
    kwota_brutto: liczba(r.kwota_brutto, 0),
    vat_odliczenie_procent: (VAT_ODLICZENIE_OPTIONS as readonly number[]).includes(liczba(r.vat_odliczenie_procent, 100))
      ? liczba(r.vat_odliczenie_procent, 100)
      : 100,
  };
}

/** Bramka zapisu szablonu cyklicznego. Osobna od `czytajPolaKosztu`, bo
 * szablon ma inne pola (nazwa, cykl, `next_run`) i NIE ma kursu — patrz
 * komentarz przy `RecurringCost.waluta`. */
export type PolaCyklu = {
  nazwa: string;
  dostawca_nazwa: string;
  dostawca_nip: string;
  dostawca_konto: string;
  kategoria: CostCategory;
  opis: string;
  kwota_netto: number;
  vat_stawka: VatRate;
  waluta: Waluta;
  metoda_platnosci: PaymentMethod | null;
  cykl: RecurringCycle;
  next_run: string;
  active: boolean;
};

export function czytajPolaCyklu(
  body: Record<string, unknown>,
  istniejacy?: Partial<PolaCyklu>
): WynikPol<PolaCyklu> {
  const ma = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const tekst = (k: string, limit: number): string =>
    ma(k)
      ? typeof body[k] === "string"
        ? (body[k] as string).slice(0, limit)
        : ""
      : ((istniejacy?.[k as keyof PolaCyklu] as string) ?? "");

  const nazwa = (ma("nazwa") ? String(body.nazwa ?? "") : (istniejacy?.nazwa ?? "")).trim().slice(0, 200);
  if (!nazwa) return { blad: "Podaj nazwę szablonu (np. „Hosting — Vercel Pro”)." };

  const kategoria = ma("kategoria") ? zeSlownika(COST_CATEGORIES, body.kategoria) : (istniejacy?.kategoria ?? "Subskrypcje");
  if (!kategoria) return { blad: `Nieznana kategoria kosztu. Dozwolone: ${COST_CATEGORIES.join(", ")}.` };

  const vat = ma("vat_stawka") ? zeSlownika(VAT_RATES, body.vat_stawka) : (istniejacy?.vat_stawka ?? "23");
  if (!vat) return { blad: `Nieznana stawka VAT. Dozwolone: ${VAT_RATES.join(", ")}.` };

  const cykl = ma("cykl") ? zeSlownika(RECURRING_CYCLES, body.cykl) : (istniejacy?.cykl ?? "miesiecznie");
  if (!cykl) return { blad: `Nieznany cykl. Dozwolone: ${RECURRING_CYCLES.join(", ")}.` };

  const waluta = ma("waluta")
    ? isWaluta(body.waluta)
      ? (String(body.waluta).trim() as Waluta)
      : null
    : (istniejacy?.waluta ?? DOMYSLNA_WALUTA);
  if (!waluta) return { blad: `Nieznana waluta. Dozwolone: ${WALUTY.join(", ")}.` };

  let metoda: PaymentMethod | null;
  if (ma("metoda_platnosci")) {
    const surowa = body.metoda_platnosci;
    if (surowa == null || surowa === "") metoda = null;
    else {
      const m = zeSlownika(PAYMENT_METHODS, surowa);
      if (!m) return { blad: `Nieznana metoda płatności. Dozwolone: ${PAYMENT_METHODS.join(", ")}.` };
      metoda = m;
    }
  } else metoda = istniejacy?.metoda_platnosci ?? null;

  const netto = ma("kwota_netto") ? kwota(body.kwota_netto, "Kwota netto") : (istniejacy?.kwota_netto ?? 0);
  if (typeof netto === "string") return { blad: netto };

  // `next_run` steruje AUTOMATEM: dzienny raport tworzy z tego szkic kosztu.
  // Rok „0202" przechodził tu dosłownie — szablon, który nigdy nie odpali.
  const nextRun = dataPola(ma, body, "next_run", "Data następnego wystąpienia", istniejacy?.next_run);
  if (!nextRun.ok) return { blad: nextRun.blad };
  if (!nextRun.v) return { blad: "Podaj datę następnego wystąpienia." };

  return {
    pola: {
      nazwa,
      dostawca_nazwa: tekst("dostawca_nazwa", 300),
      dostawca_nip: tekst("dostawca_nip", 30),
      dostawca_konto: tekst("dostawca_konto", 40),
      kategoria,
      opis: tekst("opis", 2000),
      kwota_netto: netto,
      vat_stawka: vat,
      waluta,
      metoda_platnosci: metoda,
      cykl,
      next_run: nextRun.v,
      active: ma("active") ? Boolean(body.active) : (istniejacy?.active ?? true),
    },
  };
}
