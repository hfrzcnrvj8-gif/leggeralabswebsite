// Czysta logika modułu Ofert — bez "use client", re-używana przez UI i
// serwerowe route'y. Wzorowane na lib/invoices.ts: lead → oferta (pozycje,
// kwota, ważność) → akceptacja tworzy projekt (z szablonu) + fakturę.
// Świadomie bez VAT na pozycjach — oferta to kwota netto/ogólna, VAT
// pojawia się dopiero na fakturze po akceptacji.

import { type DocLang, DOC_LANGS, DOC_LANG_LABEL, clientAddressLines as sharedClientAddressLines } from "./documents";
import { todayLocalISO } from "./dates";
import { round2 } from "./invoices";

/** Język wydruku oferty — jak w fakturach (lib/invoices.ts), niezależny od
 * języka panelu. Typ i lista dzielone przez lib/documents.ts. */
export type OfferLang = DocLang;
export const OFFER_LANGS = DOC_LANGS;
export const OFFER_LANG_LABEL = DOC_LANG_LABEL;

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
  /** Podpięty klient (patrz lib/clients.ts) — ustawiany automatycznie przy
   * tworzeniu pierwszej oferty dla leada. */
  client_id: string | null;
  project_id: string | null;
  invoice_id: string | null;
  klient_nazwa: string;
  klient_nip: string;
  /** @deprecated jedno pole adresowe sprzed rozbicia na ulicę/kod/miasto/kraj
   * — trzymane tylko dla wstecznej zgodności ze starszymi ofertami (fallback
   * w wydruku, gdy pola strukturalne są puste). Nowe oferty go nie używają. */
  klient_adres: string;
  klient_ulica: string;
  klient_kod: string;
  klient_miasto: string;
  klient_kraj: string;
  klient_email: string;
  share_token: string | null;
  /** Moduł 40 — ręczne unieważnienie publicznego linku. Token ZOSTAJE
   * w wierszu (patrz lib/shareLinks.ts); to pole decyduje o dostępie. */
  share_revoked_at: string | null;
  wazna_do: string | null;
  status: OfferStatus;
  jezyk: OfferLang;
  uwagi: string;
  /** E-podpis akceptacji (Faza I) — patrz lib/offerAccept.ts. Puste
   * accepted_by_name = zaakceptowano ręcznie w panelu, nie przez klienta. */
  accepted_at: string | null;
  accepted_by_name: string | null;
  accepted_ip: string | null;
  accepted_user_agent: string | null;
  created_at: string;
  updated_at: string;
};

export function itemKwota(it: { ilosc: number; cena: number }): number {
  return round2(it.ilosc * it.cena);
}

/** Suma kwoty oferty (bez VAT — patrz komentarz na górze pliku). */
export function offerTotal(items: { ilosc: number; cena: number }[]): number {
  return round2(items.reduce((sum, it) => sum + itemKwota(it), 0));
}

/** Statusy zamknięte — oferta w jednym z nich nie jest już "w grze" (ani do
 * licznika przeterminowania, ani do pipeline'u). Eksportowane, żeby
 * app/api/hub/today/route.ts nie trzymał własnej zduplikowanej kopii. */
export const CLOSED_OFFER_STATUSES = new Set<OfferStatus>(["Zaakceptowana", "Odrzucona", "Wygasła"]);

/** Czy oferta przeterminowała się (minęła ważność, a status wciąż otwarty). */
export function isOfferExpired(offer: Pick<Offer, "status" | "wazna_do">): boolean {
  if (CLOSED_OFFER_STATUSES.has(offer.status)) return false;
  if (!offer.wazna_do) return false;
  return offer.wazna_do < todayLocalISO();
}

/** Szacunkowe prawdopodobieństwo zamknięcia wg statusu — do ważonego
 * pipeline'u. Świadomie statyczne (bez AI/danych historycznych, panel
 * dopiero startuje) — łatwo skorygować tu jedną liczbę, gdy będzie więcej
 * danych o realnej konwersji. Zamknięte statusy nie mają wpisu — nie
 * wchodzą do pipeline'u w ogóle (patrz weightedOfferValue). */
export const OFFER_STATUS_WEIGHT: Partial<Record<OfferStatus, number>> = {
  Szkic: 0.2,
  Wysłana: 0.5,
};

/** Wartość oferty do ważonego pipeline'u: 0 dla zamkniętych, kwota × waga
 * statusu dla otwartych (domyślnie waga 1, gdyby pojawił się status bez
 * wpisu w mapie — bezpieczny fallback zamiast cichego zera). `kwota` nie
 * jest polem `Offer` (liczona w SQL z JOIN na offer_items), stąd osobny
 * parametr zamiast Pick<Offer, ...>. */
export function weightedOfferValue(status: OfferStatus, kwota: number): number {
  if (CLOSED_OFFER_STATUSES.has(status)) return 0;
  return kwota * (OFFER_STATUS_WEIGHT[status] ?? 1);
}

/** Adres klienta jako linie do wydruku (patrz lib/documents.ts). */
export function clientAddressLines(
  offer: Pick<Offer, "klient_ulica" | "klient_kod" | "klient_miasto" | "klient_kraj" | "klient_adres">
): string[] {
  return sharedClientAddressLines(offer);
}

/** Referencja oferty do wydruku (np. "OF-2026-A1B2C3") — oferty nie mają
 * formalnej numeracji fiskalnej jak faktury (nie podlegają przepisom o
 * numeracji VAT), więc wystarczy stabilny identyfikator liczony z daty
 * utworzenia i ID, bez osobnej kolumny/migracji w bazie. */
export function offerReference(offer: Pick<Offer, "id" | "created_at">): string {
  const year = new Date(offer.created_at).getFullYear();
  return `OF-${year}-${offer.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
