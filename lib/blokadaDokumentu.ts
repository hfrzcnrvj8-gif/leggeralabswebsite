/**
 * Kiedy dokument przestaje być edytowalny (decyzja właściciela 2026-07-27).
 *
 * Do tej rundy ochrona istniała WYŁĄCZNIE w interfejsie: edytor faktury
 * wyszarzał pola po wystawieniu, ale `PATCH /api/invoices/[id]` przyjmował
 * wszystko. Blokada w interfejsie nie jest blokadą — jest podpowiedzią.
 * Prawdziwa reguła musi stać w trasie, bo tras używa też apka, druga karta
 * przeglądarki i każdy przyszły ekran.
 *
 * Trzy dokumenty, trzy różne powody:
 *
 * 1. **Faktura wystawiona** — wymóg prawa. Treści faktury nie zmienia się po
 *    wystawieniu; zmiana idzie korektą (`/api/invoices/[id]/correct`). Ta sama
 *    logika, która już blokuje USUNIĘCIE numerowanej faktury.
 * 2. **Umowa podpisana** — obie strony mają kopię. Zmiana to aneks, czyli nowy
 *    dokument wskazujący na oryginał, nie cicha edycja starego.
 * 3. **Oferta wysłana** — klient patrzy na publiczny link, który renderuje
 *    dane z bazy. Bez blokady dokument „u klienta" przestaje być tym, co
 *    dostał, i przy sporze nie ma czego pokazać. Zmiana idzie przez „Nową
 *    wersję" (`/api/offers/[id]/version`), która zostawia ślad po obu stronach.
 *
 * Zawsze zwracamy 409 z gotowym zdaniem po polsku — apka pokazuje je dosłownie
 * (patrz `APIError.odmowa`), a nie jako awarię połączenia.
 */

export type PowodBlokady = { zablokowane: true; komunikat: string } | { zablokowane: false };

const WOLNE = { zablokowane: false } as const;

/** Oferta: po wysłaniu treść jest zamknięta, po akceptacji zamknięte jest
 * wszystko (z oferty powstały już projekt i szkic faktury). */
export function blokadaOferty(status: string, akceptowana = false): PowodBlokady {
  if (status === "Zaakceptowana" || akceptowana) {
    return {
      zablokowane: true,
      komunikat:
        "Oferta jest zaakceptowana — powstały z niej projekt i faktura, więc jej treści nie da się już zmienić. Potrzebujesz innego zakresu? Zrób nową ofertę.",
    };
  }
  if (status !== "Szkic") {
    return {
      zablokowane: true,
      komunikat:
        "Oferta została wysłana i klient widzi ją pod tym samym linkiem — treści nie zmieniamy po cichu. Użyj „Nowej wersji oferty”: poprzednia zostanie oznaczona jako zastąpiona.",
    };
  }
  return WOLNE;
}

/** Faktura: numer = dokument wystawiony. */
export function blokadaFaktury(numer: string | null | undefined): PowodBlokady {
  if (numer && String(numer).trim()) {
    return {
      zablokowane: true,
      komunikat:
        `Faktura ${numer} jest wystawiona — jej treści nie wolno zmieniać. Poprawka idzie fakturą korygującą („Wystaw korektę”).`,
    };
  }
  return WOLNE;
}

/** Umowa/NDA/aneks: podpisany dokument jest nienaruszalny.
 *
 * **`acceptedAt`, nie tylko `status`** (audyt Modułu 11, 2026-07-27). Status
 * jest polem WOLNYM mimo blokady (żeby dało się dokument zamknąć), więc
 * blokada oparta na samym statusie miała drzwi na oścież: sonda wysłała
 * `PATCH {"status":"Szkic"}` na podpisanej umowie (200), a zaraz potem
 * `PATCH {"cena":1}` — też 200. Dokument został z podpisem i datą podpisu,
 * ale z inną treścią. `accepted_at` jest jedynym śladem, którego nie da się
 * cofnąć zwykłą edycją, więc to on rozstrzyga.
 *
 * `typ` wpływa WYŁĄCZNIE na to, dokąd odsyłamy — a to jest tu cała wartość
 * komunikatu. Do Modułu 58 zdanie „Zmiana wymaga aneksu" było obietnicą bez
 * pokrycia: aneksu system nie znał (audyt Modułu 57). Teraz aneks istnieje,
 * więc zdanie jest prawdziwe — pod warunkiem, że nie mówimy go nad samym
 * aneksem, bo aneksu do aneksu świadomie nie robimy (patrz trasa
 * `api/contracts/[id]/aneks`). */
export function blokadaUmowy(status: string, typ?: string, acceptedAt?: string | null): PowodBlokady {
  if (status === "Podpisana" || acceptedAt) {
    return {
      zablokowane: true,
      komunikat:
        typ === "aneks"
          ? "Ten aneks jest podpisany — obie strony mają jego kopię, więc treści nie zmieniamy. Kolejną zmianę wprowadza się następnym aneksem do umowy."
          : typ === "nda"
            ? "NDA jest podpisane — obie strony mają jego kopię, więc treści nie zmieniamy. Potrzebujesz innych zapisów? Sporządź nowe NDA."
            : "Umowa jest podpisana — obie strony mają jej kopię, więc treści nie zmieniamy. Zmiana wymaga aneksu („Sporządź aneks” na liście Umów).",
    };
  }
  return WOLNE;
}

/** Czy wolno przestawić umowę/NDA/aneks na wskazany status.
 *
 * Dwie reguły, obie z audytu Modułu 11 (2026-07-27):
 *
 * 1. **Na „Podpisana" nie przechodzi się statusem.** Podpis to nie etykieta,
 *    tylko `accepted_at` — dokument z pigułką „Podpisana" i pustą datą podpisu
 *    kłamie na wydruku (rubryka podpisu zostaje pusta) i wypada z retencji
 *    dowodu e-podpisu, która chodzi po `accepted_at`. Do tego służy
 *    `POST /api/contracts/:id/accept`.
 * 2. **Z „Podpisana" nie schodzi się wcale.** To była druga połowa dziury
 *    opisanej przy `blokadaUmowy`: cofnięcie statusu odblokowywało treść.
 *    Podpisany dokument jest zamknięty — pomyłka wychodzi aneksem, a nie
 *    przewinięciem statusu do tyłu.
 */
export function blokadaStatusuUmowy(nowy: string, podpisany: boolean): PowodBlokady {
  if (nowy === "Podpisana") {
    return {
      zablokowane: true,
      komunikat:
        "Podpisu nie ustawia się statusem — użyj „Oznacz jako podpisaną”, żeby zapisać też datę złożenia podpisu.",
    };
  }
  if (podpisany) {
    return {
      zablokowane: true,
      komunikat:
        "Ten dokument jest podpisany — statusu nie cofamy. Zmianę warunków wprowadza aneks, a nie zmiana statusu.",
    };
  }
  return WOLNE;
}

/** Pola, które wolno ruszać MIMO blokady — bo nie są treścią dokumentu.
 *
 * Rozdzielenie jest tu istotne: „zablokowana oferta" nie może znaczyć „nie da
 * się jej zamknąć statusem" ani „nie da się przedłużyć ważności". To pierwsze
 * jest pracą handlową, drugie ustępstwem wobec klienta — żadne nie zmienia
 * tego, co klient przeczytał. */
export const POLA_MIMO_BLOKADY_OFERTY = new Set([
  "status",
  "powod_odrzucenia",
  "komentarz_odrzucenia",
  "wazna_do",
  "client_id",
  "lead_id",
]);

export const POLA_MIMO_BLOKADY_FAKTURY = new Set(["status", "ksef_status", "ksef_numer", "ksef_uid"]);

export const POLA_MIMO_BLOKADY_UMOWY = new Set(["status", "client_id", "project_id"]);

/** Czy w ciele żądania są pola inne niż dozwolone przy blokadzie. */
export function ruszaTresc(body: Record<string, unknown>, dozwolone: Set<string>): boolean {
  return Object.keys(body).some((k) => !dozwolone.has(k));
}
