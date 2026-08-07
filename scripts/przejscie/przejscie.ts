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
/** Token, którego na pewno nie ma w bazie — do prób, które MAJĄ się odbić. */
const TOKEN_NIEISTNIEJACY = "brak-takiego-tokenu-w-bazie";
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
  body?: unknown,
  naglowkiDodatkowe?: Record<string, string>
): Promise<{ status: number; dane: any }> {
  const naglowki: Record<string, string> = { ...(naglowkiDodatkowe ?? {}) };
  if (body) naglowki["Content-Type"] = "application/json";
  const odp = await fetch(`${BAZA}${sciezka}`, {
    method: metoda,
    headers: Object.keys(naglowki).length ? naglowki : undefined,
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

/**
 * Żądanie z JAWNYM potwierdzeniem działania nieodwracalnego (Faza 4).
 *
 * Świadomie osobna funkcja, a nie „`api()`, które samo dopina nagłówek":
 * gdyby zwykłe `api()` potwierdzało wszystko z automatu, przejście
 * przestałoby cokolwiek mówić o barierze — każde żądanie przechodziłoby tak
 * samo jak przed Fazą 4. Tu trzeba wskazać działanie z nazwy, dokładnie tak
 * jak musi to zrobić panel i apka.
 *
 * `fraza` dotyczy poziomu „mocne" (wystawienie faktury, KSeF, usunięcie
 * klienta/projektu) — serwer porównuje ją z tym, co ma w bazie.
 */
async function apiZPotwierdzeniem(
  metoda: string,
  sciezka: string,
  dzialanie: string,
  body?: unknown,
  fraza?: string
): Promise<{ status: number; dane: any }> {
  const naglowki: Record<string, string> = { "x-potwierdzenie": dzialanie };
  if (body) naglowki["Content-Type"] = "application/json";
  if (fraza != null) naglowki["x-potwierdzenie-fraza"] = encodeURIComponent(fraza);
  const odp = await fetch(`${BAZA}${sciezka}`, {
    method: metoda,
    headers: naglowki,
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

  const wyslana = await apiZPotwierdzeniem("POST", `/api/offers/${ofertaId}/send`, "oferta-wyslij");
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
  // Faza 4 (D1) — wystawienie ma poziom „mocne": trzeba przepisać nazwę
  // nabywcy. Fraza jedzie tu z tego samego pola, które panel pokazuje w oknie,
  // a porównuje ją SERWER z danych w bazie.
  const fakturaPrzedWystawieniem = await pobierzFakture(fakturaId);
  const wyst = await apiZPotwierdzeniem(
    "POST",
    `/api/invoices/${fakturaId}/issue`,
    "faktura-wystaw",
    undefined,
    fakturaPrzedWystawieniem.invoice.klient_nazwa
  );
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
  const bezWystawcy = await apiZPotwierdzeniem("POST", `/api/offers/${sondaId}/send`, "oferta-wyslij");
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
  const odmowa = await apiZPotwierdzeniem("POST", `/api/offers/${brakMailaId}/send`, "oferta-wyslij");
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

  const zOstrzezeniem = await apiZPotwierdzeniem("POST", `/api/offers/${sondaOstrzId}/send`, "oferta-wyslij");
  sprawdz(
    "samo ostrzeżenie zatrzymuje wysyłkę pytaniem, a nie odmową",
    zOstrzezeniem.status === 409 && (zOstrzezeniem.dane?.bramka?.ostrzezenia ?? []).length > 0,
    undefined,
    `→ ${zOstrzezeniem.status} ${JSON.stringify(zOstrzezeniem.dane?.bramka ?? zOstrzezeniem.dane)}`
  );
  const mimoOstrzezen = await apiZPotwierdzeniem("POST", `/api/offers/${sondaOstrzId}/send`, "oferta-wyslij", { mimo_ostrzezen: true });
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
  const naSile = await apiZPotwierdzeniem("POST", `/api/offers/${sondaBlokId}/send`, "oferta-wyslij", { mimo_ostrzezen: true });
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
  const zNawiasem = await apiZPotwierdzeniem("POST", `/api/projects/${projektId}/request-review`, "opinia-popros", {
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
  const bezNawiasu = await apiZPotwierdzeniem("POST", `/api/projects/${projektId}/request-review`, "opinia-popros", {
    body: `Projekt zakończony — dziękuję za współpracę!\n\nPozdrawiam,\n${DANE_FIRMY.osoba_podpisujaca}`,
    mimo_ostrzezen: true,
  });
  sprawdz(
    "ten sam mail z podstawionym podpisem przechodzi",
    bezNawiasu.status === 200,
    undefined,
    `→ ${bezNawiasu.status} ${JSON.stringify(bezNawiasu.dane)}`
  );

  // ── 15. Sonda: nieodwracalność (Faza 4, D1) ────────────────────────────
  // Sprawdzenie tej fazy. Ta faza jest głównie o interfejsie, ale jedno da
  // się zmierzyć od strony danych i to jest rzecz najważniejsza: **trasa
  // działania nieodwracalnego nie może go wykonać bez jawnego potwierdzenia
  // w żądaniu.** Inaczej potwierdzenie jest ozdobą okna — dokładnie tak, jak
  // przed Fazą 2 bramka wysyłki mieszkała w przyciskach zamiast w trasach.
  //
  // Mierzymy na ŚWIEŻYM szkicu faktury, nie na fakturze z tej drogi: tamta
  // ma już numer, a ponowne wystawienie jest idempotentne i świadomie NIE
  // pyta (powtórzenie czegoś, co się stało, nie jest nieodwracalne).
  krok("Sonda: nieodwracalność");
  const sondaFv = await api("POST", "/api/invoices", {
    klient_nazwa: `Sonda nieodwracalności [${ZNACZNIK}]`,
  });
  const sondaFvId = id(sondaFv.dane);
  wymagaj(!!sondaFvId, `nie udało się założyć faktury do sondy: ${JSON.stringify(sondaFv.dane)}`);
  await api("POST", `/api/invoices/${sondaFvId}/items`, {
    nazwa: "Usługa",
    ilosc: 1,
    cena_netto: 1000,
    vat_stawka: "23",
  });

  const bezZgody = await api("POST", `/api/invoices/${sondaFvId}/issue`);
  sprawdz(
    "wystawienie faktury BEZ potwierdzenia nie nadaje numeru",
    bezZgody.status === 428 && bezZgody.dane?.potwierdzenie?.dzialanie === "faktura-wystaw",
    undefined,
    `→ ${bezZgody.status} ${JSON.stringify(bezZgody.dane?.error ?? bezZgody.dane)}`
  );

  // Zgoda na jedno działanie nie może przepuszczać innego — inaczej jeden
  // nagłówek wpisany gdziekolwiek otwierałby całą listę.
  const cudzaZgoda = await apiZPotwierdzeniem("POST", `/api/invoices/${sondaFvId}/issue`, "lead-usun");
  sprawdz(
    "potwierdzenie INNEGO działania nie przepuszcza wystawienia",
    cudzaZgoda.status === 428,
    undefined,
    `→ ${cudzaZgoda.status} ${JSON.stringify(cudzaZgoda.dane?.error ?? cudzaZgoda.dane)}`
  );

  // Poziom „mocne”: sama zgoda nie wystarczy, trzeba przepisać nazwę nabywcy.
  const zlaFraza = await apiZPotwierdzeniem(
    "POST",
    `/api/invoices/${sondaFvId}/issue`,
    "faktura-wystaw",
    undefined,
    "cokolwiek innego"
  );
  sprawdz(
    "wystawienie z BŁĘDNIE przepisaną nazwą nabywcy nie przechodzi",
    zlaFraza.status === 428 && zlaFraza.dane?.potwierdzenie?.powod === "fraza-sie-nie-zgadza",
    undefined,
    `→ ${zlaFraza.status} ${JSON.stringify(zlaFraza.dane?.error ?? zlaFraza.dane)}`
  );

  // Odmowa NIE MOŻE zdradzać wymaganej wartości — inaczej wystarczyłoby
  // przepisać ją z odpowiedzi do kolejnego żądania i „mocne” potwierdzenie
  // byłoby formalnością.
  sprawdz(
    "odmowa nie zdradza frazy, którą trzeba przepisać",
    !JSON.stringify(zlaFraza.dane).includes("Sonda nieodwracalności"),
    undefined,
    `treść odmowy: ${JSON.stringify(zlaFraza.dane).slice(0, 200)}`
  );

  // Numer nie mógł się nadać przy ŻADNEJ z trzech odmów.
  const poOdmowach = await pobierzFakture(sondaFvId!);
  sprawdz(
    "po trzech odmowach faktura wciąż nie ma numeru",
    !poOdmowach.invoice.numer,
    undefined,
    `numer = ${poOdmowach.invoice.numer ?? "(brak)"}`
  );

  // …i dopiero komplet zgoda + poprawna fraza wystawia. Inna wielkość liter
  // ma przechodzić: bariera ma zmusić do PRZECZYTANIA, nie do trafienia
  // w klawisz Shift.
  const zZgoda = await apiZPotwierdzeniem(
    "POST",
    `/api/invoices/${sondaFvId}/issue`,
    "faktura-wystaw",
    undefined,
    `sonda NIEODWRACALNOŚCI [${ZNACZNIK}]`
  );
  sprawdz(
    "z potwierdzeniem i poprawną nazwą (inna wielkość liter) wystawienie przechodzi",
    zZgoda.status === 200 && !!zZgoda.dane?.numer,
    undefined,
    `→ ${zZgoda.status} ${JSON.stringify(zZgoda.dane?.error ?? zZgoda.dane)}`
  );

  // Usunięcie rekordu głównego — druga kategoria z listy, inny uchwyt HTTP
  // (`DELETE` nie niesie ciała, więc potwierdzenie jedzie nagłówkiem).
  const sondaLead = await api("POST", "/api/leads", { firma: `Sonda usuwania [${ZNACZNIK}]` });
  const sondaLeadId = id(sondaLead.dane);
  wymagaj(!!sondaLeadId, `nie udało się założyć leada do sondy: ${JSON.stringify(sondaLead.dane)}`);
  const usunBezZgody = await api("DELETE", `/api/leads/${sondaLeadId}`);
  const leadDalejJest = await pobierzLead(sondaLeadId!);
  sprawdz(
    "usunięcie leada BEZ potwierdzenia nie kasuje rekordu",
    usunBezZgody.status === 428 && !!leadDalejJest.id,
    undefined,
    `→ ${usunBezZgody.status}, lead ${leadDalejJest.id ? "istnieje" : "ZNIKNĄŁ"}`
  );
  const usunZeZgoda = await apiZPotwierdzeniem("DELETE", `/api/leads/${sondaLeadId}`, "lead-usun");
  const leadPoUsunieciu = await pobierzLead(sondaLeadId!);
  sprawdz(
    "to samo usunięcie z potwierdzeniem przechodzi",
    usunZeZgoda.status === 200 && !leadPoUsunieciu.id,
    undefined,
    `→ ${usunZeZgoda.status}, lead ${leadPoUsunieciu.id ? "WCIĄŻ istnieje" : "usunięty"}`
  );

  // Reguła działa w OBIE strony: co odwracalne, nie pyta. Gdyby zaczęło
  // pytać, potwierdzenia rozmnożyłyby się po panelu i przestały cokolwiek
  // znaczyć — a to jest ta sama choroba co D1, tylko z drugiej strony.
  const odwracalne = await api("PATCH", `/api/invoices/${sondaFvId}`, { status: "Anulowana" });
  sprawdz(
    "działanie ODWRACALNE (zmiana statusu faktury) nadal nie pyta o nic",
    odwracalne.status === 200,
    undefined,
    `→ ${odwracalne.status} ${JSON.stringify(odwracalne.dane?.error ?? "")}`
  );

  // ── 14. Droga, która się NIE udaje ─────────────────────────────────────
  await drogaPorazki(umowaId!, projektId);

  await sondaEtykietaKontraSlug();

  // ── 15. Hamulec — NA KOŃCU, świadomie ──────────────────────────────────
  // Sonda hamulca zostawia w bazie pięć nieudanych prób z tego samego odcisku,
  // więc każde publiczne żądanie PO niej dostaje 429. Postawiona wyżej
  // zabrałaby drodze porażki jej własne odrzucenie i wyglądałoby to na
  // regresję. To jest ta sama pułapka co „dev-baza żyje między przebiegami”,
  // tylko wewnątrz jednego przebiegu.
  await sondaHamulca();

  // ── 16. Drugi rok obrotowy ─────────────────────────────────────────────
  // PO hamulcu, bo nie dotyka publicznych dokumentów, a hamulec zatruwa
  // odcisk na godzinę (patrz komentarz wyżej).
  await drugiRokObrotowy();

  // ── 17. Awarie i brzegi ────────────────────────────────────────────────
  await awarieIBrzegi();

  // ── 18. Szwy między modułami ───────────────────────────────────────────
  await szwyMiedzyModulami();

  // ── 19. Dwie karty na tym samym rekordzie (etap 3) ─────────────────────
  await dwieKarty();

  // ── 20. Zerwane żądanie w połowie wysyłki maila (etap 3) ───────────────
  await zerwanaWysylka();
}

// ── Szwy między modułami ───────────────────────────────────────────────────

/**
 * Czy to JEDEN system, czy czternaście narzędzi w jednym menu.
 *
 * Przegląd szwów z 2026-08-06 zadał inne pytanie niż wszystkie audyty przed
 * nim: tamte patrzyły W GŁĄB modułu, ten — na styki. Wynik: kręgosłup
 * (lead → oferta → umowa → projekt → faktura → zapłata → opinia) trzymał,
 * a wszystkie trzy dziury leżały po jednej stronie — przy PIENIĄDZACH
 * WYCHODZĄCYCH:
 *
 *  1. rentowność projektu sumowała koszty w obcej walucie po nominale
 *     (1000 EUR wchodziło jako 1000 zł),
 *  2. faktura od dostawcy po terminie nie odzywała się NIGDZIE poza własnym
 *     modułem — ani na Pulpicie, ani w Kalendarzu, ani w porannym mailu,
 *  3. Statystyki nie znały kosztów w ogóle (słowo „costs" nie padało w tym
 *     pliku ani raz), więc „wskaźniki zdrowia biznesu" mówiły o obrocie.
 *
 * Te zdania są czujkami na wszystkie trzy naraz. Wszystkie liczą na TYCH
 * SAMYCH danych, które wpisuje jedno żądanie — jeśli któraś powierzchnia
 * znowu zacznie liczyć po swojemu, rozjazd wyjdzie tutaj, a nie u klienta.
 */
async function szwyMiedzyModulami(): Promise<void> {
  krok("Szwy: pieniądze wychodzące");

  const prj = await api("POST", "/api/projects", { tytul: `[przejście ${ZNACZNIK}] Szwy — rentowność` });
  const projektId = id(prj.dane);
  if (!projektId) {
    pominiete.push("szwy między modułami — nie udało się założyć projektu");
    return;
  }

  // 1000 EUR po kursie 4,30 to 4300 zł. Nominał (1000) był tu wynikiem do
  // 2026-08-06 i nic go nie zgłaszało, bo flaga „są inne waluty" patrzyła
  // wyłącznie na faktury.
  const koszt = await api("POST", "/api/costs", {
    kategoria: "Sprzęt",
    opis: `[przejście ${ZNACZNIK}] serwer w euro`,
    kwota_netto: 1000,
    vat_stawka: "23",
    waluta: "EUR",
    kurs_pln: 4.3,
    project_id: projektId,
    data: dzisiaj(),
  });
  if (koszt.status === 200) {
    const po = await pobierzProjekt(projektId);
    const kosztyNetto = Number(po?.rentownosc?.koszty_netto ?? 0);
    sprawdz(
      "koszt w euro wchodzi do rentowności projektu PO KURSIE, nie po nominale",
      Math.abs(kosztyNetto - 4300) < 1,
      undefined,
      `rentowność policzyła ${kosztyNetto} zamiast 4300`
    );
  } else {
    pominiete.push(`szwy: koszt w euro — trasa oddała ${koszt.status}`);
  }

  // Faktura od dostawcy po terminie. Trzy powierzchnie, jedno źródło danych.
  const zalegly = await api("POST", "/api/costs", {
    kategoria: "Usługi",
    opis: `[przejście ${ZNACZNIK}] faktura od dostawcy po terminie`,
    kwota_netto: 8000,
    vat_stawka: "23",
    waluta: "PLN",
    data: "2026-07-10",
    termin_platnosci: "2026-07-16",
    status: "Nieopłacony",
  });
  if (zalegly.status === 200) {
    const dzis = await api("GET", "/api/hub/today");
    const naPulpicie = JSON.stringify(dzis.dane?.overdueCosts ?? []).includes("po terminie");
    sprawdz(
      "faktura od dostawcy po terminie trafia na Pulpit",
      naPulpicie,
      undefined,
      "Pulpit nie zna kosztów po terminie"
    );

    const terminy = await api("GET", `/api/events/deadlines?month=2026-07`);
    const wKalendarzu = (terminy.dane?.deadlines ?? []).some(
      (d: { kind?: string }) => d.kind === "cost"
    );
    sprawdz(
      "termin zapłaty faktury od dostawcy stoi w Kalendarzu",
      wKalendarzu,
      undefined,
      "Kalendarz nie zna terminów pieniędzy wychodzących"
    );
  } else {
    pominiete.push(`szwy: koszt po terminie — trasa oddała ${zalegly.status}`);
  }

  // Statystyki: druga połowa bilansu. Sprawdzamy OBECNOŚĆ i to, że zysk jest
  // różnicą, a nie osobnym zapytaniem, które da się rozjechać.
  const stat = await api("GET", "/api/stats");
  const k = stat.dane?.koszty;
  sprawdz(
    "Statystyki znają koszty i zysk, nie tylko obrót",
    !!k && typeof k.wOknie === "number" && typeof k.zyskWOknie === "number",
    undefined,
    "odpowiedź /api/stats nie ma bloku „koszty”"
  );
  if (k) {
    sprawdz(
      "zysk w Statystykach to przychód minus koszty, policzone z tych samych liczb",
      Math.abs(Number(k.zyskWOknie) - (Number(k.przychodWOknie) - Number(k.wOknie))) < 0.05,
      undefined,
      `zysk ${k.zyskWOknie} ≠ ${k.przychodWOknie} − ${k.wOknie}`
    );
  }
}

// ── Dwie karty na tym samym rekordzie ──────────────────────────────────────

/**
 * Etap 3 planu domknięcia: co się dzieje, gdy oferta jest otwarta na laptopie
 * I na iPadzie.
 *
 * Kontroli współbieżności panel nie ma żadnej — zero `If-Match`, zero
 * `UPDATE … AND updated_at = …` — więc przy TYM SAMYM polu wygrywa ostatni
 * zapis. Ratuje sytuację **granularność PATCH-a**: trasa dotyka wyłącznie pól,
 * które przyszły w ciele, więc dwie karty piszące w RÓŻNE pola nie depczą się
 * nawzajem. To pierwsze zdanie jest czujką dokładnie na to: gdyby ktoś kiedyś
 * zamienił gałęzie `if ("tytul" in body)` na jeden `UPDATE … SET wszystko`,
 * druga karta zaczęłaby cofać pracę pierwszej — bez żadnego objawu w kodzie.
 *
 * Drugie zdanie pilnuje poprawki etapu 3: zapis do rekordu, którego już nie
 * ma, MUSI odmówić. Do 2026-08-06 dziewięć rodzajów rekordów odpowiadało wtedy
 * `{"ok":true}` — panel pisał „Zapisano" nad treścią, której nie ma w bazie
 * (patrz `lib/brakRekordu.ts`).
 */
async function dwieKarty(): Promise<void> {
  krok("Brzegi: dwie karty na tym samym rekordzie");

  const nowa = await api("POST", "/api/offers", {
    tytul: `[przejście ${ZNACZNIK}] Dwie karty`,
    klient_nazwa: `[przejście ${ZNACZNIK}] Dwie karty`,
  });
  const ofertaId = id(nowa.dane);
  if (!ofertaId) {
    pominiete.push("dwie karty — nie udało się założyć oferty");
    return;
  }

  // Karta A zmienia tytuł, karta B w tej samej chwili uwagi.
  await Promise.all([
    api("PATCH", `/api/offers/${ofertaId}`, { tytul: "TYTUŁ Z KARTY A" }),
    api("PATCH", `/api/offers/${ofertaId}`, { uwagi: "UWAGI Z KARTY B" }),
  ]);
  // `pobierzOferte` oddaje CAŁĄ odpowiedź trasy (oferta + pozycje + bramka),
  // a nie sam wiersz — pierwsza wersja tego zdania czytała `po.tytul` i miała
  // `undefined` po obu stronach, czyli sprawdzała, że dwa nic są równe.
  const po = (await pobierzOferte(ofertaId))?.offer;
  sprawdz(
    "dwie karty piszące w RÓŻNE pola tej samej oferty nie kasują sobie nawzajem zmian",
    po?.tytul === "TYTUŁ Z KARTY A" && po?.uwagi === "UWAGI Z KARTY B",
    undefined,
    `tytuł: ${JSON.stringify(po?.tytul)}, uwagi: ${JSON.stringify(po?.uwagi)}`
  );

  // Karta A usuwa pozycję, karta B próbuje ją w tym czasie edytować.
  const poz = await api("POST", `/api/offers/${ofertaId}/items`, { nazwa: "Pozycja do usunięcia", cena: 100 });
  const pozId = poz.dane?.items?.at(-1)?.id as string | undefined;
  if (pozId) {
    const usuniecie = await api("DELETE", `/api/offers/${ofertaId}/items/${pozId}`);
    const edycja = await api("PATCH", `/api/offers/${ofertaId}/items/${pozId}`, { cena: 9999 });
    sprawdz(
      "zapis do pozycji usuniętej w drugiej karcie ODMAWIA zamiast odpowiadać „zapisano”",
      usuniecie.status === 200 && edycja.status === 404,
      undefined,
      `usunięcie: ${usuniecie.status}, edycja po usunięciu: ${edycja.status} ${JSON.stringify(edycja.dane).slice(0, 120)}`
    );
  } else {
    pominiete.push("zapis do usuniętej pozycji — nie udało się dodać pozycji");
  }

  // ── WYKRYWANIE ROZJAZDU (etap 3, decyzja właściciela „wykryj i powiedz") ──
  //
  // Dwa zdania, bo mechanizm ma dwie strony i **obie potrafią upaść osobno**:
  // może przestać wykrywać (cisza) albo zacząć krzyczeć na własne zapisy
  // (fałszywy alarm). To drugie jest gorsze — ostrzeżenie, które pada bez
  // powodu, uczy je ignorować, czyli kasuje mechanizm bez kasowania kodu.
  // Fałszywy alarm ZDARZYŁ SIĘ przy budowie: drugi zapis z rzędu w jednej
  // karcie wysyłał znacznik sprzed własnej poprzedniej zmiany.
  const stanA = (await pobierzOferte(ofertaId))?.offer?.updated_at as string | undefined;
  if (stanA) {
    // (a) jedna karta, dwa zapisy z rzędu — MUSI milczeć. Drugi zapis idzie ze
    //     znacznikiem, który trasa oddała przy pierwszym (tak robi przeglądarka).
    const pierwszy = await api("PATCH", `/api/offers/${ofertaId}`, { uwagi: "jedna karta, zapis 1" }, { "x-znany-stan": stanA });
    const stanPo = pierwszy.dane?.updated_at as string | undefined;
    const drugi = stanPo
      ? await api("PATCH", `/api/offers/${ofertaId}`, { uwagi: "jedna karta, zapis 2" }, { "x-znany-stan": stanPo })
      : { status: 0, dane: {} as any };
    sprawdz(
      "dwa zapisy z rzędu w JEDNEJ karcie nie zgłaszają rozjazdu (brak fałszywego alarmu)",
      !!stanPo && !pierwszy.dane?.rozjazd && !drugi.dane?.rozjazd,
      undefined,
      `zapis 1: ${JSON.stringify(pierwszy.dane)}, zapis 2: ${JSON.stringify(drugi.dane)}`
    );

    // (b) druga karta trzyma STARY znacznik, ktoś inny w międzyczasie zapisał —
    //     MUSI ostrzec, a zapis MUSI mimo to przejść („nie blokuj").
    const stary = (await pobierzOferte(ofertaId))?.offer?.updated_at as string | undefined;
    await api("PATCH", `/api/offers/${ofertaId}`, { tytul: "Zmiana z innego okna" });
    const zeStarym = await api("PATCH", `/api/offers/${ofertaId}`, { uwagi: "UWAGI ZE STAREGO EKRANU" }, { "x-znany-stan": stary ?? "" });
    const stanKoncowy = await pobierzOferte(ofertaId);
    sprawdz(
      "zapis ze STARYM stanem ostrzega o rozjeździe — ale przechodzi, nie jest blokowany",
      zeStarym.status === 200 &&
        String(zeStarym.dane?.rozjazd ?? "").includes("zmienił się w międzyczasie") &&
        stanKoncowy?.offer?.uwagi === "UWAGI ZE STAREGO EKRANU" &&
        stanKoncowy?.offer?.tytul === "Zmiana z innego okna",
      undefined,
      `odpowiedź: ${JSON.stringify(zeStarym.dane).slice(0, 160)}`
    );

    // (c) bez nagłówka (apka, skrypt, cron) trasa MILCZY — brak wiedzy to nie
    //     jest powód do ostrzeżenia.
    const bezNaglowka = await api("PATCH", `/api/offers/${ofertaId}`, { uwagi: "bez nagłówka" });
    sprawdz(
      "zapis bez znacznika (apka, skrypt) nie dostaje ostrzeżenia o rozjeździe",
      bezNaglowka.status === 200 && !bezNaglowka.dane?.rozjazd,
      undefined,
      JSON.stringify(bezNaglowka.dane)
    );
  } else {
    pominiete.push("wykrywanie rozjazdu — nie udało się odczytać znacznika oferty");
  }

  // To samo dla rekordu GŁÓWNEGO: karta A usuwa klienta, karta B go edytuje.
  const klient = await api("POST", "/api/clients", { nazwa: `[przejście ${ZNACZNIK}] Klient dwóch kart` });
  const klientId = id(klient.dane);
  if (klientId) {
    const usun = await apiZPotwierdzeniem(
      "DELETE",
      `/api/clients/${klientId}`,
      "klient-usun",
      undefined,
      `[przejście ${ZNACZNIK}] Klient dwóch kart`
    );
    const edycja = await api("PATCH", `/api/clients/${klientId}`, { nazwa: "Nazwa z drugiej karty" });
    sprawdz(
      "zapis do klienta usuniętego w drugiej karcie ODMAWIA — i mówi dlaczego",
      usun.status === 200 && edycja.status === 404 && String(edycja.dane?.error ?? "").includes("już nie istnieje"),
      undefined,
      `usunięcie: ${usun.status}, edycja: ${edycja.status} ${JSON.stringify(edycja.dane).slice(0, 140)}`
    );
  } else {
    pominiete.push("zapis do usuniętego klienta — nie udało się założyć klienta");
  }
}

// ── Zerwane żądanie w połowie wysyłki maila ────────────────────────────────

/**
 * Bezpiecznik podwójnej wysyłki (`lib/mailGuard.ts`) bez skrzynki pocztowej.
 *
 * Przebieg etapu 3 sprawdził go na ATRAPIE serwera SMTP i przeszedł: zerwane
 * żądanie w połowie wysyłki nie dało drugiego maila u klienta, ponowienie
 * w locie usłyszało „poprzednia próba jeszcze trwa", a po zakończeniu — „ta
 * wiadomość została już wysłana". Atrapy nie ma w repo (żyła jedną sesję),
 * więc tutaj zostaje to, co da się sprawdzić ZAWSZE: że trasa wysyłki
 * odmawia, gdy skrzynki nie ma, zamiast udawać sukces.
 *
 * To nie jest namiastka tamtego przebiegu — to czujka na inną rzecz: żeby
 * „brak konfiguracji" nigdy nie zaczął wyglądać jak „wysłano".
 */
async function zerwanaWysylka(): Promise<void> {
  krok("Brzegi: wysyłka maila bez skrzynki");

  const dane = new FormData();
  dane.set("to", "klient@przyklad.pl");
  dane.set("subject", `[przejście ${ZNACZNIK}] Próba wysyłki`);
  dane.set("text", "Treść.");
  const odp = await fetch(`${BAZA}/api/mail/compose`, { method: "POST", body: dane });
  const tekst = await odp.text();

  sprawdz(
    "wysyłka maila bez skonfigurowanej skrzynki ODMAWIA — nie udaje sukcesu",
    odp.status >= 400 && !tekst.includes('"ok":true'),
    undefined,
    `kod ${odp.status}: ${tekst.slice(0, 140)}`
  );
}

// ── Awarie i brzegi ────────────────────────────────────────────────────────

/**
 * Co się dzieje, gdy KLIKNIE SIĘ DWA RAZY — albo gdy klika dwoje ludzi naraz.
 *
 * Punkt (c) trzeciego przejścia. Oba wcześniejsze przejścia szły ścieżką
 * grzeczną: jedno kliknięcie, jedna karta, wszystko po kolei. Prawdziwe
 * podwójne kliknięcie bierze się nie z niecierpliwości, tylko z **zerwanego
 * żądania**: telefon ma krótszy limit czasu niż trasa, więc pokazuje błąd tam,
 * gdzie serwer widzi sukces — i właściciel klika drugi raz.
 *
 * Trzy pierwsze zdania to CZUJKI na ochrony, które już istnieją (warunkowy
 * `UPDATE` + sprawdzenie liczby wierszy). Nie pilnują znanej luki — mają się
 * odezwać, gdyby ktoś kiedyś zamienił je na zwykły zapis.
 */
async function awarieIBrzegi(): Promise<void> {
  krok("Brzegi: dwa kliknięcia naraz");

  const oferta = await ofertaDoOdrzucenia(`[przejście ${ZNACZNIK}] Wyścig akceptacji`);
  if (oferta) {
    // Dwa równoległe „Akceptuj” na tej samej ofercie. Bez warunkowego claimu
    // powstałyby DWA projekty i DWIE faktury z jednej sprzedaży.
    const [a, b] = await Promise.all([
      api("POST", `/api/offers/${oferta.ofertaId}/accept`, {}),
      api("POST", `/api/offers/${oferta.ofertaId}/accept`, {}),
    ]);
    // Ochrona ma DWIE drogi i obie są poprawne — pierwsza wersja tego zdania
    // wymagała 409 i migotała, bo dostawała raz 409, raz 400:
    //  · drugie żądanie czyta ofertę PO zapisie pierwszego → bramka stanu
    //    (`ocenAkceptacje`) odmawia 400 „Oferta jest już zaakceptowana";
    //  · czyta PRZED → dochodzi do warunkowego claimu w transakcji, ten
    //    zwraca zero wierszy i całość wraca 409 z ROLLBACK-iem.
    // Znaczenie ma to, ile razy się UDAŁO, nie którą drogą odbiło to drugie.
    const udane = [a, b].filter((r) => r.status === 200);
    const odrzucone = [a, b].filter((r) => r.status === 400 || r.status === 409);
    sprawdz(
      "dwa równoległe „Akceptuj ofertę” kończą się JEDNĄ akceptacją — drugie odbija się bez skutku",
      udane.length === 1 && odrzucone.length === 1,
      undefined,
      `kody: ${a.status}, ${b.status}`
    );
  } else {
    pominiete.push("wyścig akceptacji oferty — nie udało się przygotować oferty");
  }

  // Wpłata: TU ochrony nie ma i to jest świadome — wpłatę da się usunąć,
  // a reguła Fazy 4 mówi „co odwracalne, nie pyta”. Ale skutek nie może być
  // niewidoczny: faktura pokazuje „Opłacona” (zgodnie z prawdą), więc nikt do
  // niej nie wraca, a zdublowana kwota zawyża przychód w Statystykach.
  const fvId = await fakturaZPozycja(`[przejście ${ZNACZNIK}] Wyścig wpłaty`, 1000);
  if (fvId) {
    await Promise.all([
      api("POST", `/api/invoices/${fvId}/payments`, { kwota: 1230 }),
      api("POST", `/api/invoices/${fvId}/payments`, { kwota: 1230 }),
    ]);
    const naruszenia = await naruszeniaReguly("wplaty-przekraczaja-naleznosc");
    sprawdz(
      "zdublowana wpłata nie znika po cichu — kontrola spójności ją pokazuje",
      naruszenia.some((n) => n.includes("2460")),
      undefined,
      naruszenia[0] ?? "kontrola spójności nie zgłosiła nadpłaty"
    );
  } else {
    pominiete.push("zdublowana wpłata — nie udało się przygotować faktury");
  }
}

/** Faktura ze szkicu, z jedną pozycją — punkt wyjścia dla sond o pieniądzach. */
async function fakturaZPozycja(nazwaKlienta: string, cenaNetto: number): Promise<string | null> {
  const fv = await api("POST", "/api/invoices", { klient_nazwa: nazwaKlienta });
  const fvId = id(fv.dane);
  if (!fvId) return null;
  await api("POST", `/api/invoices/${fvId}/items`, {
    nazwa: "Usługa", ilosc: 1, jednostka: "szt.", cena_netto: cenaNetto, vat_stawka: "23",
  });
  return fvId;
}

/** Opisy naruszeń JEDNEJ reguły kontroli spójności (`/api/observability`). */
async function naruszeniaReguly(regulaId: string): Promise<string[]> {
  const odp = await api("GET", "/api/observability");
  const reguly = odp.dane?.spojnosc?.reguly ?? [];
  const r = reguly.find((x: any) => x.id === regulaId);
  return (r?.naruszenia ?? []).map((n: any) => String(n.opis ?? ""));
}

// ── Drugi rok obrotowy ─────────────────────────────────────────────────────

/**
 * Czego dwa pierwsze przejścia nie mogły zobaczyć: UPŁYWU CZASU.
 *
 * Oba trwały dziesięć minut zegarowych, a panel powstał w lipcu 2026 i nigdy
 * nie przeżył 31 grudnia. Przez tę datę przechodzą numeracja faktur, retencja
 * i dokumenty cykliczne.
 *
 * **Metoda: postarzamy DANE, nie zegar.** W kodzie nie ma wstrzykiwania daty
 * (sprawdzone 2026-08-05) i nie ma go dokładać tylko po to, żeby dało się
 * testować. Ale retencja liczy się SQL-em (`now() - interval`), a cykliczne
 * wyzwala `next_run <= today`, więc rekord z datą w przeszłości zachowuje się
 * dokładnie tak, jakby czas minął.
 */
async function drugiRokObrotowy(): Promise<void> {
  krok("Drugi rok: rytm serii cyklicznych");

  // Szablon „co miesiąc 31." z terminem zaległym o pół roku — tak wygląda
  // seria, której cron nie nadrobił (awaria, brak CRON_SECRET, limity Vercela).
  const szablon = await api("POST", "/api/recurring", {
    nazwa: `[przejście ${ZNACZNIK}] Abonament 31.`,
    klient_nazwa: `[przejście ${ZNACZNIK}] Klient abonamentowy`,
    klient_email: `abonament.${ZNACZNIK}@przyklad.pl`,
    cykl: "miesiecznie",
    next_run: "2026-01-31",
    pozycje: [{ nazwa: "Abonament", ilosc: 1, jednostka: "szt.", cena_netto: 1000, vat_stawka: "23" }],
  });
  const szablonId = id(szablon.dane);
  wymagaj(!!szablonId, "nie udało się założyć szablonu cyklicznego");

  const poZalozeniu = await stanSzablonu(szablonId!);
  sprawdz(
    "założony szablon zapamiętuje KOTWICĘ rytmu, nie tylko najbliższy termin",
    poZalozeniu?.kotwica === "2026-01-31",
    undefined,
    `kotwica = ${poZalozeniu?.kotwica}`
  );

  await api("POST", "/api/leads/notify", {});
  const poNadrobieniu = await stanSzablonu(szablonId!);

  // SEDNO. Kotwica to 31., cron nadrabia pół roku spóźnienia — następny termin
  // ma wypaść 31. dnia miesiąca, nie w dniu nadrobienia. Do 2026-08-05 liczyło
  // się to od `today`, więc jedno spóźnienie przesuwało serię NA STAŁE:
  // faktura „co miesiąc 31." nadrobiona 5. wystawiała się już zawsze 5.
  sprawdz(
    "cron nadrabiający zaległą serię NIE przesuwa jej na dzień nadrobienia",
    typeof poNadrobieniu?.next_run === "string" && poNadrobieniu.next_run.endsWith("-31"),
    undefined,
    `next_run = ${poNadrobieniu?.next_run} (kotwica ${poNadrobieniu?.kotwica})`
  );
  sprawdz(
    "kotwica przeżywa przebieg crona — rytm należy do szablonu, nie do ostatniego uruchomienia",
    poNadrobieniu?.kotwica === "2026-01-31",
    undefined,
    `kotwica = ${poNadrobieniu?.kotwica}`
  );

  const poDrugim = await (async () => {
    await api("POST", "/api/leads/notify", {});
    return stanSzablonu(szablonId!);
  })();
  sprawdz(
    "drugi przebieg tego samego dnia nie generuje dokumentu po raz drugi",
    poDrugim?.next_run === poNadrobieniu?.next_run,
    undefined,
    `${poNadrobieniu?.next_run} → ${poDrugim?.next_run}`
  );

  // Ręczna zmiana terminu = przesunięcie RYTMU, nie jednego wystąpienia
  // (ta sama reguła, co przy terminie przypomnienia).
  await api("PATCH", `/api/recurring/${szablonId}`, { next_run: "2027-03-10" });
  const poRecznej = await stanSzablonu(szablonId!);
  sprawdz(
    "ręczna zmiana terminu przestawia kotwicę — „od teraz tego dnia”",
    poRecznej?.kotwica === "2027-03-10" && poRecznej?.next_run === "2027-03-10",
    undefined,
    `next_run = ${poRecznej?.next_run}, kotwica = ${poRecznej?.kotwica}`
  );

  krok("Drugi rok: retencja po upływie okna");

  // Trzy leady: martwy, martwy-ale-powiązany, świeży. Postarzamy przez
  // `ostatni_kontakt` — to na nim (a nie na `updated_at`) stoi zegar RODO.
  const martwy = id((await api("POST", "/api/leads", {
    firma: `[przejście ${ZNACZNIK}] Retencja — martwy`, email: `martwy.${ZNACZNIK}@przyklad.pl`,
  })).dane);
  const zOferta = id((await api("POST", "/api/leads", {
    firma: `[przejście ${ZNACZNIK}] Retencja — powiązany`, email: `powiazany.${ZNACZNIK}@przyklad.pl`,
  })).dane);
  const swiezy = id((await api("POST", "/api/leads", {
    firma: `[przejście ${ZNACZNIK}] Retencja — świeży`, email: `swiezy.${ZNACZNIK}@przyklad.pl`,
  })).dane);
  wymagaj(!!martwy && !!zOferta && !!swiezy, "nie udało się założyć leadów do retencji");

  for (const lead of [martwy!, zOferta!]) {
    await api("PATCH", `/api/leads/${lead}`, { ostatni_kontakt: "2023-01-15" });
  }
  await api("POST", "/api/offers", { tytul: `[przejście ${ZNACZNIK}] Oferta chroniąca`, lead_id: zOferta });

  await api("POST", "/api/leads/notify", {});
  const zyje = async (leadId: string) => (await api("GET", `/api/leads/${leadId}`)).status === 200;

  sprawdz(
    "lead bez śladu relacji, starszy niż okno retencji, znika sam",
    !(await zyje(martwy!)),
    undefined,
    "24 miesiące bez kontaktu i bez klienta/oferty/umowy/faktury/projektu"
  );
  // Wykluczenie jest tu ważniejsze od samego kasowania: fałszywe zatrzymanie
  // kosztuje miejsce, fałszywe usunięcie kosztuje DANE, których nie ma skąd
  // odtworzyć.
  sprawdz(
    "lead równie stary, ale z ofertą, zostaje — powiązanie chroni przed retencją",
    await zyje(zOferta!),
    undefined,
    "wykluczenia: klient, faktura, oferta, umowa, projekt"
  );
  sprawdz(
    "świeży lead zostaje nietknięty",
    await zyje(swiezy!),
  );
}

/** Stan szablonu cyklicznego, z datami przyciętymi do `YYYY-MM-DD` — kolumna
 * `DATE` wraca inaczej z `neon()` (string) niż z PGlite (bywa `Date`). */
async function stanSzablonu(szablonId: string): Promise<{ next_run: string; kotwica: string | null } | null> {
  const lista = await api("GET", "/api/recurring");
  const r = (lista.dane?.recurring ?? []).find((x: any) => x.id === szablonId);
  if (!r) return null;
  const dzien = (v: unknown) => (v == null ? null : String(v instanceof Date ? v.toISOString() : v).slice(0, 10));
  return { next_run: dzien(r.next_run)!, kotwica: dzien(r.kotwica) };
}

// ── Droga, która się nie udaje ─────────────────────────────────────────────

/**
 * Druga droga: oferta wraca z odmową, powstaje wersja 2, warunki zmieniają
 * się aneksami, projekt się psuje, a faktura nie zostaje zapłacona.
 *
 * Powstała po drugim przejściu „na sucho” (krok 5 planu) z tego samego powodu,
 co całe `npm run przejscie` po pierwszym: żeby trzecie przejście nie musiało
 * przeklikiwać ręcznie tego, co już raz sprawdzono. Do 2026-08-05 harness znał
 * WYŁĄCZNIE drogę, która się udaje — a wszystkie cztery brakujące mechanizmy
 * z drugiego przejścia siedziały właśnie po tej drugiej stronie.
 *
 * Trzy sprawdzenia niżej przeniesione co do joty z sondy kroku 4 (napisanej
 * i skasowanej): pięć wpisów w logu leada, odrzucenie na osi klienta DOKŁADNIE
 * raz i cisza reguły przy żywej ofercie. Regresja w drugim z nich byłaby cicha,
 * bo duble na osi czasu wyglądają jak „bogatsza historia”.
 */
async function drogaPorazki(umowaGlownaId: string, projektGlownyId: string): Promise<void> {
  krok("Porażka: oferta i odmowa klienta");

  const nowyLead = await api("POST", "/api/leads", {
    firma: `Chłodnia Wisła [przejście ${ZNACZNIK}]`,
    osoba_kontaktowa: "Karolina Bąk",
    email: "k.bak@chlodniawisla.pl",
    telefon: "602 330 440",
    branza: "Chłodnictwo",
    // Adres z palca, jak w głównej drodze: bez niego bramka wysyłki zgłasza
    // OSTRZEŻENIE („odbiorca bez adresu") i droga porażki nie doszłaby do
    // miejsca, o które w niej chodzi.
    ulica: "ul. Zakładowa 7",
    kod: "30-740",
    miasto: "Kraków",
    zrodlo_kategoria: "Formularz na stronie",
  });
  const leadId = id(nowyLead.dane);
  wymagaj(!!leadId, `POST /api/leads (porażka) → ${nowyLead.status} ${JSON.stringify(nowyLead.dane)}`);

  const nowaOferta = await api("POST", "/api/offers", { lead_id: leadId });
  const ofertaId = id(nowaOferta.dane);
  wymagaj(!!ofertaId, `POST /api/offers (porażka) → ${nowaOferta.status} ${JSON.stringify(nowaOferta.dane)}`);
  const klientId: string | null = (await pobierzOferte(ofertaId!)).offer.client_id ?? null;

  // Komplet warunków handlowych — te cztery pola sprawdzamy niżej po nowej
  // wersji (D2). Bez nich sprawdzenie „wersja 2 dziedziczy" mierzyłoby zera.
  await api("PATCH", `/api/offers/${ofertaId}`, {
    czas_realizacji_tygodnie: 6,
    roi_godziny: 80,
    roi_stawka: 45,
    wazna_do: zaDni(21),
  });
  await api("POST", `/api/offers/${ofertaId}/items`, { nazwa: "Wdrożenie lokalnego modelu", ilosc: 1, jednostka: "kpl.", cena: 15000 });
  await api("POST", `/api/offers/${ofertaId}/sections`, {
    tytul: "Zakres prac",
    tresc: "Wdrożenie lokalnego modelu na sprzęcie klienta wraz ze szkoleniem zespołu.",
  });

  const wyslana = await apiZPotwierdzeniem("POST", `/api/offers/${ofertaId}/send`, "oferta-wyslij");
  wymagaj(wyslana.status === 200, `wysyłka oferty (porażka) → ${wyslana.status} ${JSON.stringify(wyslana.dane)}`);
  const oWyslana = await pobierzOferte(ofertaId!);
  const shareToken = String(oWyslana.offer.share_token ?? "");
  wymagaj(!!shareToken, "wysłana oferta nie dostała tokenu — nie ma czym iść drogą klienta");

  // Reguła MILCZY, dopóki cokolwiek jest w grze — sprawdzenie przeniesione
  // z sondy kroku 4. Bez tego zawężenia panel pytałby o zamknięcie leada,
  // który właśnie dostał ofertę.
  sprawdz(
    "przy ŻYWEJ ofercie reguła domknięcia leada milczy",
    !(await propozycjeDla(leadId!)).some((p) => p.regula === "odrzucona-oferta-domyka-leada"),
    undefined,
    `propozycje dla leada: ${(await propozycjeDla(leadId!)).map((p) => p.regula).join(", ") || "brak"}`
  );

  // ── C1: klient odrzuca ofertę SAM, ze swojej strony ────────────────────
  // DOKŁADNIE JEDNO odrzucenie tej oferty. Pierwsza wersja tej sondy odrzucała
  // ją dwa razy (raz slugiem przez link, raz etykietą z panelu) i sama sobie
  // robiła dubel na osi klienta, po czym zgłaszała go jako regresję panelu.
  // Sprawdzenie „dokładnie raz” jest bezwartościowe, jeśli wołający klika
  // dwa razy.
  const odmowa = await api("POST", `/api/offers/public/${shareToken}/reject`, {
    powod: "Za drogo",
    komentarz: "Zarząd uciął budżet, chcą sam PoC",
    name: "Karolina Bąk",
  });
  let odrzucenieSprawdzone = true;
  if (odmowa.status === 429) {
    // Hamulec ma pierwszeństwo przed wygodą testu (Audyt 1) — mówimy wprost,
    // czego nie sprawdzono, zamiast go rozluźniać.
    pominiete.push("odrzucenie oferty przez PUBLICZNY link — hamulec 5/60 min (HAMULEC_DOKUMENT_PUBLICZNY)");
    console.log("   ⊘ publiczne odrzucenie pominięte (hamulec) — zapisuję od strony panelu");
    await api("PATCH", `/api/offers/${ofertaId}`, {
      status: "Odrzucona",
      powod_odrzucenia: "Za drogo",
      komentarz_odrzucenia: "Zarząd uciął budżet, chcą sam PoC",
    });
    odrzucenieSprawdzone = false;
  } else {
    wymagaj(odmowa.status === 200, `publiczne odrzucenie → ${odmowa.status} ${JSON.stringify(odmowa.dane)}`);
    // Druga próba tym samym linkiem musi odbić się od claimu — decyzja
    // zapadła raz i nie da się jej przepisać z zewnątrz.
    const drugieOdrzucenie = await api("POST", `/api/offers/public/${shareToken}/reject`, { powod: "Nie ten termin" });
    sprawdz(
      "tym samym linkiem nie da się odrzucić oferty drugi raz",
      drugieOdrzucenie.status === 409,
      undefined,
      `→ ${drugieOdrzucenie.status} ${JSON.stringify(drugieOdrzucenie.dane?.error ?? drugieOdrzucenie.dane)}`
    );
  }

  const oOdrzucona = await pobierzOferte(ofertaId!);
  sprawdz(
    "odrzucenie zapisuje powód, komentarz i datę",
    oOdrzucona.offer.status === "Odrzucona" &&
      oOdrzucona.offer.powod_odrzucenia === "Za drogo" &&
      !!oOdrzucona.offer.odrzucona_at,
    undefined,
    `status = ${oOdrzucona.offer.status}, powód = „${oOdrzucona.offer.powod_odrzucenia}”, data = ${oOdrzucona.offer.odrzucona_at}`
  );

  // Akceptacja tym samym linkiem po odmowie — bramka z kroku 1. Klient, który
  // odmówił, nie może „ożywić" oferty powrotem do zakładki.
  if (odrzucenieSprawdzone) {
    const akceptacjaPoOdmowie = await api("POST", `/api/offers/public/${shareToken}/accept`, { name: "Karolina Bąk" });
    sprawdz(
      "po odrzuceniu ten sam link nie pozwala już zaakceptować oferty",
      akceptacjaPoOdmowie.status === 409,
      undefined,
      `→ ${akceptacjaPoOdmowie.status} ${JSON.stringify(akceptacjaPoOdmowie.dane?.error ?? akceptacjaPoOdmowie.dane)}`
    );
  } else {
    pominiete.push("blokada akceptacji po odrzuceniu — publiczna droga niedostępna w tym przebiegu");
  }

  // ── B1 z kroku 4: log LEADA widzi cykl życia oferty ────────────────────
  // `GET /api/leads/:id`, nie `/activity` — ta druga trasa ma wyłącznie POST.
  // Pierwsza wersja tej asercji pytała pod nieistniejący adres i zgłaszała
  // pusty log jako regresję panelu. Sonda też jest kodem (trzeci raz z rzędu).
  const logLeada = ((await api("GET", `/api/leads/${leadId}`)).dane?.activity ?? []) as any[];
  const rodzajeLeada = logLeada.map((w) => String(w.kind ?? ""));
  sprawdz(
    "log leada widzi CAŁY cykl życia oferty, z odrzuceniem włącznie",
    rodzajeLeada.includes("offer_created") &&
      rodzajeLeada.includes("offer_sent") &&
      rodzajeLeada.includes("offer_rejected"),
    undefined,
    `wpisy w logu leada: ${rodzajeLeada.join(", ") || "brak"}`
  );
  const odrzuceniaWLogu = rodzajeLeada.filter((k) => k === "offer_rejected").length;
  sprawdz(
    "odrzucenie stoi w logu leada DOKŁADNIE raz",
    odrzuceniaWLogu === 1,
    undefined,
    `wpisów offer_rejected: ${odrzuceniaWLogu} — dubel wygląda jak bogatsza historia i dlatego byłby cichy`
  );

  if (klientId) {
    const osKlienta = ((await api("GET", `/api/clients/${klientId}`)).dane?.feed ?? []) as any[];
    const odrzuceniaNaOsi = osKlienta.filter((w) => String(w.kind ?? "") === "offer_rejected").length;
    sprawdz(
      "oś czasu klienta pokazuje odrzucenie DOKŁADNIE raz",
      odrzuceniaNaOsi === 1,
      undefined,
      `wpisów offer_rejected na osi klienta: ${odrzuceniaNaOsi} (log leada jest dociągany do osi — stąd ryzyko dubla)`
    );
  } else {
    pominiete.push("oś czasu klienta po odrzuceniu — oferta nie dostała karty klienta");
  }

  // ── B2 z kroku 4: propozycja z DWIEMA drogami wyjścia ──────────────────
  const poOdrzuceniu = (await propozycjeDla(leadId!)).find((p) => p.regula === "odrzucona-oferta-domyka-leada");
  sprawdz(
    "odrzucona oferta rodzi propozycję domknięcia leada",
    !!poOdrzuceniu,
    undefined,
    `propozycje dla leada: ${(await propozycjeDla(leadId!)).map((p) => p.regula).join(", ") || "brak"}`
  );
  sprawdz(
    "propozycja cytuje POWÓD odmowy, a nie sam fakt",
    (poOdrzuceniu?.zdanie ?? "").includes("Za drogo"),
    undefined,
    `zdanie: „${poOdrzuceniu?.zdanie ?? "—"}”`
  );

  // ── A3 + D2: nowa wersja ───────────────────────────────────────────────
  krok("Porażka: nowa wersja oferty");
  const wersja = await api("POST", `/api/offers/${ofertaId}/version`);
  const wersja2Id = id(wersja.dane);
  wymagaj(!!wersja2Id, `POST /api/offers/:id/version → ${wersja.status} ${JSON.stringify(wersja.dane)}`);

  const poprzedniczka = (await pobierzOferte(ofertaId!)).offer;
  sprawdz(
    "nowa wersja NIE wymazuje faktu, że klient odrzucił poprzednią",
    poprzedniczka.status === "Odrzucona" && poprzedniczka.powod_odrzucenia === "Za drogo",
    undefined,
    `status poprzedniczki = ${poprzedniczka.status}, powód = „${poprzedniczka.powod_odrzucenia}” ` +
      `— „Wygasła” tutaj kłamie o tym, na czym przegrywasz (A3)`
  );
  sprawdz(
    "zastąpienie odnotowuje się osobną kolumną, nie statusem",
    !!poprzedniczka.superseded_at,
    undefined,
    `superseded_at = ${poprzedniczka.superseded_at}`
  );

  const w2 = await pobierzOferte(wersja2Id!);
  sprawdz(
    "wersja 2 dziedziczy termin realizacji — ten sam, który wejdzie na umowę",
    Number(w2.offer.czas_realizacji_tygodnie) === 6,
    undefined,
    `czas_realizacji_tygodnie = ${w2.offer.czas_realizacji_tygodnie} (spodziewane 6) — ` +
      `zgubiony tutaj znika z DOKUMENTU, nie z podglądu`
  );
  sprawdz(
    "wersja 2 dziedziczy blok zwrotu dla klienta",
    Number(w2.offer.roi_godziny) === 80 && Number(w2.offer.roi_stawka) === 45,
    undefined,
    `roi_godziny = ${w2.offer.roi_godziny}, roi_stawka = ${w2.offer.roi_stawka} (spodziewane 80 i 45)`
  );
  sprawdz(
    "wersja 2 dziedziczy datę ważności, dopóki ta nie minęła",
    String(w2.offer.wazna_do ?? "").slice(0, 10) === zaDni(21),
    undefined,
    `wazna_do = ${w2.offer.wazna_do} (spodziewane ${zaDni(21)})`
  );
  sprawdz(
    "edytor wersji 2 dostaje powód odrzucenia poprzedniczki",
    w2.poprzednia?.status === "Odrzucona" && w2.poprzednia?.powod_odrzucenia === "Za drogo",
    undefined,
    `poprzednia = ${JSON.stringify(w2.poprzednia ?? null)} — ekran, na którym piszesz ODPOWIEDŹ ` +
      `na odrzucenie, ma pokazywać odrzucenie`
  );

  // Statystyka „na czym przegrywamy" — po A3 powód odrzuconej i zastąpionej
  // oferty musi być w niej widoczny. To jedyne miejsce, które odpowiada na to
  // pytanie, a najzwyklejsza reakcja na odmowę (nowa wersja) kasowała odpowiedź.
  const powody = ((await api("GET", "/api/stats")).dane?.offerLosses?.reasons ?? []) as any[];
  sprawdz(
    "powód odmowy zostaje w statystyce, choć odpowiedzieliśmy nową wersją",
    powody.some((p) => String(p.powod) === "Za drogo"),
    undefined,
    `powody w statystyce: ${powody.map((p) => `${p.powod}×${p.ile}`).join(", ") || "brak"}`
  );

  // Reguła znów MILCZY: wersja 2 jest w grze, więc nie ma czego domykać.
  sprawdz(
    "przy nowej wersji w grze reguła domknięcia leada znów milczy",
    !(await propozycjeDla(leadId!)).some((p) => p.regula === "odrzucona-oferta-domyka-leada"),
    undefined,
    "„jest szkic wersji 2” to trwająca rozmowa handlowa, nie porażka do zamknięcia"
  );

  // ── Krok 3 (A7): dwa aneksy i warunki OBOWIĄZUJĄCE ─────────────────────
  krok("Porażka: dwa aneksy");
  const aneks1 = await api("POST", `/api/contracts/${umowaGlownaId}/aneks`);
  const aneks1Id = id(aneks1.dane);
  wymagaj(!!aneks1Id, `POST aneks nr 1 → ${aneks1.status} ${JSON.stringify(aneks1.dane)}`);
  await api("PATCH", `/api/contracts/${aneks1Id}`, {
    cena: 11000,
    zakres_prac: "Rozszerzenie o drugi model i szkolenie zespołu.",
    termin_realizacji: zaDni(45),
  });
  await api("POST", `/api/contracts/${aneks1Id}/podpis-nasz`);
  const podpisA1 = await api("POST", `/api/contracts/${aneks1Id}/accept`, {});
  wymagaj(podpisA1.status === 200, `podpis aneksu nr 1 → ${podpisA1.status} ${JSON.stringify(podpisA1.dane)}`);

  const aneks2 = await api("POST", `/api/contracts/${umowaGlownaId}/aneks`);
  const aneks2Id = id(aneks2.dane);
  wymagaj(!!aneks2Id, `POST aneks nr 2 → ${aneks2.status} ${JSON.stringify(aneks2.dane)}`);
  const a2 = await pobierzUmowe(aneks2Id!);

  // A7: jedno pole niosło dwa pytania. Nagłówek SŁUSZNIE wskazuje umowę-matkę
  // (tego dokument dotyczy), ale wartości „było" mają pochodzić z aneksu nr 1.
  sprawdz(
    "aneks nr 2 powołuje się w nagłówku na umowę, nie na aneks nr 1",
    String(a2.poprzednie?.reference ?? "").startsWith("UM-"),
    undefined,
    `reference = ${a2.poprzednie?.reference}`
  );
  sprawdz(
    "aneks nr 2 bierze wartości „było” z aneksu nr 1, nie z pierwotnej umowy",
    Number(a2.poprzednie?.cena) === 11000 && a2.poprzednie?.zrodlo?.aneks_nr === 1,
    undefined,
    `„było”: cena = ${a2.poprzednie?.cena} (spodziewane 11000), źródło = ${JSON.stringify(a2.poprzednie?.zrodlo ?? null)}`
  );

  // Podpisany aneks przestawia termin projektu — druga połowa A6 z kroku 3
  // („podpisanie aneksu nie dotykało projektu w ogóle").
  const projektPoAneksie = await pobierzProjekt(projektGlownyId);
  sprawdz(
    "podpisany aneks wyrównuje termin projektu do obowiązujących warunków",
    String(projektPoAneksie.project.termin ?? "").slice(0, 10) === zaDni(45),
    undefined,
    `termin projektu = ${projektPoAneksie.project.termin}, aneks nr 1 mówi ${zaDni(45)}`
  );

  // ── B2/B3 z kroku 4: projekt się psuje ─────────────────────────────────
  krok("Porażka: zerwany projekt");
  await api("PATCH", `/api/projects/${projektGlownyId}`, { zdrowie: "Zerwany", status: "W trakcie" });
  const propozycjeProjektu = await propozycjeDla(projektGlownyId);
  const zerwany = propozycjeProjektu.find((p) => p.regula === "zerwany-projekt-domkniecie");
  sprawdz(
    "zerwany projekt rodzi propozycję domknięcia",
    !!zerwany,
    undefined,
    `propozycje dla projektu: ${propozycjeProjektu.map((p) => p.regula).join(", ") || "brak"}`
  );
  sprawdz(
    "zerwany projekt trafia na Pulpit, choć jego termin jest w PRZYSZŁOŚCI",
    (((await api("GET", "/api/hub/today")).dane?.projektyZagrozone ?? []) as any[]).some(
      (p) => String(p.id) === projektGlownyId
    ),
    undefined,
    `„Projekty z minionym terminem” go nie łapie — termin ${projektPoAneksie.project.termin} jeszcze nie minął`
  );
  if (zerwany) {
    await decyzjaOPropozycji("zerwany-projekt-domkniecie", projektGlownyId, "zrob");
    const projektPoDomknieciu = await pobierzProjekt(projektGlownyId);
    sprawdz(
      "domknięcie zerwanego projektu ustawia „Wstrzymane”, a nie „Wdrożone”",
      projektPoDomknieciu.project.status === "Wstrzymane",
      undefined,
      `status = ${projektPoDomknieciu.project.status} — „Wdrożone” znaczy ODEBRANE, a tego nikt nie odebrał`
    );
  }

  // ── Krok 2 (A4/C2): eskalacja windykacji ───────────────────────────────
  krok("Porażka: windykacja");
  const fv = await api("POST", "/api/invoices", { client_id: klientId, project_id: projektGlownyId });
  const fvId = id(fv.dane);
  wymagaj(!!fvId, `POST /api/invoices (windykacja) → ${fv.status} ${JSON.stringify(fv.dane)}`);
  // `cena_netto`/`vat_stawka`, NIE `cena`/`vat` — trasa pozycji FAKTURY nazywa
  // te pola inaczej niż bliźniacza trasa pozycji OFERTY, a nieznanych pól nie
  // odrzuca: `Number(undefined)` daje NaN, więc cena cicho wynosi 0. Do
  // 2026-08-07 stało tu `cena: 6000` i cały ten blok jechał na fakturze wartej
  // **0,00 zł** — bez objawu, bo żadne zdanie nie patrzyło na kwotę. Wyszło
  // dopiero wtedy, gdy Pulpit zaczął tę kwotę POKAZYWAĆ.
  await api("POST", `/api/invoices/${fvId}/items`, { nazwa: "Wdrożenie — etap 1", ilosc: 1, jednostka: "kpl.", cena_netto: 6000, vat_stawka: "23" });
  // Termin minął 14 dni temu: podpowiadany poziom to od razu „stanowcze
  // przypomnienie" — dokładnie sytuacja z drugiego przejścia, w której
  // PIERWSZA wiadomość twierdziła, że jest druga.
  await api("PATCH", `/api/invoices/${fvId}`, { termin_platnosci: zaDni(-14), data_wystawienia: zaDni(-28) });
  const fvGotowa = await pobierzFakture(fvId!);
  const nazwaNabywcy = String(fvGotowa.invoice.klient_nazwa ?? "");
  const wystawienie = await apiZPotwierdzeniem("POST", `/api/invoices/${fvId}/issue`, "faktura-wystaw", undefined, nazwaNabywcy);
  wymagaj(wystawienie.status === 200, `wystawienie faktury windykacyjnej → ${wystawienie.status} ${JSON.stringify(wystawienie.dane)}`);

  // C2: poziom da się WYBRAĆ, a nie tylko przyjąć podpowiedziany.
  // Wysyłka windykacji jest działaniem NIEODWRACALNYM (Faza 4), więc trasa
  // wymaga nagłówka potwierdzenia — bez niego oddaje 428. To nie jest luka,
  // tylko bariera, którą panel i apka też muszą przejść.
  const lagodne = await apiZPotwierdzeniem("POST", `/api/invoices/${fvId}/remind`, "faktura-przypomnij", { poziom: 1 });
  sprawdz(
    "przy 14 dniach zwłoki da się wysłać ŁAGODNE przypomnienie zamiast podpowiadanego",
    lagodne.status === 200,
    undefined,
    `→ ${lagodne.status} ${JSON.stringify(lagodne.dane?.error ?? lagodne.dane)}`
  );
  const poPierwszym = await pobierzFakture(fvId!);
  sprawdz(
    "wysłane przypomnienie podnosi poziom windykacji",
    Number(poPierwszym.invoice.reminder_level) === 1,
    undefined,
    `reminder_level = ${poPierwszym.invoice.reminder_level}`
  );

  // Eskalacja NIE cofa się poniżej już wysłanego poziomu (decyzja 4 z planu).
  const wStecz = await apiZPotwierdzeniem("POST", `/api/invoices/${fvId}/remind`, "faktura-przypomnij", { poziom: 1 });
  const poDrugim = await pobierzFakture(fvId!);
  sprawdz(
    "eskalacja nie cofa się poniżej poziomu, który już wyszedł do klienta",
    Number(poDrugim.invoice.reminder_level) >= 1,
    undefined,
    `po ponownym „poziom 1”: ${poDrugim.invoice.reminder_level} (→ ${wStecz.status})`
  );

  const wezwanie = await apiZPotwierdzeniem("POST", `/api/invoices/${fvId}/remind`, "wezwanie-wyslij", { poziom: 3 });
  sprawdz(
    "eskalacja w GÓRĘ, aż do wezwania, przechodzi",
    wezwanie.status === 200 && Number((await pobierzFakture(fvId!)).invoice.reminder_level) === 3,
    undefined,
    `→ ${wezwanie.status} ${JSON.stringify(wezwanie.dane?.error ?? "")}`
  );

  // ── Sufit automatu windykacji (decyzja właściciela 2026-08-07) ──────────
  //
  // Poziom 3 przestał wychodzić automatem i zatrzymuje się na Pulpicie. Osobna
  // faktura, nie ta wyżej: tamta ma już `reminder_level = 3`, więc nie ma o co
  // pytać. Termin −25 dni, żeby próg wezwania (+21) był minięty z zapasem.
  const fvPulpit = await api("POST", "/api/invoices", { client_id: klientId, project_id: projektGlownyId });
  const fvPulpitId = id(fvPulpit.dane);
  await api("POST", `/api/invoices/${fvPulpitId}/items`, { nazwa: "Wdrożenie — etap 2", ilosc: 1, jednostka: "kpl.", cena_netto: 4000, vat_stawka: "23" });
  await api("PATCH", `/api/invoices/${fvPulpitId}`, { termin_platnosci: zaDni(-25), data_wystawienia: zaDni(-39) });
  const fvPulpitGotowa = await pobierzFakture(fvPulpitId!);
  await apiZPotwierdzeniem(
    "POST",
    `/api/invoices/${fvPulpitId}/issue`,
    "faktura-wystaw",
    undefined,
    String(fvPulpitGotowa.invoice.klient_nazwa ?? "")
  );
  const naPulpicie = ((await api("GET", "/api/hub/today")).dane?.wezwaniaDoDecyzji ?? []) as any[];
  sprawdz(
    "wezwanie NIE wychodzi automatem — czeka na Pulpicie na decyzję właściciela",
    naPulpicie.some((i) => i.id === fvPulpitId),
    undefined,
    `${naPulpicie.length} pozycji, brak ${fvPulpitId}`
  );
  // Kontrola w drugą stronę: sekcja pyta o DECYZJĘ, a nie „przypomina o każdej
  // zaległej fakturze". Faktura, przy której wezwanie już wyszło, ma z niej
  // zniknąć — inaczej właściciel wysyłałby to samo pismo w kółko.
  sprawdz(
    "faktura z wysłanym już wezwaniem znika z listy do decyzji",
    !naPulpicie.some((i) => i.id === fvId),
    undefined,
    `${fvId} nadal prosi o decyzję, mimo reminder_level = 3`
  );
}

// ── Sonda: etykieta kontra slug ────────────────────────────────────────────

/**
 * `OFFER_REJECT_REASONS` to ETYKIETY („Za drogo"), nie slugi („za-drogo").
 * Trasa odrzucenia przyjmuje decyzję klienta niezależnie od tego, co przyszło
 * w polu `powod` — ale wartość spoza zamkniętej listy zapisuje jako PUSTY
 * powód, bo inaczej statystyka „na czym przegrywamy" zbierałaby dowolne
 * napisy z internetu.
 *
 * Sonda kroku 4 nabrała się na to i zgłosiła czerwień jako usterkę panelu.
 * Osobny lead i osobna oferta, bo to sprawdzenie ZUŻYWA odrzucenie.
 */
async function sondaEtykietaKontraSlug(): Promise<void> {
  krok("Sonda: etykieta kontra slug");

  const lead = await api("POST", "/api/leads", {
    firma: `Sonda sluga [${ZNACZNIK}]`,
    email: "sonda@przyklad.pl",
    ulica: "ul. Testowa 1",
    kod: "30-001",
    miasto: "Kraków",
  });
  const leadId = id(lead.dane);
  wymagaj(!!leadId, `POST /api/leads (sonda sluga) → ${lead.status} ${JSON.stringify(lead.dane)}`);

  const oferta = await api("POST", "/api/offers", { lead_id: leadId });
  const ofertaId = id(oferta.dane);
  wymagaj(!!ofertaId, `POST /api/offers (sonda sluga) → ${oferta.status} ${JSON.stringify(oferta.dane)}`);
  await api("POST", `/api/offers/${ofertaId}/items`, { nazwa: "Pozycja sondy", ilosc: 1, jednostka: "kpl.", cena: 1000 });
  await api("POST", `/api/offers/${ofertaId}/sections`, { tytul: "Zakres prac", tresc: "Zakres na potrzeby sondy." });

  const wyslana = await apiZPotwierdzeniem("POST", `/api/offers/${ofertaId}/send`, "oferta-wyslij");
  wymagaj(wyslana.status === 200, `wysyłka (sonda sluga) → ${wyslana.status} ${JSON.stringify(wyslana.dane)}`);
  const token = String((await pobierzOferte(ofertaId!)).offer.share_token ?? "");
  wymagaj(!!token, "oferta sondy nie dostała tokenu");

  const zeSlugiem = await api("POST", `/api/offers/public/${token}/reject`, {
    powod: "za-drogo",
    komentarz: "sonda: slug zamiast etykiety",
  });
  if (zeSlugiem.status === 429) {
    pominiete.push("etykieta kontra slug w powodzie odrzucenia — hamulec 5/60 min");
    return;
  }
  const po = await pobierzOferte(ofertaId!);
  sprawdz(
    "decyzja klienta zapisuje się nawet przy nieznanym powodzie",
    po.offer.status === "Odrzucona",
    undefined,
    `status = ${po.offer.status} — odmowa jest odmową, choćby pole „powód” przyszło śmieciowe`
  );
  sprawdz(
    "slug zamiast etykiety NIE zapisuje się jako powód (statystyka zostaje czysta)",
    !po.offer.powod_odrzucenia && String(po.offer.komentarz_odrzucenia ?? "").includes("slug"),
    undefined,
    `powod_odrzucenia = „${po.offer.powod_odrzucenia}”, komentarz = „${po.offer.komentarz_odrzucenia}”`
  );
}

// ── Sonda: hamulec publicznych dokumentów (D5) ─────────────────────────────

/**
 * Hamulec ma liczyć POMYŁKI i zerować się po udanym wejściu — jak przy
 * logowaniu (decyzja właściciela 2026-08-05, znalezisko D5). Do tego dnia
 * liczył KAŻDE żądanie i nigdy nie zerował, więc klient, który trzy razy
 * pomylił się przy wpisywaniu nazwiska, miał dwie próby na podpisanie umowy.
 *
 * **Sonda udaje ruch z INNEGO miejsca** (`x-forwarded-for`), i to nie jest
 * sztuczka dla wygody: bez tego wyczerpywała limit wspólny z całą resztą
 * przejścia i zabierała drogę klienta NASTĘPNEMU przebiegowi — pierwszy bieg
 * zielony, każdy kolejny z sześcioma pominięciami. Ten sam kształt pułapki co
 * „dev-baza żyje między przebiegami” (krok 3), tylko przez stan hamulca.
 * Mechanizm jest mierzony ten sam i w pełni; zmienia się wyłącznie odcisk.
 */
async function sondaHamulca(): Promise<void> {
  krok("Sonda: hamulec publicznych dokumentów");

  // Odcisk liczy się z TREŚCI nagłówka, więc znacznik przebiegu w adresie
  // wystarczy, żeby dwa biegi pod rząd nie dziedziczyły po sobie licznika.
  // Bez tego drugi przebieg zastawał własne pięć pomyłek sprzed godziny
  // i zgłaszał 429 jako regresję — złapane pomiarem, nie rozumowaniem.
  //
  // Limit ŁĄCZNY (60/60 min ze wszystkich miejsc naraz) zostaje nietknięty
  // i jest realnym sufitem: sonda zostawia po sobie ~11 wierszy, więc powyżej
  // pięciu przebiegów w ciągu godziny zacznie blokować globalnie. To jest
  // poprawne zachowanie zabezpieczenia, nie usterka przejścia.
  const zMiejsca = (kto: string) => ({ "x-forwarded-for": `203.0.113.${kto}-${ZNACZNIK}` });
  const nieudanaProba = (adres: string) =>
    // Puste imię → 400. Najtańsza możliwa pomyłka klienta i dokładnie ta,
    // o którą chodzi w D5.
    api("POST", `/api/offers/public/${TOKEN_NIEISTNIEJACY}/accept`, { name: "" }, zMiejsca(adres));

  // ── 1. Blokada po serii pomyłek (próg 5/60 min) ────────────────────────
  const adresA = "11";
  let ostatni = { status: 0, dane: null as any };
  for (let i = 0; i < 6; i++) {
    ostatni = await nieudanaProba(adresA);
    if (ostatni.status === 429) break;
  }
  sprawdz(
    "seria pomyłek z jednego miejsca kończy się blokadą",
    ostatni.status === 429,
    undefined,
    `ostatnia odpowiedź: ${ostatni.status} ${JSON.stringify(ostatni.dane?.error ?? ostatni.dane)}`
  );
  sprawdz(
    "komunikat blokady mówi klientowi, CO ZROBIĆ",
    String(ostatni.dane?.error ?? "").includes("odpowiedzieć na wiadomość"),
    undefined,
    `komunikat: „${ostatni.dane?.error ?? "—"}” — poprzedni („Zbyt wiele prób. Spróbuj ponownie za 60 min.”) ` +
      `zostawiał klienta samego przed dokumentem, którego nie mógł podpisać`
  );

  // ── 2. Udane wejście ZERUJE licznik ────────────────────────────────────
  // To jest właściwa treść D5 i jedyny sposób, żeby ją udowodnić: cztery
  // pomyłki, potem sukces, potem znowu cztery pomyłki. Bez zerowania byłoby
  // ich osiem, czyli dawno po progu, i ostatnie żądanie dostałoby 429.
  const adresB = "22";
  const cel = await ofertaDoOdrzucenia(`Sonda hamulca [${ZNACZNIK}]`);
  if (!cel) {
    pominiete.push("zerowanie licznika po udanym wejściu — nie udało się przygotować oferty do sondy");
    return;
  }

  for (let i = 0; i < 4; i++) await nieudanaProba(adresB);
  const sukces = await api(
    "POST",
    `/api/offers/public/${cel.token}/reject`,
    { powod: "Nie ten termin", komentarz: "sonda zerowania licznika" },
    zMiejsca(adresB)
  );
  sprawdz(
    "po czterech pomyłkach prawdziwa decyzja klienta wciąż przechodzi",
    sukces.status === 200,
    undefined,
    `→ ${sukces.status} ${JSON.stringify(sukces.dane?.error ?? sukces.dane)} (próg to 5, więc piąte żądanie ma się zmieścić)`
  );

  for (let i = 0; i < 4; i++) await nieudanaProba(adresB);
  const poZerowaniu = await nieudanaProba(adresB);
  sprawdz(
    "udane wejście ZERUJE licznik pomyłek",
    poZerowaniu.status !== 429,
    undefined,
    `→ ${poZerowaniu.status}: bez zerowania byłoby to dziewiąte żądanie z tego miejsca, ` +
      `czyli dawno po progu 5 — a klient, który raz podpisał, nie ma być karany za wcześniejsze literówki`
  );
}

/** Wysłana oferta z tokenem, gotowa do odrzucenia. Osobny lead za każdym
 *  razem, bo odrzucenie ZUŻYWA dokument i wpływa na reguły przy leadzie. */
async function ofertaDoOdrzucenia(nazwa: string): Promise<{ ofertaId: string; token: string } | null> {
  const lead = await api("POST", "/api/leads", {
    firma: nazwa,
    email: "sonda@przyklad.pl",
    ulica: "ul. Testowa 1",
    kod: "30-001",
    miasto: "Kraków",
  });
  const leadId = id(lead.dane);
  if (!leadId) return null;

  const oferta = await api("POST", "/api/offers", { lead_id: leadId });
  const ofertaId = id(oferta.dane);
  if (!ofertaId) return null;
  await api("POST", `/api/offers/${ofertaId}/items`, { nazwa: "Pozycja sondy", ilosc: 1, jednostka: "kpl.", cena: 1000 });
  await api("POST", `/api/offers/${ofertaId}/sections`, { tytul: "Zakres prac", tresc: "Zakres na potrzeby sondy." });

  const wyslana = await apiZPotwierdzeniem("POST", `/api/offers/${ofertaId}/send`, "oferta-wyslij");
  if (wyslana.status !== 200) return null;
  const token = String((await pobierzOferte(ofertaId)).offer.share_token ?? "");
  return token ? { ofertaId, token } : null;
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
