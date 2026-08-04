/**
 * Propozycje — komplet skutków zdarzenia, podawany do zatwierdzenia.
 *
 * **Zasada, zatwierdzona przez właściciela 2026-08-02: panel proponuje,
 * właściciel zatwierdza.**
 *
 * Do Fazy 3 panel robił jedno i drugie niekonsekwentnie: lead przestawiał się
 * sam przy akceptacji oferty, a klient po opłaconej fakturze nie przestawiał
 * się nigdy. Ujednolicone w stronę propozycji — ale nie wszystko naraz, patrz
 * „Granica automatu" niżej.
 *
 * ── Skąd biorą się propozycje: z DANYCH, nie ze zdarzeń ───────────────────
 * Reguła jest zapytaniem o stan bazy („klient jest Prospektem, a ma opłaconą
 * fakturę"), a nie wpisem robionym w trasie w chwili zdarzenia. To świadomy
 * wybór i wynika wprost z lekcji Fazy 2: bramka wysyłki miała obowiązywać
 * w czterech miejscach, a wysyłek okazało się siedem. Propozycja zapisywana
 * przy zdarzeniu obowiązywałaby wyłącznie tam, gdzie ktoś pamiętał ją dopisać.
 *
 * Trzy rzeczy dostajemy z tego za darmo:
 * 1. **Obie drogi C1 działają tak samo.** Opinia z publicznego formularza
 *    i opinia wpisana ręcznie w panelu zostawiają ten sam ślad w bazie, więc
 *    rodzą tę samą propozycję. Nie da się dodać trzeciej drogi i zapomnieć.
 * 2. **Działa wstecz.** Rekordy sprzed tej fazy też dostają propozycję.
 * 3. **„Jedna na rekord" wychodzi sama** (decyzja właściciela): klucz to para
 *    (reguła, rekord), więc klient z trzema opłaconymi fakturami dostaje jedną
 *    propozycję, a nie trzy.
 *
 * ── „Nie teraz" ───────────────────────────────────────────────────────────
 * Trwałe, w bazie (`propozycje_decyzje`), na zawsze dla tej pary — decyzja
 * właściciela. Odrzucona propozycja nie wraca nazajutrz; to różnica między
 * pomocnym panelem a natrętnym. Odrzucenie da się cofnąć („Przywróć") — bo
 * jedno pomyłkowe kliknięcie nie może kasować podpowiedzi bezpowrotnie.
 *
 * ── Granica automatu (decyzja właściciela) ────────────────────────────────
 * Automatem zostaje skutek, który właściciel wywołał świadomym kliknięciem
 * i który jest oczywisty — akceptujesz ofertę, lead robi się wygrany
 * (`lib/offerAccept.ts`). Propozycją staje się skutek, który przychodzi
 * z zewnątrz (opinia klienta, zapłata) albo nie jest oczywisty: wygrany lead
 * z zaplanowanym demo bywa wygranym leadem, z którym to demo i tak się odbędzie.
 *
 * ── Czym to NIE jest ──────────────────────────────────────────────────────
 * **Nie ma tu modelu.** To deterministyczne reguły SQL, zgodnie ze „Świadomymi
 * decyzjami produktowymi" w `CLAUDE.md`. „Skrzynka propozycji AI"
 * (`docs/plany-modulow/`) to osobna, odłożona rzecz o treściach generowanych
 * przez model. Gdyby kiedyś powstała, da się je połączyć — ale nie odwrotnie.
 *
 * Nie jest też kontrolą spójności (`lib/spojnosc.ts`). Tamta odpowiada „czy
 * stan bazy jest wewnętrznie sprzeczny" i nie proponuje niczego; ta odpowiada
 * „mogę to naprawić jednym kliknięciem, chcesz?". Dlatego reguła spójności
 * milczy na tym, co właściciel świadomie odrzucił — patrz `lib/spojnosc.ts`.
 */

import { randomUUID } from "node:crypto";
import { getSql, logClientEvent, type Sql } from "./db";
import { formatPlDate } from "./projects";
import { formatMoney } from "./invoices";
import { domyslnaStawkaVat } from "./offerAccept";
import { skutkiZmianyStatusuProjektu } from "./skutkiProjektu";
import { rozjazdySzkicowFaktur } from "./warunkiObowiazujace";

// ── Słownik reguł ──────────────────────────────────────────────────────────

export const REGULY_PROPOZYCJI = [
  /** C1 — klient wystawił opinię, projekt dalej jest otwarty. */
  "opinia-zamyka-projekt",
  /** C3 — lead wygrany, a ma żywe przypomnienie o kontakcie. */
  "wygrany-lead-bez-przypomnienia",
  /** C4 — faktura opłacona, klient dalej jest „Prospektem". */
  "oplacony-klient-aktywny",
  /** A8 (drugie przejście) — podpisany aneks zmienił wynagrodzenie, a szkic
   *  faktury dalej opiewa na kwotę sprzed aneksu. Decyzja właściciela
   *  z 2026-08-04: PROPOZYCJA, nie automat — kwoty na dokumencie księgowym nie
   *  zmieniają się bez jego kliknięcia. */
  "faktura-wg-obowiazujacych-warunkow",
] as const;

export type RegulaPropozycji = (typeof REGULY_PROPOZYCJI)[number];

export function isRegulaPropozycji(v: unknown): v is RegulaPropozycji {
  return typeof v === "string" && (REGULY_PROPOZYCJI as readonly string[]).includes(v);
}

/** Moduł, w którego widoku propozycja pokazuje się poza Pulpitem. */
export type ModulPropozycji = "projects" | "leads" | "clients" | "invoices";

export type Propozycja = {
  regula: RegulaPropozycji;
  /** Rekord, KTÓREGO dotyczy skutek — nie rekord, który wywołał zdarzenie. */
  rekordId: string;
  modul: ModulPropozycji;
  /** Jedno zdanie, zakończone pytaniem. To jest cała treść propozycji. */
  zdanie: string;
  /** Napis na przycisku „zrób to" — czasownik, nie „OK". */
  akcja: string;
  link: string;
};

/** Klucz pary (reguła, rekord) — po nim zapisuje się „nie teraz" i po nim
 *  odróżnia się propozycje w interfejsie. */
export function kluczPropozycji(regula: string, rekordId: string): string {
  return `${regula}:${rekordId}`;
}

// ── Zdania (czyste — testowalne bez bazy) ──────────────────────────────────

const nazwaLub = (v: unknown, zapas: string): string =>
  typeof v === "string" && v.trim() ? v.trim() : zapas;

export function zdanieOpiniaZamykaProjekt(tytul: string): string {
  return `Opinia o „${nazwaLub(tytul, "projekcie")}” przyszła — zamknąć projekt jako „Wdrożone”?`;
}

export function zdanieWygranyLead(firma: string, termin: string, dzialanie: string): string {
  const kiedy = formatPlDate(termin);
  const co = nazwaLub(dzialanie, "");
  const ogon = co ? `zaplanowane „${co}”${kiedy ? ` na ${kiedy}` : ""}` : `przypomnienie${kiedy ? ` na ${kiedy}` : ""}`;
  return `${nazwaLub(firma, "Lead")} jest wygrany, a ma ${ogon} — zdjąć przypomnienie?`;
}

/**
 * A8 — szkic faktury nie idzie za podpisanym aneksem.
 *
 * Zdanie mówi DOKŁADNIE, co się stanie po kliknięciu („dopisać pozycję
 * wyrównującą"), a nie ogólnie „poprawić". Propozycja, po której właściciel
 * musi sprawdzić, co się właściwie zmieniło, nie jest lepsza od cichej
 * podmiany — jest gorsza, bo jeszcze kosztuje kliknięcie.
 */
export function zdanieRozjazdFaktury(
  zrodloOpis: string,
  cena: number,
  numerFaktury: string,
  netto: number,
  roznica: number,
  waluta: string
): string {
  const numer = nazwaLub(numerFaktury, "szkic faktury");
  const znak = roznica > 0 ? "+" : "−";
  return (
    `${zrodloOpis} ustala wynagrodzenie na ${formatMoney(cena, waluta)}, ` +
    `a ${numer} opiewa na ${formatMoney(netto, waluta)} — ` +
    `dopisać pozycję wyrównującą (${znak}${formatMoney(Math.abs(roznica), waluta)})?`
  );
}

export function zdanieKlientAktywny(nazwa: string, numerFaktury: string): string {
  // „zapłacił(a)" — ta sama forma co w regułach spójności. Nazwa firmy bywa
  // dowolnego rodzaju, a zgadywanie go z końcówki jest gorsze niż nawias.
  const numer = nazwaLub(numerFaktury, "");
  return `${nazwaLub(nazwa, "Klient")} zapłacił(a)${numer ? ` fakturę ${numer}` : ""} — przestawić klienta na „Aktywny”?`;
}

/** Zdejmuje z listy to, co właściciel odrzucił. Osobna, czysta funkcja, bo to
 *  jedyne miejsce decydujące o widoczności — i jedyne, które da się sprawdzić
 *  testem bez bazy. */
export function odfiltrujOdrzucone(propozycje: Propozycja[], odrzucone: Iterable<string>): Propozycja[] {
  const zbior = new Set(odrzucone);
  return propozycje.filter((p) => !zbior.has(kluczPropozycji(p.regula, p.rekordId)));
}

// ── Reguły ─────────────────────────────────────────────────────────────────

type Regula = {
  regula: RegulaPropozycji;
  modul: ModulPropozycji;
  /** Kandydaci wprost z bazy — BEZ filtra odrzuceń (ten robi `odfiltrujOdrzucone`). */
  zbierz: (sql: Sql) => Promise<Propozycja[]>;
  /**
   * Wykonuje skutek. Zapis warunkowy („claim"): gdy warunek już nie zachodzi
   * (ktoś zamknął projekt ręcznie, ktoś przestawił klienta), zwraca
   * `nieaktualne` zamiast udawać, że coś zrobił.
   */
  wykonaj: (sql: Sql, rekordId: string) => Promise<{ ok: boolean; komunikat: string }>;
};

const NIEAKTUALNE = { ok: false, komunikat: "Ta propozycja jest już nieaktualna — stan zmienił się w międzyczasie." };

const REGULY: Regula[] = [
  {
    regula: "opinia-zamyka-projekt",
    modul: "projects",
    zbierz: async (sql) => {
      const r = await sql`
        SELECT id, tytul FROM projects
        WHERE review_submitted_at IS NOT NULL AND status <> 'Wdrożone'
        ORDER BY review_submitted_at DESC LIMIT 50;
      `;
      return r.map((w) => ({
        regula: "opinia-zamyka-projekt" as const,
        rekordId: String(w.id),
        modul: "projects" as const,
        zdanie: zdanieOpiniaZamykaProjekt(String(w.tytul ?? "")),
        akcja: "Zamknij projekt",
        link: `/pl/admin/projects/${w.id}`,
      }));
    },
    wykonaj: async (sql, rekordId) => {
      // Warunek wejścia jest częścią UPDATE-u, nie osobnym SELECT-em przed
      // nim — inaczej dwa kliknięcia obok siebie zamknęłyby projekt dwa razy
      // i dwa razy zaplanowały nurture.
      const zmienione = await sql`
        UPDATE projects SET status = 'Wdrożone', updated_at = now()
        WHERE id = ${rekordId} AND review_submitted_at IS NOT NULL AND status <> 'Wdrożone'
        RETURNING id, tytul, client_id;
      `;
      if (zmienione.length === 0) return NIEAKTUALNE;
      const p = zmienione[0];
      // Komplet skutków zamknięcia (oś klienta + kontakt kontrolny) — ta sama
      // funkcja, którą woła ręczna zmiana statusu w panelu.
      await skutkiZmianyStatusuProjektu(
        sql,
        {
          id: rekordId,
          tytul: typeof p.tytul === "string" ? p.tytul : "Projekt",
          clientId: typeof p.client_id === "string" ? p.client_id : null,
        },
        "Wdrożone"
      );
      return { ok: true, komunikat: "Projekt zamknięty jako „Wdrożone”." };
    },
  },
  {
    regula: "wygrany-lead-bez-przypomnienia",
    modul: "leads",
    zbierz: async (sql) => {
      const r = await sql`
        SELECT id, firma, next_followup, next_action FROM leads
        WHERE status = 'Zamknięte - sukces' AND next_followup IS NOT NULL
        ORDER BY next_followup ASC LIMIT 50;
      `;
      return r.map((w) => ({
        regula: "wygrany-lead-bez-przypomnienia" as const,
        rekordId: String(w.id),
        modul: "leads" as const,
        zdanie: zdanieWygranyLead(
          String(w.firma ?? ""),
          String(w.next_followup ?? "").slice(0, 10),
          String(w.next_action ?? "")
        ),
        akcja: "Zdejmij przypomnienie",
        link: `/pl/admin/leads/${w.id}`,
      }));
    },
    wykonaj: async (sql, rekordId) => {
      // `next_action` to TEXT NOT NULL DEFAULT '' (lib/db.ts) — czyszczenie
      // idzie pustym stringiem, nie NULL-em. Nazwa kolumny sugeruje inaczej;
      // wyszło dopiero z przejścia, bo `tsc` o więzach bazy nic nie wie.
      const zmienione = await sql`
        UPDATE leads SET next_followup = NULL, next_action = '', updated_at = now()
        WHERE id = ${rekordId} AND status = 'Zamknięte - sukces' AND next_followup IS NOT NULL
        RETURNING id;
      `;
      if (zmienione.length === 0) return NIEAKTUALNE;
      return { ok: true, komunikat: "Przypomnienie zdjęte z wygranego leada." };
    },
  },
  {
    regula: "oplacony-klient-aktywny",
    modul: "clients",
    zbierz: async (sql) => {
      // DISTINCT ON po kliencie — „jedna propozycja na rekord" (decyzja
      // właściciela): trzy opłacone faktury tego samego klienta to jedna
      // prośba o przestawienie statusu, nie trzy. Numer bierzemy z tej
      // najświeższej, żeby zdanie mówiło o czymś konkretnym.
      const r = await sql`
        SELECT DISTINCT ON (c.id) c.id, c.nazwa, i.numer
        FROM clients c JOIN invoices i ON i.client_id = c.id
        WHERE i.status = 'Opłacona' AND c.status = 'Prospekt'
        ORDER BY c.id, i.updated_at DESC LIMIT 50;
      `;
      return r.map((w) => ({
        regula: "oplacony-klient-aktywny" as const,
        rekordId: String(w.id),
        modul: "clients" as const,
        zdanie: zdanieKlientAktywny(String(w.nazwa ?? ""), String(w.numer ?? "")),
        akcja: "Przestaw na Aktywny",
        link: `/pl/admin/clients/${w.id}`,
      }));
    },
    wykonaj: async (sql, rekordId) => {
      const zmienione = await sql`
        UPDATE clients SET status = 'Aktywny', updated_at = now()
        WHERE id = ${rekordId} AND status = 'Prospekt'
          AND EXISTS (SELECT 1 FROM invoices i WHERE i.client_id = clients.id AND i.status = 'Opłacona')
        RETURNING id, nazwa;
      `;
      if (zmienione.length === 0) return NIEAKTUALNE;
      await logClientEvent(
        sql,
        rekordId,
        "client_status_changed",
        "Status klienta: Prospekt → Aktywny (po opłaconej fakturze)"
      );
      return { ok: true, komunikat: "Klient przestawiony na „Aktywny”." };
    },
  },
  {
    regula: "faktura-wg-obowiazujacych-warunkow",
    modul: "invoices",
    zbierz: async (sql) => {
      const rozjazdy = await rozjazdySzkicowFaktur(sql);
      return rozjazdy.map((r) => ({
        regula: "faktura-wg-obowiazujacych-warunkow" as const,
        rekordId: r.invoiceId,
        modul: "invoices" as const,
        zdanie: zdanieRozjazdFaktury(r.warunki.zrodlo.opis, r.warunki.cena, r.numer, r.netto, r.roznica, r.waluta),
        akcja: "Dopisz pozycję",
        link: `/pl/admin/invoices/${r.invoiceId}`,
      }));
    },
    wykonaj: async (sql, rekordId) => {
      // Warunek liczymy PONOWNIE, tą samą funkcją co przy zbieraniu — a nie
      // ufamy temu, co propozycja mówiła w chwili wyrenderowania. Między
      // pokazaniem a kliknięciem właściciel mógł poprawić szkic ręcznie albo
      // wystawić fakturę; wtedy dopisanie pozycji byłoby cichym psuciem
      // dokumentu, a nie pomocą.
      const rozjazd = (await rozjazdySzkicowFaktur(sql)).find((r) => r.invoiceId === rekordId);
      if (!rozjazd) return NIEAKTUALNE;

      // Dopisujemy POZYCJĘ, nie przepisujemy istniejących. Aneks podnosi
      // wynagrodzenie, bo urósł zakres — więc na fakturze ma być widać, za co.
      // Przepisanie kwot w miejscu skasowałoby rozbicie, które właściciel
      // ustawił, i zostawiłoby dokument, z którego nie wynika, skąd różnica.
      const stawka = (
        await sql`
          SELECT vat_stawka FROM invoice_items WHERE invoice_id = ${rekordId}
          ORDER BY (ilosc * cena_netto) DESC LIMIT 1;
        `
      )[0];
      const kraj = (await sql`SELECT klient_kraj FROM invoices WHERE id = ${rekordId};`)[0];
      const vat =
        typeof stawka?.vat_stawka === "string" && stawka.vat_stawka
          ? stawka.vat_stawka
          : domyslnaStawkaVat(typeof kraj?.klient_kraj === "string" ? kraj.klient_kraj : "");

      const maxPos = (await sql`SELECT COALESCE(MAX(position), -1) AS p FROM invoice_items WHERE invoice_id = ${rekordId};`)[0];
      const position = Number(maxPos?.p ?? -1) + 1;

      await sql`
        INSERT INTO invoice_items (id, invoice_id, nazwa, ilosc, jednostka, cena_netto, vat_stawka, position)
        VALUES (${randomUUID()}, ${rekordId}, ${`Zmiana wynagrodzenia — ${rozjazd.warunki.zrodlo.opis}`},
                1, 'usł.', ${rozjazd.roznica}, ${vat}, ${position});
      `;
      await sql`UPDATE invoices SET updated_at = now() WHERE id = ${rekordId};`;

      return {
        ok: true,
        komunikat: `Dopisano pozycję na ${formatMoney(rozjazd.roznica, rozjazd.waluta)}. Sprawdź nazwę i stawkę VAT przed wystawieniem.`,
      };
    },
  },
];

// ── Odczyt i decyzje ───────────────────────────────────────────────────────

/** Odrzucone pary (reguła, rekord) jako zbiór kluczy. */
async function odrzuconeKlucze(sql: Sql): Promise<Set<string>> {
  const r = await sql`SELECT regula, rekord_id FROM propozycje_decyzje;`;
  return new Set(r.map((w) => kluczPropozycji(String(w.regula), String(w.rekord_id))));
}

export type StanPropozycji = {
  propozycje: Propozycja[];
  /** Ile propozycji właściciel odrzucił — do „pokaż odrzucone" w panelu. */
  odrzuconych: number;
};

/**
 * Wszystkie aktualne propozycje, bez odrzuconych. `modul` zawęża do jednego
 * modułu (widok Projektów pokazuje tylko swoje).
 *
 * Każda reguła w osobnym `try` — ta sama zasada co w `lib/spojnosc.ts`: jedna
 * wywrócona nie może zabrać pozostałych ani całego Pulpitu.
 */
export async function zbierzPropozycje(modul?: ModulPropozycji): Promise<StanPropozycji> {
  const sql = getSql();
  const doPytania = modul ? REGULY.filter((r) => r.modul === modul) : REGULY;

  const zebrane = await Promise.all(
    doPytania.map(async (r) => {
      try {
        return await r.zbierz(sql);
      } catch (e) {
        console.error(`[propozycje] reguła ${r.regula}`, e);
        return [];
      }
    })
  );

  let odrzucone: Set<string>;
  try {
    odrzucone = await odrzuconeKlucze(sql);
  } catch (e) {
    // Nie udało się odczytać decyzji → NIE pokazujemy nic. Odwrotnie byłoby
    // gorzej: propozycja odrzucona miesiąc temu wróciłaby jak gdyby nigdy nic,
    // czyli dokładnie to, czego „nie teraz" ma nie robić.
    console.error("[propozycje] nie udało się odczytać odrzuceń", e);
    return { propozycje: [], odrzuconych: 0 };
  }

  return {
    propozycje: odfiltrujOdrzucone(zebrane.flat(), odrzucone),
    odrzuconych: odrzucone.size,
  };
}

/** Lista tego, co odrzucone — żeby „nie teraz" dało się cofnąć. */
export async function odrzuconePropozycje(): Promise<{ regula: string; rekordId: string; kiedy: string }[]> {
  const sql = getSql();
  const r = await sql`SELECT regula, rekord_id, kiedy FROM propozycje_decyzje ORDER BY kiedy DESC LIMIT 100;`;
  return r.map((w) => ({ regula: String(w.regula), rekordId: String(w.rekord_id), kiedy: String(w.kiedy) }));
}

export async function wykonajPropozycje(
  regula: RegulaPropozycji,
  rekordId: string
): Promise<{ ok: boolean; komunikat: string }> {
  const r = REGULY.find((x) => x.regula === regula);
  if (!r) return { ok: false, komunikat: "Nieznana propozycja." };
  return await r.wykonaj(getSql(), rekordId);
}

/** „Nie teraz" — trwale, na zawsze dla tej pary. */
export async function odrzucPropozycje(regula: RegulaPropozycji, rekordId: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO propozycje_decyzje (regula, rekord_id) VALUES (${regula}, ${rekordId})
    ON CONFLICT (regula, rekord_id) DO NOTHING;
  `;
}

/** Cofnięcie „nie teraz" — propozycja wraca, jeśli warunek nadal zachodzi. */
export async function przywrocPropozycje(regula: RegulaPropozycji, rekordId: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM propozycje_decyzje WHERE regula = ${regula} AND rekord_id = ${rekordId};`;
}

/** Czy ta para została świadomie odrzucona — pyta o to `lib/spojnosc.ts`,
 *  żeby nie zgłaszać jako niespójności czegoś, co właściciel rozstrzygnął. */
export async function kluczeOdrzucone(): Promise<Set<string>> {
  try {
    return await odrzuconeKlucze(getSql());
  } catch {
    return new Set();
  }
}
