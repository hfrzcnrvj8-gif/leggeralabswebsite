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
