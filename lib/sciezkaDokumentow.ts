// Ścieżka dokumentów — „z tej oferty powstała ta umowa, z niej ten projekt
// i te faktury". Czysta logika bez "use client" i bez SQL: karta klienta
// i profil pojedynczego dokumentu budują drzewko TĄ SAMĄ funkcją.
//
// Wyciągnięte z `app/api/clients/[id]/route.ts` 2026-07-27, gdy mini-mapa
// weszła do profilu każdego dokumentu — dwie kopie tej reguły rozjechałyby
// się przy pierwszej zmianie (karta pokazywałaby inne zależności niż profil).

import { offerReference } from "./offers";
import { contractReference, type ContractTyp } from "./contracts";

export type OfferRow = {
  id: string;
  tytul: string;
  status: string;
  project_id: string | null;
  waluta?: string | null;
  /** Suma pozycji — liczona w zapytaniu, żeby kafelek drzewka nie kazał
   * wchodzić w ofertę tylko po to, żeby zobaczyć kwotę. */
  kwota?: number | null;
  created_at: string;
};
export type ContractRow = {
  id: string;
  typ: string;
  status: string;
  offer_id: string | null;
  project_id: string | null;
  cena: number | null;
  waluta: string | null;
  parent_contract_id: string | null;
  aneks_nr: number;
  created_at: string;
};
export type ProjectRow = { id: string; tytul: string; status: string; created_at: string };
export type InvoiceRow = {
  id: string;
  numer: string | null;
  status: string;
  typ_dokumentu: string;
  offer_id: string | null;
  contract_id: string | null;
  project_id: string | null;
  kwota: number | null;
  waluta: string | null;
  created_at: string;
};

/** Jeden węzeł ścieżki — tyle, ile potrzeba, żeby narysować kafelek drzewka,
 * kliknąć go i pokazać menu akcji.
 *
 * `rodzic` niesie ZALEŻNOŚĆ, nie kolejność: „ta faktura wynika z tej umowy".
 * Do 2026-07-27 ścieżka była płaską listą, więc dwie faktury z jednej umowy
 * wyglądały jak łańcuch faktura→faktura, choć są rodzeństwem. Drzewko bez
 * krawędzi rodzic–dziecko byłoby ładniejszą wersją tego samego kłamstwa. */
export type KrokSciezki = {
  rodzaj: "offer" | "contract" | "project" | "invoice";
  id: string;
  /** Co to za dokument („Oferta", „Aneks", „Zaliczka") — osobno od numeru,
   * żeby UI nie sklejało „Faktura Zaliczka (szkic)". */
  prefiks: string;
  etykieta: string;
  status: string;
  /** Id węzła, z którego ten wynika. `null` = korzeń wątku. */
  rodzic: string | null;
  /** Kwota dokumentu — kafelek bez pieniędzy przy fakturze i ofercie zmusza
   * do wchodzenia w każdy z osobna. Waluta osobno: panel nie przelicza kursów. */
  kwota: number | null;
  waluta: string | null;
  created_at: string;
};

/** Łączy dokumenty w wątki „oferta → umowa (→ aneks) → faktura".
 *
 * Zasada: wątek zaczyna OFERTA, bo od niej zaczyna się sprzedaż. Dokumenty bez
 * oferty (NDA, powierzenie danych, umowa wolnostojąca, faktura wpisana ręcznie)
 * dostają własny, jednoelementowy wątek — zamiast być doklejone do przypadkowej
 * oferty albo zniknąć z widoku. Ukryty dokument jest gorszy niż samotny.
 */
export function zbudujSciezki(
  offers: OfferRow[],
  contracts: ContractRow[],
  invoices: InvoiceRow[],
  projects: ProjectRow[]
): KrokSciezki[][] {
  const uzyteUmowy = new Set<string>();
  const uzyteFaktury = new Set<string>();
  const uzyteProjekty = new Set<string>();

  const krokOferty = (o: OfferRow): KrokSciezki => ({
    rodzaj: "offer",
    id: o.id,
    prefiks: "Oferta",
    etykieta: offerReference(o),
    status: o.status,
    rodzic: null,
    kwota: o.kwota ?? null,
    waluta: o.waluta ?? null,
    created_at: o.created_at,
  });
  const krokUmowy = (c: ContractRow, rodzic: string | null): KrokSciezki => ({
    rodzaj: "contract",
    id: c.id,
    rodzic,
    kwota: c.typ === "nda" || c.typ === "dpa" ? null : Number(c.cena) || null,
    waluta: c.waluta ?? null,
    prefiks: c.typ === "aneks" ? "Aneks" : c.typ === "nda" ? "NDA" : c.typ === "dpa" ? "Powierzenie" : "Umowa",
    etykieta:
      c.typ === "aneks"
        ? `nr ${c.aneks_nr}`
        : contractReference({ id: c.id, typ: c.typ as ContractTyp, created_at: c.created_at }),
    status: c.status,
    created_at: c.created_at,
  });
  const krokFaktury = (i: InvoiceRow, rodzic: string | null): KrokSciezki => ({
    rodzaj: "invoice",
    id: i.id,
    rodzic,
    kwota: i.kwota ?? null,
    waluta: i.waluta ?? null,
    prefiks: i.typ_dokumentu === "zaliczkowa" ? "Zaliczka" : i.typ_dokumentu === "proforma" ? "Proforma" : "Faktura",
    etykieta: i.numer || "(szkic)",
    status: i.status,
    created_at: i.created_at,
  });

  const krokProjektu = (p: ProjectRow, rodzic: string | null): KrokSciezki => ({
    rodzaj: "project",
    id: p.id,
    rodzic,
    kwota: null,
    waluta: null,
    prefiks: "Projekt",
    etykieta: p.tytul || "(bez tytułu)",
    status: p.status,
    created_at: p.created_at,
  });

  const sciezki: KrokSciezki[][] = [];

  for (const o of offers) {
    const wezly = [krokOferty(o)];

    // Projekt wisi pod UMOWĄ, jeśli umowa go wskazuje — „papier przed pracą".
    // Gdy umowy nie ma, wisi wprost pod ofertą.
    const projektId =
      contracts.find((c) => c.offer_id === o.id && c.project_id)?.project_id ??
      o.project_id ??
      invoices.find((f) => f.offer_id === o.id && f.project_id)?.project_id ??
      null;
    const projekt = projektId ? projects.find((p) => p.id === projektId) : undefined;
    let rodzicProjektu: string = o.id;

    for (const c of contracts.filter((x) => x.offer_id === o.id && x.typ !== "aneks")) {
      wezly.push(krokUmowy(c, o.id));
      uzyteUmowy.add(c.id);
      // Aneks wisi pod SWOJĄ umową, nie pod ofertą — zmienia jej warunki.
      for (const a of contracts.filter((x) => x.parent_contract_id === c.id)) {
        wezly.push(krokUmowy(a, c.id));
        uzyteUmowy.add(a.id);
      }
      if (projekt && c.project_id === projekt.id) rodzicProjektu = c.id;
    }

    if (projekt && !uzyteProjekty.has(projekt.id)) {
      wezly.push(krokProjektu(projekt, rodzicProjektu));
      uzyteProjekty.add(projekt.id);
    }

    // Faktura wisi pod umową, z której wynika; bez umowy — pod ofertą. Dwie
    // faktury z jednej umowy są RODZEŃSTWEM, nie łańcuchem (to właśnie gubiła
    // płaska lista).
    for (const f of invoices.filter((x) => !uzyteFaktury.has(x.id))) {
      const podUmowa = f.contract_id && uzyteUmowy.has(f.contract_id) ? f.contract_id : null;
      const podOferta = f.offer_id === o.id ? o.id : null;
      const rodzic = podUmowa ?? podOferta;
      if (!rodzic) continue;
      wezly.push(krokFaktury(f, rodzic));
      uzyteFaktury.add(f.id);
    }

    sciezki.push(wezly);
  }

  // Wątki bez oferty — umowa wolnostojąca, NDA, powierzenie danych.
  for (const c of contracts.filter((x) => !uzyteUmowy.has(x.id) && x.typ !== "aneks")) {
    const wezly = [krokUmowy(c, null)];
    uzyteUmowy.add(c.id);
    for (const a of contracts.filter((x) => x.parent_contract_id === c.id && !uzyteUmowy.has(x.id))) {
      wezly.push(krokUmowy(a, c.id));
      uzyteUmowy.add(a.id);
    }
    const p = c.project_id ? projects.find((x) => x.id === c.project_id) : undefined;
    if (p && !uzyteProjekty.has(p.id)) {
      wezly.push(krokProjektu(p, c.id));
      uzyteProjekty.add(p.id);
    }
    for (const f of invoices.filter((x) => x.contract_id === c.id && !uzyteFaktury.has(x.id))) {
      wezly.push(krokFaktury(f, c.id));
      uzyteFaktury.add(f.id);
    }
    sciezki.push(wezly);
  }

  // Pojedynczy dokument NIE jest ścieżką — sam ze sobą nic nie tworzy, a
  // narysowany jako drzewko z jednym kafelkiem powtarza rejestr niżej
  // (zgłoszenie właściciela 2026-07-27: „jak mam to odczytywać?").
  return sciezki.filter((s) => s.length >= 2);
}

