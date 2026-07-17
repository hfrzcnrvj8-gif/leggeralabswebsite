"use client";

import { motion } from "framer-motion";

// Pigułki filtrowania listy (zakładki „Do odpowiedzi”/„VIP” w Poczcie, tagi w
// Notatniku). Audyt wizualny 2026-07-16 (Moduł 21): każdy moduł malował stan
// aktywny inaczej — Poczta płaskim `--hairline`, Notatnik odwróconą bielą
// `--fg` — i żaden nie sięgał po gradient marki. Tu jest jeden wygląd,
// z akcentem purpura→złoto (`.pill-active`, globals.css).
//
// Rozmiar jest parametrem, bo Poczta ma pigułki nad listą (większe, 12 px),
// a Notatnik pod polem notatki (drobniejsze, 11 px) — to świadoma różnica
// gęstości, nie niespójność do wyrównania.
//
// Moduł 27: podświetlenie PRZEJEŻDŻA między pigułkami zamiast przeskakiwać —
// ten sam wzorzec i ten sam spring co `ViewTabs` (patrz komentarz tam).
// Gradient przeniesiony z klasy na `<button>` do osobnej warstwy `motion.span`
// pod tekstem: framer musi mieć JEDEN element, który zmienia pozycję, a nie
// dwa tła zapalane/gaszone na różnych przyciskach.
//
// `layoutId` jest WYMAGANY, świadomie bez wartości domyślnej. Notatnik
// renderuje dwa zestawy pigułek JEDNOCZEŚNIE (zakładki i tagi, osobne rzędy) —
// przy wspólnym `layoutId` framer uzna oba podświetlenia za ten sam element
// i przeleci gradientem z rzędu zakładek do rzędu tagów. `ViewTabs` złapał
// dokładnie ten błąd w Module 23 i dostał ten prop już po fakcie; tutaj brak
// domyślki wymusza decyzję na wywołującym, zamiast czekać na regresję.
export function FilterPills<T extends string>({
  value,
  onChange,
  pills,
  size = "md",
  layoutId,
}: {
  value: T;
  onChange: (v: T) => void;
  pills: { id: T; label: string }[];
  size?: "sm" | "md";
  layoutId: string;
}) {
  return (
    <>
      {pills.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={`relative rounded-full transition-colors ${
            size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1 text-[12px]"
          } ${
            value === p.id
              ? "font-medium text-[var(--fg)]"
              : // Obramowanie przezroczyste, nie brak obramowania — warstwa
                // podświetlenia ma 1 px ramki, więc bez tego pigułka skakałaby
                // o piksel przy każdym przełączeniu. Widoczny obrys na
                // nieaktywnych dawał rząd sześciu obwódek naraz (sprawdzone
                // wzrokowo) — za dużo szumu.
                "border border-transparent text-muted hover:bg-[var(--hairline)]/40 hover:text-[var(--fg)]"
          }`}
        >
          {value === p.id && (
            <motion.span
              layoutId={layoutId}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="pill-active absolute inset-0 rounded-full"
            />
          )}
          {/* Tekst nad warstwą podświetlenia — bez tego gradient go zakryje. */}
          <span className="relative">{p.label}</span>
        </button>
      ))}
    </>
  );
}

/** Kontener rzędu pigułek na szkle — chrome, nie karta, więc `.glass` jest tu
 *  zgodne z regułą z CLAUDE.md („glass zarezerwowane dla chrome”). Osobny
 *  komponent, bo nie każdy rząd go chce: tagi w Notatniku siedzą pod polem
 *  notatki i szkło robiłoby z nich drugą kartę na karcie. */
export function FilterPillsBar({ children }: { children: React.ReactNode }) {
  // `flex-wrap` + `max-w-full`: na wąskim ekranie rząd zawija się wewnątrz
  // szkła zamiast wyjeżdżać poza kadr. (Panel i tak nie jest jeszcze mobilny —
  // poziomy scroll na 375 px jest tu sprzed tej zmiany i należy do Modułu 5 —
  // ale nie ma powodu dokładać do niego kolejnych pikseli.)
  return <div className="glass inline-flex max-w-full flex-wrap items-center gap-1 rounded-full p-1">{children}</div>;
}
