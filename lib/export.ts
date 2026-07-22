// Czysta logika eksportu CSV dla księgowej — bez "use client", re-używana
// przez route'y Faktur i Kosztów (Faza 4 mapy drogowej ERP, patrz pamięć
// comprehensive-audit-plan). Format wzorowany na tym, co przyjmuje polski
// Excel bez dodatkowych ustawień: średnik jako separator kolumn (nie
// przecinek — ten jest już zajęty przez separator dziesiętny), przecinek
// jako separator dziesiętny, BOM UTF-8 na początku pliku (inaczej Excel
// czasem gubi polskie znaki). Świadomie samo CSV, bez JPK_V7 — firma nie
// jest jeszcze zarejestrowana, a JPK to osobna, dużo większa decyzja (patrz
// comprehensive-audit-plan: "tylko jeśli zdecyduje robić sam").

function csvEscape(v: string): string {
  if (/[";\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Kwota jako string z przecinkiem dziesiętnym (polska konwencja Excela). */
export function csvMoney(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

/** Składa wiersze (nagłówek + dane) w gotowy do pobrania plik CSV. */
export function toCsv(rows: string[][]): string {
  return "﻿" + rows.map((row) => row.map(csvEscape).join(";")).join("\r\n") + "\r\n";
}

/** Wiersz „RAZEM" na dole rejestru — etykieta w pierwszej kolumnie, sumy
 * w kolumnach wskazanych indeksem, reszta pusta.
 *
 * `szerokosc` bierz z nagłówka, nie z palca: wiersz krótszy od nagłówka
 * rozjeżdża tabelę w Excelu przy pierwszym sortowaniu.
 *
 * Świadomie BEZ pustego wiersza oddzielającego — rejestr zostaje jednym
 * prostokątem, więc zaznaczenie „od nagłówka w dół" dalej działa. */
export function csvSummaryRow(
  szerokosc: number,
  etykieta: string,
  kwoty: Record<number, number>
): string[] {
  const row = Array<string>(szerokosc).fill("");
  row[0] = etykieta;
  for (const [i, v] of Object.entries(kwoty)) row[Number(i)] = csvMoney(v);
  return row;
}

/** Sumy per waluta, w kolejności pierwszego wystąpienia w rejestrze.
 *
 * Osobny wiersz na walutę, nigdy jeden wspólny: rejestr sprzedaży bywa
 * wielowalutowy (faktury walutowe + VAT-UE są w panelu obsłużone i
 * przetestowane na KSeF), a zsumowanie złotówek z euro dałoby liczbę, która
 * nic nie znaczy — w dokumencie idącym do księgowej. Przy jednej walucie
 * w pliku wychodzi z tego po prostu jeden wiersz i nikt nie zauważy różnicy. */
export function groupByCurrency<T>(
  rows: T[],
  waluta: (r: T) => string
): { waluta: string; wiersze: T[] }[] {
  const grupy = new Map<string, T[]>();
  for (const r of rows) {
    const w = waluta(r) || "PLN";
    (grupy.get(w) ?? grupy.set(w, []).get(w)!).push(r);
  }
  return [...grupy].map(([waluta, wiersze]) => ({ waluta, wiersze }));
}

/** Domyślny zakres eksportu — bieżący miesiąc (pierwszy dzień do dziś),
 * gdy właściciel nie poda `from`/`to` w query string. */
export function currentMonthRange(today: string): { from: string; to: string } {
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

/** Nazwa pliku do pobrania — np. "faktury_2026-07-01_2026-07-12.csv". */
export function exportFilename(prefix: string, from: string, to: string): string {
  return `${prefix}_${from}_${to}.csv`;
}
