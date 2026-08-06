/**
 * Straż sesji — jedno miejsce, w którym panel dowiaduje się, że sesja wygasła.
 *
 * **Skąd to się wzięło (etap 3, 2026-08-06).** Przebieg na żywym edytorze
 * oferty: sesja wygasa w połowie pracy, właściciel pisze dalej i zapisuje.
 * Zmierzone:
 *
 * | co edytował | co zobaczył |
 * |---|---|
 * | tytuł oferty | „Nie udało się zapisać." przez 3,4 s, potem nic |
 * | TREŚĆ oferty (blok „Zakres prac") | **nic — ani jednego znaku** |
 *
 * W obu przypadkach ekran dalej pokazywał wpisany tekst, a w bazie została
 * stara wartość. Panel miał **243 miejsca zapisu i ANI JEDNO nie rozpoznawało
 * 401** — komunikat (gdy w ogóle był) mówił „nie udało się", czyli sugerował
 * awarię sieci i „spróbuj jeszcze raz", a próbowanie jeszcze raz nie mogło
 * pomóc.
 *
 * **Dlaczego opakowanie `window.fetch`, a nie 243 poprawki.** Bo poprawka
 * w 243 miejscach byłaby skończona w 240 — a poprawka wzorca, która staje
 * w połowie modułu, to osobna lekcja z audytu Notatnika. Tu jest jedna reguła:
 * *każda* odpowiedź 401 na zapis do `/api` zapala pasek, także z miejsca, które
 * powstanie jutro i o którym ten plik nie wie. Opakowanie jest wąskie —
 * **niczego nie zmienia w przebiegu żądania**, tylko podgląda kod odpowiedzi.
 *
 * **Druga połowa tej samej sprawy: koniec z samoczynnym przeładowaniem.**
 * `dane.ts` i siedem ekranów robiło przy 401 `window.location.reload()`, żeby
 * pokazać formularz logowania. To kasuje niezapisany formularz bez ostrzeżenia
 * — dokładnie w chwili, w której właściciel ma na ekranie coś, czego nie ma
 * w bazie. Dziś nikt nie przeładowuje: pasek mówi, co się stało, i pozwala
 * zalogować się NA MIEJSCU, bez opuszczania ekranu.
 */

import { NAGLOWEK_ZNANY_STAN } from "@/lib/rozjazd";
import { zapamietajStan, znanyStan } from "./rozjazdKart";

let wygasla = false;
const sluchacze = new Set<() => void>();

function powiadom() {
  for (const f of sluchacze) f();
}

/** Zgłasza wygaśnięcie sesji. Wołane przez strażnika `fetch` i przez te
 *  ekrany, które same czytają 401 z odczytu. Powtórne zgłoszenie nic nie robi,
 *  więc wolno je wołać z pętli. */
export function zglosWygasnieciesesji(): void {
  if (wygasla) return;
  wygasla = true;
  powiadom();
}

/** Sesja znów działa (udane logowanie z paska). */
export function zglosPowrotSesji(): void {
  if (!wygasla) return;
  wygasla = false;
  powiadom();
}

export function czySesjaWygasla(): boolean {
  return wygasla;
}

export function subskrybujStrazSesji(fn: () => void): () => void {
  sluchacze.add(fn);
  return () => {
    sluchacze.delete(fn);
  };
}

/** Sam serwer w SSR nie ma `window` — `useSyncExternalStore` wymaga migawki
 *  serwerowej, a ta jest zawsze „sesja żyje". */
export function migawkaSerwera(): boolean {
  return false;
}

type OpakowanyFetch = typeof fetch & { __strazSesji?: true };

/**
 * Zakłada strażnika na `window.fetch`. Idempotentne — drugie wywołanie (np.
 * po odmontowaniu i zamontowaniu providera w trybie ścisłym Reacta) nie
 * nakłada drugiej warstwy.
 *
 * Świadomie NIE reaguje na:
 * — żądania `GET` (odczyt ma własną drogę, `pobierzJSON`, i sam zgłasza się tu),
 * — `/api/admin/*` (401 z logowania to złe hasło, nie wygasła sesja; 401
 *   z wylogowania to skutek zamierzony),
 * — adresy spoza `/api` (obce domeny nie mają nic wspólnego z naszą sesją).
 */
/** Co zrobić, gdy trasa zgłosi rozjazd kart. Ustawiane przez `AdminUIProvider`,
 *  bo tylko on ma `toast()`. Do czasu ustawienia rozjazd jest po cichu
 *  pomijany — i to jest w porządku: pierwszy odczyt ekranu i tak nie jest
 *  zapisem. */
let obslugaRozjazdu: ((komunikat: string) => void) | null = null;

export function ustawObslugeRozjazdu(fn: ((komunikat: string) => void) | null): void {
  obslugaRozjazdu = fn;
}

export function zainstalujStrazSesji(): void {
  if (typeof window === "undefined") return;
  const biezacy = window.fetch as OpakowanyFetch;
  if (biezacy.__strazSesji) return;

  const opakowany = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const adres = adresZadania(input);
    const zapis = dotyczyZapisuPanelu(input, init);

    // ROZJAZD KART, krok 1: dokleja znacznik, który TA karta widziała przy
    // wczytaniu rekordu. Nagłówek, nie ciało — jedzie tak samo przy PATCH-u
    // z ciałem i przy POST-cie bez. Gdy karta nie zna stanu, nagłówka nie ma
    // i trasa świadomie nie zgłasza rozjazdu (patrz lib/rozjazd.ts).
    let zadanie = init;
    if (zapis && adres) {
      const stan = znanyStan(adres);
      if (stan) {
        const naglowki = new Headers(init?.headers ?? (typeof input === "object" && "headers" in input ? (input as Request).headers : undefined));
        naglowki.set(NAGLOWEK_ZNANY_STAN, stan);
        zadanie = { ...(init ?? {}), headers: naglowki };
      }
    }

    const res = await biezacy(input, zadanie);

    try {
      if (res.status === 401 && zapis) zglosWygasnieciesesji();

      // ROZJAZD KART, krok 2: zapamiętaj stan z odczytu POJEDYNCZEGO rekordu
      // i pokaż zdanie, gdy trasa zgłosiła rozjazd przy zapisie. Czytamy
      // KLON — oryginalna odpowiedź musi dojść do wołającego nietknięta.
      if (adres && res.ok && res.headers.get("content-type")?.includes("json")) {
        const dane = await res.clone().json().catch(() => null);
        // Zapamiętujemy ZAWSZE — i po odczycie rekordu, i po zapisie, bo trasy
        // oddają w odpowiedzi nowy `updated_at`. To jest cała obrona przed
        // fałszywym alarmem: bez odświeżenia znacznika DRUGI zapis z rzędu
        // w tej samej karcie wyglądał jak cudza zmiana (zmierzone).
        zapamietajStan(adres, dane);
        if (zapis) {
          const komunikat = (dane as { rozjazd?: unknown } | null)?.rozjazd;
          if (typeof komunikat === "string" && komunikat) obslugaRozjazdu?.(komunikat);
        }
      }
    } catch {
      // Strażnik nie ma prawa wywrócić żądania, które się udało.
    }
    return res;
  }) as OpakowanyFetch;
  opakowany.__strazSesji = true;
  window.fetch = opakowany;
}

/** Adres żądania jako ścieżka na naszym origin — albo `null`. */
function adresZadania(input: RequestInfo | URL): string | null {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : ((input as Request).url ?? "");
  return url ? url : null;
}

/** Czy to był ZAPIS do naszego API. Wydzielone, żeby dało się to sprawdzić
 *  testem bez sieci. */
export function dotyczyZapisuPanelu(input: RequestInfo | URL, init?: RequestInit): boolean {
  const metoda = (
    init?.method ??
    (typeof input === "object" && "method" in input ? (input as Request).method : "GET")
  ).toUpperCase();
  if (metoda === "GET" || metoda === "HEAD") return false;

  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : ((input as Request).url ?? "");
  // Ścieżka względna („/api/…") albo absolutna na naszym origin.
  const sciezka = url.startsWith("/")
    ? url
    : (() => {
        try {
          const u = new URL(url, typeof window !== "undefined" ? window.location.href : "http://localhost");
          return typeof window !== "undefined" && u.origin !== window.location.origin ? "" : u.pathname;
        } catch {
          return "";
        }
      })();

  if (!sciezka.startsWith("/api/")) return false;
  if (sciezka.startsWith("/api/admin/")) return false;
  return true;
}


// **Instalacja przy imporcie, nie w `useEffect`.** Efekty Reacta wykonują się
// od dzieci do rodzica, więc `useEffect` w `AdminUIProvider` odpala się PO
// efektach edytorów — a te robią w nich swój pierwszy odczyt rekordu. Przy
// instalacji w efekcie ten pierwszy GET przechodził OBOK strażnika, karta
// nigdy nie zapamiętywała znacznika i wykrywanie rozjazdu milczało.
// Zmierzone w przeglądarce: trasa oddawała `rozjazd` na żądanie z nagłówkiem,
// a panel nagłówka nie wysyłał, bo nie miał czego.
//
// Moduł importuje `ui.tsx`, czyli ładuje się przed pierwszym renderem panelu.
zainstalujStrazSesji();
