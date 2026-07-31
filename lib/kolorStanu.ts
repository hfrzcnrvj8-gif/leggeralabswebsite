/**
 * JEDNO ŹRÓDŁO KOLORU STANU — panel (Moduł 59, 2026-07-28).
 *
 * Skąd to się wzięło: pomiar całego słownika koloru pokazał, że te same cztery
 * barwy marki wykonują w produkcie CZTERY różne prace naraz (stan rekordu,
 * rodzaj rzeczy, „wymaga uwagi", ozdoba), a nikt tego nigdy nie rozstrzygnął —
 * bo każdy moduł rozstrzygał sam. Skutek: „Wysłana" była fioletem w Ofertach
 * i cyjanem w Fakturach, „Pilotaż w trakcie" zielenią (czyli kolorem sprawy
 * ZAMKNIĘTEJ), a nowy lead czerwienią, jakby był awarią.
 *
 * Reguła, którą to zastępuje — cztery zdania:
 *
 *   1. Na jednym ekranie kolor niesie TYLKO JEDNO z dwojga. W module (Leady,
 *      Faktury…) wszystkie rekordy są tego samego rodzaju, więc kolor niesie
 *      STAN — czy to pigułka, czy kropka przy nazwie, byle stała przy słowie
 *      statusu. Tam, gdzie rodzaje się MIESZAJĄ (Kalendarz, Szukaj, Rejestr),
 *      kolor niesie RODZAJ, a stan jest podany słowem.
 *      [Pierwsza wersja tej reguły rozdzielała to formą — „pigułka = stan,
 *      kropka = rodzaj". Nie przeżyła zderzenia z kodem: kanban panelu i
 *      `StatusPill` apki od zawsze niosą stan właśnie kropką. Rozstrzyga
 *      kontekst ekranu, nie kształt.]
 *   2. Stan to jedna skala cyklu życia (niżej): złoto = ja, fiolet = oni,
 *      cyjan = robimy, zieleń = koniec dobry, szarość = koniec albo nic.
 *   3. Pilność jest OSOBNĄ osią i liczy się z DATY, nie ze słownika
 *      (patrz `stopienPilnosci`) — dlatego nie da się jej zapomnieć w nowym
 *      module.
 *   4. Gradient marki niesie WYŁĄCZNIE tożsamość i nigdy znaczenia; ikona,
 *      która nie mówi ani o stanie, ani o rodzaju, jest neutralna. Czerwień
 *      nie należy do skali stanu — ma dwie role: obietnica zerwana (koniec
 *      rampy pilności) i awaria/akcja niszcząca.
 *
 * Odpowiednik po stronie apki: `Stan` w `LeggeraHub/Views/Theme.swift`.
 * Trzymaj obie strony zsynchronizowane — to jest ten sam słownik.
 */

/** Gdzie rekord stoi w swoim cyklu życia. Sześć wartości dla CAŁEGO produktu. */
export type Stan =
  /** Jeszcze nie ruszone — szkic, pomysł, świeżo dodane. „Nic się nie dzieje." */
  | "nieruszone"
  /** Czeka na MÓJ ruch. „Ja." */
  | "mojRuch"
  /** U drugiej strony, w obiegu. „Oni." */
  | "uNich"
  /** Praca trwa po naszej stronie. „Robimy." */
  | "wRobocie"
  /** Domknięte sukcesem. „Koniec dobry." */
  | "sukces"
  /** Domknięte bez sukcesu albo nieaktualne. Przygasa, wzrok ma iść dalej. */
  | "zamkniete";

/**
 * Klasy pigułki dla każdego stanu. To jedyne miejsce w panelu, w którym te
 * konkretne klasy są wypisane — moduły odwołują się do stanu, nie do koloru.
 *
 * `tailwind.config.ts` skanuje `lib/`, więc klasy stąd realnie się generują
 * (do 2026-07-26 nie skanował i mapy „status → klasy" działały przez przypadek
 * — pigułka bez tła była jedynym objawem).
 */
export const STAN_CLASS: Record<Stan, string> = {
  nieruszone: "bg-[var(--hairline)] text-muted",
  mojRuch: "bg-brand-gold/15 text-brand-gold",
  uNich: "bg-brand-purple/20 text-[#c4a5ff] font-semibold",
  wRobocie: "bg-brand-cyan/15 text-brand-cyan",
  sukces: "bg-emerald-500/20 text-emerald-400 font-semibold",
  zamkniete: "bg-[var(--hairline)] text-muted opacity-70",
};

/** Kropka statusu — kanban i wszędzie, gdzie kolor stoi PRZY słowie statusu,
 *  a nie zamiast niego. Ta sama skala co `STAN_CLASS`, tylko lity kolor. */
export const STAN_DOT: Record<Stan, string> = {
  nieruszone: "bg-[var(--fg-muted)]",
  mojRuch: "bg-brand-gold",
  uNich: "bg-brand-purple",
  wRobocie: "bg-brand-cyan",
  sukces: "bg-emerald-500",
  zamkniete: "bg-[var(--hairline)]",
};

/**
 * Stan jako SAM KOLOR TEKSTU — ikony statusu (kanban, oś czasu), gdzie kolor
 * stoi przy kształcie, a nie na własnym tle.
 *
 * Istnieje, bo bez tego każdy moduł wypisywał swoje `text-*` z palca i po
 * pierwszej zmianie skali zostawał w tyle: `STATUS_ICON` w kanbanie Projektów
 * miał komentarz „kolory zgodne z pigułkami" i **nie był** zgodny od dnia,
 * w którym pigułki przeszły na tę skalę (Moduł 59, D+).
 */
export const STAN_TEXT: Record<Stan, string> = {
  nieruszone: "text-[var(--fg-muted)]",
  mojRuch: "text-brand-gold",
  uNich: "text-[#c4a5ff]",
  wRobocie: "text-brand-cyan",
  sukces: "text-emerald-400",
  zamkniete: "text-[var(--fg-muted)] opacity-70",
};

/**
 * Stan jako HEX — wyłącznie dla rysowania stylem inline (paski osi czasu,
 * gradienty, `<svg fill>`), gdzie klasa Tailwinda nie wchodzi.
 *
 * Dwie wartości świadomie NIE są dosłownym odpowiednikiem `STAN_DOT`:
 *
 * - `uNich` bierze **jasny fiolet `#c4a5ff`** (kolor tekstu pigułki), a nie
 *   `brand.purple #7C3AED`. Powód jest zmierzony, nie estetyczny: na tle panelu
 *   `#7C3AED` ma kontrast **2,9**, podczas gdy złoto 8,9, cyan 11,4 i zieleń
 *   8,0 — pasmo „u nich" byłoby jedynym, które ledwo widać. Ciemny fiolet
 *   działa jako TŁO pigułki (bo pod jasnym tekstem), nie jako sama kreska.
 * - `zamkniete` bierze szarość `--fg-muted`, a nie `--hairline`: hairline to
 *   kolor KRAWĘDZI, na pasku o szerokości ekranu nie widać go w ogóle.
 */
export const STAN_HEX: Record<Stan, string> = {
  nieruszone: "#8a8f98",
  mojRuch: "#E0A93B",
  uNich: "#c4a5ff",
  wRobocie: "#22D3EE",
  sukces: "#10b981",
  zamkniete: "#8a8f98",
};

/** Krótkie tłumaczenie stanu — do podpowiedzi i legend, żeby skala dała się
 *  przeczytać bez zaglądania do kodu. */
export const STAN_OPIS: Record<Stan, string> = {
  nieruszone: "Jeszcze nie ruszone",
  mojRuch: "Czeka na Twój ruch",
  uNich: "U drugiej strony",
  wRobocie: "Praca trwa",
  sukces: "Domknięte sukcesem",
  zamkniete: "Domknięte",
};

/**
 * Buduje mapę „status → klasy" ze słownika „status → stan".
 *
 * Po co pośrednik: moduł deklaruje ZNACZENIE („Wysłana to «u nich»"), a nie
 * kolor. Gdy skala się zmieni, zmienia się jeden plik — a nie osiem map, z
 * których siódma zostanie zapomniana. Dokładnie tak powstał rozjazd, który ten
 * moduł sprząta.
 */
export function mapaStanow<K extends string>(slownik: Record<K, Stan>): Record<string, string> {
  const wynik: Record<string, string> = {};
  for (const [status, stan] of Object.entries(slownik) as [K, Stan][]) {
    wynik[status] = STAN_CLASS[stan];
  }
  return wynik;
}

/** To samo dla kropek kanbanu — patrz `STAN_DOT`. */
export function mapaKropek<K extends string>(slownik: Record<K, Stan>): Record<string, string> {
  const wynik: Record<string, string> = {};
  for (const [status, stan] of Object.entries(slownik) as [K, Stan][]) {
    wynik[status] = STAN_DOT[stan];
  }
  return wynik;
}

/** To samo dla ikon statusu — patrz `STAN_TEXT`. */
export function mapaTekstow<K extends string>(slownik: Record<K, Stan>): Record<string, string> {
  const wynik: Record<string, string> = {};
  for (const [status, stan] of Object.entries(slownik) as [K, Stan][]) {
    wynik[status] = STAN_TEXT[stan];
  }
  return wynik;
}

/** To samo dla rysowania stylem inline — patrz `STAN_HEX`. */
export function mapaHexow<K extends string>(slownik: Record<K, Stan>): Record<string, string> {
  const wynik: Record<string, string> = {};
  for (const [status, stan] of Object.entries(slownik) as [K, Stan][]) {
    wynik[status] = STAN_HEX[stan];
  }
  return wynik;
}

/* ------------------------------------------------------ rampa pilności ---- */

/**
 * PRÓG ZANIEDBANIA — jedna liczba dla całego produktu (decyzja właściciela,
 * 2026-07-28). Wcześniej każdy moduł miał własny: Faktury czerwieniły przy 21
 * dniach, Leady miały własne `isOverdue`, Pulpit malował złotem wszystko po
 * terminie. Trzy progi na to samo zjawisko to trzy rzeczy do zapamiętania.
 */
export const PROG_ZANIEDBANIA_DNI = 14;

/** Jak dawno minął termin. Prostopadła do `Stan`: mówi „jak pilne", nie „gdzie
 *  w procesie". */
export type Pilnosc =
  /** Termin jeszcze przed nami (albo terminu nie ma). */
  | "wTerminie"
  /** Termin minął, ale niedawno. */
  | "poTerminie"
  /** Minął dawno — obietnica zerwana. */
  | "zaniedbane";

/**
 * Rampa ciepła: złoto → pomarańcz → czerwień.
 *
 * Dlaczego pomarańcz jest tu STOPNIEM, a nie osobną kategorią „ostrzeżenie":
 * zmierzone ΔE między brandowym złotem a pomarańczem to 23,6 (dla porównania
 * fiolet↔zieleń: 101). To wystarczy, żeby rozróżnić je OBOK SIEBIE w ustalonej
 * kolejności, i za mało, żeby rozpoznać je Z PAMIĘCI na dwóch różnych ekranach.
 * Kolejność niesie znaczenie — więc niczego nie trzeba pamiętać.
 *
 * Dlaczego czerwień NIE znaczy „nieopłacone": nieopłacona faktura to zdrowy,
 * normalny stan przez większość jej życia — 2 z 5 statusów faktury i 1 z 2
 * statusów kosztu świeciłyby na czerwono przy poprawnie działającej firmie.
 * Kolor, który świeci zawsze, przestaje cokolwiek znaczyć.
 *
 * @param dniPoTerminie dodatnie = tyle dni po terminie; `null`/ujemne = w terminie
 */
export function stopienPilnosci(dniPoTerminie: number | null | undefined): Pilnosc {
  if (dniPoTerminie == null || dniPoTerminie <= 0) return "wTerminie";
  return dniPoTerminie > PROG_ZANIEDBANIA_DNI ? "zaniedbane" : "poTerminie";
}

/** Kolor SAMEGO TEKSTU dla stopnia pilności (liczba dni, data po terminie). */
export const PILNOSC_TEXT: Record<Pilnosc, string> = {
  wTerminie: "text-brand-gold",
  poTerminie: "text-brand-orange",
  zaniedbane: "text-brand-red-soft",
};

/**
 * Pilność jako PIGUŁKA — odpowiednik `STAN_CLASS` na osi pilności.
 *
 * Dołożona przy audycie Faktur (2026-07-31), bo jej brak rodził dokładnie ten
 * rozjazd, który ten plik miał skończyć: edytor faktury malował własną,
 * wpisaną z palca plakietkę „po terminie" na generycznej `red-500` — czyli
 * DRUGĄ formę statusu, który skala świadomie odczerwieniła (`INVOICE_STAN`
 * mapuje „Po terminie" na `mojRuch`, a to, JAK pilnie, mówi rampa liczona
 * z daty). Kto potrzebuje pigułki pilności, bierze ją stąd.
 *
 * `wTerminie` jest pusty celowo — w terminie nie ma o pilności czego mówić,
 * tak samo jak w `PILNOSC_ROW` i `PILNOSC_HEX`.
 */
export const PILNOSC_CLASS: Record<Pilnosc, string> = {
  wTerminie: "",
  poTerminie: "bg-brand-orange/15 text-brand-orange",
  zaniedbane: "bg-brand-red/20 text-brand-red-soft font-semibold",
};

/** Delikatne podbarwienie WIERSZA/karty — ma wołać kątem oka, nie krzyczeć. */
export const PILNOSC_ROW: Record<Pilnosc, string> = {
  wTerminie: "",
  poTerminie: "bg-brand-orange/[0.06]",
  zaniedbane: "bg-brand-red/[0.08]",
};

/** Rampa pilności w HEX — do rysowania stylem inline (pasek osi czasu).
 *  Ta sama rampa co `PILNOSC_TEXT`, ta sama rola co `STAN_HEX` wobec
 *  `STAN_TEXT`. `wTerminie` nie ma własnej barwy: w terminie o pilności nie ma
 *  czego mówić, więc rysujący zostaje przy kolorze stanu. */
export const PILNOSC_HEX: Record<Exclude<Pilnosc, "wTerminie">, string> = {
  poTerminie: "#F97316",
  zaniedbane: "#CE6A70",
};

/** Zdanie tłumaczące, co ten kolor znaczy — pilność bez powodu jest ozdobą. */
export function opisPilnosci(dniPoTerminie: number | null | undefined): string | null {
  const stopien = stopienPilnosci(dniPoTerminie);
  if (stopien === "wTerminie") return null;
  const dni = dniPoTerminie ?? 0;
  const forma = dni === 1 ? "dzień" : "dni";
  return stopien === "zaniedbane"
    ? `Po terminie o ${dni} ${forma} — to już zerwana obietnica, zajmij się tym dziś.`
    : `Po terminie o ${dni} ${forma}.`;
}
