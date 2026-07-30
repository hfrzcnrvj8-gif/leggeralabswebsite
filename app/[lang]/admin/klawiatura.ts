"use client";

import { useCallback, useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { isTypingTarget } from "./ui";

/**
 * Skróty listy — JEDNO źródło dla całego panelu (Moduł 59, paczka C).
 *
 * Do tej paczki ten sam zestaw klawiszy istniał w czterech modułach w czterech
 * wersjach (Leady, Klienci, Oferty, Umowy), a w dziesięciu nie istniał wcale.
 * Różnice nie były kosmetyczne: Oferty i Umowy same rozpoznawały „czy piszę
 * w polu", Leady i Klienci wołały `isTypingTarget`; Oferty czyściły szukanie
 * Esc-em, Leady nie; nigdzie kursor nie przewijał się do widoku, więc na
 * dłuższej liście `j` gubiło zaznaczenie pod krawędzią ekranu.
 *
 * Kontrakt (kategoria 4 listy kontrolnej Modułu 59):
 * - `/` — kursor do pola szukania,
 * - `Esc` w polu szukania — czyści frazę i oddaje fokus liście,
 * - `j` / `k` (oraz strzałki ↓/↑) — kursor po widocznych wierszach,
 * - `Enter` — otwiera wiersz pod kursorem.
 *
 * Klawisze modułowe (cyfry statusu w Leadach, `r`/`f`/`e` w Poczcie) zostają
 * w module — to jego słownik, nie wspólny.
 */

/** Podświetlenie wiersza pod kursorem. Neutralne `--zaznaczenie`, bo kursor
 *  nie niesie ani stanu, ani rodzaju rekordu (słownik koloru, Moduł 59/D).
 *
 *  Kolor przez `ring-zaznaczenie/60` (kolor z `tailwind.config.ts`), NIE przez
 *  `ring-[var(--zaznaczenie)]/60`: tej drugiej postaci Tailwind nie umie
 *  wygenerować i cicho zostawia domyślny błękit ringa. Pomiar i szczegóły:
 *  `globals.css` przy `--zaznaczenie-rgb`. */
export const KLASA_KURSORA = "ring-1 ring-inset ring-zaznaczenie/60";

export type WlasciwosciWiersza = {
  className: string;
  /** Po tym atrybucie hook znajduje wiersz i przewija go do widoku. */
  "data-kursor"?: "1";
};

export type SkrotyListy = {
  kursor: number;
  /** `kursor`, ale dopiero PO pierwszym użyciu klawiatury; wcześniej `null`.
   *  Dla modułów, które podświetlają wiersz po `id`, a nie przez `wiersz()`. */
  kursorWidoczny: number | null;
  setKursor: Dispatch<SetStateAction<number>>;
  /** Właściwości wiersza listy: `<tr {...wiersz(i, "moje klasy")}>`.
   *  Jedno wywołanie zamiast pary „klasa + atrybut", żeby nie dało się dodać
   *  podświetlenia bez przewijania (albo odwrotnie). */
  wiersz: (index: number, klasy?: string) => WlasciwosciWiersza;
};

export function useSkrotyListy<T>(opcje: {
  /** Elementy AKTUALNIE widoczne — po filtrach i po szukaniu. Kursor nie może
   *  wskazywać rekordu, którego nie widać: Enter otwierałby wtedy coś innego,
   *  niż pokazuje ekran. */
  elementy: readonly T[];
  /** Enter na wierszu pod kursorem. */
  otworz: (element: T, index: number) => void;
  /** Pole szukania. Bez niego `/` nic nie robi (i tak ma być — martwy skrót
   *  jest tym samym, co martwy przycisk). */
  szukajRef?: RefObject<HTMLInputElement | null>;
  /** Wywoływane przez `Esc` w polu szukania. */
  wyczyscSzukanie?: () => void;
  /** `false` wycisza skróty — modal profilu, formularz i arkusz mają własną
   *  obsługę klawiszy, a lista pod spodem nie może im podbierać `Enter`. */
  aktywne?: boolean;
}): SkrotyListy {
  const { elementy, otworz, szukajRef, wyczyscSzukanie, aktywne = true } = opcje;
  const [kursor, setKursor] = useState(0);
  /** Czy klawiatura była w ogóle użyta na tej liście. Do paczki C obrys stał
   *  na pierwszym wierszu od razu po wejściu na ekran — właściciel zgłosił to
   *  w Poczcie jako „toporne" (04e, runda 4) i naprawiono to wtedy przez
   *  ścieńszenie obrysu, czyli objaw, nie przyczynę. Kursor jest odpowiedzią
   *  na naciśnięcie klawisza; zanim padnie, nie ma czego pokazywać. */
  const [uzyty, setUzyty] = useState(false);
  const liczba = elementy.length;

  // Lista mogła się skrócić (filtr, szukanie, usunięcie) — kursor za jej
  // końcem znaczy „Enter nic nie robi", czyli znowu martwy skrót.
  useEffect(() => {
    setKursor((k) => Math.min(k, Math.max(0, liczba - 1)));
  }, [liczba]);

  // Przewinięcie do kursora. `block: "nearest"` — przewijamy tylko wtedy, gdy
  // wiersz naprawdę wypadł poza widok; inaczej lista skakałaby przy każdym
  // naciśnięciu `j`. Zapytanie po dokumencie, bo na raz zamontowany jest
  // dokładnie jeden dashboard (panel nie renderuje dwóch list obok siebie).
  useEffect(() => {
    if (!aktywne || !uzyty) return;
    document.querySelector<HTMLElement>('[data-kursor="1"]')?.scrollIntoView({ block: "nearest" });
  }, [kursor, aktywne, uzyty]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Esc w polu szukania czyści frazę i oddaje fokus liście — jedyny
      // przypadek, w którym reagujemy na klawisz WEWNĄTRZ pola tekstowego.
      if (e.key === "Escape" && szukajRef && e.target === szukajRef.current) {
        e.preventDefault();
        wyczyscSzukanie?.();
        szukajRef.current?.blur();
        return;
      }
      if (!aktywne) return;
      if (isTypingTarget(e.target)) return;
      // Cmd/Ctrl/Alt zostawiamy systemowi i palecie poleceń (Cmd+K).
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "/") {
        if (!szukajRef?.current) return;
        e.preventDefault();
        szukajRef.current.focus();
        return;
      }
      if (e.key === "j" || e.key === "ArrowDown") {
        if (liczba === 0) return;
        e.preventDefault();
        // Pierwsze naciśnięcie POKAZUJE kursor na pierwszym wierszu, nie
        // przeskakuje na drugi — inaczej wiersz nr 1 byłby nie do wybrania.
        if (!uzyty) setUzyty(true);
        else setKursor((k) => Math.min(k + 1, liczba - 1));
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        if (liczba === 0) return;
        e.preventDefault();
        if (!uzyty) setUzyty(true);
        else setKursor((k) => Math.max(k - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        // Enter bez widocznego kursora otwierałby rekord, którego nikt nie
        // wskazał — a przy pierwszym wierszu wyglądałoby to jak przypadek.
        if (!uzyty) return;
        const cel = elementy[kursor];
        if (!cel) return;
        e.preventDefault();
        otworz(cel, kursor);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aktywne, elementy, kursor, liczba, otworz, szukajRef, uzyty, wyczyscSzukanie]);

  const wiersz = useCallback(
    (index: number, klasy?: string): WlasciwosciWiersza => {
      const podKursorem = uzyty && index === kursor;
      return {
        className: [klasy, podKursorem ? KLASA_KURSORA : ""].filter(Boolean).join(" "),
        ...(podKursorem ? { "data-kursor": "1" as const } : {}),
      };
    },
    [kursor, uzyty]
  );

  return { kursor, kursorWidoczny: uzyty ? kursor : null, setKursor, wiersz };
}
