// Czysta logika modułu Klienci — bez "use client". Wzorowane 1:1 na
// lib/leads.ts (ten sam kształt: status, log aktywności, przypomnienia).
//
// Klient to nie to samo co Lead: Lead = ktoś nieznany, kogo dopiero
// kwalifikujesz. Klient = ktoś, z kim realnie zaczęła się rozmowa i jest
// szansa coś dla niego stworzyć/sprzedać, teraz albo w przyszłości — od tego
// momentu chcesz mieć jedną, chronologiczną historię kontaktu. Rekord
// Klienta powstaje albo automatycznie (pierwsza Oferta utworzona dla leada),
// albo ręcznie (przycisk "Utwórz klienta" na leadzie, gdy rozmowa już trwa,
// zanim jest oferta). Patrz lib/db.ts ensureClientsSchema.

import { todayLocalISO } from "./dates";

export type Client = {
  id: string;
  nazwa: string;
  nip: string;
  ulica: string;
  kod: string;
  miasto: string;
  kraj: string;
  email: string;
  telefon: string;
  www: string;
  /** Link do profilu LinkedIn — osobne pole, patrz lib/contact.ts linkedinLink(). */
  linkedin_url: string;
  branza: string;
  status: ClientStatus;
  ostatni_kontakt: string | null;
  next_followup: string | null;
  /** Tekstowy "następny krok" obok next_followup — PO CO jest przypomnienie. */
  next_action: string;
  /** Kanał ostatniego wpisu na osi (denormalizacja z client_activity.kanal) —
   * do ikony na karcie kanban bez dociągania całej historii. */
  ostatni_kanal: string | null;
  notatki: string;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientActivity = {
  id: string;
  client_id: string;
  text: string;
  /** Kanał tego wpisu (CONTACT_CHANNELS w lib/contact.ts) — null gdy
   * nieokreślony (wpisy sprzed Modułu 3). */
  kanal: string | null;
  /** Kierunek: kto zainicjował ten kontakt (CONTACT_DIRECTIONS). */
  kierunek: string | null;
  created_at: string;
};

/** Zdarzenia systemowe zapisywane automatycznie przez routes (patrz
 * lib/db.ts logClientEvent) — zaraz po realnej akcji, więc `created_at` to
 * prawdziwy moment jej wystąpienia, nie odgadnięty później z `updated_at`. */
export const CLIENT_EVENT_KINDS = [
  "client_created",
  "offer_created",
  "offer_sent",
  "offer_accepted",
  "invoice_issued",
  "invoice_sent",
  "invoice_reminder",
  "payment_received",
  "invoice_paid",
  "project_status_changed",
  "nurture_scheduled",
] as const;
export type ClientEventKind = (typeof CLIENT_EVENT_KINDS)[number];

export type ClientEvent = {
  id: string;
  client_id: string;
  kind: ClientEventKind | string;
  text: string;
  amount: number | null;
  created_at: string;
};

export const CLIENT_EVENT_ICON: Record<string, string> = {
  client_created: "🤝",
  offer_created: "📝",
  offer_sent: "📤",
  offer_accepted: "✅",
  invoice_issued: "🧾",
  invoice_sent: "📤",
  invoice_reminder: "🔔",
  payment_received: "💰",
  invoice_paid: "✅",
  project_status_changed: "📁",
  nurture_scheduled: "📅",
};

/** Status relacji — świadomie OSOBNA oś od tego, czy klient coś już kupił
 * (to widać po powiązanych ofertach/fakturach). Ten sam wzorzec co "zdrowie"
 * projektu vs jego status na tablicy. */
export const CLIENT_STATUSES = ["Prospekt", "Aktywny", "Uśpiony", "Stracony"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_CLASS: Record<ClientStatus, string> = {
  Prospekt: "bg-brand-cyan/15 text-brand-cyan",
  Aktywny: "bg-emerald-500/15 text-emerald-400 font-semibold",
  Uśpiony: "bg-[var(--hairline)] text-muted",
  Stracony: "bg-[var(--hairline)] text-muted opacity-70",
};

export const CLIENT_STATUS_DOT: Record<ClientStatus, string> = {
  Prospekt: "bg-brand-cyan",
  Aktywny: "bg-emerald-500",
  Uśpiony: "bg-[var(--fg-muted)]",
  Stracony: "bg-[var(--fg-muted)]",
};

/** Miękkie, statyczne podpowiedzi "co zwykle dalej" per status — mentor
 * bez LLM (zgodne z istniejącą zasadą "brak AI w logice przypominacza").
 * Czysto informacyjne, nigdy nie blokują żadnej akcji. */
export const CLIENT_STATUS_HINT: Record<ClientStatus, string> = {
  Prospekt: "Rozmowa w toku — umów kolejny kontakt albo przygotuj ofertę, gdy widzisz konkretną potrzebę.",
  Aktywny: "Ma otwartą ofertę/projekt/fakturę — pilnuj terminów, nie zostawiaj bez odpowiedzi dłużej niż kilka dni.",
  Uśpiony: "Cisza od jakiegoś czasu — ustaw przypomnienie, żeby wrócić z nową propozycją zamiast zapomnieć o kliencie.",
  Stracony: "Odrzucił lub nieaktualne — warto zanotować dlaczego, przyda się przy następnej okazji.",
};

/** Mapowanie statusu klienta na krok uzgodnionego 12-krokowego procesu
 * (lib/process.ts) — status klienta to relacyjna oś (Prospekt/Aktywny/...),
 * nie proces krok po kroku, więc to przybliżenie: "Uśpiony"/"Stracony" oba
 * ląduje na kroku Nurture, bo w obu przypadkach właściwa akcja to ustawić
 * przypomnienie na później, zgodnie z CLIENT_STATUS_HINT powyżej. */
export const CLIENT_STATUS_STEP: Record<ClientStatus, number> = {
  Prospekt: 3,
  Aktywny: 8,
  Uśpiony: 12,
  Stracony: 12,
};

/** Jeden zaplanowany kontakt nurture (harmonogram, `client_followups`) —
 * `done_at` puste = jeszcze do zrobienia. Patrz NURTURE_OFFSETS. */
export type ClientFollowup = {
  id: string;
  client_id: string;
  project_id: string | null;
  due_date: string;
  powod: string;
  created_at: string;
  done_at: string | null;
};

/** Rytm automatycznego nurture po "Wdrożone" — DWA dotknięcia, bo mają różną
 * wartość: +14 dni to moment największego zadowolenia klienta (prośba o
 * referencję), +90 dni to moment na kolejną propozycję po kwartale
 * użytkowania. Świadomie tylko dwa (decyzja właściciela 2026-07-14) — po
 * nich panel przestaje nagabywać, dalej to ręczna decyzja (next_followup
 * albo status "Uśpiony"). Zero AI — stałe w kodzie, deterministyczne. */
export const NURTURE_OFFSETS: { days: number; powod: string }[] = [
  { days: 14, powod: "kontakt kontrolny: referencja/opinia" },
  { days: 90, powod: "kontakt kontrolny: kolejna automatyzacja" },
];

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

const CLOSED_CLIENT_STATUSES = new Set<ClientStatus>(["Stracony"]);

/** Klient "wymaga działania dziś" wyłącznie na podstawie jawnie ustawionego
 * przypomnienia — w przeciwieństwie do leadów nie ma tu sztywnej reguły
 * czasowej per status, bo tempo kontaktu z klientem jest bardziej
 * zróżnicowane i to Ty decydujesz kiedy wrócić. */
export function isClientOverdue(client: Pick<Client, "status" | "next_followup">): boolean {
  if (CLOSED_CLIENT_STATUSES.has(client.status)) return false;
  if (!client.next_followup) return false;
  return client.next_followup <= todayLocalISO();
}

export function clientOverdueReason(client: Pick<Client, "next_followup" | "next_action">): string {
  const action = client.next_action?.trim();
  return `ustawione przypomnienie na ${client.next_followup}${action ? ` — ${action}` : ""}`;
}

export { daysSince as clientDaysSince };
