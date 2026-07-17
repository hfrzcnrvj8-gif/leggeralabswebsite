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
import { type DocLang } from "./documents";

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
  /** Osoba kontaktowa u klienta — kopiowana z leada przy awansie (Moduł 12),
   * pole istniało tylko w leads przed tą migracją. */
  osoba_kontaktowa: string;
  /** Pochodzenie klienta (skąd przyszedł jako lead) — wolny tekst,
   * kopiowany z leada przy awansie, nigdy nie edytowany ręcznie potem. */
  zrodlo: string;
  /** Kategoria źródła (SOURCE_CATEGORIES w lib/leads.ts) — patrz zrodlo. */
  zrodlo_kategoria: string;
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
  /** Średnia ocena ze wszystkich zebranych opinii (Moduł 15) po projektach
   * tego klienta — null, gdy żadna opinia jeszcze nie została zebrana.
   * Dociągana w GET /api/clients (podzapytanie po projects), nie jest
   * kolumną w tabeli `clients`. */
  avg_rating: number | null;
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
  /** Wynik połączenia (CALL_OUTCOMES) — tylko dla kanal="telefon". */
  wynik: string | null;
  /** Czas trwania połączenia w sekundach — tylko gdy wynik="odebrane". */
  czas_trwania_sek: number | null;
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
  "invoice_dunning_sent",
  "project_status_changed",
  "nurture_scheduled",
  "contract_created",
  "contract_sent",
  "contract_signed",
  "nda_created",
  "review_requested",
  "review_collected",
  "nurture_contact_sent",
] as const;
export type ClientEventKind = (typeof CLIENT_EVENT_KINDS)[number];

export type ClientEvent = {
  id: string;
  client_id: string;
  kind: ClientEventKind | string;
  text: string;
  amount: number | null;
  related_id: string | null;
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
  invoice_dunning_sent: "⚠️",
  project_status_changed: "📁",
  nurture_scheduled: "📅",
  contract_created: "📄",
  contract_sent: "📤",
  contract_signed: "✍️",
  nda_created: "🔒",
  review_requested: "📮",
  review_collected: "⭐",
  nurture_contact_sent: "🔁",
};

/** Moduł 12 (fundament linkowania) — do jakiego segmentu URL-a
 * (`/admin/<segment>/<id>`) prowadzi dane zdarzenie, na podstawie `kind`.
 * `null` = zdarzenie świadomie bez celu (client_created, nurture_scheduled —
 * nie ma osobnego rekordu, do którego dałoby się linkować). */
export const CLIENT_EVENT_TARGET: Record<string, "offers" | "invoices" | "projects" | "contracts" | null> = {
  client_created: null,
  offer_created: "offers",
  offer_sent: "offers",
  offer_accepted: "offers",
  invoice_issued: "invoices",
  invoice_sent: "invoices",
  invoice_reminder: "invoices",
  payment_received: "invoices",
  invoice_paid: "invoices",
  invoice_dunning_sent: "invoices",
  project_status_changed: "projects",
  nurture_scheduled: null,
  contract_created: "contracts",
  contract_sent: "contracts",
  contract_signed: "contracts",
  nda_created: "contracts",
  review_requested: "projects",
  review_collected: "projects",
  nurture_contact_sent: "projects",
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

/** Mapowanie statusu klienta na krok uzgodnionego 15-krokowego procesu
 * (lib/process.ts) — status klienta to relacyjna oś (Prospekt/Aktywny/...),
 * nie proces krok po kroku, więc to przybliżenie: "Uśpiony"/"Stracony" oba
 * ląduje na kroku Nurture, bo w obu przypadkach właściwa akcja to ustawić
 * przypomnienie na później, zgodnie z CLIENT_STATUS_HINT powyżej.
 * Numery przesunięte w Module 32 (doszły Umowa/Onboarding/Wsparcie):
 * Realizacja 8→10, Nurture 12→15. */
export const CLIENT_STATUS_STEP: Record<ClientStatus, number> = {
  Prospekt: 3,
  Aktywny: 10,
  Uśpiony: 15,
  Stracony: 15,
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

/** Generuje szkic wiadomości retencyjnej (Moduł 17) na podstawie jednego
 * z dwóch zaplanowanych dotknięć (patrz NURTURE_OFFSETS) — gotowy tekst do
 * przejrzenia, edycji i wysłania, nigdy automatycznie (wzorem
 * buildOnboardingWelcomeMessage/buildProjectClosingSummary, lib/projects.ts).
 * +14 to przypomnienie o opinii (pomijane, gdy `review.submitted` — nie ma
 * sensu prosić drugi raz, jeśli już ją zebrano modułem 15); +90 to propozycja
 * kolejnego kroku. Oba kończą się pytaniem o polecenie (decyzja właściciela
 * przy starcie modułu, 2026-07-15). */
export function buildNurtureMessage(
  days: 14 | 90,
  project: { tytul: string },
  client: { nazwa: string; osoba_kontaktowa: string } | null,
  review: { url: string; submitted: boolean } | null,
  lang: DocLang = "pl"
): string {
  const nazwaKlienta = client?.nazwa ? ` (${client.nazwa})` : "";

  if (lang === "en") {
    const greeting = client?.osoba_kontaktowa ? `Hi ${client.osoba_kontaktowa},` : "Hi,";
    if (days === 14) {
      const reviewLine =
        review && !review.submitted
          ? `\n\nBy the way — if you haven't had a chance yet, I'd really appreciate a short review of our collaboration: ${review.url}`
          : "";
      return `${greeting}

It's been two weeks since we wrapped up "${project.tytul}"${nazwaKlienta} — how is the rollout going? Let me know if anything needs attention.${reviewLine}

And if you know anyone who could use similar help, feel free to send them my way — always appreciated!

Best,
[Your name]`;
    }
    return `${greeting}

It's been three months since we wrapped up "${project.tytul}"${nazwaKlienta} — how has it been working out day to day? If new needs have come up that we could automate together, I'd love to hear about them.

And if you know anyone who could use similar help, feel free to send them my way — always appreciated!

Best,
[Your name]`;
  }

  if (lang === "de") {
    const greeting = client?.osoba_kontaktowa ? `Hallo ${client.osoba_kontaktowa},` : "Hallo,";
    if (days === 14) {
      const reviewLine =
        review && !review.submitted
          ? `\n\nÜbrigens — falls Sie noch keine Zeit hatten: Ich würde mich sehr über eine kurze Bewertung unserer Zusammenarbeit freuen: ${review.url}`
          : "";
      return `${greeting}

seit dem Abschluss von „${project.tytul}"${nazwaKlienta} sind zwei Wochen vergangen — wie läuft die Umsetzung? Lassen Sie es mich wissen, falls etwas Aufmerksamkeit braucht.${reviewLine}

Und falls Sie jemanden kennen, dem eine ähnliche Unterstützung helfen würde — ich freue mich immer über Empfehlungen!

Viele Grüße,
[Ihr Name]`;
    }
    return `${greeting}

seit dem Abschluss von „${project.tytul}"${nazwaKlienta} sind drei Monate vergangen — wie läuft es im Alltag? Falls neue Bedürfnisse entstanden sind, die wir gemeinsam automatisieren könnten, würde ich das gerne hören.

Und falls Sie jemanden kennen, dem eine ähnliche Unterstützung helfen würde — ich freue mich immer über Empfehlungen!

Viele Grüße,
[Ihr Name]`;
  }

  const greeting = client?.osoba_kontaktowa ? `Cześć ${client.osoba_kontaktowa},` : "Cześć,";
  if (days === 14) {
    const reviewLine =
      review && !review.submitted
        ? `\n\nPrzy okazji — jeśli jeszcze nie było czasu, będzie mi bardzo miło, jeśli zostawisz kilka słów opinii o naszej współpracy: ${review.url}`
        : "";
    return `${greeting}

Minęły dwa tygodnie odkąd zamknęliśmy „${project.tytul}"${nazwaKlienta} — jak działa wdrożenie? Daj znać, jeśli coś wymaga uwagi.${reviewLine}

I jeśli znasz kogoś, komu przydałaby się podobna pomoc — śmiało polecaj, zawsze to doceniam!

Pozdrawiam,
[Twoje imię]`;
  }
  return `${greeting}

Minęły trzy miesiące odkąd zamknęliśmy „${project.tytul}"${nazwaKlienta} — jak sprawdza się to na co dzień? Jeśli pojawiły się nowe potrzeby, które moglibyśmy razem zautomatyzować, chętnie o nich usłyszę.

I jeśli znasz kogoś, komu przydałaby się podobna pomoc — śmiało polecaj, zawsze to doceniam!

Pozdrawiam,
[Twoje imię]`;
}

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
