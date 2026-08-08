/**
 * Komplet dokumentów do WYDRUKU NA PAPIERZE — jednym poleceniem.
 *
 *   npm run wydruki            (wymaga działającego `npm run dev`)
 *
 * Po co to jest: krok 1 kartki `docs/PRZEGLAD-KARTKA.md` prosi właściciela
 * o wydrukowanie czterech dokumentów i ocenienie, jak wyglądają na papierze.
 * Bez tego skryptu trzeba by je wyklikać — a jeden z nich, faktura na
 * kilkanaście pozycji, to kilkanaście par kliknięć (popover „Z katalogu"
 * zamyka się po każdej pozycji, nie ma multi-wyboru ani duplikowania wiersza).
 * Skrypt zakłada komplet i wypisuje cztery gotowe adresy.
 *
 * ── Dlaczego lokalnie, a nie na produkcji ────────────────────────────────
 * Wydruk wygląda tak samo, bo to ten sam komponent i ten sam arkusz stylów,
 * a lokalnie: nic nie idzie do prawdziwych ludzi, nic nie zostaje w prawdziwych
 * danych i nie trzeba wystawiać faktury z prawdziwym numerem fiskalnym.
 *
 * ── Uwaga o trwałości ────────────────────────────────────────────────────
 * Dev-baza to PGlite w pamięci procesu `next dev` — **restart serwera kasuje
 * te dokumenty**. Dlatego to skrypt, a nie „przygotowane raz linki": odpala się
 * w tej samej minucie, w której siada się do drukowania.
 *
 * ── Co dokładnie zakłada ─────────────────────────────────────────────────
 *   1. dane wystawcy (bez nich wydruk nie ma nagłówka ani rachunku),
 *   2. klienta z pełnym adresem i NIP-em,
 *   3. ofertę z czterema pozycjami,
 *   4. fakturę na 15 pozycji, WYSTAWIONĄ i 25 dni po terminie,
 *   5. umowę powstałą z tej oferty.
 *
 * Faktura jest po terminie świadomie: dopiero wtedy panel pokazuje sekcję
 * „Windykacja", a w niej wezwanie do zapłaty. Wezwania NIE wysyłamy — od
 * 2026-08-08 podgląd działa też przed wysłaniem, więc czwarty dokument da się
 * wydrukować bez wysyłania czegokolwiek komukolwiek.
 */

const BAZA = process.env.WYDRUKI_URL ?? "http://localhost:3000";

/** Dane wystawcy — te same, których używa `npm run przejscie`. Prowizoryczne,
 *  firma nie jest jeszcze zarejestrowana; żyją wyłącznie w dev-bazie. */
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
  // Bez stawki wezwanie nie pokazuje ani odsetek, ani wiersza „Razem do
  // zapłaty" — a to jest dokładnie ta część pisma, którą warto ocenić na
  // papierze. Wartość poglądowa, prowizoryczna jak reszta danych wystawcy.
  stawka_odsetek_ustawowych: 11.25,
};

const KLIENT = {
  nazwa: "Zakłady Przetwórcze Wisła sp. z o.o.",
  nip: "5252445123",
  email: "biuro@zpwisla.example",
  ulica: "ul. Fabryczna 118",
  kod: "31-553",
  miasto: "Kraków",
};

/** Piętnaście pozycji o RÓŻNEJ długości nazwy i różnych stawkach — bo test
 *  dotyczy łamania stron, a tabela z piętnastoma identycznymi wierszami łamie
 *  się inaczej niż prawdziwa. Ostatnie pozycje mają wpaść na drugą stronę:
 *  tam właśnie może zostać sam blok „Razem netto / Razem VAT / Do zapłaty". */
const POZYCJE_FAKTURY: { nazwa: string; ilosc: number; jednostka: string; cena_netto: number; vat_stawka: string }[] = [
  { nazwa: "Audyt procesów i danych — warsztat wstępny", ilosc: 1, jednostka: "kpl.", cena_netto: 4200, vat_stawka: "23" },
  { nazwa: "Mapa przepływu dokumentów w dziale zamówień", ilosc: 1, jednostka: "kpl.", cena_netto: 2800, vat_stawka: "23" },
  { nazwa: "Wdrożenie lokalnego modelu językowego (serwer klienta)", ilosc: 1, jednostka: "kpl.", cena_netto: 12500, vat_stawka: "23" },
  { nazwa: "Integracja ze skrzynką pocztową", ilosc: 1, jednostka: "kpl.", cena_netto: 3400, vat_stawka: "23" },
  { nazwa: "Automatyczne odczytywanie faktur od dostawców", ilosc: 1, jednostka: "kpl.", cena_netto: 5600, vat_stawka: "23" },
  { nazwa: "Klasyfikacja zgłoszeń serwisowych", ilosc: 1, jednostka: "kpl.", cena_netto: 3900, vat_stawka: "23" },
  { nazwa: "Panel raportowy", ilosc: 1, jednostka: "kpl.", cena_netto: 2200, vat_stawka: "23" },
  { nazwa: "Szkolenie zespołu — dzień pierwszy", ilosc: 8, jednostka: "godz.", cena_netto: 320, vat_stawka: "23" },
  { nazwa: "Szkolenie zespołu — dzień drugi", ilosc: 8, jednostka: "godz.", cena_netto: 320, vat_stawka: "23" },
  { nazwa: "Dokumentacja powdrożeniowa i instrukcja dla użytkownika końcowego", ilosc: 1, jednostka: "kpl.", cena_netto: 1800, vat_stawka: "23" },
  { nazwa: "Konfiguracja kopii zapasowych", ilosc: 1, jednostka: "kpl.", cena_netto: 1400, vat_stawka: "23" },
  { nazwa: "Opieka powdrożeniowa — miesiąc 1", ilosc: 1, jednostka: "mies.", cena_netto: 900, vat_stawka: "23" },
  { nazwa: "Opieka powdrożeniowa — miesiąc 2", ilosc: 1, jednostka: "mies.", cena_netto: 900, vat_stawka: "23" },
  { nazwa: "Opieka powdrożeniowa — miesiąc 3", ilosc: 1, jednostka: "mies.", cena_netto: 900, vat_stawka: "23" },
  { nazwa: "Dojazd i praca na miejscu u klienta", ilosc: 3, jednostka: "dni", cena_netto: 750, vat_stawka: "23" },
];

const POZYCJE_OFERTY: { nazwa: string; cena: number }[] = [
  { nazwa: "Audyt procesów i danych", cena: 4200 },
  { nazwa: "Wdrożenie lokalnego modelu językowego", cena: 12500 },
  { nazwa: "Szkolenie zespołu (2 dni)", cena: 5120 },
  { nazwa: "Opieka powdrożeniowa (3 miesiące)", cena: 2700 },
];

// ── Rozmowa z panelem ─────────────────────────────────────────────────────

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

/** Działanie nieodwracalne wymaga nagłówka `x-potwierdzenie` — pyta TRASA,
 *  nie przycisk (Faza 4). Wystawienie faktury jest na poziomie „mocnym", więc
 *  dochodzi `x-potwierdzenie-fraza` z nazwą rekordu, którą serwer porównuje
 *  z bazą. Kształt 1:1 z `scripts/przejscie/przejscie.ts`. */
async function apiZPotwierdzeniem(
  metoda: string,
  sciezka: string,
  dzialanie: string,
  body?: unknown,
  fraza?: string
): Promise<{ status: number; dane: any }> {
  const naglowki: Record<string, string> = { "x-potwierdzenie": dzialanie };
  if (fraza != null) naglowki["x-potwierdzenie-fraza"] = encodeURIComponent(fraza);
  return api(metoda, sciezka, body, naglowki);
}

function id(dane: any): string | null {
  return dane?.id ?? dane?.offer?.id ?? dane?.invoice?.id ?? dane?.contract?.id ?? dane?.client?.id ?? null;
}

function zaDni(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Przerywa z czytelnym powodem zamiast zostawiać połowę kompletu. */
function wymagaj(warunek: boolean, powod: string): asserts warunek {
  if (!warunek) {
    console.error(`\n✗ ${powod}`);
    console.error("  Czy `npm run dev` działa? Skrypt nie zakłada nic na produkcji.");
    process.exit(1);
  }
}

// ── Przygotowanie ─────────────────────────────────────────────────────────

async function przygotuj(): Promise<void> {
  console.log(`\nZakładam dokumenty do wydruku w ${BAZA}\n`);

  // 1. Wystawca. Bez tego wydruk nie ma nagłówka, adresu ani numeru rachunku.
  await api("PATCH", "/api/settings", DANE_FIRMY);
  console.log("   · dane wystawcy ustawione");

  // 2. Klient z pełnym adresem — na wydruku rubryka nabywcy ma być kompletna.
  const klient = await api("POST", "/api/clients", KLIENT);
  const klientId = id(klient.dane);
  wymagaj(!!klientId, `Nie udało się założyć klienta → ${klient.status} ${JSON.stringify(klient.dane).slice(0, 200)}`);
  console.log("   · klient założony");

  // 3. Oferta z czterema pozycjami. UWAGA na nazwę pola: pozycja OFERTY ma
  //    `cena`, a pozycja FAKTURY `cena_netto` + `vat_stawka`. Bliźniacze trasy,
  //    różne kontrakty — pomyłka nie daje błędu, tylko `Number(undefined)` → 0,
  //    czyli dokument na 0 zł (to samo przepuściło kiedyś cały blok windykacji).
  const oferta = await api("POST", "/api/offers", { client_id: klientId, tytul: "Automatyzacja obiegu dokumentów" });
  const ofertaId = id(oferta.dane);
  wymagaj(!!ofertaId, `Nie udało się założyć oferty → ${oferta.status} ${JSON.stringify(oferta.dane).slice(0, 200)}`);
  for (const p of POZYCJE_OFERTY) {
    await api("POST", `/api/offers/${ofertaId}/items`, { nazwa: p.nazwa, ilosc: 1, jednostka: "kpl.", cena: p.cena });
  }
  console.log(`   · oferta z ${POZYCJE_OFERTY.length} pozycjami`);

  // 4. Umowa z tej oferty — przepisuje zakres prac i kwotę. Panel wygeneruje ją
  //    dopiero z oferty ZAAKCEPTOWANEJ (bramka: „Umowę można wygenerować dopiero
  //    po akceptacji oferty"), więc przechodzimy tę samą drogę, co przejście:
  //    wysyłka, a potem akceptacja OD STRONY PANELU. Nie publicznym linkiem —
  //    tamta droga zużywa hamulec 5/60 min, a nam wystarczy skutek.
  const wysylka = await apiZPotwierdzeniem("POST", `/api/offers/${ofertaId}/send`, "oferta-wyslij");
  const akceptacja = await api("POST", `/api/offers/${ofertaId}/accept`, { name: "Marta Zielińska" });
  wymagaj(
    akceptacja.status === 200,
    `Nie udało się zaakceptować oferty → wysyłka ${wysylka.status}, akceptacja ${akceptacja.status} ` +
      JSON.stringify(akceptacja.dane).slice(0, 200)
  );
  const umowa = await api("POST", "/api/contracts", { typ: "umowa", offer_id: ofertaId });
  const umowaId = id(umowa.dane);
  wymagaj(!!umowaId, `Nie udało się założyć umowy → ${umowa.status} ${JSON.stringify(umowa.dane).slice(0, 200)}`);
  console.log("   · umowa z oferty");

  // 5. Faktura na 15 pozycji, 25 dni po terminie — żeby pokazała się sekcja
  //    „Windykacja", a w niej podgląd wezwania. Wystawiamy ją (nadanie numeru),
  //    bo wydruk szkicu pisze „(szkic)" zamiast numeru, a na papierze chcemy
  //    zobaczyć prawdziwy nagłówek faktury.
  const faktura = await api("POST", "/api/invoices", { client_id: klientId });
  const fakturaId = id(faktura.dane);
  wymagaj(!!fakturaId, `Nie udało się założyć faktury → ${faktura.status} ${JSON.stringify(faktura.dane).slice(0, 200)}`);
  for (const p of POZYCJE_FAKTURY) {
    await api("POST", `/api/invoices/${fakturaId}/items`, p);
  }
  await api("PATCH", `/api/invoices/${fakturaId}`, { termin_platnosci: zaDni(-25), data_wystawienia: zaDni(-39) });
  const wystawienie = await apiZPotwierdzeniem(
    "POST",
    `/api/invoices/${fakturaId}/issue`,
    "faktura-wystaw",
    undefined,
    KLIENT.nazwa
  );
  const poWystawieniu = (await api("GET", `/api/invoices/${fakturaId}`)).dane;
  const numer = poWystawieniu?.invoice?.numer;
  const pozycji = (poWystawieniu?.items ?? []).length;
  console.log(
    `   · faktura: ${pozycji} pozycji, ${numer ? `numer ${numer}` : `NIEWYSTAWIONA (→ ${wystawienie.status})`}, 25 dni po terminie`
  );
  if (pozycji !== POZYCJE_FAKTURY.length) {
    console.log(`     ⚠ pozycji miało być ${POZYCJE_FAKTURY.length} — sprawdź nazwy pól w body`);
  }

  // ── Adresy do druku ─────────────────────────────────────────────────────
  const linia = (co: string, sciezka: string) => `   ${co.padEnd(9)} ${BAZA}${sciezka}`;
  console.log("\nCztery adresy do wydrukowania (otwórz i kliknij „Drukuj / Zapisz PDF”):\n");
  console.log(linia("Oferta", `/pl/admin/offers/${ofertaId}/print`));
  console.log(linia("Faktura", `/pl/admin/invoices/${fakturaId}/print`));
  console.log(linia("Umowa", `/pl/admin/contracts/${umowaId}/print`));
  console.log(linia("Wezwanie", `/pl/admin/invoices/${fakturaId}/wezwanie/print`));
  console.log(
    "\n   Wezwanie otwiera się w trybie PODGLĄDU (przerywana ramka u góry) —\n" +
      "   nic nie zostało i nie zostanie do nikogo wysłane.\n" +
      "   Na co patrzeć na papierze: docs/PRZEGLAD-KARTKA.md, krok 1.\n"
  );
}

przygotuj().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Czyni ten plik MODUŁEM. Bez tego jest skryptem w zasięgu globalnym i dzieli
// przestrzeń nazw z `scripts/przejscie/przejscie.ts` (też bez importów), przez
// co `tsc` zgłasza sześć kolizji: `BAZA`, `DANE_FIRMY`, `api`, `id`, `zaDni`,
// `wymagaj`. Uruchomienie działa mimo to — esbuild kompiluje plik po pliku —
// więc jedynym miejscem, gdzie ten błąd w ogóle widać, jest `npx tsc`.
export {};
