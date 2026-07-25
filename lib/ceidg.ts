/**
 * Klient Hurtowni danych CEIDG (API v3) — „Łowca leadów", Moduł 52.
 * Server-only. Zero AI, zero zewnętrznych bibliotek.
 *
 * ── LIMITY, KTÓRE TRZEBA SZANOWAĆ ────────────────────────────────────────
 * Dokumentacja integratora (wersja 1.0, 2024-10-21) daje **50 żądań / 3 min
 * ORAZ 1000 żądań / 60 min**. Przekroczenie = **180 s blokady liczonej od
 * OSTATNIEGO żądania** — czyli dobijanie w trakcie blokady przedłuża ją w
 * nieskończoność. Zalecany stały odstęp: 3,6 s.
 *
 * ── DLACZEGO LICZNIK JEST W BAZIE ────────────────────────────────────────
 * Vercel ubija instancję funkcji między wywołaniami. Licznik w pamięci
 * procesu po zimnym starcie zaczynałby od zera i wchodziłby prosto w blokadę,
 * a objawem byłoby „łowca nic nie znajduje" bez śladu przyczyny. Każde
 * żądanie zapisuje więc wiersz w `ceidg_requests` (tabela w
 * `ensureLeadHunterSchema()`), a limit liczy się zapytaniem po oknie czasu —
 * ta sama filozofia co hamulec logowania w `lib/rateLimit.ts`.
 *
 * ── CZEGO TU NIE MA ──────────────────────────────────────────────────────
 * Spółek z o.o. CEIDG obejmuje **wyłącznie jednoosobowe działalności**; KRS
 * ma osobne, darmowe API, ale wyszukuje po numerze KRS, nie po branży, więc
 * spółek tą drogą przesiać się nie da. Dla segmentu docelowego (biura
 * rachunkowe, kancelarie, gabinety, nieruchomości) JDG to i tak większość
 * rynku. Spółki zostają przy OSM, poleceniu i ręcznym dodaniu.
 */

import { randomUUID } from "node:crypto";
import { getSql, ensureLeadHunterSchema } from "./db";

/* ────────────────────────── konfiguracja ────────────────────────── */

/** Odstęp między żądaniami. 3,6 s to zalecenie z dokumentacji: 50 żądań ×
 * 3,6 s = 180 s, czyli dokładnie okno limitu. Dokładamy 200 ms marginesu —
 * przy równych 3,6 s pięćdziesiąte żądanie ląduje CO DO SEKUNDY na granicy,
 * a granica po stronie CEIDG kosztuje 180 s blokady. */
export const ODSTEP_MS = 3800;

/** Twarde okna z dokumentacji. */
export const LIMIT_KROTKI = { zadania: 50, oknoSek: 180 };
export const LIMIT_DLUGI = { zadania: 1000, oknoSek: 3600 };

/** Ile wierszy licznika trzymamy. Do limitu wystarcza godzina; resztę kasujemy,
 * żeby tabela nie rosła w nieskończoność (wzorem `rate_limit_hits`). */
const RETENCJA_GODZIN = 2;

function bazowyAdres(): string {
  // Środowisko testowe ma tę samą ścieżkę i osobny token — do pierwszego
  // przejazdu bez zużywania limitu produkcyjnego. Przełącznik jawny, bo
  // pomyłka w drugą stronę (test zamiast produkcji) daje puste wyniki bez
  // żadnego błędu.
  return process.env.CEIDG_ENV === "test"
    ? "https://test-dane.biznes.gov.pl/api/ceidg/v3"
    : "https://dane.biznes.gov.pl/api/ceidg/v3";
}

/** Czy token w ogóle jest. Bez niego cały potok E1/E2 nie ma jak zapytać
 * rejestru — panel ma to POWIEDZIEĆ wprost, a nie udawać pustego wyniku. */
export function ceidgSkonfigurowany(): boolean {
  return Boolean(process.env.CEIDG_TOKEN);
}

/** Które środowisko jest ustawione — do pokazania w panelu, żeby „nic nie
 * znajduje" dało się odróżnić od „siedzisz na bazie testowej". */
export function ceidgSrodowisko(): "test" | "produkcja" {
  return process.env.CEIDG_ENV === "test" ? "test" : "produkcja";
}

/* ────────────────────────── typy odpowiedzi ────────────────────────── */

export type CeidgFirmaSkrot = {
  /** Identyfikator wpisu w CEIDG (do pobrania szczegółów, gdy brak NIP-u). */
  id: string;
  nazwa: string;
  nip: string;
  regon: string;
  ulica: string;
  kod: string;
  miasto: string;
  wojewodztwo: string;
  dataRozpoczecia: string;
  status: string;
  /** Gotowy odnośnik do szczegółów podany przez rejestr (gdy jest — używamy
   * go zamiast składania URL-a samodzielnie). */
  link: string;
};

export type CeidgFirmaSzczegoly = {
  telefon: string;
  email: string;
  www: string;
  pkdGlowny: string;
  pkd: string[];
  liczbaAdresow: number;
  upadlosc: boolean;
  zakaz: boolean;
  status: string;
  dataRozpoczecia: string;
};

/** Dlaczego zapytanie się nie udało — potok reaguje inaczej na każdy z tych
 * przypadków (brak tokenu = stop na zawsze, limit = stop do jutra, błąd
 * jednej firmy = idziemy dalej). */
export type CeidgBlad =
  | { rodzaj: "brak_tokenu" }
  | { rodzaj: "limit"; zaSekund: number }
  | { rodzaj: "autoryzacja"; status: number }
  | { rodzaj: "sieć"; komunikat: string };

export class CeidgError extends Error {
  constructor(public info: CeidgBlad) {
    super(opisBleduCeidg(info));
    this.name = "CeidgError";
  }
}

export function opisBleduCeidg(b: CeidgBlad): string {
  switch (b.rodzaj) {
    case "brak_tokenu":
      return "Brak CEIDG_TOKEN w zmiennych środowiskowych — łowca nie ma jak zapytać rejestru.";
    case "limit":
      return `Limit żądań CEIDG wyczerpany — kolejne można wysłać za ${Math.ceil(b.zaSekund / 60)} min.`;
    case "autoryzacja":
      return `CEIDG odrzuciło token (HTTP ${b.status}). Sprawdź CEIDG_TOKEN i środowisko (CEIDG_ENV).`;
    case "sieć":
      return `CEIDG nie odpowiedziało: ${b.komunikat}`;
  }
}

/* ────────────────────────── licznik żądań ────────────────────────── */

export type StanLimitu = {
  /** Ile ms trzeba odczekać, zanim wolno wysłać kolejne żądanie. */
  czekajMs: number;
  wKrotkimOknie: number;
  wDlugimOknie: number;
};

/** Ile jeszcze trzeba czekać na wolny slot. Nie śpi — samo liczenie, żeby
 * wołający (potok z budżetem 240 s) mógł zdecydować: poczekać czy zapisać
 * kursor i skończyć na dziś. */
export async function stanLimitu(): Promise<StanLimitu> {
  await ensureLeadHunterSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      COUNT(*) FILTER (WHERE created_at > now() - (${LIMIT_KROTKI.oknoSek} || ' seconds')::interval)::int AS krotkie,
      COUNT(*) FILTER (WHERE created_at > now() - (${LIMIT_DLUGI.oknoSek} || ' seconds')::interval)::int AS dlugie,
      COALESCE(EXTRACT(EPOCH FROM (now() - MAX(created_at))), 999999)::float AS od_ostatniego,
      COALESCE(EXTRACT(EPOCH FROM (now() - MIN(created_at) FILTER (WHERE created_at > now() - (${LIMIT_KROTKI.oknoSek} || ' seconds')::interval))), 0)::float AS wiek_najstarszego
    FROM ceidg_requests;
  `) as unknown as { krotkie: number; dlugie: number; od_ostatniego: number; wiek_najstarszego: number }[];

  const r = rows[0] ?? { krotkie: 0, dlugie: 0, od_ostatniego: 999999, wiek_najstarszego: 0 };

  // 1) stały odstęp między żądaniami
  let czekajMs = Math.max(0, ODSTEP_MS - r.od_ostatniego * 1000);

  // 2) okno krótkie — czekamy, aż najstarsze żądanie z okna z niego wypadnie
  if (r.krotkie >= LIMIT_KROTKI.zadania) {
    czekajMs = Math.max(czekajMs, (LIMIT_KROTKI.oknoSek - r.wiek_najstarszego) * 1000 + 1000);
  }
  // 3) okno długie — tu nie ma sensu czekać w locie (do godziny), wołający
  //    dostaje wartość i sam kończy przebieg.
  if (r.dlugie >= LIMIT_DLUGI.zadania) {
    czekajMs = Math.max(czekajMs, LIMIT_DLUGI.oknoSek * 1000);
  }

  return { czekajMs, wKrotkimOknie: r.krotkie, wDlugimOknie: r.dlugie };
}

async function odnotujZadanie(): Promise<void> {
  const sql = getSql();
  await sql`INSERT INTO ceidg_requests (id) VALUES (${randomUUID()});`;
  await sql`DELETE FROM ceidg_requests WHERE created_at < now() - (${RETENCJA_GODZIN} || ' hours')::interval;`;
}

function spij(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Jedno żądanie do CEIDG z pełnym poszanowaniem limitu.
 *
 * `maksCzekaniaMs` to budżet wołającego: gdy wolny slot jest dalej niż tyle,
 * NIE czekamy i NIE strzelamy — rzucamy `CeidgError{limit}`, a potok zapisuje
 * kursor i kończy przebieg. To jest ta różnica, która decyduje o wszystkim:
 * dobicie do zablokowanego API przedłuża blokadę o kolejne 180 s.
 */
async function zapytaj<T>(sciezka: string, maksCzekaniaMs: number): Promise<T> {
  const token = process.env.CEIDG_TOKEN;
  if (!token) throw new CeidgError({ rodzaj: "brak_tokenu" });

  const stan = await stanLimitu();
  if (stan.czekajMs > maksCzekaniaMs) {
    throw new CeidgError({ rodzaj: "limit", zaSekund: Math.ceil(stan.czekajMs / 1000) });
  }
  if (stan.czekajMs > 0) await spij(stan.czekajMs);

  // Wiersz licznika zapisujemy PRZED strzałem, nie po. Gdyby funkcja padła w
  // trakcie (timeout Vercela), żądanie i tak poszło — licznik musi o nim
  // wiedzieć, inaczej następny przebieg wystrzeli ponad limit.
  await odnotujZadanie();

  const url = sciezka.startsWith("http") ? sciezka : `${bazowyAdres()}${sciezka}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    throw new CeidgError({ rodzaj: "sieć", komunikat: e instanceof Error ? e.message : String(e) });
  }

  if (res.status === 401 || res.status === 403) {
    throw new CeidgError({ rodzaj: "autoryzacja", status: res.status });
  }
  if (res.status === 429) {
    // CEIDG samo powiedziało „za dużo". Blokada trwa 180 s od OSTATNIEGO
    // żądania — więc nie ponawiamy w tym przebiegu w ogóle.
    throw new CeidgError({ rodzaj: "limit", zaSekund: LIMIT_KROTKI.oknoSek });
  }
  if (res.status === 404) {
    // Brak wyniku to nie awaria — wołający rozróżnia to po `null`.
    return null as T;
  }
  if (!res.ok) {
    throw new CeidgError({ rodzaj: "sieć", komunikat: `HTTP ${res.status}` });
  }
  return (await res.json().catch(() => null)) as T;
}

/* ────────────────────────── odczyt pól ────────────────────────── */

// Odpowiedzi rejestru czytamy DEFENSYWNIE: dokumentacja opisuje kształt, ale
// pola bywają w kilku wariantach zapisu (`pkdGlowny` jako string albo obiekt
// z `symbol`, adres jako `adresDzialalnosci` albo `adresyDzialalnosci[0]`).
// Zamiast zakładać jeden wariant, każdą wartość wyciągamy przez helper, który
// przy niespodziance zwraca pusty string — brak pola ma dać kandydata bez
// telefonu, a nie wywrócić cały przebieg.

type Json = Record<string, unknown>;

function txt(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
}

function obj(v: unknown): Json {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
}

function tablica(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** „6920Z" z kilku możliwych kształtów: "6920Z", {symbol:"6920Z"},
 * {kod:"69.20.Z"}. */
function kodPkd(v: unknown): string {
  if (typeof v === "string") return v;
  const o = obj(v);
  return txt(o.symbol) || txt(o.kod) || txt(o.pkd) || "";
}

function adres(f: Json): { ulica: string; kod: string; miasto: string; wojewodztwo: string } {
  const a = obj(f.adresDzialalnosci ?? f.adres ?? tablica(f.adresyDzialalnosci)[0] ?? {});
  const ulica = [txt(a.ulica), txt(a.budynek), txt(a.lokal) ? `lok. ${txt(a.lokal)}` : ""]
    .filter(Boolean)
    .join(" ");
  return {
    ulica,
    kod: txt(a.kod) || txt(a.kodPocztowy),
    miasto: txt(a.miasto) || txt(a.miejscowosc),
    wojewodztwo: txt(a.wojewodztwo),
  };
}

/* ────────────────────────── E1: lista firm ────────────────────────── */

export type ZapytanieListy = {
  /** Prefiksy PKD, np. ["6920", "6910"]. */
  pkd: string[];
  wojewodztwo: string;
  powiat: string;
  miasto: string;
  /** Data rozpoczęcia działalności OD / DO („YYYY-MM-DD"), puste = bez limitu. */
  dataOd: string;
  dataDo: string;
  /** Strona (CEIDG liczy od 1). */
  strona: number;
  limit: number;
};

export type WynikListy = { firmy: CeidgFirmaSkrot[]; ile: number };

/** E1 — jedno żądanie listy. Zwraca firmy i `count` (ile w ogóle spełnia
 * kryteria), po którym potok wie, czy kursor ma iść dalej, czy wrócić na
 * początek. */
export async function pobierzListe(q: ZapytanieListy, maksCzekaniaMs: number): Promise<WynikListy> {
  const p = new URLSearchParams();
  for (const kod of q.pkd) if (kod.trim()) p.append("pkd", kod.trim());
  if (q.wojewodztwo) p.append("wojewodztwo", q.wojewodztwo);
  if (q.powiat) p.append("powiat", q.powiat);
  if (q.miasto) p.append("miasto", q.miasto);
  if (q.dataOd) p.append("datod", q.dataOd);
  if (q.dataDo) p.append("datdo", q.dataDo);
  // Tylko aktywne — status nieaktywny i tak jest dyskwalifikatorem sita, więc
  // pobieranie ich kosztowałoby limit za nic.
  p.append("status", "AKTYWNY");
  p.append("page", String(Math.max(1, q.strona)));
  p.append("limit", String(Math.min(50, Math.max(1, q.limit))));

  const dane = await zapytaj<Json | null>(`/firmy?${p.toString()}`, maksCzekaniaMs);
  if (!dane) return { firmy: [], ile: 0 };

  const lista = tablica(dane.firmy ?? dane.dane ?? dane.results);
  const firmy: CeidgFirmaSkrot[] = lista.map((raw) => {
    const f = obj(raw);
    const wl = obj(f.wlasciciel);
    const a = adres(f);
    return {
      id: txt(f.id) || txt(f.idWpisu),
      nazwa: txt(f.nazwa) || txt(f.firma),
      nip: txt(wl.nip) || txt(f.nip),
      regon: txt(wl.regon) || txt(f.regon),
      ulica: a.ulica,
      kod: a.kod,
      miasto: a.miasto,
      wojewodztwo: a.wojewodztwo,
      dataRozpoczecia: txt(f.dataRozpoczecia).slice(0, 10),
      status: txt(f.status).toUpperCase() || "AKTYWNY",
      link: txt(f.link),
    };
  });

  const ile = typeof dane.count === "number" ? dane.count : firmy.length;
  return { firmy, ile };
}

/* ────────────────────────── E2: szczegóły firmy ────────────────────────── */

/** E2 — szczegóły jednej firmy (telefon, e-mail, www, pełne PKD, upadłość).
 * To jest to żądanie, którego jest najwięcej, więc to ono zjada limit — i
 * dlatego czarną listę oraz duplikaty odsiewamy PRZED nim. */
export async function pobierzSzczegoly(
  firma: Pick<CeidgFirmaSkrot, "nip" | "id" | "link">,
  maksCzekaniaMs: number
): Promise<CeidgFirmaSzczegoly | null> {
  const sciezka = firma.nip
    ? `/firma?nip=${encodeURIComponent(firma.nip)}`
    : firma.link || (firma.id ? `/firma/${encodeURIComponent(firma.id)}` : "");
  if (!sciezka) return null;

  const dane = await zapytaj<Json | null>(sciezka, maksCzekaniaMs);
  if (!dane) return null;

  // Odpowiedź bywa opakowana w tablicę `firma` — bierzemy pierwszy wpis.
  const f = obj(tablica(dane.firma)[0] ?? dane.firma ?? dane);

  const pkdLista = tablica(f.pkd).map(kodPkd).filter(Boolean);
  const glowny = kodPkd(f.pkdGlowny) || pkdLista[0] || "";

  const dodatkowe = tablica(f.adresyDzialalnosciDodatkowe ?? f.dodatkoweAdresy);
  const zakazy = tablica(f.zakazy);

  return {
    telefon: txt(f.telefon),
    email: txt(f.email),
    www: txt(f.www) || txt(f.stronaWww),
    pkdGlowny: glowny,
    pkd: pkdLista.length ? pkdLista : glowny ? [glowny] : [],
    liczbaAdresow: 1 + dodatkowe.length,
    upadlosc: Boolean(f.upadlosc) || Boolean(f.upadloscKonsumencka),
    zakaz: zakazy.length > 0,
    status: txt(f.status).toUpperCase() || "AKTYWNY",
    dataRozpoczecia: txt(f.dataRozpoczecia).slice(0, 10),
  };
}
