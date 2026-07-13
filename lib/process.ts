// Uzgodniony 12-krokowy proces sprzedaży/realizacji (patrz
// docs/plany-modulow/01-podpowiedzi-leadow.md) — jedna wspólna lista kroków
// używana przez mapowania w lib/leads.ts (LEAD_STATUS_STEP) i lib/clients.ts
// (CLIENT_STATUS_STEP). Czysto informacyjna ściągawka, bez logiki AI/LLM.

export const PROCESS_STEPS = [
  { step: 1, label: "Znalezienie leada" },
  { step: 2, label: "Pierwszy kontakt" },
  { step: 3, label: "Rozmowa kwalifikująca" },
  { step: 4, label: "Oferta (PoC-first)" },
  { step: 5, label: "Negocjacja" },
  { step: 6, label: "Akceptacja" },
  { step: 7, label: "Kickoff/kamienie" },
  { step: 8, label: "Realizacja" },
  { step: 9, label: "Wystawienie faktury" },
  { step: 10, label: "Pilnowanie płatności" },
  { step: 11, label: "Zamknięcie/referencja" },
  { step: 12, label: "Nurture" },
] as const;
