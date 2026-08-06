"use client";

import { forwardRef } from "react";
import { IconSearch, IconX } from "@tabler/icons-react";
import { Tooltip } from "./Tooltip";

/**
 * Pole szukania na pasku modułu — JEDNO dla całego panelu (Moduł 59, paczka C).
 *
 * Przed tą paczką ten sam pasek miał trzy kształty: Oferty/Umowy — ikona lupy
 * i pole zaraz po tytule, Leady/Klienci/Projekty/Notatnik — samo pole przy
 * prawej krawędzi, a Faktury, Koszty, Katalog i Przypomnienia nie miały go
 * wcale. Do tego trzy różne podpowiedzi o skrócie („(/)", „   /", brak).
 *
 * Ustalone: **pole stoi zaraz po tożsamości modułu** (tytuł albo zakładki
 * widoku), po lewej — tak samo jak `.searchable` w apce siedzi tuż pod
 * tytułem ekranu. Prawa strona paska należy do akcji („+", filtry, eksport),
 * a szukanie nie jest akcją, tylko sposobem patrzenia na tę samą listę.
 *
 * Zakres szukania idzie w dymek, nie w placeholder: placeholder znika, gdy coś
 * wpiszesz (kategoria 7 listy kontrolnej), a wtedy właśnie najbardziej chce się
 * wiedzieć, czego ta lista szuka.
 */
export const PoleSzukania = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    /** Czego szuka — treść dymka, np. „Szuka w tytule, kliencie i numerze". */
    podpowiedz: string;
    /** Domyślnie rośnie do 280 px. Wąskie paski (Katalog, Przypomnienia) mogą
     *  podać własną szerokość. */
    className?: string;
  }
>(function PoleSzukania({ value, onChange, podpowiedz, className }, ref) {
  return (
    <Tooltip label={podpowiedz}>
      <div className={`ml-3 flex min-w-0 flex-1 items-center gap-1.5 text-muted ${className ?? ""}`}>
        <IconSearch size={13} className="shrink-0" />
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Szukaj… (/)"
          aria-label={podpowiedz}
          // `py-1` daje polu 24 px wysokości zamiast 19 (etap 3, próg WCAG
          // 2.5.8 z CLAUDE.md). Rośnie samo pole, nie tekst — rozmiar czcionki
          // zostaje 12,5 px, więc pasek wygląda tak samo.
          className="min-w-0 max-w-[280px] flex-1 bg-transparent py-1 text-[12.5px] text-[var(--fg)] placeholder:text-muted focus:outline-none"
        />
        {/* Krzyżyk tylko przy wpisanej frazie. Do paczki C miała go jedna
            Poczta — a to jedyna droga wyjścia z zawężonej listy dla kogoś,
            kto nie zna Esc. */}
        {value && (
          <button
            onClick={() => onChange("")}
            aria-label="Wyczyść szukanie"
            className="shrink-0 text-muted hover:text-[var(--fg)]"
          >
            <IconX size={13} />
          </button>
        )}
      </div>
    </Tooltip>
  );
});
