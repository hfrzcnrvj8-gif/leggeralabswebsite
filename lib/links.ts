// Moduł 22 — wspólny słownik powiązań rekordu z CRM.
//
// Przed tym modułem to samo („z kim jest związany ten rekord?") robiły w
// panelu trzy różne mechanizmy: ClientPickerButton (oferty/faktury), własne
// selecty PropTrigger (projekty) i surowy <select> (kalendarz) — a pickera
// leada nie było w ogóle, stąd komplet luk przy `lead_id`. Ten plik to czysta
// logika (bez "use client"), re-używana przez API routes i UI — zgodnie z
// architekturą modułów opisaną w CLAUDE.md.

/** Rodzaj rekordu, z którym można powiązać inny rekord. */
export type LinkKind = "client" | "lead" | "project";

/** Jedna pozycja na liście wyboru w LinkPickerze. */
export type LinkTarget = {
  kind: LinkKind;
  id: string;
  nazwa: string;
  /** Drugi wiersz pozycji — NIP, miasto, status. Sam nie jest przeszukiwany,
   * chyba że autor listy wrzuci to samo do `szukaj`. */
  hint?: string;
  /** Tekst, po którym filtruje wyszukiwarka (nazwa + NIP + miasto + e-mail).
   * Budowany przy tworzeniu listy, żeby nie sklejać go przy każdym wpisanym
   * znaku. */
  szukaj: string;
};

/** Wartość pola powiązania. Klucze odpowiadają 1:1 kolumnom w bazie, więc
 * obiekt idzie prosto do `fetch(..., { body: JSON.stringify(value) })`. */
export type LinkValue = {
  client_id?: string | null;
  lead_id?: string | null;
  project_id?: string | null;
};

const COLUMN: Record<LinkKind, keyof LinkValue> = {
  client: "client_id",
  lead: "lead_id",
  project: "project_id",
};

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  client: "Klient",
  lead: "Lead",
  project: "Projekt",
};

/** Nagłówki sekcji w pickerze. Osobna mapa, bo polska liczba mnoga nie da się
 * skleić regułą („Klient" → „Klienci", nie „Klienty"). */
export const LINK_KIND_LABEL_PLURAL: Record<LinkKind, string> = {
  client: "Klienci",
  lead: "Leady",
  project: "Projekty",
};

/** Emoji zamiast ikon — świadoma decyzja projektu (CLAUDE.md). */
export const LINK_KIND_EMOJI: Record<LinkKind, string> = {
  client: "🤝",
  lead: "🎯",
  project: "📁",
};

/** Buduje `LinkValue` dla wyboru `picked` spośród pól `kinds`.
 *
 * Relacja jest WYŁĄCZNA w obrębie `kinds` — wybór klienta czyści leada i
 * odwrotnie (decyzja właściciela 2026-07-16; tak od początku zachowywał się
 * PATCH /api/mail/[id]). Dzięki temu jedno pole „Powiązanie" w UI odpowiada
 * jednej odpowiedzi na pytanie „czyj to rekord", zamiast dwóch pól, z których
 * drugie prawie zawsze zostaje puste.
 *
 * `picked === null` czyści wszystkie pola z `kinds` („— brak —").
 *
 * Uwaga: to reguła dla RĘCZNEGO wyboru. Automatyczne dziedziczenie przy
 * akceptacji oferty (lib/offerAccept.ts) świadomie ustawia `lead_id` i
 * `client_id` naraz — tam oba pola to ślad pochodzenia rekordu, nie wybór.
 */
export function linkValueFor(kinds: LinkKind[], picked: LinkTarget | null): LinkValue {
  const value: LinkValue = {};
  for (const kind of kinds) value[COLUMN[kind]] = null;
  if (picked && kinds.includes(picked.kind)) value[COLUMN[picked.kind]] = picked.id;
  return value;
}

/** Odwrotność `linkValueFor` — który z targetów jest dziś wybrany.
 *
 * Kolejność `kinds` jest kolejnością pierwszeństwa: przy rekordzie mającym
 * ustawione i `client_id`, i `lead_id` (np. projekt z zaakceptowanej oferty)
 * wygrywa ten wcześniejszy. Wołający podaje `["client", "lead"]`, bo klient to
 * aktualniejsza relacja niż lead, z którego powstał — ta sama zasada co w
 * findContactsByEmail() (lib/contactLookup.ts).
 */
export function pickedTarget(kinds: LinkKind[], value: LinkValue, targets: LinkTarget[]): LinkTarget | null {
  for (const kind of kinds) {
    const id = value[COLUMN[kind]];
    if (!id) continue;
    const found = targets.find((t) => t.kind === kind && t.id === id);
    // Rekord skasowany albo lista jeszcze się nie wczytała — pokaż, że
    // powiązanie JEST, zamiast udawać "— brak —" i skusić do nadpisania.
    return found ?? { kind, id, nazwa: "(usunięty rekord)", szukaj: "" };
  }
  return null;
}
