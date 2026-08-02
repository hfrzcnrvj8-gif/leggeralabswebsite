/**
 * Przejście „na sucho” — cała droga klienta jednym poleceniem.
 *
 *   npm run przejscie          (wymaga działającego `npm run dev`)
 *
 * Idzie dokładnie tą drogą, którą 2026-08-02 przeklikałem ręcznie:
 * lead → rozmowa → oferta → wysyłka → akceptacja przez klienta → umowa →
 * podpis → projekt → faktura → wystawienie → zapłata → opinia.
 * Po KAŻDYM kroku sprawdza DANE, nie kod odpowiedzi — bo wszystkie znaleziska
 * z tamtego przejścia wyszły z kodem 200 (`docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md`).
 *
 * ── Dlaczego trzy stany, a nie „przeszło / nie przeszło” ──────────────────
 * Gdyby to była zwykła asercja, skrypt byłby czerwony od pierwszego
 * uruchomienia (bo luki są znane i jeszcze nienaprawione) i nie dałoby się
 * odróżnić „luka, o której wiemy” od „właśnie coś zepsuliśmy”. Dlatego każde
 * sprawdzenie deklaruje, czy dziś MA działać, czy jest znaną luką z numerem
 * z dokumentu przejścia:
 *
 *   ✓  DZIAŁA          — i ma działać. Zielone.
 *   ✗  REGRESJA        — miało działać, nie działa. **To jedyna rzecz, która
 *                        wywala skrypt kodem 1.**
 *   ⚠  ZNANA LUKA      — nie działa i wiemy o tym. Nie wywala.
 *   ★  NAPRAWIONE      — znana luka zaczęła działać. Nie wywala, ale krzyczy,
 *                        żeby zdjąć znacznik `luka` — inaczej lista kłamie.
 *
 * Ostatni stan jest tu najważniejszy: to on pilnuje, żeby lista luk nie
 * zestarzała się tak, jak zestarzała się tabela Modułu 59 (34 wskazania → 22
 * nieaktualne). Naprawa bez zdjęcia znacznika jest wykrywana automatycznie.
 *
 * ── Uwaga o danych ────────────────────────────────────────────────────────
 * Skrypt zakłada PRAWDZIWE rekordy w dev-bazie. PGlite żyje w pamięci procesu
 * `next dev`, więc restart serwera = czysta baza. Rekordy dostają w nazwie
 * znacznik przebiegu, żeby dało się je odróżnić od danych z seeda.
 */

const BAZA = process.env.PRZEJSCIE_URL ?? "http://localhost:3000";

/** Dane wystawcy — prowizoryczne, firma nie jest jeszcze zarejestrowana.
 *  Żyją wyłącznie w dev-bazie PGlite (w pamięci procesu `next dev`). */
const DANE_FIRMY = {
  nazwa: "Leggera Labs Patryk Piecyk",
  nip: "6771234567",
  osoba_podpisujaca: "Patryk Piecyk",
  ulica: "ul. Kalwaryjska 33/5",
  kod: "30-504",
  miasto: "Kraków",
  email: "kontakt@leggeralabs.pl",
  telefon: "+48 600 100 200",
  konto: "PL61 1090 1014 0000 0712 1981 2874",
  bank_nazwa: "mBank",
};
const ZNACZNIK = new Date().toISOString().slice(11, 19).replace(/:/g, "");
const FIRMA = `Drukarnia Helios [przejście ${ZNACZNIK}]`;

// ── Zbieranie wyników ──────────────────────────────────────────────────────

type Stan = "DZIALA" | "REGRESJA" | "LUKA" | "NAPRAWIONE";
type Wynik = { krok: string; opis: string; stan: Stan; luka?: string; szczegol?: string };

const wyniki: Wynik[] = [];
let krokBiezacy = "—";

function krok(nazwa: string): void {
  krokBiezacy = nazwa;
  console.log(`\n── ${nazwa}`);
}

/**
 * @param opis   zdanie, które MA być prawdziwe o zapleczu
 * @param spelnione czy jest prawdziwe teraz
 * @param luka   numer znaleziska z PIERWSZE-PRZEJSCIE-NA-SUCHO.md, jeśli to
 *               znana, jeszcze nienaprawiona luka
 */
function sprawdz(opis: string, spelnione: boolean, luka?: string, szczegol?: string): void {
  let stan: Stan;
  if (spelnione) stan = luka ? "NAPRAWIONE" : "DZIALA";
  else stan = luka ? "LUKA" : "REGRESJA";

  const ikona = { DZIALA: "✓", REGRESJA: "✗", LUKA: "⚠", NAPRAWIONE: "★" }[stan];
  const ogon =
    stan === "LUKA" ? `  (znana luka ${luka})`
    : stan === "NAPRAWIONE" ? `  (luka ${luka} NAPRAWIONA — zdejmij znacznik)`
    : "";
  console.log(`   ${ikona} ${opis}${ogon}${szczegol && stan !== "DZIALA" ? `\n       → ${szczegol}` : ""}`);
  wyniki.push({ krok: krokBiezacy, opis, stan, luka, szczegol });
}

const obejscia: string[] = [];
const pominiete: string[] = [];

/**
 * Robi ręcznie to, co panel powinien zrobić sam — żeby droga mogła iść dalej
 * i żeby dało się przetestować wszystko ZA luką.
 *
 * **Od Fazy 1 nieużywane i to jest wynik, nie martwy kod**: jedyne obejście
 * (dopisywanie e-maila klienta do oferty, skutek luki B1) zniknęło razem
 * z luką. Zostawiamy mechanizm, bo kolejne fazy planu mogą go potrzebować,
 * a licznik `↻ obejścia` ma pokazywać zero jako ZMIERZONE, nie jako brak
 * pomiaru.
 *
 * Liczba obejść to osobny wynik przejścia: mówi, ile razy właściciel musi
 * załatać przepływ palcami, zanim dojdzie od leada do zapłaconej faktury.
 */
async function obejscie(luka: string, opis: string, dzialanie: () => Promise<void>): Promise<void> {
  await dzialanie();
  console.log(`   ↻ obejście ${luka}: ${opis}`);
  obejscia.push(`${luka} — ${opis}`);
}

// ── Rozmowa z panelem ──────────────────────────────────────────────────────

async function api(
  metoda: string,
  sciezka: string,
  body?: unknown
): Promise<{ status: number; dane: any }> {
  const odp = await fetch(`${BAZA}${sciezka}`, {
    method: metoda,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const tekst = await odp.text();
  let dane: any = null;
  try {
    dane = tekst ? JSON.parse(tekst) : null;
  } catch {
    dane = { _niePoprawnyJSON: tekst.slice(0, 300) };
  }
  return { status: odp.status, dane };
}

/** Wywala przejście od razu — bez tego rekordu nie ma czego sprawdzać dalej. */
function wymagaj(warunek: boolean, komunikat: string): asserts warunek {
  if (!warunek) {
    console.error(`\n💥 Przejście przerwane w kroku „${krokBiezacy}”: ${komunikat}`);
    process.exit(2);
  }
}

function id(dane: any): string | null {
  return dane?.id ?? dane?.offer?.id ?? dane?.invoice?.id ?? dane?.contract?.id ?? null;
}

// ── Droga klienta ──────────────────────────────────────────────────────────

async function przejscie(): Promise<void> {
  // ── 0. Czy w ogóle jest z czym rozmawiać ───────────────────────────────
  krok("Serwer");
  try {
    const puls = await api("GET", "/api/leads");
    wymagaj(
      puls.status === 200,
      `GET /api/leads zwróciło ${puls.status}. Przy 401 brakuje DEV_ADMIN_BYPASS=1 w .env.local.`
    );
    console.log(`   ✓ ${BAZA} odpowiada, trasy otwarte (dev-login)`);
  } catch {
    console.error(
      `\n💥 Nie ma kontaktu z ${BAZA}.\n   Uruchom  npm run dev  w drugim oknie i powtórz.`
    );
    process.exit(2);
  }

  // ── 0b. Warunki początkowe ─────────────────────────────────────────────
  // Bez tego wynik przejścia zależy od tego, KIEDY wstał serwer i czy ktoś
  // wcześniej klikał po panelu — PGlite żyje w pamięci procesu. Ustawiamy
  // dane firmy jawnie, żeby dwa przebiegi dawały ten sam wynik.
  krok("Warunki początkowe");
  await api("PATCH", "/api/settings", DANE_FIRMY);
  const ust = (await api("GET", "/api/settings")).dane;
  const firmaUst = ust?.settings ?? ust;
  wymagaj(!!firmaUst?.nazwa, "nie udało się ustawić danych firmy — bez nich wydruki są anonimowe");
  console.log(`   ✓ dane firmy ustawione (${firmaUst.nazwa}, NIP ${firmaUst.nip})`);

  // ── 1. Lead z polecenia ────────────────────────────────────────────────
  krok("Lead");
  const nowyLead = await api("POST", "/api/leads", {
    firma: FIRMA,
    osoba_kontaktowa: "Marta Zielińska",
    telefon: "601 220 330",
    email: "m.zielinska@drukarniahelios.pl",
    branza: "Poligrafia",
    ulica: "ul. Nadwiślańska 14",
    kod: "30-701",
    miasto: "Kraków",
    zrodlo_kategoria: "Polecenie",
    zrodlo: "poleciło Studio Kreska",
  });
  const leadId = id(nowyLead.dane);
  wymagaj(!!leadId, `POST /api/leads → ${nowyLead.status} ${JSON.stringify(nowyLead.dane)}`);

  const lead1 = await pobierzLead(leadId!);
  sprawdz("lead zapisuje komplet danych kontaktowych", lead1.email === "m.zielinska@drukarniahelios.pl" && lead1.miasto === "Kraków");

  // ── 2. Rozmowa telefoniczna ────────────────────────────────────────────
  krok("Rozmowa");
  const wpis = await api("POST", `/api/leads/${leadId}/activity`, {
    text: "Zadzwoniła Marta Zielińska. 40 zapytań ofertowych dziennie przepisywanych ręcznie. Pliki nie mogą opuszczać firmy.",
    kanal: "telefon",
    kierunek: "oni-ja",
    wynik: "odebrane",
    ostatni_kontakt: dzisiaj(),
    next_followup: zaDni(3),
    next_action: "Rozmowa wideo — pokazać demo lokalnego modelu",
  });
  wymagaj(wpis.status === 200, `POST activity → ${wpis.status}`);

  const lead2 = await pobierzLead(leadId!);
  sprawdz("wpis z historii ustawia datę ostatniego kontaktu", lead2.ostatni_kontakt === dzisiaj(), undefined, `ostatni_kontakt = ${lead2.ostatni_kontakt}`);
  sprawdz("wpis z historii ustawia przypomnienie", lead2.next_followup === zaDni(3));

  // ── 3. Oferta z leada ──────────────────────────────────────────────────
  krok("Oferta");
  const nowaOferta = await api("POST", "/api/offers", { lead_id: leadId });
  const ofertaId = id(nowaOferta.dane);
  wymagaj(!!ofertaId, `POST /api/offers → ${nowaOferta.status} ${JSON.stringify(nowaOferta.dane)}`);

  const o1 = await pobierzOferte(ofertaId!);
  const klientId: string | null = o1.offer.client_id ?? null;
  sprawdz("oferta z leada zakłada kartę klienta", !!klientId);

  const klient1 = klientId ? await pobierzKlienta(klientId) : null;
  sprawdz(
    "karta klienta dostaje adres i mail z leada",
    klient1?.email === "m.zielinska@drukarniahelios.pl" && klient1?.miasto === "Kraków"
  );

  // ── B1 zamknięte w Fazie 1 (lib/przepisanie.ts) ──
  sprawdz(
    "dokument oferty dostaje adres klienta, nie samą nazwę",
    !!o1.offer.klient_ulica && !!o1.offer.klient_miasto,
    undefined,
    `klient_ulica="${o1.offer.klient_ulica}" klient_miasto="${o1.offer.klient_miasto}" — karta klienta ma komplet`
  );
  sprawdz(
    "dokument oferty dostaje e-mail klienta",
    !!o1.offer.klient_email,
    undefined,
    `klient_email="${o1.offer.klient_email}"`
  );

  // Odświeżanie danych w SZKICU (decyzja właściciela 2026-08-02): poprawka na
  // karcie klienta ma dogonić dokument, dopóki ten nie poszedł do klienta.
  // Sprawdzamy powód, nie kod — zmieniamy JEDNO pole i patrzymy, czy to
  // dokładnie ono się przeniosło.
  if (klientId) {
    await api("PATCH", `/api/clients/${klientId}`, { ulica: "ul. Nadwiślańska 14 lok. 3" });
    const oPoPoprawce = await pobierzOferte(ofertaId!);
    sprawdz(
      "poprawka adresu na karcie klienta dogania ofertę-szkic",
      oPoPoprawce.offer.klient_ulica === "ul. Nadwiślańska 14 lok. 3",
      undefined,
      `na ofercie: "${oPoPoprawce.offer.klient_ulica}"`
    );
  } else {
    pominiete.push("odświeżanie danych klienta w szkicu — oferta nie dostała karty klienta");
  }

  // Czas realizacji — od tego zależy termin umowy i projektu (luka B5).
  // Wpisany RAZ, tutaj; dalej nikt go już nie podaje z palca.
  await api("PATCH", `/api/offers/${ofertaId}`, { czas_realizacji_tygodnie: 4 });

  // Pozycje — bez nich nie ma czego fakturować.
  for (const p of [
    { nazwa: "Audyt procesów i danych", cena: 3000 },
    { nazwa: "Prototyp (PoC) wybranego rozwiązania", cena: 4000 },
    { nazwa: "Raport z rekomendacjami", cena: 1000 },
  ]) {
    await api("POST", `/api/offers/${ofertaId}/items`, { nazwa: p.nazwa, ilosc: 1, jednostka: "kpl.", cena: p.cena });
  }
  // Sekcje opisowe — od Fazy 2 ich brak jest OSTRZEŻENIEM przy wysyłce
  // („bez sekcji oferta jest samym cennikiem"). Główna droga ma pokazywać
  // dokument, który realnie wychodzi do klienta, więc pisze je tak jak
  // właściciel: zakres i terminy.
  await api("POST", `/api/offers/${ofertaId}/sections`, {
    tytul: "Zakres prac",
    tresc: "Przegląd procesu ofertowania, prototyp lokalnego modelu i raport z rekomendacjami.",
  });
  await api("POST", `/api/offers/${ofertaId}/sections`, {
    tytul: "Terminy",
    tresc: "Realizacja: 4 tygodnie od akceptacji oferty.",
  });

  const o2 = await pobierzOferte(ofertaId!);
  sprawdz("pozycje oferty sumują się do 8000 zł", suma(o2.items) === 8000, undefined, `suma = ${suma(o2.items)}`);
  // Faza 2 (A4) — sekcja mówi 4 tygodnie i pole mówi 4 tygodnie, więc bramka
  // ma MILCZEĆ. Sprzeczność sprawdza test jednostkowy; tutaj pilnujemy, żeby
  // zgodny dokument nie dostawał ostrzeżenia (fałszywy alarm usypia czujność).
  sprawdz(
    "zgodne terminy w ofercie nie wywołują ostrzeżenia",
    !(o2.bramka?.ostrzezenia ?? []).some((z: any) => z.id === "sprzeczne-terminy"),
    undefined,
    `ostrzeżenia: ${(o2.bramka?.ostrzezenia ?? []).map((z: any) => z.id).join(", ") || "brak"}`
  );

  // ── 4. Wysyłka ─────────────────────────────────────────────────────────
  krok("Wysyłka oferty");

  // Do Fazy 1 stało tu obejście: ręczne dopisanie e-maila klienta, bo bez
  // niego wysyłka odbijała się o własną bramkę (skutek B1) i cała droga za
  // nią zostawała niesprawdzona. Zostaje asercja, która pilnuje, żeby to
  // obejście nie musiało wrócić.
  const przedWysylka = await pobierzOferte(ofertaId!);
  sprawdz(
    "oferta jest gotowa do wysyłki bez dopisywania czegokolwiek ręcznie",
    !!przedWysylka.offer.klient_email,
    undefined,
    "bez maila klienta wysyłka odbija się o własną bramkę"
  );

  const wyslana = await api("POST", `/api/offers/${ofertaId}/send`);
  wymagaj(wyslana.status === 200, `wysyłka → ${wyslana.status} ${JSON.stringify(wyslana.dane)}`);
  const o3 = await pobierzOferte(ofertaId!);

  sprawdz(
    "migawka wysłanej oferty obejmuje blok wystawcy",
    !!o3.offer.migawka?.wystawca?.nazwa,
    undefined,
    `klucze migawki: ${o3.offer.migawka ? Object.keys(o3.offer.migawka).join(", ") : "brak migawki"}`
  );
  // Migawka ma być tym, CO KLIENT ZOBACZYŁ — więc sprawdzamy to od strony
  // klienta, nie po kolumnie w bazie. Zmieniamy nazwę firmy i patrzymy, czy
  // publiczny link dalej pokazuje tę z chwili wysyłki (Faza 2, A2).
  const publiczna = async (token: string) => (await api("GET", `/api/offers/public/${token}`)).dane;
  const przedZmiana = await publiczna(String(o3.offer.share_token));
  await api("PATCH", "/api/settings", { nazwa: "Nazwa zmieniona po wysyłce" });
  const poZmianie = await publiczna(String(o3.offer.share_token));
  await api("PATCH", "/api/settings", DANE_FIRMY); // zawsze przywracamy
  sprawdz(
    "zmiana nazwy firmy nie przepisuje wstecz dokumentu, który klient już ma",
    poZmianie?.settings?.nazwa === DANE_FIRMY.nazwa && przedZmiana?.settings?.nazwa === DANE_FIRMY.nazwa,
    undefined,
    `pod linkiem klienta: „${poZmianie?.settings?.nazwa}” po zmianie ustawień na „Nazwa zmieniona po wysyłce”`
  );
  sprawdz(
    "migawka nie wypuszcza prywatnych ustawień właściciela",
    !("rezerwa_vat_procent" in (poZmianie?.settings ?? {})) && !("domyslne_uwagi" in (poZmianie?.settings ?? {})),
    undefined,
    `pola wystawcy u klienta: ${Object.keys(poZmianie?.settings ?? {}).join(", ")}`
  );
  sprawdz("wysłana oferta dostaje token do udostępnienia", !!o3.offer.share_token);

  // ── 5. Akceptacja przez klienta ────────────────────────────────────────
  krok("Akceptacja");
  let drogaKlienta = true;
  let akc = await api("POST", `/api/offers/public/${o3.offer.share_token}/accept`, { name: "Marta Zielińska" });

  // HAMULEC_DOKUMENT_PUBLICZNY: 5 prób / 60 min na odcisk (audyt Modułu 57).
  // To świadoma i dobra decyzja — nie osłabiamy jej dla wygody testu. Ale przy
  // kilku przebiegach pod rząd droga KLIENTA staje się niedostępna, więc
  // dopinamy akceptację od strony panelu i mówimy wprost, czego nie sprawdzono.
  if (akc.status === 429) {
    pominiete.push(
      "akceptacja przez PUBLICZNY link — hamulec 5/60 min (HAMULEC_DOKUMENT_PUBLICZNY). " +
        "Odczekaj godzinę albo zrestartuj `npm run dev`, żeby przejść tę drogę naprawdę."
    );
    console.log("   ⊘ publiczna akceptacja pominięta (hamulec) — akceptuję od strony panelu");
    drogaKlienta = false;
    akc = await api("POST", `/api/offers/${ofertaId}/accept`, { name: "Marta Zielińska" });
  }
  wymagaj(akc.status === 200, `akceptacja → ${akc.status} ${JSON.stringify(akc.dane)}`);

  const o4 = await pobierzOferte(ofertaId!);
  if (drogaKlienta) {
    sprawdz("akceptacja przez klienta zapisuje, KTO zaakceptował", o4.offer.accepted_by_name === "Marta Zielińska");
  } else {
    pominiete.push("dowód „kto zaakceptował” — sprawdzalny tylko na publicznej drodze");
  }
  sprawdz("akceptacja zakłada projekt", !!o4.offer.project_id);
  sprawdz("akceptacja zakłada szkic faktury", !!o4.offer.invoice_id);

  const projektId: string = o4.offer.project_id;
  const fakturaId: string = o4.offer.invoice_id;

  const lead3 = await pobierzLead(leadId!);
  sprawdz("akceptacja zamyka leada jako sukces", lead3.status === "Zamknięte - sukces");

  // ── C3, zamknięte w Fazie 3 jako PROPOZYCJA ──
  // Uwaga na kształt tej asercji: przypomnienie ma tu jeszcze ŻYĆ. Panel nie
  // zdejmuje go sam, bo wygrany lead z umówionym demo bywa leadem, z którym
  // to demo i tak się odbędzie (decyzja właściciela: propozycja, nie automat).
  // Sprawdzamy więc nie skutek, tylko to, że panel go PROPONUJE.
  sprawdz(
    "wygrany lead z żywym przypomnieniem rodzi propozycję jego zdjęcia",
    (await propozycjeDla(leadId!)).some((p) => p.regula === "wygrany-lead-bez-przypomnienia"),
    undefined,
    `next_followup = ${lead3.next_followup}, next_action = „${lead3.next_action}”`
  );

  // ── B2 zamknięte w Fazie 1 ──
  const f1 = await pobierzFakture(fakturaId);
  sprawdz(
    "faktura z oferty dostaje e-mail nabywcy",
    !!f1.invoice.klient_email,
    undefined,
    `klient_email="${f1.invoice.klient_email}" — a to dokument, który się WYSYŁA mailem`
  );
  sprawdz(
    "faktura z oferty dostaje też adres nabywcy",
    !!f1.invoice.klient_ulica && !!f1.invoice.klient_miasto,
    undefined,
    `ulica="${f1.invoice.klient_ulica}" miasto="${f1.invoice.klient_miasto}"`
  );

  // ── B6 zamknięte w Fazie 1 ──
  const p1 = await pobierzProjekt(projektId);
  sprawdz(
    "projekt ze sprzedanego zlecenia nie stoi w „Pomysł”",
    p1.project.status !== "Pomysł",
    undefined,
    `status = ${p1.project.status}`
  );
  sprawdz(
    "projekt nie nazywa się od słowa „Oferta”",
    !/^oferta\s*[—–-]/i.test(String(p1.project.tytul ?? "")),
    undefined,
    `tytuł projektu = „${p1.project.tytul}”`
  );

  // ── 6. Umowa ───────────────────────────────────────────────────────────
  krok("Umowa");
  const nowaUmowa = await api("POST", "/api/contracts", { typ: "umowa", offer_id: ofertaId });
  const umowaId = id(nowaUmowa.dane);
  wymagaj(!!umowaId, `POST /api/contracts → ${nowaUmowa.status} ${JSON.stringify(nowaUmowa.dane)}`);

  const u1 = await pobierzUmowe(umowaId!);
  sprawdz("umowa przepisuje zakres prac z pozycji oferty", (u1.zakres_prac ?? "").includes("Audyt procesów i danych"));
  sprawdz("umowa przepisuje kwotę z oferty", Number(u1.cena) === 8000);

  // ── B5 zamknięte w Fazie 1 ──
  // Oferta podała 4 tygodnie od akceptacji; umowa ma z tego policzyć datę.
  sprawdz(
    "umowa dostaje termin realizacji policzony z czasu podanego w ofercie",
    String(u1.termin_realizacji ?? "").slice(0, 10) === zaDni(28),
    undefined,
    `termin_realizacji = ${u1.termin_realizacji}, spodziewany ${zaDni(28)} (dziś + 4 tyg.)`
  );

  // ── B3 zamknięte w Fazie 1 ──
  const f2 = await pobierzFakture(fakturaId);
  sprawdz(
    "faktura wie o umowie po jej wygenerowaniu",
    !!f2.invoice.contract_id,
    undefined,
    "faktura pokazuje „umowy — brak —”, choć umowa dotyczy tego samego zlecenia"
  );

  // ── 7. Podpis ──────────────────────────────────────────────────────────
  krok("Podpis umowy");
  await api("POST", `/api/contracts/${umowaId}/podpis-nasz`);

  // NIE `PATCH {status:"Podpisana"}` — trasa to odrzuca (409) i ma rację:
  // „Podpisu nie ustawia się statusem — użyj «Oznacz jako podpisaną», żeby
  // zapisać też datę złożenia podpisu”. Pierwsza wersja tego skryptu połykała
  // tę odmowę w ciszy i asertowała B6 na NIEPODPISANEJ umowie, czyli
  // sprawdzała nic. Wyszło dopiero z kontroli spójności, która na tych samych
  // danych zgłosiła zero naruszeń.
  const podpis = await api("POST", `/api/contracts/${umowaId}/accept`, {});
  wymagaj(podpis.status === 200, `oznaczenie umowy jako podpisanej → ${podpis.status} ${JSON.stringify(podpis.dane)}`);

  const u2 = await pobierzUmowe(umowaId!);
  sprawdz("umowa naprawdę jest podpisana, zanim sprawdzamy jej skutki", u2.status === "Podpisana", undefined, `status = ${u2.status}`);
  sprawdz("podpis po naszej stronie bierze imię z ustawień firmy", !!u2.podpis_nasz_osoba, undefined, `podpis_nasz_osoba = ${u2.podpis_nasz_osoba}`);

  const p2 = await pobierzProjekt(projektId);
  sprawdz(
    "projekt z podpisanej umowy dostaje termin",
    !!p2.project.termin,
    undefined,
    `umowa ma termin_realizacji = ${u2.termin_realizacji}, projekt ma termin = ${p2.project.termin}`
  );
  sprawdz(
    "projekt z podpisanej umowy dostaje datę startu",
    !!p2.project.start,
    undefined,
    `start = ${p2.project.start}`
  );
  sprawdz(
    "podpis umowy formalnie uruchamia projekt",
    p2.project.status === "W trakcie",
    undefined,
    `status = ${p2.project.status}`
  );

  // ── 8. Faktura ─────────────────────────────────────────────────────────
  krok("Faktura");
  const wyst = await api("POST", `/api/invoices/${fakturaId}/issue`);
  wymagaj(wyst.status === 200, `wystawienie → ${wyst.status} ${JSON.stringify(wyst.dane)}`);

  const f3 = await pobierzFakture(fakturaId);
  sprawdz("wystawienie nadaje numer", !!f3.invoice.numer, undefined, `numer = ${f3.invoice.numer}`);
  sprawdz("wystawienie uzupełnia daty", !!f3.invoice.data_wystawienia && !!f3.invoice.termin_platnosci);
  // Faza 2 (A2) — faktura nie miała migawki W OGÓLE. To najostrzejszy prawnie
  // przypadek: dokument, który klient dostał i opłacił, zmieniał się razem
  // z „Danymi firmy". Migawkę robi WYSTAWIENIE, bo od numeru dokument jest
  // niezmienny (wysyłek bywa kilka).
  sprawdz(
    "wystawienie zamraża dane sprzedawcy na fakturze",
    !!f3.invoice.migawka?.wystawca?.nip,
    undefined,
    `migawka faktury: ${f3.invoice.migawka ? Object.keys(f3.invoice.migawka).join(", ") : "brak"}`
  );

  const proba = await api("PATCH", `/api/invoices/${fakturaId}`, { klient_nazwa: "PRÓBA PODMIANY" });
  const f4 = await pobierzFakture(fakturaId);
  sprawdz(
    "wystawionej faktury nie da się zmienić przez trasę",
    proba.status >= 400 && f4.invoice.klient_nazwa !== "PRÓBA PODMIANY",
    undefined,
    `PATCH → ${proba.status}`
  );

  // ── 9. Zapłata ─────────────────────────────────────────────────────────
  krok("Zapłata");
  const doZaplaty = Number(f3.invoice.brutto ?? 9840);
  await api("POST", `/api/invoices/${fakturaId}/payments`, { kwota: doZaplaty, data: dzisiaj() });
  const f5 = await pobierzFakture(fakturaId);
  sprawdz("pełna wpłata przestawia fakturę na Opłaconą", f5.invoice.status === "Opłacona", undefined, `status = ${f5.invoice.status}`);

  // ── C4, zamknięte w Fazie 3 jako PROPOZYCJA ──
  const klient2 = klientId ? await pobierzKlienta(klientId) : null;
  if (klientId) {
    sprawdz(
      "opłacona faktura rodzi propozycję przestawienia klienta na „Aktywny”",
      (await propozycjeDla(klientId)).some((p) => p.regula === "oplacony-klient-aktywny"),
      undefined,
      `status klienta = ${klient2?.status}; ostatni_kontakt = ${klient2?.ostatni_kontakt}`
    );
  } else {
    pominiete.push("propozycja „klient → Aktywny” — oferta nie dostała karty klienta");
  }

  // ── 10. Opinia ─────────────────────────────────────────────────────────
  krok("Opinia");
  const link = await api("POST", `/api/projects/${projektId}/review-link`);
  const token = String(link.dane?.url ?? "").split("/").pop();
  wymagaj(!!token, `review-link → ${link.status} ${JSON.stringify(link.dane)}`);

  const trescOpinii = {
    jakosc: 5,
    terminowosc: 4,
    komunikacja: 5,
    comment: "PoC dowiózł to, co było w ofercie. Ruszamy z pełnym wdrożeniem.",
    consentCaseStudy: true,
    consentName: "Marta Zielińska",
  };
  let opinia = await api("POST", `/api/projects/review/public/${token}/submit`, trescOpinii);

  // Ten sam hamulec co przy akceptacji — patrz komentarz wyżej.
  if (opinia.status === 429) {
    pominiete.push(
      "wysłanie opinii przez PUBLICZNY link — hamulec 5/60 min (HAMULEC_DOKUMENT_PUBLICZNY)"
    );
    console.log("   ⊘ publiczna opinia pominięta (hamulec) — zapisuję od strony panelu");
    opinia = await api("POST", `/api/projects/${projektId}/review`, trescOpinii);
  }
  wymagaj(opinia.status === 200, `opinia → ${opinia.status} ${JSON.stringify(opinia.dane)}`);

  const p3 = await pobierzProjekt(projektId);
  sprawdz("opinia zapisuje trzy oceny", p3.project.review_rating_jakosc === 5 && p3.project.review_rating_terminowosc === 4);
  sprawdz("opinia zapisuje zgodę na case study wraz z imieniem", p3.project.review_consent_case_study === true && !!p3.project.review_consent_name);

  // ── C1, zamknięte w Fazie 3 jako PROPOZYCJA ──
  sprawdz(
    "opinia rodzi propozycję domknięcia projektu",
    (await propozycjeDla(projektId)).some((p) => p.regula === "opinia-zamyka-projekt"),
    undefined,
    `status projektu po opinii = ${p3.project.status}`
  );

  // ── 11. Propozycje: komplet skutków zdarzenia (Faza 3) ─────────────────
  // Sprawdzenie fazy, wprost z planu: „na Pulpicie stoją dokładnie te
  // propozycje, których się spodziewamy — ani jednej więcej". Liczymy TYLKO
  // po rekordach z tego przebiegu: dev-baza ma też dane z seeda, więc liczba
  // wszystkich propozycji w bazie niczego by nie dowodziła.
  krok("Propozycje");
  const nasze = [leadId!, projektId, ...(klientId ? [klientId] : [])];
  const stoja = (await pobierzPropozycje()).filter((p) => nasze.includes(p.rekordId));
  const oczekiwane = [
    "wygrany-lead-bez-przypomnienia",
    "opinia-zamyka-projekt",
    ...(klientId ? ["oplacony-klient-aktywny"] : []),
  ];
  sprawdz(
    "po całej drodze stoją dokładnie te propozycje, których się spodziewamy",
    stoja.length === oczekiwane.length && oczekiwane.every((r) => stoja.some((p) => p.regula === r)),
    undefined,
    `stoi ${stoja.length} (${stoja.map((p) => p.regula).join(", ") || "brak"}), ` +
      `spodziewane ${oczekiwane.length} (${oczekiwane.join(", ")})`
  );

  // „Nie teraz" musi przeżyć odświeżenie strony — czyli siedzieć w bazie, nie
  // w przeglądarce. Sprawdzamy to jedynym sposobem, który to naprawdę dowodzi:
  // osobnym żądaniem, bez żadnego stanu po drodze.
  await decyzjaOPropozycji("wygrany-lead-bez-przypomnienia", leadId!, "odrzuc");
  const poOdrzuceniu = await propozycjeDla(leadId!);
  sprawdz(
    "„Nie teraz” zdejmuje propozycję i przeżywa nowe żądanie",
    !poOdrzuceniu.some((p) => p.regula === "wygrany-lead-bez-przypomnienia"),
    undefined,
    `po odrzuceniu wciąż widać: ${poOdrzuceniu.map((p) => p.regula).join(", ") || "nic"}`
  );

  // Odrzucenie to nie usterka, tylko decyzja — ekran „Zdrowie" ma o niej
  // milczeć. Inaczej świeciłby na czerwono z powodu świadomego wyboru
  // właściciela, a czerwień, którą trzeba ignorować, przestaje coś znaczyć.
  const zdrowie = await api("GET", "/api/observability");
  const naruszeniaLeada = ((zdrowie.dane?.spojnosc?.reguly ?? []) as any[])
    .flatMap((r: any) => (r.naruszenia ?? []).map((n: any) => n.rekordId))
    .filter((x: string) => x === leadId);
  sprawdz(
    "świadomie odłożona propozycja nie zapala ekranu „Zdrowie”",
    naruszeniaLeada.length === 0,
    undefined,
    `reguły spójności zgłaszają ten lead ${naruszeniaLeada.length} raz(y)`
  );

  await decyzjaOPropozycji("wygrany-lead-bez-przypomnienia", leadId!, "przywroc");
  sprawdz(
    "odłożoną propozycję da się przywrócić",
    (await propozycjeDla(leadId!)).some((p) => p.regula === "wygrany-lead-bez-przypomnienia"),
    undefined,
    "bez drogi powrotu jedno pomyłkowe kliknięcie kasowałoby podpowiedź na zawsze"
  );

  // Zatwierdzenie — dopiero tu panel COKOLWIEK zmienia.
  await decyzjaOPropozycji("wygrany-lead-bez-przypomnienia", leadId!, "zrob");
  const lead4 = await pobierzLead(leadId!);
  sprawdz(
    "zatwierdzenie zdejmuje przypomnienie z wygranego leada",
    !lead4.next_followup && !lead4.next_action,
    undefined,
    `next_followup = ${lead4.next_followup}, next_action = „${lead4.next_action}”`
  );

  if (klientId) {
    await decyzjaOPropozycji("oplacony-klient-aktywny", klientId, "zrob");
    const klient3 = await pobierzKlienta(klientId);
    sprawdz(
      "zatwierdzenie przestawia klienta z „Prospekta” na „Aktywnego”",
      klient3?.status === "Aktywny",
      undefined,
      `status klienta = ${klient3?.status}`
    );
  }

  await decyzjaOPropozycji("opinia-zamyka-projekt", projektId, "zrob");
  const p4 = await pobierzProjekt(projektId);
  sprawdz(
    "zatwierdzenie domyka projekt jako „Wdrożone”",
    p4.project.status === "Wdrożone",
    undefined,
    `status projektu = ${p4.project.status}`
  );
  // Zamknięcie projektu to nie sam status: przy wejściu w „Wdrożone" panel
  // planuje klientowi dwa kontakty kontrolne (Moduł 2). Gdyby propozycja
  // robiła sam UPDATE, zamknięcie tą drogą po cichu gubiłoby pętlę retencji —
  // dlatego skutek liczy jedna funkcja dla obu dróg (lib/skutkiProjektu.ts).
  if (klientId) {
    // Szukamy kontaktów przypiętych do TEGO projektu, nie „czegoś, co wygląda
    // na kontakt": pierwsza wersja tej asercji sprawdzała, czy odpowiedź
    // zawiera słowo „kontakt", i przechodziła na polu `osoba_kontaktowa`.
    const karta = await api("GET", `/api/clients/${klientId}`);
    const nurture = ((karta.dane?.followups ?? []) as any[]).filter((f) => f.project_id === projektId);
    sprawdz(
      "zatwierdzenie domknięcia planuje kontakty kontrolne, jak ręczna zmiana statusu",
      nurture.length === 2,
      undefined,
      `kontaktów zaplanowanych dla tego projektu: ${nurture.length} (spodziewane 2: 14 i 90 dni) — ` +
        `propozycja ma robić CAŁY skutek zdarzenia, nie sam status`
    );
  }

  const zostalo = (await pobierzPropozycje()).filter((p) => nasze.includes(p.rekordId));
  sprawdz(
    "po zatwierdzeniu wszystkich nie zostaje ani jedna propozycja z tej drogi",
    zostalo.length === 0,
    undefined,
    `zostało: ${zostalo.map((p) => `${p.regula}→${p.rekordId}`).join(", ")}`
  );

  // ── 12. Sonda: czego pilnuje bramka wysyłki ────────────────────────────
  // Osobny, sterowany eksperyment — bo w głównej drodze nie da się odróżnić
  // „odmówiono z powodu wystawcy” od „odmówiono z powodu maila klienta”.
  // Bierzemy ofertę z KOMPLETNYM klientem i po kolei zabieramy dane firmy.
  krok("Sonda: bramka wysyłki");
  const sonda = await api("POST", "/api/offers", {
    klient_nazwa: `Sonda bramki [${ZNACZNIK}]`,
    klient_email: "sonda@przyklad.pl",
  });
  const sondaId = id(sonda.dane);
  wymagaj(!!sondaId, `nie udało się założyć oferty do sondy: ${JSON.stringify(sonda.dane)}`);

  // Mail klienta MUSI być ustawiony, inaczej odmowa przyjdzie z jego powodu
  // i sonda zmierzy nie to, co trzeba (ten błąd popełniłem w pierwszej wersji).
  await api("PATCH", `/api/offers/${sondaId}`, { klient_email: "sonda@przyklad.pl" });
  const sondaGotowa = await pobierzOferte(sondaId!);
  wymagaj(
    !!sondaGotowa.offer.klient_email,
    "sonda nie ma maila klienta — nie da się odróżnić powodów odmowy"
  );

  await api("PATCH", "/api/settings", { nazwa: "", nip: "" });
  const bezWystawcy = await api("POST", `/api/offers/${sondaId}/send`);
  await api("PATCH", "/api/settings", DANE_FIRMY); // zawsze przywracamy

  // POWODU szukamy po identyfikatorach reguł, nie po treści komunikatu:
  // dwie różne przyczyny dawały wcześniej ten sam kod 400 i pierwsza wersja
  // tego skryptu ogłosiła lukę A2 za naprawioną, choć dokument dalej
  // wychodził anonimowy.
  const powody = (o: any): string[] => (o?.dane?.bramka?.blokady ?? []).map((b: any) => b.id);
  sprawdz(
    "wysyłka odmawia — i to Z POWODU braku wystawcy",
    bezWystawcy.status === 400 && powody(bezWystawcy).includes("wystawca-bez-nazwy"),
    undefined,
    `oferta ma komplet danych klienta; po wyczyszczeniu „Danych firmy” ` +
      `POST /send → ${bezWystawcy.status}, powody: ${powody(bezWystawcy).join(", ") || "(brak listy)"}`
  );

  const brakMaila = await api("POST", "/api/offers", { klient_nazwa: `Sonda maila [${ZNACZNIK}]` });
  const brakMailaId = id(brakMaila.dane);
  const odmowa = await api("POST", `/api/offers/${brakMailaId}/send`);
  sprawdz(
    "wysyłka odmawia z podanym wprost powodem, gdy brakuje maila klienta",
    odmowa.status === 400 && powody(odmowa).includes("odbiorca-bez-emaila"),
    undefined,
    `→ ${odmowa.status}, powody: ${powody(odmowa).join(", ") || "(brak listy)"}`
  );
  sprawdz(
    "odmowa nie miesza powodów — brak maila to nie brak wystawcy",
    !powody(odmowa).includes("wystawca-bez-nazwy"),
    undefined,
    `powody: ${powody(odmowa).join(", ")}`
  );

  // ── 13. Sonda: ostrzeżenie da się przejść, blokady nie ─────────────────
  krok("Sonda: ostrzeżenie kontra blokada");
  const sondaOstrz = await api("POST", "/api/offers", { klient_nazwa: `Sonda ostrzeżenia [${ZNACZNIK}]` });
  const sondaOstrzId = id(sondaOstrz.dane);
  wymagaj(!!sondaOstrzId, `nie udało się założyć oferty do sondy ostrzeżeń: ${JSON.stringify(sondaOstrz.dane)}`);
  // Komplet danych odbiorcy MUSI wejść osobnym PATCH-em — `POST /api/offers`
  // ich nie przyjmuje. Bez tego odmowa przyszłaby z powodu BLOKADY (brak
  // maila), a sonda ma mierzyć zachowanie przy samym OSTRZEŻENIU.
  await api("PATCH", `/api/offers/${sondaOstrzId}`, {
    klient_email: "sonda@przyklad.pl",
    klient_ulica: "ul. Testowa 1",
    klient_kod: "30-001",
    klient_miasto: "Kraków",
  });
  // Pozycja bez ani jednej sekcji = „sam cennik", czyli OSTRZEŻENIE.
  await api("POST", `/api/offers/${sondaOstrzId}/items`, { nazwa: "Audyt", ilosc: 1, jednostka: "kpl.", cena: 1000 });

  const zOstrzezeniem = await api("POST", `/api/offers/${sondaOstrzId}/send`);
  sprawdz(
    "samo ostrzeżenie zatrzymuje wysyłkę pytaniem, a nie odmową",
    zOstrzezeniem.status === 409 && (zOstrzezeniem.dane?.bramka?.ostrzezenia ?? []).length > 0,
    undefined,
    `→ ${zOstrzezeniem.status} ${JSON.stringify(zOstrzezeniem.dane?.bramka ?? zOstrzezeniem.dane)}`
  );
  const mimoOstrzezen = await api("POST", `/api/offers/${sondaOstrzId}/send`, { mimo_ostrzezen: true });
  sprawdz(
    "„Wyślij mimo to” przechodzi ostrzeżenie",
    mimoOstrzezen.status === 200,
    undefined,
    `→ ${mimoOstrzezen.status} ${JSON.stringify(mimoOstrzezen.dane)}`
  );

  // …ale ta sama zgoda NIE MOŻE obejść blokady. Inaczej okno w panelu byłoby
  // furtką dookoła reguły, której trasa ma pilnować.
  const sondaBlok = await api("POST", "/api/offers", { klient_nazwa: `Sonda blokady [${ZNACZNIK}]` });
  const sondaBlokId = id(sondaBlok.dane);
  const naSile = await api("POST", `/api/offers/${sondaBlokId}/send`, { mimo_ostrzezen: true });
  sprawdz(
    "„Wyślij mimo to” NIE obchodzi blokady",
    naSile.status === 400,
    undefined,
    `→ ${naSile.status} ${JSON.stringify(naSile.dane?.error ?? naSile.dane)}`
  );

  // ── 14. Sonda: mail z niewypełnionym nawiasem (A1) ─────────────────────
  // Najpoważniejsze znalezisko przejścia: do klienta poszło dosłownie
  // „Pozdrawiam, [Twoje imię]". Trasa sprawdzała tylko, czy treść jest
  // niepusta. Projekt z tej drogi ma klienta z mailem, więc odmowa może
  // przyjść WYŁĄCZNIE z powodu nawiasu — inaczej sonda mierzyłaby nie to.
  krok("Sonda: mail zamykający");
  const zNawiasem = await api("POST", `/api/projects/${projektId}/request-review`, {
    body: "Projekt zakończony — dziękuję!\n\nPozdrawiam,\n[Twoje imię]",
  });
  const powodyMaila = (zNawiasem.dane?.bramka?.blokady ?? []).map((b: any) => b.id);
  sprawdz(
    "mail z niewypełnionym „[Twoje imię]” nie wychodzi do klienta",
    zNawiasem.status === 400 && powodyMaila.includes("mail-z-nawiasami"),
    undefined,
    `→ ${zNawiasem.status}, powody: ${powodyMaila.join(", ") || "(brak listy)"}`
  );
  // `mimo_ostrzezen` zostaje, choć po Fazie 3 projekt jest już „Wdrożone"
  // i ostrzeżenie „mail mówi o zakończeniu, a projekt jest w trakcie" tu nie
  // pada. Sonda ma sprawdzać, że mail Z PODPISEM wychodzi — a nie zależeć od
  // tego, czy akurat jest co przechodzić zgodą (to sprawdza krok wyżej,
  // na ofercie bez sekcji).
  const bezNawiasu = await api("POST", `/api/projects/${projektId}/request-review`, {
    body: `Projekt zakończony — dziękuję za współpracę!\n\nPozdrawiam,\n${DANE_FIRMY.osoba_podpisujaca}`,
    mimo_ostrzezen: true,
  });
  sprawdz(
    "ten sam mail z podstawionym podpisem przechodzi",
    bezNawiasu.status === 200,
    undefined,
    `→ ${bezNawiasu.status} ${JSON.stringify(bezNawiasu.dane)}`
  );
}

// ── Odczyty ────────────────────────────────────────────────────────────────

async function pobierzLead(id: string): Promise<any> {
  const { dane } = await api("GET", "/api/leads");
  return (dane.leads ?? dane).find((l: any) => l.id === id) ?? {};
}
async function pobierzKlienta(id: string): Promise<any> {
  const { dane } = await api("GET", "/api/clients");
  return (dane.clients ?? dane).find((c: any) => c.id === id) ?? {};
}
async function pobierzOferte(id: string): Promise<any> {
  return (await api("GET", `/api/offers/${id}`)).dane;
}
async function pobierzUmowe(id: string): Promise<any> {
  const { dane } = await api("GET", `/api/contracts/${id}`);
  return dane.contract ?? dane;
}
async function pobierzProjekt(id: string): Promise<any> {
  return (await api("GET", `/api/projects/${id}`)).dane;
}
async function pobierzFakture(id: string): Promise<any> {
  return (await api("GET", `/api/invoices/${id}`)).dane;
}

// ── Propozycje (Faza 3) ────────────────────────────────────────────────────

type PropozycjaZTrasy = { regula: string; rekordId: string; zdanie: string };

/** Cała lista, jak widzi ją Pulpit — bez filtrowania po module, bo propozycje
 *  z jednej drogi klienta dotyczą trzech różnych modułów naraz. */
async function pobierzPropozycje(): Promise<PropozycjaZTrasy[]> {
  const { dane } = await api("GET", "/api/hub/propozycje");
  return (dane?.propozycje ?? []) as PropozycjaZTrasy[];
}

async function propozycjeDla(rekordId: string): Promise<PropozycjaZTrasy[]> {
  return (await pobierzPropozycje()).filter((p) => p.rekordId === rekordId);
}

async function decyzjaOPropozycji(
  regula: string,
  rekordId: string,
  decyzja: "zrob" | "odrzuc" | "przywroc"
): Promise<void> {
  const odp = await api("POST", "/api/hub/propozycje", { regula, rekordId, decyzja });
  // Cicha odmowa jest tu groźniejsza niż błąd: asercja niżej sprawdzałaby
  // skutek, którego nikt nie próbował wykonać, i ogłosiłaby lukę za otwartą
  // (dokładnie ten błąd, który przy podpisie umowy połknął 409 i asertował
  // na niepodpisanym dokumencie).
  wymagaj(
    odp.status === 200,
    `decyzja „${decyzja}” o propozycji ${regula} → ${odp.status} ${JSON.stringify(odp.dane)}`
  );
}

// ── Drobiazgi ──────────────────────────────────────────────────────────────

function dzisiaj(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function zaDni(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function suma(items: any[]): number {
  return (items ?? []).reduce((s, it) => s + Number(it.ilosc) * Number(it.cena), 0);
}

// ── Podsumowanie ───────────────────────────────────────────────────────────

function podsumuj(): number {
  const licz = (s: Stan) => wyniki.filter((w) => w.stan === s).length;
  const regresje = wyniki.filter((w) => w.stan === "REGRESJA");
  const naprawione = wyniki.filter((w) => w.stan === "NAPRAWIONE");

  console.log("\n" + "═".repeat(72));
  console.log(
    `Przejście: ${licz("DZIALA")} działa · ${licz("LUKA")} znanych luk · ` +
      `${naprawione.length} naprawionych · ${regresje.length} regresji · ` +
      `${obejscia.length} obejść · ${pominiete.length} pominiętych`
  );

  if (pominiete.length) {
    console.log("\n⊘ Pominięte — tego przebieg NIE sprawdził:");
    for (const p of pominiete) console.log(`   ${p}`);
  }

  if (obejscia.length) {
    console.log("\n↻ Obejścia — tyle razy trzeba załatać przepływ ręcznie, żeby dojść do końca:");
    for (const o of obejscia) console.log(`   ${o}`);
  }

  if (naprawione.length) {
    console.log("\n★ NAPRAWIONE — zdejmij znacznik `luka` w scripts/przejscie/przejscie.ts:");
    for (const w of naprawione) console.log(`   ${w.luka}  ${w.opis}`);
  }

  if (regresje.length) {
    console.log("\n✗ REGRESJE — to miało działać:");
    for (const w of regresje) {
      console.log(`   [${w.krok}] ${w.opis}`);
      if (w.szczegol) console.log(`       → ${w.szczegol}`);
    }
    console.log("\nPrzejście NIE przeszło.");
    return 1;
  }

  const luki = wyniki.filter((w) => w.stan === "LUKA");
  if (luki.length) {
    console.log("\n⚠ Znane luki (opisane w docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md):");
    const wgLuki = new Map<string, string[]>();
    for (const w of luki) wgLuki.set(w.luka!, [...(wgLuki.get(w.luka!) ?? []), w.opis]);
    for (const [nr, opisy] of [...wgLuki].sort()) {
      console.log(`   ${nr}: ${opisy.join("; ")}`);
    }
  }

  console.log("\nPrzejście przeszło — bez regresji.");
  return 0;
}

przejscie()
  .then(() => process.exit(podsumuj()))
  .catch((e) => {
    console.error(`\n💥 Przejście wywaliło się w kroku „${krokBiezacy}”:`, e);
    process.exit(2);
  });
