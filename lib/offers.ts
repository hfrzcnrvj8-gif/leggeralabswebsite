// Czysta logika modułu Ofert — bez "use client", re-używana przez UI i
// serwerowe route'y. Wzorowane na lib/invoices.ts: lead → oferta (pozycje,
// kwota, ważność) → akceptacja tworzy projekt (z szablonu) + fakturę.
// Świadomie bez VAT na pozycjach — oferta to kwota netto/ogólna, VAT
// pojawia się dopiero na fakturze po akceptacji.

export type OfferStatus = "Szkic" | "Wysłana" | "Zaakceptowana" | "Odrzucona" | "Wygasła";
export const OFFER_STATUSES: OfferStatus[] = ["Szkic", "Wysłana", "Zaakceptowana", "Odrzucona", "Wygasła"];

export const OFFER_STATUS_CLASS: Record<string, string> = {
  Szkic: "bg-[var(--hairline)] text-muted",
  Wysłana: "bg-brand-cyan/15 text-brand-cyan",
  Zaakceptowana: "bg-emerald-500/20 text-emerald-400 font-semibold",
  Odrzucona: "bg-red-500/15 text-red-400",
  Wygasła: "bg-[var(--hairline)] text-muted opacity-70",
};

export type OfferItem = {
  id: string;
  offer_id: string;
  nazwa: string;
  ilosc: number;
  jednostka: string;
  cena: number;
  position: number;
};

export type Offer = {
  id: string;
  tytul: string;
  lead_id: string | null;
  project_id: string | null;
  invoice_id: string | null;
  klient_nazwa: string;
  klient_nip: string;
  klient_adres: string;
  wazna_do: string | null;
  status: OfferStatus;
  uwagi: string;
  created_at: string;
  updated_at: string;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function itemKwota(it: { ilosc: number; cena: number }): number {
  return round2(it.ilosc * it.cena);
}

/** Suma kwoty oferty (bez VAT — patrz komentarz na górze pliku). */
export function offerTotal(items: { ilosc: number; cena: number }[]): number {
  return round2(items.reduce((sum, it) => sum + itemKwota(it), 0));
}

const CLOSED_OFFER_STATUSES = new Set<string>(["Zaakceptowana", "Odrzucona", "Wygasła"]);

/** Czy oferta przeterminowała się (minęła ważność, a status wciąż otwarty). */
export function isOfferExpired(offer: Pick<Offer, "status" | "wazna_do">): boolean {
  if (CLOSED_OFFER_STATUSES.has(offer.status)) return false;
  if (!offer.wazna_do) return false;
  const today = new Date().toISOString().slice(0, 10);
  return offer.wazna_do < today;
}
