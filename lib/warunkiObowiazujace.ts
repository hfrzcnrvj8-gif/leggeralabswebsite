/**
 * Warunki OBOWIĄZUJĄCE dla zlecenia — jedno miejsce, które odpowiada na
 * pytanie „co dla tego zlecenia obowiązuje DZISIAJ".
 *
 * ── PO CO TO POWSTAŁO ─────────────────────────────────────────────────────
 * Drugie przejście „na sucho" (`docs/DRUGIE-PRZEJSCIE-NA-SUCHO.md`) dało jedno
 * zlecenie i trzy różne terminy — oferta i umowa 25.08, projekt 22.09, aneks
 * 15.09 — oraz fakturę na 11 000 zł przy podpisanym aneksie na 15 000 zł.
 * Nic tego nie oznaczyło jako problemu, bo **nikt nie pytał**: umowa znała
 * swoje warunki, aneks swoje, projekt miał termin z szablonu, faktura kwotę
 * z oferty. Cztery rekordy, cztery prawdy, zero konfrontacji.
 *
 * ── CO TO ZNACZY „OBOWIĄZUJĄCE" ───────────────────────────────────────────
 * Obowiązuje **ostatni PODPISANY aneks**, a gdy takiego nie ma — sama umowa.
 * Szkic i aneks wysłany bez podpisu jeszcze niczego nie zmieniły; klient ich
 * nie zaakceptował.
 *
 * Bierzemy **cały** ostatni aneks, nie pole po polu z różnych aneksów. To nie
 * jest uproszczenie — aneks powstaje z kompletem czterech warunków przepisanym
 * z warunków obowiązujących w chwili jego sporządzenia (patrz
 * `POST /api/contracts/:id/aneks`), więc każdy aneks powtarza wszystkie cztery,
 * także te, których nie zmienia. Ostatni podpisany niesie zatem pełny stan.
 *
 * ── SKĄD SIĘ TO WZIĘŁO ────────────────────────────────────────────────────
 * Ta reguła istniała już wcześniej — zaszyta w `POST /api/contracts/:id/aneks`
 * jako zmienna `obowiazujace`. Krok 3 planu po drugim przejściu wyciągnął ją
 * stamtąd zamiast pisać drugą kopię; trasa aneksu woła teraz tę funkcję.
 *
 * ── DLACZEGO `zrodlo` JEST OSOBNO OD `umowa` ──────────────────────────────
 * To są dwie różne odpowiedzi na dwa różne pytania i pomylenie ich dało
 * znalezisko A7:
 *
 *  - `umowa` — **czego** dokument dotyczy. Aneks nr 2 jest aneksem do UMOWY,
 *    nie do aneksu nr 1, i tak ma brzmieć jego nagłówek.
 *  - `zrodlo` — **skąd pochodzą wartości** „dotychczasowego brzmienia". Przy
 *    drugim aneksie to jest aneks nr 1, a nie umowa-matka.
 *
 * Aneks nr 2 cytował kwotę z aneksu nr 1, a w nagłówku powoływał się na umowę,
 * w której tej kwoty nie ma. Wartości były policzone dobrze — kłamał wskaźnik.
 *
 * ── DLACZEGO TEN PLIK NIE IMPORTUJE `lib/db.ts` ───────────────────────────
 * Ten sam powód co w `lib/przepisanie.ts`: funkcje mają być wołane i z tras,
 * i (przez czyste `warunkiZWierszy`) z komponentów `"use client"`. Zamiast
 * `getSql()` przyjmujemy `sql` parametrem.
 */

import { aneksReference, contractReference, type ContractTyp } from "./contracts";
import { formatPlDate } from "./dates";
import type { SqlTag } from "./przepisanie";

/** Minimalny kształt wiersza `contracts`, jakiego potrzebują te funkcje.
 *  Świadomie NIE `Contract` — dzięki temu wołający może podać wynik zapytania
 *  z wąską listą kolumn, a nie ciągnąć całego wiersza z klauzulami. */
export type WierszUmowy = {
  id: string;
  typ: string;
  status: string;
  created_at: string;
  aneks_nr?: number | null;
  zakres_prac?: string | null;
  cena?: number | string | null;
  waluta?: string | null;
  termin_realizacji?: string | null;
};

/** Dokument, z którego pochodzą obowiązujące wartości. */
export type ZrodloWarunkow = {
  id: string;
  typ: "umowa" | "aneks";
  /** Numer aneksu; `null` dla samej umowy. */
  aneksNr: number | null;
  /** Identyfikator do wydruku — „UM-2026-A1B2C3" albo „ANEKS-1-UM-2026-A1B2C3". */
  reference: string;
  /** Data zawarcia (`created_at` dokumentu), w formacie RRRR-MM-DD. */
  zawarta: string;
  /** Zdanie po ludzku: „Aneks nr 1 z 04.08.2026" / „Umowa UM-2026-A1B2C3 z 04.08.2026". */
  opis: string;
};

export type WarunkiObowiazujace = {
  zakres_prac: string;
  cena: number;
  waluta: string;
  termin_realizacji: string | null;
  /** Skąd pochodzą powyższe cztery wartości. */
  zrodlo: ZrodloWarunkow;
  /** Umowa-matka — czego zlecenie dotyczy (patrz nagłówek pliku). */
  umowa: { id: string; reference: string; zawarta: string };
  /** Ile aneksów jest podpisanych. 0 = obowiązuje sama umowa. */
  aneksowPodpisanych: number;
};

const tekst = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const dzien = (v: unknown): string => tekst(v).slice(0, 10);

/** Aneksy, które NAPRAWDĘ zmieniły warunki — posortowane rosnąco po numerze.
 *
 * Warunek pisany przez **wyliczenie dozwolonego** (`status === "Podpisana"`),
 * nie przez wykluczanie zakazanego. Lekcja kroku 1: `status !== "Odrzucona"`
 * przepuszczało wszystko, czego ktoś nie zdążył wymienić. */
function podpisaneAneksy(aneksy: WierszUmowy[]): WierszUmowy[] {
  return aneksy
    .filter((a) => tekst(a.typ) === "aneks" && tekst(a.status) === "Podpisana")
    .sort((a, b) => Number(a.aneks_nr ?? 0) - Number(b.aneks_nr ?? 0));
}

function zrodloZWiersza(w: WierszUmowy, referencjaUmowy: string): ZrodloWarunkow {
  const zawarta = dzien(w.created_at);
  const data = formatPlDate(zawarta);
  if (tekst(w.typ) === "aneks") {
    const nr = Number(w.aneks_nr ?? 0);
    return {
      id: String(w.id),
      typ: "aneks",
      aneksNr: nr,
      reference: aneksReference(nr, referencjaUmowy),
      zawarta,
      opis: `Aneks nr ${nr}${data ? ` z ${data}` : ""}`,
    };
  }
  return {
    id: String(w.id),
    typ: "umowa",
    aneksNr: null,
    reference: referencjaUmowy,
    zawarta,
    opis: `Umowa ${referencjaUmowy}${data ? ` z ${data}` : ""}`,
  };
}

/**
 * Czysta postać — do wołania z komponentu albo z testu bez bazy.
 *
 * `aneksy` mogą być w dowolnej kolejności i mogą zawierać szkice; funkcja
 * sama odsiewa i sortuje. Wołający nie ma prawa musieć o tym pamiętać —
 * inaczej reguła znów zacznie żyć w kilku kopiach.
 */
export function warunkiZWierszy(umowa: WierszUmowy, aneksy: WierszUmowy[]): WarunkiObowiazujace {
  const referencjaUmowy = contractReference({
    id: umowa.id,
    typ: umowa.typ as ContractTyp,
    created_at: umowa.created_at,
  });
  const podpisane = podpisaneAneksy(aneksy);
  const obowiazujacy = podpisane[podpisane.length - 1] ?? umowa;

  return {
    zakres_prac: tekst(obowiazujacy.zakres_prac),
    cena: Number(obowiazujacy.cena) || 0,
    waluta: tekst(obowiazujacy.waluta) || "PLN",
    termin_realizacji: dzien(obowiazujacy.termin_realizacji) || null,
    zrodlo: zrodloZWiersza(obowiazujacy, referencjaUmowy),
    umowa: { id: String(umowa.id), reference: referencjaUmowy, zawarta: dzien(umowa.created_at) },
    aneksowPodpisanych: podpisane.length,
  };
}

/**
 * Warunki obowiązujące dla umowy o podanym `id`.
 *
 * Lista kolumn jest wypisana w obu zapytaniach dosłownie, a nie podstawiona ze
 * stałej: `sql` to tagged template, więc identyfikatorów nie da się w nim
 * sparametryzować, a sklejanie ze stringa to droga do wstrzyknięcia (ta sama
 * zasada, co przy trzech gałęziach `zapiszDaneKlienta`). Zmieniając jedną
 * listę, zmień drugą — `WierszUmowy` przypilnuje reszty.
 *
 * `null`, gdy dokumentu nie ma albo nie jest umową — aneks, NDA i DPA nie
 * zaczynają zlecenia i nie mają czego obowiązywać.
 */
export async function warunkiZlecenia(sql: SqlTag, umowaId: string): Promise<WarunkiObowiazujace | null> {
  const rows = await sql`
    SELECT id, typ, status, created_at, aneks_nr, zakres_prac, cena, waluta, termin_realizacji
    FROM contracts WHERE id = ${umowaId};
  `;
  const umowa = rows[0] as WierszUmowy | undefined;
  if (!umowa || tekst(umowa.typ) !== "umowa") return null;

  const aneksy = (await sql`
    SELECT id, typ, status, created_at, aneks_nr, zakres_prac, cena, waluta, termin_realizacji
    FROM contracts WHERE parent_contract_id = ${umowaId} AND typ = 'aneks';
  `) as WierszUmowy[];

  return warunkiZWierszy(umowa, aneksy);
}

/**
 * Warunki obowiązujące dla dokumentu, który MOŻE być aneksem.
 *
 * Podpisanie aneksu ma pociągać te same skutki co podpisanie umowy (termin
 * projektu), a trasa podpisu dostaje wtedy wiersz aneksu — nie umowy. Ta
 * funkcja sprowadza jedno do drugiego, żeby wołający nie musiał wiedzieć,
 * który przypadek trzyma w ręku.
 */
export async function warunkiZleceniaZDokumentu(
  sql: SqlTag,
  dokument: Record<string, unknown>
): Promise<WarunkiObowiazujace | null> {
  const typ = tekst(dokument.typ);
  if (typ === "aneks") {
    const rodzic = tekst(dokument.parent_contract_id);
    return rodzic ? await warunkiZlecenia(sql, rodzic) : null;
  }
  if (typ !== "umowa") return null;
  return await warunkiZlecenia(sql, String(dokument.id));
}

/**
 * Warunki obowiązujące dla PROJEKTU — po umowie, która go dotyczy.
 *
 * Bierzemy najświeższą podpisaną umowę projektu. „Podpisana", nie „ostatnia
 * jakakolwiek": szkic umowy leżący obok podpisanej nie ma prawa przestawiać
 * terminu projektu ani świecić w regułach spójności.
 */
export async function warunkiProjektu(sql: SqlTag, projektId: string): Promise<WarunkiObowiazujace | null> {
  const rows = await sql`
    SELECT id FROM contracts
    WHERE project_id = ${projektId} AND typ = 'umowa' AND status = 'Podpisana'
    ORDER BY created_at DESC LIMIT 1;
  `;
  const umowa = rows[0];
  if (!umowa) return null;
  return await warunkiZlecenia(sql, String(umowa.id));
}

// ── Wyrównanie terminu projektu (A6) ──────────────────────────────────────

/**
 * Ustawia termin projektu na termin z obowiązujących warunków.
 *
 * ── DECYZJA WŁAŚCICIELA (2026-08-04, start kroku 3) ───────────────────────
 * 1. **Umowa wygrywa z szablonem projektu.** Do dziś było odwrotnie i to po
 *    cichu: `projektPoPodpisieUmowy` ustawiał termin *tylko gdy projekt go nie
 *    miał*, a szablon („Automatyzacja / integracja" i dwa pozostałe) wstawiał
 *    własny termin sekundy wcześniej — więc warunek nigdy nie był spełniony.
 *    Mechanizm istniał i nigdy nie zadziałał. Umowa jest dokumentem podpisanym
 *    przez obie strony; szablon jest zgadywanką z palca.
 * 2. **Kamienie milowe z szablonu ZOSTAJĄ nietknięte.** Skalowanie ich do
 *    nowego terminu przepisywałoby także daty uzgodnione z klientem — bez
 *    pytania. Zamiast tego te, które wypadają po terminie, dostają widoczne
 *    ostrzeżenie na projekcie i regułę w *Zdrowiu*.
 * 3. **To jest AUTOMAT, nie propozycja** — ale zostawia ślad w logu. Edytor
 *    oferty obiecuje to wprost („projekt weźmie ją przy podpisie"), a pytanie,
 *    na które odpowiedź brzmi „tak" za każdym razem, uczy klikać bez czytania.
 *    Granica z `CLAUDE.md`: skutek świadomego kliknięcia właściciela (podpis).
 *
 * Zwraca, co się zmieniło — do wpisu na osi klienta. `null` = bez zmian
 * (brak projektu, brak terminu w warunkach albo termin już się zgadza).
 */
export async function wyrownajTerminProjektu(
  sql: SqlTag,
  projektId: string,
  warunki: WarunkiObowiazujace
): Promise<{ przed: string | null; po: string; zrodloOpis: string } | null> {
  const po = warunki.termin_realizacji;
  if (!po) return null;

  const rows = await sql`SELECT termin FROM projects WHERE id = ${projektId};`;
  const projekt = rows[0];
  if (!projekt) return null;

  const przed = dzien(projekt.termin) || null;
  if (przed === po) return null;

  await sql`UPDATE projects SET termin = ${po}, updated_at = now() WHERE id = ${projektId};`;
  return { przed, po, zrodloOpis: warunki.zrodlo.opis };
}

/** Zdanie do logu i na oś klienta — jedno źródło, bo idzie z dwóch tras
 *  podpisu i z reguł spójności. */
export function zdanieWyrownaniaTerminu(zmiana: { przed: string | null; po: string; zrodloOpis: string }): string {
  const przed = zmiana.przed ? formatPlDate(zmiana.przed) : "brak";
  return `Termin projektu wyrównany do obowiązujących warunków (${zmiana.zrodloOpis}): ${przed} → ${formatPlDate(zmiana.po)}`;
}

// ── Rozjazd szkicu faktury z warunkami (A8) ───────────────────────────────

export type RozjazdFaktury = {
  invoiceId: string;
  numer: string;
  clientId: string | null;
  klientNazwa: string;
  /** Suma netto pozycji szkicu — policzona tak samo jak `invoiceTotals`. */
  netto: number;
  waluta: string;
  warunki: WarunkiObowiazujace;
  /** Ile brakuje do obowiązującej kwoty; ujemne = szkic jest za wysoki. */
  roznica: number;
};

/**
 * Szkice faktur, których kwota nie zgadza się z warunkami obowiązującymi.
 *
 * Jedno zapytanie dla DWÓCH konsumentów — propozycji („poprawić?") i reguły
 * *Zdrowia* („czy stan bazy jest sprzeczny"). Rozdzielenie ich na dwa zapytania
 * byłoby dokładnie tą samą pomyłką, którą krok 3 sprząta w warunkach.
 *
 * ── Dlaczego tylko przy PODPISANYM ANEKSIE ────────────────────────────────
 * Bez aneksu „warunki obowiązujące" to sama umowa, a faktura na inną kwotę niż
 * umowa bywa najzupełniej poprawna: zaliczka, płatność etapami, faktura za
 * część zakresu. Reguła bez tego warunku świeciłaby na czerwono przy normalnej
 * pracy — a ekran, który świeci zawsze, uczy tylko go ignorować. A8 jest
 * węższe i konkretne: **aneks zmienił kwotę, a szkic faktury o tym nie wie.**
 *
 * ── Co jeszcze odsiewamy i dlaczego ───────────────────────────────────────
 * Lista pisana przez **wyliczenie dozwolonego**: `status = 'Szkic'` (wystawiona
 * faktura jest niezmienna — poprawia się ją korektą, nie edycją),
 * `typ_dokumentu = 'faktura'` (proforma i zaliczkowa mają się różnić z definicji),
 * brak `koryguje_id` i `rozlicza_zaliczke_id` (korekta i faktura rozliczeniowa
 * liczą się względem innego dokumentu, nie względem umowy), zgodna waluta
 * (kwot w dwóch walutach nie porównujemy — od tego jest kurs, a nie ta reguła).
 */
export async function rozjazdySzkicowFaktur(sql: SqlTag): Promise<RozjazdFaktury[]> {
  const kandydaci = await sql`
    SELECT i.id, i.numer, i.client_id, i.klient_nazwa, i.waluta, i.contract_id,
           COALESCE((
             SELECT SUM(ROUND((it.ilosc * it.cena_netto * (1 - it.rabat_procent / 100))::numeric, 2))
             FROM invoice_items it WHERE it.invoice_id = i.id
           ), 0) AS netto
    FROM invoices i
    JOIN contracts ct ON ct.id = i.contract_id
    WHERE i.status = 'Szkic'
      AND i.typ_dokumentu = 'faktura'
      AND i.koryguje_id IS NULL
      AND i.rozlicza_zaliczke_id IS NULL
      AND ct.typ = 'umowa'
      AND ct.status = 'Podpisana'
      AND EXISTS (
        SELECT 1 FROM contracts a
        WHERE a.parent_contract_id = ct.id AND a.typ = 'aneks' AND a.status = 'Podpisana'
      )
    ORDER BY i.updated_at DESC LIMIT 50;
  `;

  const wynik: RozjazdFaktury[] = [];
  const cache = new Map<string, WarunkiObowiazujace | null>();

  for (const w of kandydaci) {
    const umowaId = tekst(w.contract_id);
    if (!cache.has(umowaId)) cache.set(umowaId, await warunkiZlecenia(sql, umowaId));
    const warunki = cache.get(umowaId) ?? null;
    if (!warunki || warunki.aneksowPodpisanych === 0) continue;

    const waluta = tekst(w.waluta) || "PLN";
    if (waluta !== warunki.waluta) continue;

    const netto = Math.round((Number(w.netto) || 0) * 100) / 100;
    const roznica = Math.round((warunki.cena - netto) * 100) / 100;
    if (roznica === 0) continue;

    wynik.push({
      invoiceId: String(w.id),
      numer: tekst(w.numer),
      clientId: tekst(w.client_id) || null,
      klientNazwa: tekst(w.klient_nazwa),
      netto,
      waluta,
      warunki,
      roznica,
    });
  }
  return wynik;
}
