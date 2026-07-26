// Szablony ofert (Moduł 20) — gotowe szkielety pozycji + domyślne uwagi do
// wstawienia jako punkt startowy nowej oferty. Pozycje trzymane jako JSONB
// "odbitka" na wzór lib/recurring.ts — bez cyklicznego generowania, tylko
// kopiowane przy "wstaw z szablonu" (patrz app/api/offers/[id]/apply-template).
// Po wstawieniu wszystko jest w pełni edytowalne — szablon to tylko punkt
// startowy, nie sztywny wzór.

import { round2 } from "./invoices";

export type OfferTemplateItem = {
  nazwa: string;
  ilosc: number;
  jednostka: string;
  cena: number;
};

/** Blok treści w szablonie — kopiowany do oferty przy „Wstaw z szablonu",
 * tak samo jak pozycje (runda 2 Modułu 57). */
export type OfferTemplateSection = {
  tytul: string;
  tresc: string;
};

export type OfferTemplate = {
  id: string;
  nazwa: string;
  opis: string;
  pozycje: OfferTemplateItem[];
  sekcje: OfferTemplateSection[];
  uwagi: string;
  created_at: string;
  updated_at: string;
};

/** Pola scalane w treści szablonu — podstawiane RAZ, przy wstawianiu do
 * oferty (runda 3). Świadomie zwykłe podstawienie tekstu, nie „silnik
 * szablonów": zmienne są cztery, a wynik ma zostać zwykłym tekstem, który da
 * się dowolnie poprawić.
 *
 * Nieznane pole zostaje w treści jako `{{cos}}` — widać wtedy literówkę,
 * zamiast po cichu wstawiać pustkę w ofercie idącej do klienta. */
export const POLA_SCALANE = ["klient", "kwota", "wazna_do", "dzis"] as const;

export function podstawPola(
  tekst: string,
  wartosci: { klient: string; kwota: string; wazna_do: string; dzis: string }
): string {
  return tekst.replace(/\{\{\s*(klient|kwota|wazna_do|dzis)\s*\}\}/g, (_m, klucz: string) => {
    const v = wartosci[klucz as keyof typeof wartosci];
    return v ? v : "";
  });
}

export function templateTotal(pozycje: OfferTemplateItem[]): number {
  return round2(pozycje.reduce((sum, it) => sum + it.ilosc * it.cena, 0));
}
