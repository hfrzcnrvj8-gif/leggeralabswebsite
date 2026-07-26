// Czysta logika modułu Ofert — bez "use client", re-używana przez UI i
// serwerowe route'y. Wzorowane na lib/invoices.ts: lead → oferta (pozycje,
// kwota, ważność) → akceptacja tworzy projekt (z szablonu) + fakturę.
// Świadomie bez VAT na pozycjach — oferta to kwota netto/ogólna, VAT
// pojawia się dopiero na fakturze po akceptacji.

import { type DocLang, DOC_LANGS, DOC_LANG_LABEL, clientAddressLines as sharedClientAddressLines, documentYear } from "./documents";
import { todayLocalISO, parsePgTimestamp } from "./dates";
import { round2 } from "./invoices";

/** Język wydruku oferty — jak w fakturach (lib/invoices.ts), niezależny od
 * języka panelu. Typ i lista dzielone przez lib/documents.ts. */
export type OfferLang = DocLang;
export const OFFER_LANGS = DOC_LANGS;
export const OFFER_LANG_LABEL = DOC_LANG_LABEL;

export type OfferStatus = "Szkic" | "Wysłana" | "Zaakceptowana" | "Odrzucona" | "Wygasła";
export const OFFER_STATUSES: OfferStatus[] = ["Szkic", "Wysłana", "Zaakceptowana", "Odrzucona", "Wygasła"];

/** Czy `v` to znany status oferty. Trasa PATCH przyjmowała wcześniej DOWOLNY
 * string do 40 znaków — literówka w statusie („Wyslana") przechodziła cicho,
 * a potem wypadała ze wszystkich liczników naraz: `weightedOfferValue` liczyło
 * ją z wagą 1 (fallback), pigułka na liście traciła kolor (brak wpisu w
 * OFFER_STATUS_CLASS), a filtr statusu jej nie pokazywał. */
export function isOfferStatus(v: unknown): v is OfferStatus {
  return typeof v === "string" && (OFFER_STATUSES as string[]).includes(v);
}

/** Waluta oferty — ten sam zestaw co na fakturze (`lib/invoices.ts`), bo po
 * akceptacji oferta przepisuje się wprost na fakturę. Do tego modułu oferta
 * waluty nie miała w ogóle: dokument był trójjęzyczny (PL/EN/DE), ale wydruk
 * liczył zawsze w złotówkach, więc oferta po niemiecku pokazywała „6.000,00 zł". */
export const OFFER_CURRENCIES = ["PLN", "EUR", "USD", "GBP"] as const;
export type OfferCurrency = (typeof OFFER_CURRENCIES)[number];
export const DEFAULT_OFFER_CURRENCY: OfferCurrency = "PLN";

export function isOfferCurrency(v: unknown): v is OfferCurrency {
  return typeof v === "string" && (OFFER_CURRENCIES as readonly string[]).includes(v);
}

/** Powody odrzucenia oferty — krótka, ZAMKNIĘTA lista (decyzja właściciela
 * 2026-07-26), żeby dało się kiedyś policzyć, na czym realnie przegrywamy.
 * „Inny powód" zostawia miejsce na zdanie własnymi słowami; sam komentarz
 * można dopisać do każdego z powodów. */
export const OFFER_REJECT_REASONS = [
  "Za drogo",
  "Nie ten termin",
  "Wybrali kogoś innego",
  "Brak decyzji / ucichło",
  "Inny powód",
] as const;
export type OfferRejectReason = (typeof OFFER_REJECT_REASONS)[number];

export function isOfferRejectReason(v: unknown): v is OfferRejectReason {
  return typeof v === "string" && (OFFER_REJECT_REASONS as readonly string[]).includes(v);
}

/** Powód odrzucenia jednym zdaniem — do osi czasu klienta i profilu oferty. */
export function rejectReasonLabel(powod: string, komentarz: string): string {
  const p = powod.trim();
  const k = komentarz.trim();
  if (!p && !k) return "";
  if (!k) return p;
  if (!p) return k;
  return `${p} — ${k}`;
}

export const OFFER_STATUS_CLASS: Record<string, string> = {
  Szkic: "bg-[var(--hairline)] text-muted",
  Wysłana: "bg-brand-cyan/15 text-brand-cyan",
  Zaakceptowana: "bg-emerald-500/20 text-emerald-400 font-semibold",
  Odrzucona: "bg-red-500/15 text-red-400",
  Wygasła: "bg-[var(--hairline)] text-muted opacity-70",
};

export type OfferItem = {
  id: string;
  offer_id: string;
  nazwa: string;
  ilosc: number;
  jednostka: string;
  cena: number;
  position: number;
  /** Pozycja „do wyboru" — klient odhacza ją sam na publicznej stronie
   * (runda 2 Modułu 57, wzorem PandaDoc/Qwilr). Pozwala sprzedać wariant bez
   * pisania drugiej oferty. */
  opcjonalna: boolean;
  /** Decyzja KLIENTA co do pozycji opcjonalnej. Dla pozycji obowiązkowych
   * bez znaczenia — liczy się zawsze. */
  wybrana: boolean;
};

/** Czy pozycja wchodzi do kwoty: obowiązkowa zawsze, opcjonalna tylko
 * zaznaczona. Jedno miejsce, bo tę samą regułę stosują cztery ekrany
 * (edytor, lista, wydruk, publiczna strona) i faktura po akceptacji. */
export function itemLiczySie(it: Pick<OfferItem, "opcjonalna" | "wybrana">): boolean {
  return !it.opcjonalna || it.wybrana;
}

/** Blok treści oferty (runda 2 Modułu 57) — „Kontekst", „Zakres prac",
 * „Harmonogram", „Warunki". Osobno od `uwagi`, które zostają krótką notką pod
 * kwotą; to jest treść, przez którą klient czyta ofertę zanim spojrzy na
 * cenę. */
export type OfferSection = {
  id: string;
  offer_id: string;
  tytul: string;
  tresc: string;
  position: number;
};

/** Gotowe bloki treści do wstawienia jednym kliknięciem (runda 2 Modułu 57).
 * Treść jest PUNKTEM STARTOWYM do przepisania pod konkretnego klienta — dlatego
 * krótka i konkretna, a nie „lorem ipsum" ani marketingowa laurka. Kolejność
 * odpowiada temu, jak czyta się ofertę: co rozumiem z Twojej sytuacji → co
 * zrobię → kiedy → na jakich warunkach. */
export const SEKCJE_STARTOWE: { tytul: string; tresc: string }[] = [
  {
    tytul: "Kontekst",
    tresc:
      "Z naszej rozmowy rozumiem, że [opisz sytuację klienta jego słowami — co dziś zajmuje czas, co się gubi, gdzie boli]. Ta oferta odpowiada na ten problem, nie na wszystko naraz.",
  },
  {
    tytul: "Zakres prac",
    tresc:
      "Co robię:\n• [krok pierwszy]\n• [krok drugi]\n• [krok trzeci]\n\nCzego ta oferta NIE obejmuje: [wypisz wprost — to skraca późniejsze nieporozumienia bardziej niż jakikolwiek zapis w umowie].",
  },
  {
    tytul: "Jak to przebiega",
    tresc:
      "1. Start — ustalamy dostępy i osobę kontaktową po Państwa stronie.\n2. Praca — pokazuję działający fragment, zanim zrobię całość.\n3. Odbiór — wspólne sprawdzenie na Państwa danych.\n4. Po wdrożeniu — [wsparcie / szkolenie / przekazanie dokumentacji].",
  },
  {
    tytul: "Terminy",
    tresc: "Realizacja zajmuje ok. [X tygodni] od akceptacji oferty i przekazania dostępów.",
  },
  {
    tytul: "Warunki",
    tresc:
      "Płatność: [np. 50% zaliczki, 50% po odbiorze].\nOferta jest ważna do daty podanej wyżej.\nOferta nie stanowi umowy — po akceptacji przygotowuję umowę do podpisu.",
  },
  {
    tytul: "Dlaczego ja",
    tresc:
      "[Jedno–dwa zdania konkretu: co dokładnie zrobiłeś podobnego i z jakim efektem. Bez przymiotników — liczby i fakty przekonują, deklaracje nie.]",
  },
];

export type Offer = {
  id: string;
  tytul: string;
  lead_id: string | null;
  /** Podpięty klient (patrz lib/clients.ts) — ustawiany automatycznie przy
   * tworzeniu pierwszej oferty dla leada. */
  client_id: string | null;
  project_id: string | null;
  invoice_id: string | null;
  klient_nazwa: string;
  klient_nip: string;
  /** @deprecated jedno pole adresowe sprzed rozbicia na ulicę/kod/miasto/kraj
   * — trzymane tylko dla wstecznej zgodności ze starszymi ofertami (fallback
   * w wydruku, gdy pola strukturalne są puste). Nowe oferty go nie używają. */
  klient_adres: string;
  klient_ulica: string;
  klient_kod: string;
  klient_miasto: string;
  klient_kraj: string;
  klient_email: string;
  share_token: string | null;
  /** Moduł 40 — ręczne unieważnienie publicznego linku. Token ZOSTAJE
   * w wierszu (patrz lib/shareLinks.ts); to pole decyduje o dostępie. */
  share_revoked_at: string | null;
  wazna_do: string | null;
  status: OfferStatus;
  jezyk: OfferLang;
  waluta: OfferCurrency;
  uwagi: string;
  /** Dlaczego klient powiedział „nie" — jeden z `OFFER_REJECT_REASONS`
   * (puste, dopóki oferta nie jest odrzucona) + własny komentarz. */
  powod_odrzucenia: string;
  komentarz_odrzucenia: string;
  odrzucona_at: string | null;
  /** Ślad otwarcia publicznego linku przez klienta (runda 2 Modułu 57) —
   * bez IP i bez identyfikacji osoby, patrz migracja w lib/db.ts. */
  otwarta_at: string | null;
  ostatnio_otwarta_at: string | null;
  liczba_otwarc: number;
  /** Znacznik ostatniej wysyłki i ostatniego przypomnienia — z nich liczy się
   * cisza po stronie klienta (patrz isOfferStale). */
  wyslana_at: string | null;
  przypomniano_at: string | null;
  /** Wersjonowanie (runda 2 Modułu 57): `parent_offer_id` wskazuje ofertę,
   * z której ta powstała, `superseded_at` oznacza ofertę ZASTĄPIONĄ nowszą
   * wersją — taka nie liczy się do skuteczności ani do pipeline'u, bo nie
   * jest ani wygrana, ani przegrana. */
  parent_offer_id: string | null;
  wersja: number;
  superseded_at: string | null;
  /** E-podpis akceptacji (Faza I) — patrz lib/offerAccept.ts. Puste
   * accepted_by_name = zaakceptowano ręcznie w panelu, nie przez klienta. */
  accepted_at: string | null;
  accepted_by_name: string | null;
  accepted_ip: string | null;
  accepted_user_agent: string | null;
  created_at: string;
  updated_at: string;
};

export function itemKwota(it: { ilosc: number; cena: number }): number {
  return round2(it.ilosc * it.cena);
}

/** Suma kwoty oferty (bez VAT — patrz komentarz na górze pliku).
 *
 * Pozycje opcjonalne wchodzą TYLKO zaznaczone. Starsze wywołania podają
 * pozycje bez tych pól — wtedy `itemLiczySie` traktuje je jak obowiązkowe,
 * czyli dokładnie jak przed tą zmianą. */
export function offerTotal(items: { ilosc: number; cena: number; opcjonalna?: boolean; wybrana?: boolean }[]): number {
  return round2(
    items
      .filter((it) => itemLiczySie({ opcjonalna: !!it.opcjonalna, wybrana: !!it.wybrana }))
      .reduce((sum, it) => sum + itemKwota(it), 0)
  );
}

/** Suma samych pozycji opcjonalnych NIEzaznaczonych — „ile jeszcze można
 * dołożyć". Do pokazania obok kwoty, żeby było widać potencjał oferty. */
export function offerOptionalRest(items: { ilosc: number; cena: number; opcjonalna?: boolean; wybrana?: boolean }[]): number {
  return round2(
    items.filter((it) => it.opcjonalna && !it.wybrana).reduce((sum, it) => sum + itemKwota(it), 0)
  );
}

/** Statusy zamknięte — oferta w jednym z nich nie jest już "w grze" (ani do
 * licznika przeterminowania, ani do pipeline'u). Eksportowane, żeby
 * app/api/hub/today/route.ts nie trzymał własnej zduplikowanej kopii. */
export const CLOSED_OFFER_STATUSES = new Set<OfferStatus>(["Zaakceptowana", "Odrzucona", "Wygasła"]);

/** Czy oferta przeterminowała się (minęła ważność, a status wciąż otwarty). */
export function isOfferExpired(offer: Pick<Offer, "status" | "wazna_do">): boolean {
  if (CLOSED_OFFER_STATUSES.has(offer.status)) return false;
  if (!offer.wazna_do) return false;
  return offer.wazna_do < todayLocalISO();
}

/** Szacunkowe prawdopodobieństwo zamknięcia wg statusu — do ważonego
 * pipeline'u. Świadomie statyczne (bez AI/danych historycznych, panel
 * dopiero startuje) — łatwo skorygować tu jedną liczbę, gdy będzie więcej
 * danych o realnej konwersji. Zamknięte statusy nie mają wpisu — nie
 * wchodzą do pipeline'u w ogóle (patrz weightedOfferValue). */
export const OFFER_STATUS_WEIGHT: Partial<Record<OfferStatus, number>> = {
  Szkic: 0.2,
  Wysłana: 0.5,
};

/** Wartość oferty do ważonego pipeline'u: 0 dla zamkniętych, kwota × waga
 * statusu dla otwartych (domyślnie waga 1, gdyby pojawił się status bez
 * wpisu w mapie — bezpieczny fallback zamiast cichego zera). `kwota` nie
 * jest polem `Offer` (liczona w SQL z JOIN na offer_items), stąd osobny
 * parametr zamiast Pick<Offer, ...>. */
export function weightedOfferValue(status: OfferStatus, kwota: number): number {
  if (CLOSED_OFFER_STATUSES.has(status)) return 0;
  return kwota * (OFFER_STATUS_WEIGHT[status] ?? 1);
}

/** Czy oferta w ogóle wchodzi do liczników. Zastąpiona nowszą wersją nie —
 * inaczej jedna rozmowa handlowa liczyłaby się dwa razy (raz jako wersja 1,
 * raz jako 2), a skuteczność spadałaby przy każdej poprawce zakresu. */
export function offerLiczySieDoStatystyk(o: Pick<Offer, "superseded_at">): boolean {
  return !o.superseded_at;
}

/** Gotowe okresy ważności oferty (dni od dziś) — 7 dni to „decyzja w tym
 * tygodniu", 14 to standard przy większym wdrożeniu, 30 przy budżecie, który
 * musi przejść przez czyjeś biurko. */
export const WAZNOSC_SKROTY = [7, 14, 30] as const;

/** Po ilu dniach ciszy od wysyłki oferta trafia na Pulpit jako „warto
 * przypomnieć". Pięć dni roboczo-kalendarzowych: krócej to nachalność, dłużej
 * i oferta zdąży wyjść klientowi z głowy. Bliźniak `CONTRACT_STALE_DAYS`
 * (tam 7 — umowa po akceptacji ma inny rytm niż oferta w negocjacji). */
export const OFFER_STALE_DAYS = 5;

/** Ile dni ciszy od wysłania oferty — `null`, gdy pytanie nie ma sensu
 * (szkic, oferta zamknięta, brak znacznika wysyłki). */
export function offerSilenceDays(
  o: Pick<Offer, "status" | "wyslana_at">,
  now: number = Date.now()
): number | null {
  if (o.status !== "Wysłana") return null;
  // `parsePgTimestamp`, NIE `new Date()` — ta funkcja liczy się także
  // w przeglądarce (Pulpit, apka), a Postgres oddaje „2026-07-26 19:12+01".
  const wyslana = parsePgTimestamp(o.wyslana_at);
  if (!wyslana) return null;
  const days = Math.floor((now - wyslana.getTime()) / 86_400_000);
  return days < 0 ? 0 : days;
}

/** Czy oferta czeka na decyzję na tyle długo, żeby zaproponować przypomnienie.
 *
 * Po wysłaniu przypomnienia (`przypomniano_at`) oferta ZNIKA z listy i nie
 * wraca — dopiero ponowna wysyłka zeruje znacznik. Świadomie: druga i trzecia
 * prośba o to samo w tydzień to już nagabywanie klienta, a Pulpit, który
 * pokazuje coś, czego nie da się odhaczyć, uczy ignorowania Pulpitu. */
export function isOfferStale(
  o: Pick<Offer, "status" | "wyslana_at" | "przypomniano_at">,
  now: number = Date.now()
): boolean {
  if (o.przypomniano_at) return false;
  const days = offerSilenceDays(o, now);
  return days != null && days >= OFFER_STALE_DAYS;
}

/** Adres klienta jako linie do wydruku (patrz lib/documents.ts). */
export function clientAddressLines(
  offer: Pick<Offer, "klient_ulica" | "klient_kod" | "klient_miasto" | "klient_kraj" | "klient_adres">
): string[] {
  return sharedClientAddressLines(offer);
}

/** Referencja oferty do wydruku (np. "OF-2026-A1B2C3") — oferty nie mają
 * formalnej numeracji fiskalnej jak faktury (nie podlegają przepisom o
 * numeracji VAT), więc wystarczy stabilny identyfikator liczony z daty
 * utworzenia i ID, bez osobnej kolumny/migracji w bazie. */
export function offerReference(offer: Pick<Offer, "id" | "created_at">): string {
  return `OF-${documentYear(offer.created_at)}-${offer.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
