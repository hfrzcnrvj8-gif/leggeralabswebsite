"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ZNALEZISKO D2 — „nowy lead ląduje poza ekranem".
 *
 * Po „Dodano leada." rekord trafiał na 10. pozycję z 11 (lista sortuje po
 * „ostatni kontakt", a nowy lead żadnego nie ma), lista się nie przewijała
 * i nic go nie podświetlało. Toast mówił „dodano", ekran nie pokazywał —
 * rekordu trzeba było szukać wyszukiwarką.
 *
 * **Decyzja właściciela (2026-08-02): sortowanie zostaje bez zmian.** Kolumna
 * „ostatni kontakt" ma dalej sortować czysto po dacie — nowe rekordy NIE
 * wskakują na górę. Zamiast tego lista przewija się do świeżo dodanego rekordu
 * i podświetla go na chwilę. Ta sama reguła obowiązuje w KAŻDYM module, bo
 * zachowanie „dodałem i nie widzę" nie jest właściwością Leadów, tylko listy.
 *
 * ## Jak to wpiąć w moduł (trzy linijki)
 *
 * ```tsx
 * const nowy = useNowyRekord();
 * // po udanym POST — trasa oddaje { ok: true, id }
 * const { id } = await res.json();
 * nowy.pokaz(id);
 * // przy renderze wiersza / karty
 * <div data-rekord={lead.id} className={`… ${nowy.klasa(lead.id)}`}>
 * ```
 *
 * `data-rekord` jest OBOWIĄZKOWE — po nim ten hook znajduje element w DOM.
 * Bez atrybutu podświetlenie zadziała, a przewinięcie nie, i nic tego nie
 * zgłosi.
 *
 * ## Dlaczego czekanie w pętli, a nie jeden `scrollIntoView`
 *
 * `pokaz(id)` wołane jest zaraz po odpowiedzi trasy, a wiersz pojawia się
 * dopiero po `load()` i przerysowaniu. Jednorazowa próba trafiałaby w pustkę.
 * Stąd kilkadziesiąt krótkich prób i poddanie się po ~2 s — zamiast jednego
 * `setTimeout` na oko, który albo jest za krótki, albo opóźnia przewinięcie
 * o pół sekundy bez powodu.
 *
 * Świadomie `setTimeout`, a NIE `requestAnimationFrame`: rAF nie tyka
 * w karcie w tle. Pierwsza wersja tego pliku chodziła na rAF i w podglądzie
 * przewinięcie nie następowało wcale — a to jest dokładnie ten artefakt
 * środowiska, który `CLAUDE.md` opisuje jako „zamrożony rAF". Zegar tyka
 * zawsze, więc rekord jest przewinięty również wtedy, gdy właściciel dodał
 * go z drugiej karty i wraca do listy chwilę później.
 */

/** Ile czasu rekord zostaje podświetlony. Na tyle długo, żeby oko zdążyło
 * trafić po przewinięciu, i na tyle krótko, żeby po powrocie do listy za
 * minutę nie było już widać „czegoś zaznaczonego" bez powodu. */
const CZAS_PODSWIETLENIA_MS = 3800;
/** Odstęp i sufit czekania na wiersz w DOM (~2 s). */
const ODSTEP_PROBY_MS = 40;
const MAX_PROB = 50;

export type NowyRekord = {
  /** Id świeżo dodanego rekordu albo `null`. */
  id: string | null;
  /** Zgłoś nowy rekord: przewiń do niego i podświetl. Puste id ignorowane. */
  pokaz: (id: string | null | undefined) => void;
  /** Klasy podświetlenia dla wiersza o danym id (pusty string dla reszty). */
  klasa: (id: string) => string;
};

export function useNowyRekord(): NowyRekord {
  const [id, setId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const szukajRef = useRef<number | null>(null);

  // Sprzątanie przy odmontowaniu — inaczej `setId` po zamknięciu modułu
  // wywołuje ostrzeżenie Reacta, a licznik prób chodzi dalej w tle.
  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      if (szukajRef.current != null) window.clearTimeout(szukajRef.current);
    },
    []
  );

  const pokaz = useCallback((nowe: string | null | undefined) => {
    if (!nowe) return;
    setId(nowe);

    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setId(null), CZAS_PODSWIETLENIA_MS);

    if (szukajRef.current != null) window.clearTimeout(szukajRef.current);
    let proby = 0;
    const szukaj = () => {
      const el = document.querySelector(`[data-rekord="${CSS.escape(nowe)}"]`);
      if (el) {
        // `center`, nie `nearest`: rekord dosunięty do krawędzi ekranu czyta
        // się jak „coś tam jeszcze jest", a nie jak „o, jest".
        //
        // `auto`, nie `smooth`. Dwa powody, oba zmierzone. Po pierwsze
        // przewijanie płynne jest animacją kompozytora i w karcie w tle nie
        // rusza z miejsca — sprawdzone: ten sam wiersz po `smooth` został na
        // `top: 1021`, po `auto` przeskoczył na 687. Po drugie to skok po
        // ŚWIADOMYM kliknięciu „Dodaj", gdzie liczy się „gdzie on jest", a nie
        // droga do niego; robotę pokazania drogi bierze na siebie
        // podświetlenie, które zostaje na ekranie prawie cztery sekundy.
        el.scrollIntoView({ behavior: "auto", block: "center" });
        szukajRef.current = null;
        return;
      }
      if (++proby > MAX_PROB) {
        szukajRef.current = null;
        return;
      }
      szukajRef.current = window.setTimeout(szukaj, ODSTEP_PROBY_MS);
    };
    szukajRef.current = window.setTimeout(szukaj, ODSTEP_PROBY_MS);
  }, []);

  const klasa = useCallback(
    (kandydat: string) =>
      kandydat && kandydat === id
        ? // Obwódka + tło w barwie ZAZNACZENIA, nie w barwie stanu. Kolor
          // w tym panelu niesie jedną rzecz (reguła słownika koloru), a „to
          // jest nowe" to chrome interfejsu, nie status rekordu — dokładnie
          // ten sam powód, dla którego `--zaznaczenie` jest neutralne.
          //
          // `!bg-…` z wykrzyknikiem, i to nie jest ozdoba. `.admin-linear
          // .card-paper` (globals.css) to selektor POTOMKA, więc bije zwykłą
          // klasę-utility na specyficzności — na kartach tablicy tło bez
          // wykrzyknika nie robi NIC i nie daje żadnego objawu. Zmierzone:
          // `card-paper` + `bg-zaznaczenie/[0.08]` → `rgb(13,14,16)`, czyli
          // dokładnie tło karty. Na wierszu tabeli (bez `.card-paper`) ta sama
          // klasa działa — stąd pułapka: połowa list wyglądała poprawnie.
          "ring-2 ring-[var(--zaznaczenie)] ring-offset-2 ring-offset-[var(--bg)] !bg-zaznaczenie/[0.08]"
        : "",
    [id]
  );

  return { id, pokaz, klasa };
}
