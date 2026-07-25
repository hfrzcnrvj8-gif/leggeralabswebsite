// Zaczepka do pierwszego kontaktu (Moduł 52, decyzja właściciela 4) — prompt
// do lokalnego modelu tekstowego.
//
// **Gdzie kończy się rola modelu.** Sito jest w 100% deterministyczne
// (`lib/leadHunter.ts`) — model NIE ma wpływu na to, kto wchodzi do skrzynki,
// i nie jest wołany dla kandydatów, których właściciel odrzucił. Uruchamia się
// dopiero PO przyjęciu kandydata, na jawne kliknięcie, i proponuje jedno
// zdanie do notatki leada, które właściciel zatwierdza albo wyrzuca. Ten sam
// kształt co Moduły 7/8/48–50 (patrz CLAUDE.md → „Świadome decyzje
// produktowe").

import type { Sygnal } from "./leadHunter";

/** Ten sam model tekstowy co szkice odpowiedzi (Moduł 7), podsumowania wątku
 * (49) i szkice notatek (50) — jedno zdanie polskiej prozy, funkcja klikana
 * pojedynczo, nie w pętli. */
export const HOOK_MODEL = "qwen3.6:27b";

export const HOOK_SYSTEM = `Jesteś asystentem Patryka, który prowadzi Leggera Labs — jednoosobową agencję wdrażającą automatyzacje i lokalne modele AI dla małych firm w Polsce.

Twoje zadanie: napisz PO POLSKU JEDNO zdanie — konkretną zaczepkę do pierwszego kontaktu z podaną firmą. Zdanie ma nazywać rzecz, którą u NIEJ da się zautomatyzować.

Zasady:
- JEDNO zdanie, maksymalnie ~30 słów. Bez powitania, bez podpisu, bez markdown.
- Opieraj się WYŁĄCZNIE na tym, co jest w dostarczonych danych (branża, treść strony). NIGDY nie zmyślaj nazwisk, liczb, klientów ani faktów o firmie.
- Konkret zamiast ogólników: „umawianie wizyt i przypomnienia SMS" jest dobre, „usprawnienie procesów biznesowych" jest bezwartościowe.
- Nie obiecuj oszczędności w procentach ani złotówkach — tego nie wiesz.
- Nie zaczynaj od „Cześć" ani „Dzień dobry" — to fragment do wklejenia w środek maila, nie cały mail.
- To tylko PROPOZYCJA, którą człowiek przeczyta i poprawi przed użyciem.`;

export type HookInput = {
  nazwa: string;
  branza: string;
  miasto: string;
  /** Sygnały z sita — mówią modelowi, co o tej firmie faktycznie wiemy
   * (formularz, cennik, wiek), zamiast kazać mu zgadywać. */
  sygnaly: Sygnal[];
  /** Tekst ze strony głównej, już oczyszczony ze znaczników i przycięty. */
  tekstStrony: string;
};

/** Buduje prompt. Cały kontekst zbiera kod — model nie grzebie sam w bazie
 * ani w internecie (ta sama zasada co w `lib/note-draft.ts`). */
export function buildHookPrompt(k: HookInput): string {
  const czesci: string[] = [];
  czesci.push(`Firma: ${k.nazwa}${k.branza ? ` (${k.branza})` : ""}${k.miasto ? `, ${k.miasto}` : ""}.`);
  const dodatnie = k.sygnaly.filter((s) => s.punkty > 0).map((s) => s.opis);
  if (dodatnie.length) czesci.push(`Co o niej wiemy: ${dodatnie.join("; ")}.`);
  if (k.tekstStrony.trim()) {
    czesci.push(`Fragment jej strony internetowej:\n${k.tekstStrony.trim()}`);
  } else {
    czesci.push("Strony internetowej nie udało się przeczytać — oprzyj się na branży.");
  }
  czesci.push("Napisz jedno zdanie zaczepki zgodnie z instrukcją systemową.");
  return czesci.join("\n\n");
}

/** Sprząta odpowiedź modelu — ten sam wzorzec co `cleanNoteDraftText()`.
 * Dodatkowo ucina wszystko po pierwszym zdaniu: model bywa rozmowny, a
 * kontrakt tej funkcji brzmi „jedno zdanie". */
export function cleanHookText(raw: string): string {
  let t = raw.trim().replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1).trim();
  // Kropka kończąca zdanie — ale nie ta w skrócie („np.", „m.in.") ani
  // w liczbie. Wymagamy spacji i wielkiej litery po niej.
  // `[\s\S]` zamiast flagi `s` — cel kompilacji tego projektu jest niższy niż
  // ES2018 i `tsc` odrzuca `dotAll` (złapane typecheckiem, nie w przeglądarce).
  const m = /^([\s\S]+?[.!?])(\s+[A-ZŁŚŻŹĆĄĘÓŃ])/.exec(t);
  return (m ? m[1] : t).trim();
}

/** Zamienia HTML strony na goły tekst na potrzeby promptu. Prymitywnie i
 * świadomie: model dostaje kilka tysięcy znaków treści, a nie drzewo DOM —
 * pełny parser byłby kolejną zależnością do pilnowania za zerowy zysk. */
export function tekstZeStrony(html: string, limit = 3000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}
