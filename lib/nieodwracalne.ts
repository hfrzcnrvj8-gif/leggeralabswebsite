/**
 * Jawna lista działań nieodwracalnych — Faza 4 planu `docs/PLAN-ZAPLECZE.md`.
 *
 * ── PO CO TO POWSTAŁO ─────────────────────────────────────────────────────
 * Bariery stały w złych miejscach. Wynik przejścia „na sucho" z 2026-08-02
 * (`docs/PIERWSZE-PRZEJSCIE-NA-SUCHO.md`, znalezisko **D1**):
 *
 * - „Wystaw fakturę" nadaje trwały numer w serii (`FV 93/2026`), zużywa go
 *   na zawsze i **nie pyta o nic**,
 * - „Oznacz umowę jako podpisaną" — działanie odwracalne jednym kliknięciem —
 *   **potwierdzenia wymaga**.
 *
 * Mocniejsze działanie miało słabszą barierę. Reguła, którą to zastępuje,
 * jest jedna i obowiązuje w obie strony: **co nieodwracalne — pyta, co
 * odwracalne — nie pyta.** Potwierdzenie na każdym kroku uczy klikać „tak"
 * bez czytania, więc rozdawanie ich hojnie osłabia te, które są potrzebne.
 *
 * ── DLACZEGO TO ŻYJE W TRASIE, A NIE W PRZYCISKU ──────────────────────────
 * Bo bariera w interfejsie jest ozdobą. Faza 2 nauczyła tego dosłownie:
 * bramka wysyłki działała tylko tam, gdzie ktoś zajrzał, dopóki nie trafiła
 * do wszystkich tras (`lib/bramkaWysylki.ts`). Tu jest tak samo — trasa
 * odmawia wykonania działania z tej listy, dopóki żądanie nie niesie
 * **jawnego potwierdzenia**. Panel, apka i `curl` dostają tę samą odpowiedź.
 *
 * ── DWA POZIOMY (decyzja właściciela, 2026-08-02) ─────────────────────────
 * - **zwykłe** — okno „Na pewno?". Wysyłka dokumentu, unieważnienie linku,
 *   usunięcie leada/faktury/oferty/umowy/notatki/kosztu.
 * - **mocne** — trzeba przepisać frazę identyfikującą rekord. Zarezerwowane
 *   dla czterech rzeczy, których nie da się odkręcić NICZYM: wystawienie
 *   faktury, wysyłka do KSeF, usunięcie klienta i usunięcie projektu.
 *
 * Potwierdzenie **pyta zawsze** — nie ma „nie pytaj ponownie" ani wyłącznika
 * w Ustawieniach (druga decyzja właściciela z tego samego dnia). Wyłącznik
 * prowadzi do stanu, w którym bariera formalnie jest, a realnie jej nie ma,
 * i nikt nie pamięta, kiedy się wyłączyła.
 *
 * ── CZEGO NA TEJ LIŚCIE ŚWIADOMIE NIE MA ──────────────────────────────────
 * Drobiazgów, choć technicznie też znikają bezpowrotnie: pozycji faktury,
 * uczestnika wydarzenia, zadania w projekcie, kamienia milowego, pozycji
 * katalogu, przypomnienia, wydarzenia kalendarza, szablonu. Repozytorium ma
 * 41 uchwytów `DELETE`; gdyby każdy pytał, potwierdzenia klikałoby się na
 * ślepo i cała ta faza byłaby pracą wykonaną przeciwko sobie. Te rekordy
 * odtwarza się wpisaniem ich z powrotem — kosztem minuty, nie dokumentu.
 *
 * Nie ma tu też zwykłego maila z modułu Poczta: to codzienna korespondencja,
 * nie dokument. Lista obejmuje siedem dróg, którymi wychodzi DOKUMENT.
 */

// ── Kształt listy ──────────────────────────────────────────────────────────

export type PoziomPotwierdzenia = "zwykle" | "mocne";

export type IdDzialania =
  // Faktura i urząd — jedyne rzeczy, które zostawiają ślad poza panelem.
  | "faktura-wystaw"
  | "ksef-wyslij"
  // Wysyłka dokumentu do klienta — siedem dróg spiętych bramką z Fazy 2.
  | "oferta-wyslij"
  | "umowa-wyslij"
  | "faktura-wyslij"
  | "wezwanie-wyslij"
  | "faktura-przypomnij"
  | "umowa-przypomnij"
  | "oferta-przypomnij"
  | "kontakt-kontrolny-wyslij"
  | "opinia-popros"
  // Publiczny link, który klient już ma.
  | "link-uniewaznij"
  | "link-wygeneruj-nowy"
  // Usunięcie głównego rekordu.
  | "klient-usun"
  | "projekt-usun"
  | "lead-usun"
  | "faktura-usun"
  | "oferta-usun"
  | "umowa-usun"
  | "notatka-usun"
  | "koszt-usun"
  | "klienci-usun-masowo"
  | "oferty-usun-masowo";

export type OpisDzialania = {
  id: IdDzialania;
  poziom: PoziomPotwierdzenia;
  /** Nagłówek okna — co właściwie zaraz zrobisz. */
  tytul: string;
  /**
   * Dlaczego to nieodwracalne — jedno zdanie, konkretne. „Tej operacji nie
   * można cofnąć" nic nie znaczy; „numer zostanie zużyty na zawsze, nawet
   * jeśli fakturę zaraz anulujesz" mówi, co dokładnie się stanie.
   */
  skutek: string;
  /** Napis na przycisku potwierdzającym — czasownik, nie „OK". */
  przycisk: string;
  /**
   * Co przepisać przy poziomie „mocne" — nazwa pola po ludzku, np.
   * „nazwę klienta". Panel pokazuje wartość, właściciel ją przepisuje.
   */
  coPrzepisac?: string;
};

/**
 * Cała lista, w jednym miejscu. Dokładając działanie: dopisz je TUTAJ,
 * a potem zawołaj `odmowaPotwierdzenia()` w jego trasie. Sam wpis na liście
 * niczego nie blokuje — blokuje trasa (patrz nagłówek pliku).
 */
export const DZIALANIA_NIEODWRACALNE: Record<IdDzialania, OpisDzialania> = {
  "faktura-wystaw": {
    id: "faktura-wystaw",
    poziom: "mocne",
    tytul: "Wystawić fakturę?",
    skutek:
      "Faktura dostanie trwały numer w serii i od tej chwili nie da się jej edytować — zostaje korekta albo anulowanie. Numer zostanie zużyty na zawsze, także po anulowaniu.",
    przycisk: "Wystaw fakturę",
    coPrzepisac: "nazwę nabywcy",
  },
  "ksef-wyslij": {
    id: "ksef-wyslij",
    poziom: "mocne",
    tytul: "Wysłać fakturę do KSeF?",
    skutek:
      "Faktura trafi do Krajowego Systemu e-Faktur. Dokumentu przyjętego przez KSeF nie da się stamtąd wycofać — zmiana wymaga wystawienia korekty.",
    przycisk: "Wyślij do KSeF",
    coPrzepisac: "numer faktury",
  },

  "oferta-wyslij": {
    id: "oferta-wyslij",
    poziom: "zwykle",
    tytul: "Wysłać ofertę klientowi?",
    skutek: "Mail wyjdzie od razu i nie da się go cofnąć. Treść oferty zostanie zamknięta — poprawki idą przez nową wersję.",
    przycisk: "Wyślij ofertę",
  },
  "umowa-wyslij": {
    id: "umowa-wyslij",
    poziom: "zwykle",
    tytul: "Wysłać dokument klientowi?",
    skutek: "Mail z linkiem do podpisu wyjdzie od razu i nie da się go cofnąć.",
    przycisk: "Wyślij dokument",
  },
  "faktura-wyslij": {
    id: "faktura-wyslij",
    poziom: "zwykle",
    tytul: "Wysłać fakturę klientowi?",
    skutek: "Mail z fakturą wyjdzie od razu i nie da się go cofnąć.",
    przycisk: "Wyślij fakturę",
  },
  "wezwanie-wyslij": {
    id: "wezwanie-wyslij",
    poziom: "zwykle",
    tytul: "Wysłać wezwanie do zapłaty?",
    skutek:
      "Mail wyjdzie od razu i nie da się go cofnąć. To wiadomość o innym ciężarze niż przypomnienie — przeczytaj, do kogo idzie.",
    przycisk: "Wyślij wezwanie",
  },
  "faktura-przypomnij": {
    id: "faktura-przypomnij",
    poziom: "zwykle",
    tytul: "Wysłać przypomnienie o płatności?",
    skutek: "Mail wyjdzie od razu i nie da się go cofnąć. Poziom eskalacji zapisze się na fakturze i nie cofa się w dół.",
    przycisk: "Wyślij przypomnienie",
  },
  "umowa-przypomnij": {
    id: "umowa-przypomnij",
    poziom: "zwykle",
    tytul: "Wysłać przypomnienie o podpisie?",
    skutek: "Mail z prośbą o podpisanie dokumentu wyjdzie od razu i nie da się go cofnąć.",
    przycisk: "Wyślij przypomnienie",
  },
  "oferta-przypomnij": {
    id: "oferta-przypomnij",
    poziom: "zwykle",
    tytul: "Wysłać przypomnienie o ofercie?",
    skutek: "Mail wyjdzie od razu i nie da się go cofnąć.",
    przycisk: "Wyślij przypomnienie",
  },
  "kontakt-kontrolny-wyslij": {
    id: "kontakt-kontrolny-wyslij",
    poziom: "zwykle",
    tytul: "Wysłać wiadomość do klienta?",
    skutek: "Mail wyjdzie od razu i nie da się go cofnąć.",
    przycisk: "Wyślij wiadomość",
  },
  "opinia-popros": {
    id: "opinia-popros",
    poziom: "zwykle",
    tytul: "Poprosić klienta o opinię?",
    skutek: "Mail z linkiem do formularza wyjdzie od razu i nie da się go cofnąć.",
    przycisk: "Wyślij prośbę",
  },

  "link-uniewaznij": {
    id: "link-uniewaznij",
    poziom: "zwykle",
    tytul: "Unieważnić link dla klienta?",
    skutek:
      "Klient, który ma ten adres, zobaczy komunikat o unieważnieniu zamiast dokumentu. Przywrócenie dostępu wymaga wygenerowania nowego linku i wysłania go kolejnym mailem.",
    przycisk: "Unieważnij link",
  },
  "link-wygeneruj-nowy": {
    id: "link-wygeneruj-nowy",
    poziom: "zwykle",
    tytul: "Wygenerować nowy link?",
    skutek: "Adres, który klient już dostał, przestanie działać natychmiast. Nowy trzeba mu wysłać osobno.",
    przycisk: "Wygeneruj nowy",
  },

  "klient-usun": {
    id: "klient-usun",
    poziom: "mocne",
    tytul: "Usunąć klienta?",
    skutek:
      "Znika karta klienta razem z całą jego historią kontaktów, osobami kontaktowymi i powiązaniami. Dokumenty zostają, ale tracą powiązanie z kartą.",
    przycisk: "Usuń klienta",
    coPrzepisac: "nazwę klienta",
  },
  "projekt-usun": {
    id: "projekt-usun",
    poziom: "mocne",
    tytul: "Usunąć projekt?",
    skutek:
      "Znika projekt razem z kamieniami milowymi, zadaniami, zapisanym czasem i wdrożeniem. Tego nie odtworzy żaden zapis w panelu.",
    przycisk: "Usuń projekt",
    coPrzepisac: "nazwę projektu",
  },
  "lead-usun": {
    id: "lead-usun",
    poziom: "zwykle",
    tytul: "Usunąć leada?",
    skutek: "Znika lead razem z całą historią kontaktów z nim.",
    przycisk: "Usuń leada",
  },
  "faktura-usun": {
    id: "faktura-usun",
    poziom: "zwykle",
    tytul: "Usunąć fakturę?",
    skutek: "Znika szkic faktury razem z pozycjami. (Wystawionej faktury usunąć się nie da — od tego jest anulowanie.)",
    przycisk: "Usuń fakturę",
  },
  "oferta-usun": {
    id: "oferta-usun",
    poziom: "zwykle",
    tytul: "Usunąć ofertę?",
    skutek: "Znika oferta razem z pozycjami, sekcjami i historią jej oglądania przez klienta.",
    przycisk: "Usuń ofertę",
  },
  "umowa-usun": {
    id: "umowa-usun",
    poziom: "zwykle",
    tytul: "Usunąć dokument?",
    skutek: "Znika umowa/NDA razem z aneksami i śladem po podpisach.",
    przycisk: "Usuń dokument",
  },
  "notatka-usun": {
    id: "notatka-usun",
    poziom: "zwykle",
    tytul: "Usunąć notatkę?",
    skutek: "Znika notatka razem z jej treścią i załącznikiem.",
    przycisk: "Usuń notatkę",
  },
  "koszt-usun": {
    id: "koszt-usun",
    poziom: "zwykle",
    tytul: "Usunąć koszt?",
    skutek: "Znika wpis kosztu razem z paragonem. Koszt wpisany do rozliczenia trzeba będzie wprowadzić od nowa.",
    przycisk: "Usuń koszt",
  },
  "klienci-usun-masowo": {
    id: "klienci-usun-masowo",
    poziom: "mocne",
    tytul: "Usunąć zaznaczonych klientów?",
    skutek: "Znikają wszystkie zaznaczone karty klientów razem z ich historią kontaktów i powiązaniami.",
    przycisk: "Usuń klientów",
    coPrzepisac: "liczbę zaznaczonych klientów",
  },
  "oferty-usun-masowo": {
    id: "oferty-usun-masowo",
    poziom: "zwykle",
    tytul: "Usunąć zaznaczone oferty?",
    skutek: "Znikają wszystkie zaznaczone oferty razem z pozycjami i sekcjami.",
    przycisk: "Usuń oferty",
  },
};

export function jestDzialaniemNieodwracalnym(v: string): v is IdDzialania {
  return Object.prototype.hasOwnProperty.call(DZIALANIA_NIEODWRACALNE, v);
}

// ── Jak potwierdzenie jedzie w żądaniu ─────────────────────────────────────

/**
 * Nagłówek z identyfikatorem działania, na które właściciel się zgodził.
 *
 * Nagłówek, nie ciało żądania — bo połowa tej listy to `DELETE`, a `DELETE`
 * z ciałem bywa gubiony przez pośredniki. Jeden nośnik dla wszystkich
 * dwudziestu działań jest wart więcej niż elegancja w połowie z nich.
 */
export const NAGLOWEK_POTWIERDZENIA = "x-potwierdzenie";

/**
 * Przepisana fraza przy poziomie „mocne", zakodowana `encodeURIComponent`.
 *
 * Kodowanie jest konieczne: nagłówki HTTP niosą tylko latin-1, a przepisuje
 * się nazwy w rodzaju „Kowalski Sp. z o.o." albo „Wdrożenie w Łodzi" —
 * pierwsze „ł" wywaliłoby `fetch` błędem, zanim żądanie by wyszło.
 * Dekodowanie siedzi w JEDNYM miejscu (`odczytajPotwierdzenie`), bo ta sama
 * wartość przechodzi przez dwa języki i to jest klasa błędu, która potrafi
 * przejść niezauważona (patrz pamięć: „escapowanie przez dwa języki").
 */
export const NAGLOWEK_FRAZY = "x-potwierdzenie-fraza";

export type PotwierdzenieZZadania = {
  /** Na co właściciel się zgodził. `null`, gdy żądanie nie niesie zgody. */
  dzialanie: string | null;
  /** Co przepisał. `null`, gdy nie przepisywał (poziom „zwykłe"). */
  fraza: string | null;
};

/** Czyta potwierdzenie z nagłówków żądania. Nie ocenia — od tego jest
 *  `odmowaPotwierdzenia()`. */
export function odczytajPotwierdzenie(naglowki: {
  get(name: string): string | null;
}): PotwierdzenieZZadania {
  const dzialanie = naglowki.get(NAGLOWEK_POTWIERDZENIA);
  const surowaFraza = naglowki.get(NAGLOWEK_FRAZY);
  let fraza: string | null = null;
  if (surowaFraza != null && surowaFraza !== "") {
    try {
      fraza = decodeURIComponent(surowaFraza);
    } catch {
      // Popsute kodowanie traktujemy jak brak frazy, nie jak błąd serwera —
      // odpowiedź i tak powie, co przepisać.
      fraza = null;
    }
  }
  return { dzialanie: dzialanie && dzialanie !== "" ? dzialanie : null, fraza };
}

// ── Porównanie przepisanej frazy ───────────────────────────────────────────

/**
 * Sprowadza frazę do postaci, w której porównanie ma sens: bez nadmiarowych
 * spacji, bez różnicy wielkości liter, w jednolitej postaci Unicode.
 *
 * NFC ma znaczenie realne, nie teoretyczne: „ł" wpisane na macOS potrafi
 * przyjechać jako inna sekwencja bajtów niż to samo „ł" wyrenderowane
 * z bazy, a wtedy dwa identycznie wyglądające napisy nie są równe. Nie
 * ignorujemy natomiast polskich znaków — przepisanie „Lodz" zamiast „Łódź"
 * ma się nie udać, bo to znaczy, że nikt nie przeczytał, co przepisuje.
 */
export function normalizujFraze(v: unknown): string {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  return s.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("pl-PL");
}

export function frazaSieZgadza(przepisana: string | null, wymagana: string | null | undefined): boolean {
  const cel = normalizujFraze(wymagana);
  if (!cel) return true; // nie ma czego przepisywać — patrz `odmowaPotwierdzenia`
  return normalizujFraze(przepisana) === cel;
}

// ── Odmowa po stronie trasy ────────────────────────────────────────────────

export type PowodOdmowy =
  /** Żądanie nie niosło zgody w ogóle. */
  | "brak-potwierdzenia"
  /** Zgoda dotyczyła innego działania niż to, które trasa wykonuje. */
  | "inne-dzialanie"
  /** Poziom „mocne", a przepisana fraza się nie zgadza. */
  | "fraza-sie-nie-zgadza";

export type OdmowaPotwierdzenia = {
  /**
   * 428 Precondition Required — „żądanie jest poprawne, brakuje mu warunku
   * wstępnego". Świadomie nie 400 (żądanie nie jest błędne) i nie 403
   * (uprawnienia są w porządku). Osobny kod pozwala panelowi i apce odróżnić
   * „zapytaj i powtórz" od „to się nie uda, cokolwiek zrobisz".
   */
  status: 428;
  /** Zdanie dla człowieka — apka bez wsparcia dla tej fazy pokaże właśnie to. */
  error: string;
  potwierdzenie: {
    powod: PowodOdmowy;
    dzialanie: IdDzialania;
    poziom: PoziomPotwierdzenia;
    tytul: string;
    skutek: string;
    przycisk: string;
    /**
     * Co przepisać — sama ETYKIETA („nazwę klienta"), nigdy wymagana
     * wartość. Odesłanie wartości zamieniłoby mocne potwierdzenie w formalność:
     * wystarczyłoby przepisać ją z odpowiedzi 428 do kolejnego żądania.
     * Panel wie, co pokazać, bo ma rekord na ekranie.
     */
    coPrzepisac?: string;
  };
};

/**
 * Czy tej trasie wolno wykonać działanie. `null` = wolno.
 *
 * `frazaWymagana` podaje trasa, bo tylko ona wie, co jest w bazie — i to
 * ona jest tu autorytetem. Klient nie przysyła frazy wymaganej, tylko tę,
 * którą przepisał; porównuje serwer.
 *
 * **Pusta `frazaWymagana` przy poziomie „mocne" schodzi do zwykłej zgody.**
 * Inaczej klient bez nazwy albo projekt bez tytułu byłyby nieusuwalne na
 * zawsze — bariera zamieniłaby się w zamek bez klucza.
 */
export function odmowaPotwierdzenia(
  id: IdDzialania,
  potwierdzenie: PotwierdzenieZZadania,
  frazaWymagana?: string | null
): OdmowaPotwierdzenia | null {
  const opis = DZIALANIA_NIEODWRACALNE[id];
  const wymagaFrazy = opis.poziom === "mocne" && !!normalizujFraze(frazaWymagana);

  const odmow = (powod: PowodOdmowy, error: string): OdmowaPotwierdzenia => ({
    status: 428,
    error,
    potwierdzenie: {
      powod,
      dzialanie: id,
      poziom: wymagaFrazy ? "mocne" : "zwykle",
      tytul: opis.tytul,
      skutek: opis.skutek,
      przycisk: opis.przycisk,
      ...(wymagaFrazy && opis.coPrzepisac ? { coPrzepisac: opis.coPrzepisac } : {}),
    },
  });

  if (potwierdzenie.dzialanie == null) {
    return odmow(
      "brak-potwierdzenia",
      `${opis.tytul} ${opis.skutek} Potwierdź to działanie, żeby je wykonać.`
    );
  }
  if (potwierdzenie.dzialanie !== id) {
    // Zgoda na jedno działanie nie jest zgodą na inne — inaczej potwierdzenie
    // wysyłki przepuszczałoby usunięcie, gdyby panel pomylił nagłówki.
    return odmow("inne-dzialanie", `Potwierdzenie dotyczy innego działania niż „${opis.tytul}”.`);
  }
  if (wymagaFrazy && !frazaSieZgadza(potwierdzenie.fraza, frazaWymagana)) {
    return odmow(
      "fraza-sie-nie-zgadza",
      `Aby potwierdzić, przepisz ${opis.coPrzepisac ?? "wskazaną wartość"} dokładnie tak, jak jest wyświetlona.`
    );
  }
  return null;
}
