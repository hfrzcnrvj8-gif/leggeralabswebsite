// Wyszukiwanie kontrahenta po NIP w "Białej liście podatników VAT"
// Ministerstwa Finansów — publiczne, bezpłatne, bez klucza API. Używane do
// autouzupełniania danych nabywcy/odbiorcy na fakturze/ofercie zamiast
// ręcznego przepisywania. Bez "use client" — tylko server-side.

import { todayLocalISO } from "./dates";

export type MfSubject = {
  nazwa: string;
  ulica: string;
  kod: string;
  miasto: string;
  statusVat: string | null;
  /** Numery rachunków rozliczeniowych zarejestrowane do tego NIP-u w Białej
   * Liście (Moduł 9, fundamenty zgodności) — do porównania z ręcznie
   * wpisanym numerem konta dostawcy. Przelew >15 000 zł na konto SPOZA tej
   * listy grozi utratą prawa do zaliczenia wydatku w koszty (bez zgłoszenia
   * ZAW-NR w 7 dni). Puste = MF nie zwróciło żadnego numeru dla tego NIP-u. */
  numeryKont: string[];
};

/** Rozbija jednolinijkowy adres z Białej Listy ("ul. Testowa 1, 00-001
 * Warszawa") na ulicę / kod pocztowy / miasto — najlepszy możliwy podział
 * bez dalszej struktury w odpowiedzi API. */
function splitAddress(address: string): { ulica: string; kod: string; miasto: string } {
  const m = /^(.*?),?\s*(\d{2}-\d{3})\s+(.+)$/.exec(address.trim());
  if (m) return { ulica: m[1].replace(/,$/, "").trim(), kod: m[2], miasto: m[3].trim() };
  return { ulica: address.trim(), kod: "", miasto: "" };
}

/** Szuka podmiotu po NIP w Białej Liście MF na dzień dzisiejszy. Zwraca
 * `null` gdy nie znaleziono lub API nie odpowiedziało (nie rzuca — to
 * pomocniczy autofill, brak wyniku nie powinien blokować edycji faktury). */
export async function lookupNip(nip: string): Promise<MfSubject | null> {
  const cleanNip = nip.replace(/\D/g, "");
  if (cleanNip.length !== 10) return null;
  const today = todayLocalISO();
  try {
    const res = await fetch(`https://wl-api.mf.gov.pl/api/search/nip/${cleanNip}?date=${today}`, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: {
        subject?: {
          name?: string;
          workingAddress?: string;
          residenceAddress?: string;
          statusVat?: string;
          accountNumbers?: string[];
        } | null;
      };
    };
    const subject = data.result?.subject;
    if (!subject || !subject.name) return null;
    const address = subject.workingAddress || subject.residenceAddress || "";
    const { ulica, kod, miasto } = splitAddress(address);
    return {
      nazwa: subject.name,
      ulica,
      kod,
      miasto,
      statusVat: subject.statusVat ?? null,
      numeryKont: Array.isArray(subject.accountNumbers) ? subject.accountNumbers : [],
    };
  } catch {
    return null;
  }
}
