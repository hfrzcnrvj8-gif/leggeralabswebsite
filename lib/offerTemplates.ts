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

export type OfferTemplate = {
  id: string;
  nazwa: string;
  opis: string;
  pozycje: OfferTemplateItem[];
  uwagi: string;
  created_at: string;
  updated_at: string;
};

export function templateTotal(pozycje: OfferTemplateItem[]): number {
  return round2(pozycje.reduce((sum, it) => sum + it.ilosc * it.cena, 0));
}
