// Nadzór nad kopiami zapasowymi bazy (2026-07-20).
//
// Czysta logika, bez bazy i bez Reacta — żeby tę samą regułę mogły policzyć
// panel, trasa API i (docelowo) apka. Ten sam podział co lib/mail.ts wobec
// lib/mailbox.ts.
//
// Zero AI: „czy kopie są w porządku" wynika wyłącznie z daty ostatniego
// udanego przebiegu i tego, czy ostatni przebieg się powiódł.

import { parsePgTimestamp } from "./dates";

/** Jeden przebieg kopii, tak jak melduje go skrypt z NAS-a. */
export type BackupRun = {
  id: string;
  ok: boolean;
  host: string;
  powod: string;
  tabel: number | null;
  rozmiar_bajtow: number | null;
  trwalo_sekund: number | null;
  created_at: string;
};

/** Po ilu godzinach bez UDANEJ kopii uznajemy, że coś jest nie tak.
 *
 * 36, nie 24: kopia leci raz na dobę, więc przy progu 24 h każde drobne
 * przesunięcie (restart NAS-a, dłuższy zrzut) dawałoby fałszywy alarm.
 * Fałszywe alarmy uczą ignorowania ostrzeżeń — a to ostrzeżenie musi
 * działać wtedy, gdy naprawdę zapali się raz na rok. */
export const BACKUP_STALE_HOURS = 36;

export type BackupStan =
  /** Nigdy nie przyszedł żaden meldunek — kopie nie są jeszcze uruchomione. */
  | { stan: "brak"; opis: string }
  /** Ostatnia udana kopia jest świeża i ostatni przebieg się powiódł. */
  | { stan: "ok"; opis: string; ostatniaUdana: BackupRun }
  /** Ostatni przebieg SIĘ NIE UDAŁ — mamy konkretny powód do pokazania. */
  | { stan: "blad"; opis: string; powod: string; ostatniaUdana: BackupRun | null }
  /** Nic nie padło, ale od ostatniej udanej kopii minęło za dużo czasu —
   *  czyli skrypt prawdopodobnie w ogóle nie chodzi (kontener stoi, NAS
   *  wyłączony). To osobny przypadek od „błędu", bo nie ma czego zacytować. */
  | { stan: "przestarzale"; opis: string; ostatniaUdana: BackupRun | null };

function godzinTemu(iso: string, teraz: Date): number {
  // parsePgTimestamp, NIE `new Date()` — Postgres zwraca „2026-07-20
  // 08:55:44.709+01" (spacja, strefa bez dwukropka), czego JS nie zjada.
  // Złapane 2026-07-20: Pulpit ogłosił „kopie przestarzałe, Infinity dni
  // temu" sekundę po udanej kopii. Patrz komentarz przy parsePgTimestamp.
  const d = parsePgTimestamp(iso);
  if (!d) return Number.POSITIVE_INFINITY;
  return (teraz.getTime() - d.getTime()) / 3_600_000;
}

export function opisWieku(godzin: number): string {
  if (godzin < 1) return "przed chwilą";
  if (godzin < 24) return `${Math.floor(godzin)} godz. temu`;
  const dni = Math.floor(godzin / 24);
  return dni === 1 ? "wczoraj" : `${dni} dni temu`;
}

/**
 * Ocenia stan kopii na podstawie historii przebiegów (najnowszy pierwszy).
 *
 * **Kolejność warunków jest tu regułą, nie stylem.** Nieudany OSTATNI przebieg
 * bije wszystko inne, nawet gdy wczorajsza kopia się udała: to znaczy, że coś
 * właśnie się zepsuło i jutro kopii już nie będzie. Odwrotna kolejność
 * („mamy świeżą kopię, więc OK") ukryłaby awarię na całą dobę.
 */
export function ocenKopie(runs: BackupRun[], teraz: Date = new Date()): BackupStan {
  if (runs.length === 0) {
    return {
      stan: "brak",
      opis: "Kopie zapasowe bazy nie są jeszcze uruchomione.",
    };
  }

  const ostatni = runs[0];
  const ostatniaUdana = runs.find((r) => r.ok) ?? null;

  if (!ostatni.ok) {
    return {
      stan: "blad",
      opis: ostatniaUdana
        ? `Ostatnia kopia się nie udała. Poprzednia udana: ${opisWieku(godzinTemu(ostatniaUdana.created_at, teraz))}.`
        : "Kopia się nie udała i nie ma żadnej wcześniejszej udanej.",
      // Powód idzie WPROST do właściciela. Nie jest programistą i nie będzie
      // czytał logów kontenera na NAS-ie — jeśli komunikat nie dojedzie tutaj,
      // to praktycznie nie istnieje.
      powod: ostatni.powod || "Skrypt nie podał powodu — sprawdź log kontenera na NAS-ie.",
      ostatniaUdana,
    };
  }

  const wiek = godzinTemu(ostatniaUdana!.created_at, teraz);
  if (wiek > BACKUP_STALE_HOURS) {
    return {
      stan: "przestarzale",
      opis: `Ostatnia udana kopia: ${opisWieku(wiek)}. Sprawdź, czy kontener na NAS-ie chodzi.`,
      ostatniaUdana,
    };
  }

  return {
    stan: "ok",
    opis: `Ostatnia kopia: ${opisWieku(wiek)} (${ostatniaUdana!.host || "nieznana maszyna"}).`,
    ostatniaUdana: ostatniaUdana!,
  };
}

/** Czy stan wymaga uwagi właściciela — czyli czy pokazać go na Pulpicie.
 * Gdy jest dobrze, Pulpit MILCZY: to ekran „co wymaga działania", a nie
 * tablica kontrolna. Kolejny zielony wskaźnik uczy przewijania. */
export function kopieWymagajaUwagi(stan: BackupStan): boolean {
  return stan.stan !== "ok";
}
