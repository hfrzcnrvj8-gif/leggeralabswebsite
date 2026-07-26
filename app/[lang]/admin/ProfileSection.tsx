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
 * Etykieta stoi PO LEWEJ w stałej kolumnie, nie nad wartością — to ta zmiana
 * daje pionową krawędź, po której oko przeskakuje w dół. Układ „etykieta nad
 * wartością" przy jednej kolumnie robił z wizytówki ciąg naprzemiennych
 * linijek bez żadnej osi.
 *
 * `items-start`, bo wartość bywa wyższa niż jedna linijka (pigułki terminów
 * pod datą, ostrzeżenie o rytmie, dwa pola w wierszu „Kod / Miasto").
 */
export function WierszPola({
  etykieta,
  children,
  title,
}: {
  etykieta: string;
  children: ReactNode;
  /** Podpowiedź po najechaniu na etykietę — dla pól, których nazwa nie mieści
   * całego znaczenia (np. „Odzywaj się"). */
  title?: string;
}) {
  return (
    <div className="flex items-start gap-2 px-3 py-2">
      <span className="w-[38%] shrink-0 pt-1 text-[11.5px] leading-tight text-muted" title={title}>
        {etykieta}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
