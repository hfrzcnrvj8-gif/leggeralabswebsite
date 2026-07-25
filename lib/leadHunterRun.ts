/**
 * „Łowca leadów" (Moduł 52) — POTOK. Server-only, warstwa I/O: baza + CEIDG +
 * Biała lista MF + strona firmy. Decyzję „czy ten kandydat jest wart kontaktu"
 * podejmuje wyłącznie `lib/leadHunter.ts` (czyste reguły, `npm test`).
 *
 * Cztery etapy, każdy idempotentny i wznawialny:
 *   E1 zbieranie   — jedno żądanie listy CEIDG na polowanie, odsiew czarnej
 *                    listy i duplikatów, zapis jako `surowy`.
 *   E2 wzbogacanie — szczegóły CEIDG (telefon/mail/www/PKD) + Biała lista MF.
 *   E3 strona      — jedno pobranie strony głównej, deterministyczne sygnały.
 *   E4 sito        — punkty, ocena, uzasadnienie; `surowy` → `nowy` albo kasacja.
 *
 * **Budżet czasu.** Cały przebieg to JEDNO wywołanie z twardym stopem ~240 s
 * (Vercel Hobby daje 300 s — Audyt 5) i zapisem kursora, więc przerwanie w
 * połowie niczego nie psuje: następny przebieg podejmuje od tego samego
 * miejsca. Przy odstępie 3,8 s mieści się w tym ~60 żądań do CEIDG, czyli
 * ~60 wzbogaconych firm na dobę — z tego po sicie zwykle kilkanaście
 * kandydatów. To jest realna dzienna porcja i ona ogranicza ten moduł, nie
 * limit rejestru.
 *
 * **Kolejność odsiewu jest tu najważniejszą decyzją inżynierską:** czarna
 * lista i duplikaty lecą w E1, PRZED wzbogacaniem. Każde wzbogacenie to jedno
 * żądanie z puli, więc sprawdzanie ich po fakcie znaczyłoby płacenie limitem
 * za firmy, które i tak odpadną.
 */

import { randomUUID } from "node:crypto";
import { getSql, ensureLeadHunterSchema, ensureLeadsSchema, ensureClientsSchema, ensureObservabilitySchema } from "./db";
import {
  ceidgSkonfigurowany,
  pobierzListe,
  pobierzSzczegoly,
  CeidgError,
  opisBleduCeidg,
  type CeidgFirmaSkrot,
} from "./ceidg";
import { lookupNip } from "./mf";
import {
  ocenKandydata,
  sygnalyZeStrony,
  normalizujNazwe,
  branzaZPkd,
  STRONA_NIE_ODPOWIEDZIALA,
  type HunterInput,
  type WebsiteSignals,
} from "./leadHunter";
import { todayLocalISO } from "./dates";
import { zapiszBlad } from "./errorLog";

/** Twardy stop przebiegu. 240 s przy limicie 300 s Vercela zostawia zapas na
 * zapis kursora i podsumowania — przerwanie przez platformę byłoby jedyną
 * sytuacją, w której licznik żądań CEIDG mógłby się rozjechać z rzeczywistością. */
export const BUDZET_MS = 240_000;

/**
 * Budżet dla polowania odpalonego RĘCZNIE z telefonu.
 *
 * **Dlaczego krótszy, a nie ten sam.** Apka trzyma połączenie przez cały
 * przebieg (Vercel nie umie w zadanie w tle — funkcja żyje tak długo, jak
 * żądanie), a jej limity to 20 s na żądanie i 45 s na całość. Pełne
 * czterominutowe polowanie z telefonu **zawsze** kończyłoby się fałszywym
 * „brak połączenia z panelem", podczas gdy serwer spokojnie dokańczał robotę.
 * Najgorszy rodzaj błędu: wygląda na awarię, choć wszystko działa.
 *
 * Podnoszenie limitów w apce do 250 s byłoby leczeniem objawu — telefon na
 * zasięgu komórkowym nie ma trzymać otwartego połączenia przez cztery minuty.
 * Kursor i tak zapamiętuje, gdzie skończyliśmy, więc krótka porcja niczego nie
 * gubi: dokończy ją nocny cron.
 */
export const BUDZET_TELEFON_MS = 60_000;

/** Ile firm bierzemy z jednej strony listy CEIDG (maksimum API to 50). */
export const PORCJA_LISTY = 50;

export type Polowanie = {
  id: string;
  nazwa: string;
  pkd: string;
  wojewodztwo: string;
  powiat: string;
  miasto: string;
  data_od: string | null;
  data_do: string | null;
  aktywne: boolean;
  kursor: number;
  ostatni_przebieg: string | null;
  ostatni_wynik: string;
  znalezionych: number;
  przyjetych: number;
};

export type WynikPrzebiegu = {
  polowan: number;
  zebranych: number;
  wzbogaconych: number;
  nowych: number;
  odsianych: number;
  ocenA: number;
  /** Powód zatrzymania, gdy przebieg nie doszedł do końca — trafia do panelu
   * i do Centrum powiadomień. Pusty = doszedł. */
  przerwane: string;
  /**
   * Czy przerwanie było AWARIĄ, czy normalnym końcem porcji.
   *
   * To rozróżnienie decyduje o tym, czy nadzór (Audyt 4) wyśle alarm.
   * Wyczerpany budżet czasu i limit rejestru **nie są awarią** — potok
   * dokładnie po to ma kursor, żeby dokończyć jutro; alarm o tym co rano
   * nauczyłby właściciela ignorować alarmy, a te mają zadziałać raz na rok.
   * Awarią jest odrzucony token, cisza sieci albo błąd zapisu.
   */
  awaria: boolean;
  /** Brak `CEIDG_TOKEN` — moduł nie jest jeszcze skonfigurowany. To NIE jest
   * awaria automatu i nie melduje się go nadzorowi (patrz trasa `hunt/run`). */
  nieskonfigurowany: boolean;
  /**
   * Ile z wzbogaconych firm nie miało PO wzbogaceniu ani telefonu, ani
   * e-maila, ani strony — czyli ile odpadło na dyskwalifikatorze „brak
   * kontaktu".
   *
   * To jest **detektor cichej zmiany po stronie rejestru**. Klient CEIDG
   * czyta pola defensywnie (brakujące pole = pusta wartość, nie wyjątek), więc
   * przemianowanie `telefon` na cokolwiek innego nie dałoby żadnego błędu —
   * dostawalibyśmy kandydatów bez kontaktu i uznawali to za „taki rocznik".
   * Kilka procent to norma; osiemdziesiąt to sygnał, że zmienił się kształt
   * odpowiedzi. Ocenia to `podejrzanyPrzebieg()`.
   */
  bezKontaktu: number;
};

/** Od ilu wzbogaceń w przebiegu w ogóle warto wyciągać wnioski ze statystyki
 * „bez kontaktu". Przy trzech firmach 100% nic nie znaczy. */
export const PROG_PROBKI = 15;

/** Powyżej jakiego udziału firm bez kontaktu uznajemy przebieg za podejrzany. */
export const PROG_BEZ_KONTAKTU = 0.8;

/** Czy przebieg wygląda na skutek zmiany kształtu danych w rejestrze, a nie na
 * zwykły chudy dzień. Czysta arytmetyka — testowana w `test/lowca.test.ts`. */
export function podejrzanyPrzebieg(wzbogaconych: number, bezKontaktu: number): boolean {
  if (wzbogaconych < PROG_PROBKI) return false;
  return bezKontaktu / wzbogaconych >= PROG_BEZ_KONTAKTU;
}

/* ────────────────────────── E3: strona firmy ────────────────────────── */

/** Adres do pobrania: rejestr podaje „firma.pl", „www.firma.pl" albo pełny
 * URL. Zwraca `null`, gdy z pola nie da się zrobić sensownego adresu. */
export function adresStrony(www: string): string | null {
  const s = (www || "").trim();
  if (!s) return null;
  const url = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(url);
    if (!u.hostname.includes(".")) return null;
    // Wyłącznie strona GŁÓWNA — brief mówi wprost: jedno żądanie, bez
    // wchodzenia w głąb. Ścieżkę z rejestru celowo ucinamy.
    return `${u.protocol}//${u.hostname}/`;
  } catch {
    return null;
  }
}

/** Czy `robots.txt` pozwala nam pobrać stronę główną.
 *
 * Sprawdzamy TYLKO to, po co przychodzimy: reguły `Disallow` z grupy
 * `User-agent: *` (i naszej własnej), dopasowane do ścieżki „/". Pełnego
 * parsera robots.txt świadomie nie piszemy — pobieramy jeden zasób, nie
 * crawlujemy; koszt utrzymania parsera byłby większy niż to, co rozstrzyga.
 * Gdy `robots.txt` nie istnieje albo nie odpowiada — wolno (tak stanowi sam
 * standard). */
export async function robotsPozwala(origin: string): Promise<boolean> {
  try {
    const res = await fetch(`${origin}robots.txt`, {
      signal: AbortSignal.timeout(4000),
      headers: { "User-Agent": UZYTKOWNIK },
    });
    if (!res.ok) return true;
    const tekst = (await res.text()).slice(0, 20_000);
    let wGrupie = false;
    for (const linia of tekst.split(/\r?\n/)) {
      const l = linia.replace(/#.*$/, "").trim();
      if (!l) continue;
      const m = /^user-agent\s*:\s*(.+)$/i.exec(l);
      if (m) {
        wGrupie = m[1].trim() === "*" || m[1].trim().toLowerCase().includes("leggera");
        continue;
      }
      if (!wGrupie) continue;
      const d = /^disallow\s*:\s*(.*)$/i.exec(l);
      // „Disallow: /" zamyka wszystko; „Disallow:" (pusty) nie zamyka nic.
      if (d && d[1].trim() === "/") return false;
    }
    return true;
  } catch {
    return true;
  }
}

/** Nagłówek przedstawiający nas z imienia i adresu — ta sama zasada, co przy
 * Nominatim/Overpass w starym generatorze. Anonimowy bot to bot, który
 * właściciel strony ma prawo zablokować. */
const UZYTKOWNIK = "LeggeraHubLeadHunter/1.0 (+https://leggeralabs.pl; kontakt@leggeralabs.pl)";

/** E3 — jedno pobranie strony głównej. Nigdy nie rzuca: brak strony to brak
 * kilku punktów, nie awaria przebiegu. `null` = nie sprawdzaliśmy (nie ma
 * czego), co w sicie znaczy co innego niż „sprawdziliśmy i nie odpowiada". */
export async function zbadajStrone(www: string): Promise<WebsiteSignals | null> {
  const adres = adresStrony(www);
  if (!adres) return null;
  const origin = adres;
  if (!(await robotsPozwala(origin))) return null;
  try {
    const res = await fetch(adres, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": UZYTKOWNIK, Accept: "text/html" },
      redirect: "follow",
    });
    if (!res.ok) return STRONA_NIE_ODPOWIEDZIALA;
    const typ = res.headers.get("content-type") ?? "";
    if (!typ.includes("html")) return STRONA_NIE_ODPOWIEDZIALA;
    // Sto kilobajtów wystarcza na nagłówek, menu i pierwszy ekran — a tam
    // siedzą wszystkie sygnały, których szukamy. Bez limitu jedna strona z
    // wklejoną galerią base64 potrafiłaby zjeść pamięć funkcji.
    const html = (await res.text()).slice(0, 100_000);
    return sygnalyZeStrony(html);
  } catch {
    return STRONA_NIE_ODPOWIEDZIALA;
  }
}

/* ────────────────────────── potok ────────────────────────── */

type Odsiew = { nip: Set<string>; nazwa: Set<string> };

/** Kandydat czekający na wzbogacenie (E2–E4). */
type SurowyKandydat = {
  id: string;
  nazwa: string;
  nip: string;
  miasto: string;
  data_rozpoczecia: string | null;
  status_ceidg: string;
  ceidg_link: string;
};

/** Wiersz dowolnej z czterech tabel, z których składamy odsiew. */
type WierszOdsiewu = { nip?: string | null; firma?: string | null; nazwa?: string | null; nazwa_norm?: string | null };

/** Wszystko, czego NIE chcemy zbierać: czarna lista + istniejące leady +
 * klienci + kandydaci już w skrzynce. Jedno wczytanie na przebieg (neon() =
 * jedno żądanie HTTP na zapytanie, więc pytanie per firma byłoby czterema
 * setkami rund do bazy). */
async function wczytajOdsiew(): Promise<Odsiew> {
  await ensureLeadsSchema();
  await ensureClientsSchema();
  await ensureLeadHunterSchema();
  const sql = getSql();

  const nip = new Set<string>();
  const nazwa = new Set<string>();
  const dodaj = (rows: WierszOdsiewu[]) => {
    for (const r of rows) {
      const n = (r.nip ?? "").replace(/\D/g, "");
      if (n) nip.add(n);
      const nz = r.nazwa_norm || normalizujNazwe(r.firma ?? r.nazwa ?? "");
      if (nz) nazwa.add(nz);
    }
  };

  dodaj((await sql`SELECT nip, nazwa_norm FROM lead_blacklist;`) as unknown as WierszOdsiewu[]);
  dodaj((await sql`SELECT nip, nazwa_norm FROM lead_candidates;`) as unknown as WierszOdsiewu[]);
  dodaj((await sql`SELECT firma FROM leads;`) as unknown as WierszOdsiewu[]);
  dodaj((await sql`SELECT nazwa, nip FROM clients;`) as unknown as WierszOdsiewu[]);
  return { nip, nazwa };
}

function jestOdsiany(f: { nip: string; nazwa: string }, o: Odsiew): boolean {
  const nip = f.nip.replace(/\D/g, "");
  if (nip && o.nip.has(nip)) return true;
  const nz = normalizujNazwe(f.nazwa);
  return Boolean(nz) && o.nazwa.has(nz);
}

/** Licznik „co odsiało sito" — bez nazw firm, sam powód i dzień. To drugi
 * wskaźnik pętli poprawy: „30× za młoda" znaczy, że próg wieku jest zły. */
async function odnotujOdsiew(kodPowodu: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO lead_hunt_rejects (dzien, powod, ile) VALUES (CURRENT_DATE, ${kodPowodu}, 1)
    ON CONFLICT (dzien, powod) DO UPDATE SET ile = lead_hunt_rejects.ile + 1;
  `;
}

/** E1 — jedna strona listy dla jednego polowania. */
async function etapZbierania(
  p: Polowanie,
  odsiew: Odsiew,
  budzetMs: number
): Promise<{ zebranych: number; wynikListy: number }> {
  const sql = getSql();
  const strona = p.kursor + 1;
  const wynik = await pobierzListe(
    {
      pkd: p.pkd.split(",").map((s) => s.trim()).filter(Boolean),
      wojewodztwo: p.wojewodztwo,
      powiat: p.powiat,
      miasto: p.miasto,
      dataOd: p.data_od ? p.data_od.slice(0, 10) : "",
      dataDo: p.data_do ? p.data_do.slice(0, 10) : "",
      strona,
      limit: PORCJA_LISTY,
    },
    budzetMs
  );

  let zebranych = 0;
  for (const f of wynik.firmy) {
    if (jestOdsiany(f, odsiew)) continue;
    const nip = f.nip.replace(/\D/g, "");
    const nazwaNorm = normalizujNazwe(f.nazwa);
    // Odsiew rośnie w locie — ta sama firma potrafi wrócić na dwóch stronach
    // listy, gdy rejestr przestawi kolejność między przebiegami.
    if (nip) odsiew.nip.add(nip);
    if (nazwaNorm) odsiew.nazwa.add(nazwaNorm);

    await sql`
      INSERT INTO lead_candidates
        (id, hunt_id, nazwa, nazwa_norm, nip, regon, ulica, kod, miasto, data_rozpoczecia, status_ceidg, stan, ceidg_link)
      VALUES (
        ${randomUUID()}, ${p.id}, ${f.nazwa.slice(0, 300)}, ${nazwaNorm}, ${nip}, ${f.regon},
        ${f.ulica.slice(0, 300)}, ${f.kod.slice(0, 20)}, ${f.miasto.slice(0, 200)},
        ${f.dataRozpoczecia || null}, ${f.status}, 'surowy', ${f.link || f.id}
      )
      ON CONFLICT DO NOTHING;
    `;
    zebranych++;
  }

  // Kursor: kolejna strona, a po wyczerpaniu wyników z powrotem na początek —
  // przy następnym obiegu polowanie złapie firmy, które w międzyczasie doszły
  // do rejestru.
  const wyczerpane = strona * PORCJA_LISTY >= wynik.ile || wynik.firmy.length === 0;
  await sql`
    UPDATE lead_hunts
    SET kursor = ${wyczerpane ? 0 : strona},
        znalezionych = znalezionych + ${zebranych},
        ostatni_przebieg = now(),
        updated_at = now()
    WHERE id = ${p.id};
  `;
  return { zebranych, wynikListy: wynik.ile };
}

/** E2+E3+E4 dla jednego surowego kandydata. Zwraca `true`, gdy kandydat
 * przeszedł sito i czeka w skrzynce. */
async function etapWzbogacania(
  k: SurowyKandydat,
  budzetMs: number
): Promise<{ przyjety: boolean; ocena: string; kodPowodu: string }> {
  const sql = getSql();

  // E2a — szczegóły z CEIDG (telefon, mail, www, PKD, upadłość). Gdy rejestr
  // nie oddał NIP-u w E1, wchodzimy odnośnikiem/identyfikatorem z listy.
  const szczegoly = await pobierzSzczegoly(
    { nip: k.nip, id: k.ceidg_link.startsWith("http") ? "" : k.ceidg_link, link: k.ceidg_link.startsWith("http") ? k.ceidg_link : "" },
    budzetMs
  );

  // E2b — Biała lista MF. Bezpłatna, bez klucza i z OSOBNYM limitem, więc nie
  // dotyka puli CEIDG. `lookupNip` nigdy nie rzuca (patrz lib/mf.ts).
  const mf = k.nip ? await lookupNip(k.nip) : null;

  // E3 — strona firmy.
  const www = szczegoly?.www ?? "";
  const strona = await zbadajStrone(www);

  const wejscie: HunterInput = {
    nazwa: k.nazwa,
    nip: k.nip,
    status: szczegoly?.status || k.status_ceidg || "AKTYWNY",
    pkdGlowny: szczegoly?.pkdGlowny ?? "",
    pkd: szczegoly?.pkd ?? [],
    dataRozpoczecia: (szczegoly?.dataRozpoczecia || k.data_rozpoczecia || "").slice(0, 10),
    telefon: szczegoly?.telefon ?? "",
    email: szczegoly?.email ?? "",
    www,
    miasto: k.miasto,
    liczbaAdresow: szczegoly?.liczbaAdresow ?? 1,
    upadlosc: szczegoly?.upadlosc ?? false,
    zakaz: szczegoly?.zakaz ?? false,
    statusVat: mf?.statusVat ?? null,
    strona,
  };

  // E4 — sito. Zero sieci, w pełni przetestowane (test/lowca.test.ts).
  const wynik = ocenKandydata(wejscie, todayLocalISO());

  if (!wynik.przyjety) {
    // Odsiany kandydat NIE zostaje w bazie: nie zamierzamy się do tej firmy
    // odzywać, więc nie ma podstawy trzymać jej danych (minimalizacja, Audyt 2).
    // Zostaje sam licznik powodu — bez nazwy, NIP-u i adresu.
    await sql`DELETE FROM lead_candidates WHERE id = ${k.id};`;
    await odnotujOdsiew(wynik.kodPowodu);
    return { przyjety: false, ocena: "", kodPowodu: wynik.kodPowodu };
  }

  await sql`
    UPDATE lead_candidates SET
      telefon = ${wejscie.telefon.slice(0, 100)},
      email = ${wejscie.email.slice(0, 200)},
      www = ${www.slice(0, 300)},
      pkd_glowny = ${wejscie.pkdGlowny},
      pkd = ${wejscie.pkd.join(",")},
      branza = ${branzaZPkd([wejscie.pkdGlowny, ...wejscie.pkd])},
      status_vat = ${wejscie.statusVat},
      liczba_adresow = ${wejscie.liczbaAdresow},
      data_rozpoczecia = ${wejscie.dataRozpoczecia || null},
      punkty = ${wynik.punkty},
      ocena = ${wynik.ocena},
      sygnaly = ${JSON.stringify(wynik.sygnaly)}::jsonb,
      stan = 'nowy',
      updated_at = now()
    WHERE id = ${k.id};
  `;
  return { przyjety: true, ocena: wynik.ocena, kodPowodu: "" };
}

/**
 * Jeden przebieg łowcy: po jednym kroku E1 dla każdego aktywnego polowania,
 * potem wzbogacanie surowych kandydatów aż do wyczerpania budżetu czasu.
 *
 * Nigdy nie rzuca — błąd CEIDG (limit, zły token, cisza) kończy przebieg i
 * wraca jako `przerwane`, żeby wołający mógł to pokazać właścicielowi. Cichy
 * błąd w automacie, o którym nikt się nie dowiaduje, to dokładnie ustalenie 3
 * z Audytu 4.
 */
export async function przebiegLowcy(teraz = Date.now(), budzetMs = BUDZET_MS): Promise<WynikPrzebiegu> {
  const wynik: WynikPrzebiegu = {
    polowan: 0, zebranych: 0, wzbogaconych: 0, nowych: 0, odsianych: 0, ocenA: 0,
    przerwane: "", awaria: false, nieskonfigurowany: false, bezKontaktu: 0,
  };

  if (!ceidgSkonfigurowany()) {
    wynik.przerwane = "Brak CEIDG_TOKEN — łowca nie ma jak zapytać rejestru.";
    wynik.nieskonfigurowany = true;
    return wynik;
  }

  await ensureLeadHunterSchema();
  const sql = getSql();
  const zostalo = () => budzetMs - (Date.now() - teraz);

  const polowania = (await sql`
    SELECT * FROM lead_hunts WHERE aktywne = true ORDER BY COALESCE(ostatni_przebieg, to_timestamp(0)) ASC;
  `) as unknown as Polowanie[];
  wynik.polowan = polowania.length;
  if (!polowania.length) return wynik;

  const odsiew = await wczytajOdsiew();

  // ── E1 ──
  for (const p of polowania) {
    if (zostalo() < 20_000) {
      wynik.przerwane = "Zabrakło czasu na wszystkie polowania — reszta w kolejnym przebiegu.";
      break;
    }
    try {
      const r = await etapZbierania(p, odsiew, Math.max(0, zostalo() - 15_000));
      wynik.zebranych += r.zebranych;
      await sql`UPDATE lead_hunts SET ostatni_wynik = ${`Zebrano ${r.zebranych} firm z listy`} WHERE id = ${p.id};`;
    } catch (e) {
      const opis = e instanceof CeidgError ? opisBleduCeidg(e.info) : e instanceof Error ? e.message : String(e);
      await sql`UPDATE lead_hunts SET ostatni_wynik = ${opis.slice(0, 300)}, ostatni_przebieg = now() WHERE id = ${p.id};`;
      wynik.przerwane = opis;
      // Limit rejestru mija sam; token i sieć nie miną — patrz `awaria`.
      if (!(e instanceof CeidgError) || e.info.rodzaj !== "limit") wynik.awaria = true;
      if (e instanceof CeidgError && (e.info.rodzaj === "limit" || e.info.rodzaj === "autoryzacja" || e.info.rodzaj === "brak_tokenu")) {
        // Limit i zły token dotyczą CAŁEGO rejestru, nie tego jednego
        // polowania — dalsze próby tylko przedłużyłyby blokadę.
        return await domknij(wynik);
      }
    }
  }

  // ── E2–E4 ──
  // Najstarsze najpierw: kandydat zebrany wczoraj nie może czekać w
  // nieskończoność, bo dziś doszła świeższa porcja.
  const surowi = (await sql`
    SELECT id, nazwa, nip, miasto, data_rozpoczecia, status_ceidg, ceidg_link
    FROM lead_candidates WHERE stan = 'surowy' ORDER BY created_at ASC LIMIT 200;
  `) as unknown as SurowyKandydat[];

  for (const k of surowi) {
    // Jedno wzbogacenie to żądanie do CEIDG (do 3,8 s czekania na slot),
    // odpytanie MF i pobranie strony — z zapasem 20 s.
    if (zostalo() < 20_000) {
      wynik.przerwane = wynik.przerwane || "Budżet czasu wyczerpany — reszta kandydatów czeka do kolejnego przebiegu.";
      break;
    }
    try {
      const r = await etapWzbogacania(k, Math.max(0, zostalo() - 15_000));
      wynik.wzbogaconych++;
      if (r.przyjety) {
        wynik.nowych++;
        if (r.ocena === "A") wynik.ocenA++;
      } else {
        wynik.odsianych++;
        if (r.kodPowodu === "brak_kontaktu") wynik.bezKontaktu++;
      }
    } catch (e) {
      if (e instanceof CeidgError) {
        wynik.przerwane = opisBleduCeidg(e.info);
        if (e.info.rodzaj !== "limit") wynik.awaria = true;
        break;
      }
      // Pojedyncza firma może nie odpowiedzieć — to nie powód, żeby przerwać
      // cały przebieg. Kandydat zostaje `surowy` i wróci następnym razem.
      await zapiszBlad({
        zakres: "lowca",
        komunikat: `Nie udało się wzbogacić kandydata „${k.nazwa}"`,
        szczegoly: e,
        klucz: `lowca:wzbogacanie:${k.id}`,
      });
    }
  }

  return await domknij(wynik);
}

/** Ślad przebiegu przy polowaniach, żeby panel pokazał „co się stało", a nie
 * tylko „kiedy". */
async function domknij(w: WynikPrzebiegu): Promise<WynikPrzebiegu> {
  try {
    const sql = getSql();
    const opis = w.przerwane
      ? w.przerwane.slice(0, 300)
      : `Dołożono ${w.nowych} kandydatów (${w.ocenA}× A), odsiano ${w.odsianych}`;
    await sql`UPDATE lead_hunts SET ostatni_wynik = ${opis} WHERE aktywne = true AND ostatni_przebieg > now() - interval '10 minutes';`;
  } catch {
    // Ślad jest miły, ale nie jest wynikiem — jego brak nie może wywrócić przebiegu.
  }
  return w;
}

/**
 * Czy łowca chodził w ciągu ostatniej doby.
 *
 * **Po co druga droga.** Cron Vercela ma na planie Hobby JEDNĄ szansę dziennie
 * i nikt jej nie ponawia. Gdy przebieg o 4:00 padnie (czkawka platformy,
 * zimny start, chwilowy brak bazy), dzień przepada po cichu — próg alarmu to
 * 36 godzin, więc jedno pominięcie jest dla nadzoru NIEWIDOCZNE.
 *
 * Dlatego dzienny raport o 6:00 sprawdza to i w razie czego dopala łowcę.
 * To ta sama zasada, co przy alarmach z Audytu 4: druga, niezależna droga do
 * tego samego celu, żeby awaria jednej nie kończyła sprawy.
 */
export async function lowcaChodzilWDobie(teraz: Date = new Date()): Promise<boolean> {
  try {
    await ensureObservabilitySchema();
    const sql = getSql();
    const rows = (await sql`
      SELECT COUNT(*)::int AS n FROM automation_runs
      WHERE klucz = 'lowca' AND ok = true AND created_at > now() - interval '20 hours';
    `) as unknown as { n: number }[];
    return (rows[0]?.n ?? 0) > 0;
  } catch (e) {
    // Nie wiemy = zachowaj się, jakby chodził. Odwrotny wybór (dopalaj przy
    // każdej awarii odczytu) zamieniłby usterkę bazy w podwójne polowanie
    // i podwójne zużycie limitu CEIDG.
    console.error("[lowca] nie udało się sprawdzić, czy automat chodził", e);
    return true;
  }
}

/* ────────────────────────── retencja (RODO) ────────────────────────── */

/** Po ilu dniach znika kandydat, którego właściciel nie przyjął.
 *
 * Dane JDG z CEIDG **są danymi osobowymi** (imię, nazwisko, adres, NIP osoby
 * fizycznej). Podstawa ich przetwarzania to prawnie uzasadniony interes
 * (marketing B2B) — a ten kończy się w chwili, gdy właściciel nie zamierza się
 * do tej firmy odezwać. Kandydat przyjęty staje się leadem i przechodzi pod
 * retencję 24 miesięcy (`LEADS_RETENTION_MONTHS`, Audyt 2).
 *
 * Ta liczba MUSI zgadzać się z polityką prywatności — zmieniasz jedno, zmień
 * drugie (`docs/DO-PRAWNIKA-I-TLUMACZA.md`). */
export const KANDYDACI_RETENCJA_DNI = 30;

/** Kasuje kandydatów starszych niż retencja: nieprzyjętych całkiem, a po
 * odrzuconych zostaje wyłącznie wpis na czarnej liście (NIP + nazwa + powód),
 * który powstał już w chwili odrzucenia. Wołane z dziennego cronu. */
export async function purgeStareKandydaty(): Promise<number> {
  await ensureLeadHunterSchema();
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM lead_candidates
    WHERE stan <> 'wziety'
      AND created_at < now() - (${KANDYDACI_RETENCJA_DNI} || ' days')::interval
    RETURNING id;
  `) as unknown as { id: string }[];
  // Liczniki odsiewu też mają wygasać — same w sobie są anonimowe, ale
  // trzymanie ich w nieskończoność zamieniłoby tabelę w archiwum bez celu.
  await sql`DELETE FROM lead_hunt_rejects WHERE dzien < CURRENT_DATE - 180;`;
  return rows.length;
}
