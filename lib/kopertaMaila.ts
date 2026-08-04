/**
 * Koperta maila wychodzącego — kto do kogo pisze.
 *
 * Krok 2 planu `docs/PLAN-PO-DRUGIM-PRZEJSCIU.md`, znalezisko **D3**: wszystkie
 * cztery maile z drugiego przejścia zaczynały się „Dzień dobry," i kończyły
 * „Pozdrawiamy, Leggera Labs" — jednoosobowa firma pisała w liczbie mnogiej
 * i bez nazwiska, także pod wezwaniem do zapłaty. Panel przez cały ten czas
 * ZNAŁ obie strony: `clients.osoba_kontaktowa` (albo `leads.osoba_kontaktowa`)
 * i `company_settings.osoba_podpisujaca`.
 *
 * To bezpośredni krewny **A1 z pierwszego przejścia** (`[Twoje imię]` w szkicu
 * maila) — z tą różnicą, że tam brakowało danych w szkicu, a tu dane były,
 * tylko nikt ich nie czytał. Dlatego szablony NIE dostają nowych parametrów
 * „imię" i „podpis" każdy z osobna: dostają jedną kopertę, a ta ma jedno
 * miejsce, w którym wiadomo, jak brzmi powitanie i jak brzmi stopka.
 *
 * ── CZEGO TU ŚWIADOMIE NIE MA ─────────────────────────────────────────────
 * **Formy „Pani/Panie".** Wymagałyby zgadywania płci z imienia — a imię jej
 * nie niesie: trafiłoby czasem, a pomyłka w powitaniu listu do klienta jest
 * gorsza niż jej brak. Zostaje samo imię w wołaczu.
 */

import { type DanePodpisu } from "./documents";

/** Ton stopki. `formalny` idzie pod pisma, które są żądaniem, nie rozmową:
 *  stanowcze przypomnienie o płatności i wezwanie do zapłaty. Decyzja
 *  właściciela 2026-08-04 — „Pozdrawiam" pod wezwaniem brzmi lekko. */
export type TonPodpisu = "zwykly" | "formalny";

export type KopertaMaila = {
  /** Osoba kontaktowa po stronie klienta/leada — `clients.osoba_kontaktowa`.
   *  `null` (albo pusta) zostawia samo „Dzień dobry," bez zmyślania. */
  osoba: string | null;
  /** Kto podpisuje — z „Danych firmy". `null`, gdy `osoba_podpisujaca` jest
   *  pusta; wtedy pod mailem staje sama nazwa firmy. Zgadywanie imienia
   *  z nazwy firmy dałoby podpis, którego nikt nie zatwierdził. */
  podpis: DanePodpisu | null;
  /** Nazwa firmy — `company_settings.nazwa`. */
  firma: string;
};

export const PUSTA_KOPERTA: KopertaMaila = { osoba: null, podpis: null, firma: "" };

/** Tytuły, które ktoś mógł wpisać przed imieniem — przeskakujemy je, żeby nie
 *  wyjść z „Dzień dobry, dr,". Bez kropek i wielkości liter. */
const TYTULY = new Set(["pan", "pani", "panstwo", "państwo", "dr", "mgr", "inz", "inż", "prof", "hab", "ks"]);

/**
 * Imię w wołaczu — tyle, ile da się zrobić uczciwie.
 *
 * Odmieniamy WYŁĄCZNIE imiona kończące się na „-a": Karolina → Karolino,
 * Anna → Anno, Kuba → Kubo. Ta jedna reguła jest w polszczyźnie regularna.
 * Imiona zakończone spółgłoską są nieregularne (Piotr → Piotrze, Marek →
 * Marku, Tomasz → Tomaszu) i nie ma reguły, która by ich nie kaleczyła —
 * dlatego zostają w mianowniku („Dzień dobry, Piotr,"). Lepiej brzmieć
 * odrobinę sztywno niż przekręcić komuś imię w pierwszym zdaniu listu.
 *
 * Zwraca `null`, gdy z pola nie da się wyłuskać czegoś, co wygląda na imię —
 * pole bywa wypełnione adresem e-mail, nazwą działu albo samym tytułem.
 */
export function wolaczImienia(osoba: string | null | undefined): string | null {
  if (!osoba) return null;
  const tokeny = osoba.trim().split(/\s+/).filter(Boolean);
  for (const token of tokeny) {
    const czyste = token.replace(/[.,;]+$/u, "");
    if (TYTULY.has(czyste.toLowerCase())) continue;
    // Same litery (z polskimi znakami), co najmniej trzy — odsiewa „@", cyfry,
    // inicjały („A.") i skróty, które wołaczem tylko by się ośmieszyły.
    if (!/^\p{L}+$/u.test(czyste) || czyste.length < 3) return null;
    return czyste.endsWith("a") || czyste.endsWith("A") ? `${czyste.slice(0, -1)}o` : czyste;
  }
  return null;
}

/** Pierwszy wiersz maila: „Dzień dobry, Karolino," albo „Dzień dobry,". */
export function powitanie(osoba: string | null | undefined): string {
  const imie = wolaczImienia(osoba);
  return imie ? `Dzień dobry, ${imie},` : "Dzień dobry,";
}

/**
 * Stopka jako wiersze: zwrot grzecznościowy, imię i nazwisko, firma, kontakt.
 *
 * Każdy element wypada, gdy panel go nie zna — nigdy nie zostawiamy nawiasu
 * ani wymyślonej wartości. W najgorszym razie zostaje „Pozdrawiam," i nazwa
 * firmy, czyli dokładnie tyle, ile było przed tą zmianą.
 */
export function stopkaMaila(koperta: KopertaMaila, ton: TonPodpisu = "zwykly"): string[] {
  const wiersze: string[] = [ton === "formalny" ? "Z poważaniem," : "Pozdrawiam,"];
  const imie = koperta.podpis?.imie ?? "";
  // Jednoosobowa działalność ma w nazwie firmy imię i nazwisko właściciela
  // („Leggera Labs Patryk Piecyk") — z osobnymi wierszami wychodziło z tego
  // „Patryk Piecyk / Leggera Labs Patryk Piecyk", czyli podpis jąkający się
  // nazwiskiem. Zmierzone na sondzie kroku 2, nie wydedukowane: to jest
  // dokładnie ta nazwa, którą firma będzie miała po rejestracji.
  const firmaZawieraImie = !!imie && !!koperta.firma && koperta.firma.toLowerCase().includes(imie.toLowerCase());
  if (imie && !firmaZawieraImie) wiersze.push(imie);
  if (koperta.firma) wiersze.push(koperta.firma);
  const kontakt = [koperta.podpis?.email, koperta.podpis?.telefon].filter(Boolean).join(" · ");
  if (kontakt) wiersze.push(kontakt);
  return wiersze;
}

/**
 * Cały mail: powitanie, treść, stopka — z pustymi wierszami w odpowiednich
 * miejscach. `tresc` to wiersze BEZ powitania i BEZ podpisu; puste wiersze
 * wewnątrz zostają nietknięte, bo to akapity autora szablonu.
 */
export function zlozMail(koperta: KopertaMaila, ton: TonPodpisu, tresc: string[]): string {
  return [powitanie(koperta.osoba), "", ...tresc, "", ...stopkaMaila(koperta, ton)].join("\n");
}
