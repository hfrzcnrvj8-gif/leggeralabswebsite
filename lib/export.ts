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

/** Domyślny zakres eksportu — bieżący miesiąc (pierwszy dzień do dziś),
 * gdy właściciel nie poda `from`/`to` w query string. */
export function currentMonthRange(today: string): { from: string; to: string } {
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

/** Nazwa pliku do pobrania — np. "faktury_2026-07-01_2026-07-12.csv". */
export function exportFilename(prefix: string, from: string, to: string): string {
  return `${prefix}_${from}_${to}.csv`;
}
