"use client";

import type { ReactNode } from "react";

/**
 * Sekcja profilu rekordu — nagłówek kapitalikami nad jaśniejszą płytą
 * (Moduł 54, krok 6, runda czytelności 2026-07-26).
 *
 * Powód powstania: po wprowadzeniu układu bocznego właściciel zgłosił, że
 * „w panelu wszystko się zlewa, a w apce ten sam układ jest przejrzysty".
 * Porównanie z `KlientDetailView.swift` pokazało, na czym polega różnica —
 * apka trzyma pola w `List(.insetGrouped)`, czyli w kilku osobnych płytach
 * z nagłówkami `Section("Kontakt")`, `Section("Dane")`. Panel miał tę samą
 * treść rozłożoną na jednym płaskim tle, rozdzieloną wyłącznie odstępem.
 * To nie był problem gęstości ani kolejności, tylko braku KRAWĘDZI.
 *
 * Świadomie NIE `.card-paper`: ta klasa maluje tło całej karty profilu, więc
 * sekcja w tym samym odcieniu byłaby niewidzialna. `.card-inset` (globals.css)
 * jest o włos jaśniejsza i istnieje wyłącznie po to, żeby leżeć NA karcie.
 */
export function SekcjaProfilu({
  tytul,
  akcje,
  children,
  /** Dzieci są wierszami „etykieta — wartość" i mają dostać kreski między
   * sobą. Wyłącz dla sekcji z własną treścią (lista osób, notatka, oś czasu),
   * gdzie kreska co element rysowałaby siatkę zamiast grupy. */
  wiersze = true,
  plyta = true,
  className = "",
}: {
  tytul: string;
  akcje?: ReactNode;
  children: ReactNode;
  wiersze?: boolean;
  /** Sam nagłówek, bez płyty pod spodem — dla treści, która ma WŁASNE
   * krawędzie (oś czasu: każdy wpis jest osobną kartą). Płyta pod płytą robi
   * pudełko w pudełku i zabiera obu czytelność. */
  plyta?: boolean;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-1.5 flex min-h-[22px] flex-wrap items-center gap-2 px-1">
        <h3 className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">{tytul}</h3>
        {akcje && (
          <>
            <span className="flex-1" />
            {akcje}
          </>
        )}
      </div>
      {plyta ? (
        <div
          className={`card-inset overflow-hidden rounded-xl ${
            wiersze ? "divide-y divide-[var(--hairline)]" : "p-3"
          }`}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/**
 * Wiersz „etykieta — wartość" wewnątrz `SekcjaProfilu`.
 *
 * Etykieta stoi PO LEWEJ w stałej kolumnie, nie nad wartością — to daje pionową
 * krawędź, po której oko przeskakuje w dół. Układ „etykieta nad wartością" przy
 * jednej kolumnie robił z wizytówki ciąg naprzemiennych linijek bez żadnej osi.
 *
 * **Trzy rzeczy, bez których to dalej wygląda krzywo** (zgłoszenie właściciela
 * „nadal jakoś koślawo", 2026-07-26, po zmierzeniu wysokości wierszy: 41, 42,
 * 42, 42, 64, 110, 44, 41, 42, 70, 41 px):
 *
 * 1. **Stała wysokość wiersza.** Rytm skaczący o 70 px czyta się jak krzywy
 *    stół, nawet gdy każdy wiersz z osobna jest poprawny. Dlatego `min-h` i
 *    `items-center`, a treść wyższa niż jedna linijka NIE wchodzi do wiersza —
 *    idzie do sufiksu obok wartości albo poza sekcję.
 * 2. **Stała szerokość etykiety w PIKSELACH, nie w procentach.** Procent liczy
 *    się od szerokości sekcji, więc kolumna wartości wypadała w innym miejscu
 *    w każdej sekcji i pionowa krawędź, o którą w tym wszystkim chodzi,
 *    rozjeżdżała się o kilkanaście pikseli.
 * 3. **Jeden rozmiar i jedno wcięcie wartości.** W jednej kolumnie stały obok
 *    siebie `input` (12 px, wcięcie 4 px), przycisk daty (13 px, 6 px) i
 *    pigułka (11 px, 10 px) — trzy różne lewe krawędzie w jednym słupku.
 *    Wyrównuje to `[&_input]` niżej, a nie poprawki w każdym wywołaniu.
 */
export function WierszPola({
  etykieta,
  children,
  title,
  /** Dopisek za wartością — „3 dni temu", „rytm minął". Kiedyś stał w drugiej
   * linijce i to on rozdymał wiersz do 110 px. */
  sufiks,
}: {
  etykieta: string;
  children: ReactNode;
  /** Podpowiedź po najechaniu na etykietę — dla pól, których nazwa nie mieści
   * całego znaczenia (np. „Odzywaj się"). */
  title?: string;
  sufiks?: ReactNode;
}) {
  return (
    <div className="flex min-h-[38px] items-center gap-2 px-3 py-1">
      <span className="w-[104px] shrink-0 text-[11.5px] leading-tight text-muted" title={title}>
        {etykieta}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2 [&_input]:px-1.5 [&_input]:text-[13px]">
        {children}
        {sufiks}
      </div>
    </div>
  );
}
