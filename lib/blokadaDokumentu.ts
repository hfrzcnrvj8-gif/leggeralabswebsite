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

/** Umowa/NDA: podpisana jest nienaruszalna. */
export function blokadaUmowy(status: string): PowodBlokady {
  if (status === "Podpisana") {
    return {
      zablokowane: true,
      komunikat:
        "Umowa jest podpisana — obie strony mają jej kopię, więc treści nie zmieniamy. Zmiana wymaga aneksu.",
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
