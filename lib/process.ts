// Uzgodniony 15-krokowy proces sprzedaży/realizacji (patrz
// docs/plany-modulow/01-podpowiedzi-leadow.md, aktualizacja: Moduł 32) —
// jedna wspólna lista kroków używana przez mapowania w lib/leads.ts
// (LEAD_STATUS_STEP) i lib/clients.ts (CLIENT_STATUS_STEP). Czysto
// informacyjna ściągawka, bez logiki AI/LLM.
//
// Do Modułu 32 lista miała 12 kroków i szła "Akceptacja → Kickoff", czyli
// opisywała panel sprzed Modułów 11-17: nie znała Umowy (Moduł 11),
// Onboardingu (14) ani Wsparcia (16), mimo że "Umowy" są w menu.
// Decyzja właściciela 2026-07-17: dołożyć te trzy kroki. NDA (też Moduł 11)
// świadomie NIE jest osobnym krokiem — jest opcjonalne i dotyczy tylko
// części rozmów, więc mieszka w treści podpowiedzi przy statusie "Rozmowa
// umówiona" (LEAD_STATUS_HINT), gdzie i tak stoi przycisk wysyłki.
export const PROCESS_STEPS = [
  { step: 1, label: "Znalezienie leada" },
  { step: 2, label: "Pierwszy kontakt" },
  { step: 3, label: "Rozmowa kwalifikująca" },
  { step: 4, label: "Oferta (PoC-first)" },
  { step: 5, label: "Negocjacja" },
  { step: 6, label: "Akceptacja" },
  { step: 7, label: "Umowa" },
  { step: 8, label: "Onboarding" },
  { step: 9, label: "Kickoff/kamienie" },
  { step: 10, label: "Realizacja" },
  { step: 11, label: "Wystawienie faktury" },
  { step: 12, label: "Pilnowanie płatności" },
  { step: 13, label: "Zamknięcie/opinia" },
  { step: 14, label: "Wsparcie" },
  { step: 15, label: "Nurture" },
] as const;

/**
 * Moduł panelu, w którym dany krok się faktycznie ODBYWA — po to, żeby mapa
 * procesu prowadziła gdziekolwiek.
 *
 * Do 2026-08-04 piętnaście kroków było wyłącznie napisami: mapa mówiła
 * „Oferta (PoC-first)" i nie dawało się z niej przejść do Ofert (znalezisko F
 * z pierwszego przejścia). Ściągawka, z której nie da się ruszyć dalej, każe
 * szukać modułu ręcznie w menu — czyli robi dokładnie odwrotnie, niż obiecuje.
 *
 * To jest MAPOWANIE NA MODUŁ, nie na rekord. Krok „Umowa" prowadzi do listy
 * umów, a nie do umowy tego konkretnego leada — bo na etapie, na którym mapa
 * jest pomocna, ta umowa zwykle jeszcze nie istnieje.
 */
export const PROCESS_STEP_MODULE: Record<number, string> = {
  1: "leads",
  2: "leads",
  3: "leads",
  4: "offers",
  5: "offers",
  6: "offers",
  7: "contracts",
  8: "projects",
  9: "projects",
  10: "projects",
  11: "invoices",
  12: "invoices",
  13: "projects",
  14: "clients",
  15: "clients",
};
