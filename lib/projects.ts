// Czysta logika projektów/wdrożeń — bez "use client", żeby mogła być
// re-używana zarówno przez UI, jak i serwerowe route'y (agregacja
// dashboardu, dzienny raport mailowy). Wzorowane 1:1 na lib/leads.ts.

import { todayLocalISO } from "./dates";
import { type DocLang } from "./documents";

export type Project = {
  id: string;
  tytul: string;
  opis: string;
  status: string;
  priorytet: string;
  zdrowie: string;
  start: string | null;
  termin: string | null;
  lead_id: string | null;
  /** Podpięty klient (patrz lib/clients.ts) — propagowany automatycznie z
   * oferty przy akceptacji, nullable dla projektów bez podpiętego klienta. */
  client_id: string | null;
  /** Kolor akcentu projektu (hex) — tożsamość w listach/tablicy/osi czasu. */
  kolor: string | null;
  /** Ikona projektu (emoji) — jak w Linear/Notion. */
  ikona: string | null;
  created_at: string;
  updated_at: string;
  /** Agregat z listy /api/projects — liczba zadań łącznie/ukończonych.
   * Opcjonalne, bo endpointy pojedynczego projektu ich nie zwracają
   * (tam liczymy bezpośrednio z pełnej listy `tasks`). */
  task_total?: number;
  task_done?: number;
  /** Zamknięcie projektu i opinia (Moduł 15) — patrz buildProjectClosingSummary,
   * PROJECT_REVIEW_CONSENT_TEXT i app/api/projects/review/public/[token]. */
  review_token: string | null;
  /** Moduł 40 — ręczne unieważnienie linku do formularza opinii. Blokuje
   * i formularz, i wysłanie opinii (patrz lib/shareLinks.ts). */
  review_revoked_at: string | null;
  review_requested_at: string | null;
  review_rating_jakosc: number | null;
  review_rating_terminowosc: number | null;
  review_rating_komunikacja: number | null;
  review_comment: string;
  review_submitted_at: string | null;
  review_consent_case_study: boolean;
  review_consent_text: string | null;
  review_consent_name: string | null;
  review_consent_ip: string | null;
  review_consent_user_agent: string | null;
  /** Język projektu (pl/en/de) — dziedziczony z języka oferty przy akceptacji
   * (lib/offerAccept.ts), decyduje o wersji językowej publicznego formularza
   * opinii i szkicu podsumowania (Moduł 15). Projekty utworzone poza tą
   * ścieżką (ręcznie) zostają domyślnie 'pl'. */
  jezyk: DocLang;
};

export type ProjectTask = {
  id: string;
  project_id: string;
  text: string;
  done: boolean;
  position: number;
  milestone_id: string | null;
  created_at: string;
};

export type ProjectActivity = {
  id: string;
  project_id: string;
  text: string;
  /** "note" = ręczny wpis użytkownika, "system" = automatyczny log zmiany
   * (status/priorytet/zdrowie/data), renderowany dyskretnie. */
  kind: "note" | "system";
  created_at: string;
};

export type ProjectMilestone = {
  id: string;
  project_id: string;
  nazwa: string;
  termin: string | null;
  position: number;
  created_at: string;
};

export type ProjectResource = {
  id: string;
  project_id: string;
  etykieta: string;
  url: string;
  position: number;
  created_at: string;
};

export type ProjectOnboardingItem = {
  id: string;
  project_id: string;
  tekst: string;
  done: boolean;
  position: number;
  created_at: string;
};

/** Domyślna checklista onboardingowa (Moduł 14) — wsiewana automatycznie przy
 * tworzeniu projektu (POST /api/projects, acceptOffer), potem dowolnie
 * edytowalna/rozszerzalna per projekt (właściciel może dodać/usunąć punkty). */
export const DEFAULT_ONBOARDING_ITEMS: string[] = [
  "Dane kontaktowe do decydenta / osoby kontaktowej po stronie klienta",
  "Dostępy do systemów/narzędzi potrzebnych do realizacji",
  "Materiały startowe (grafiki, treści, dokumentacja, brandbook)",
  "Ustalona częstotliwość i kanał statusów (np. mail co tydzień)",
  "Wysłana wiadomość powitalna",
];

/** Miękka podpowiedź, gdy checklista onboardingowa nie jest domknięta —
 * czysto informacyjna, nigdy nie blokuje przejścia do realizacji. Wzorem
 * LEAD_STATUS_HINT (lib/leads.ts). */
export const ONBOARDING_INCOMPLETE_HINT =
  "Checklista onboardingowa nie jest jeszcze domknięta — upewnij się, że masz to, czego potrzebujesz, zanim ruszysz z realizacją.";

/** Generuje szkic wiadomości powitalnej do klienta po podpisaniu umowy —
 * gotowy tekst do przejrzenia, edycji i RĘCZNEGO wysłania (panel niczego nie
 * wysyła sam, zgodnie z decyzją właściciela przy starcie Modułu 14). */
export function buildOnboardingWelcomeMessage(
  project: { tytul: string },
  client: { nazwa: string; osoba_kontaktowa: string } | null
): string {
  const powitanie = client?.osoba_kontaktowa
    ? `Cześć ${client.osoba_kontaktowa},`
    : client?.nazwa
      ? `Cześć,`
      : "Cześć,";
  const nazwaKlienta = client?.nazwa ? ` (${client.nazwa})` : "";
  return `${powitanie}

Dziękuję za podpisanie umowy — zaczynamy pracę nad „${project.tytul}"${nazwaKlienta}!

Krótkie podsumowanie, jak będziemy współpracować:
- Kontakt: [Twoje imię], [e-mail/telefon]
- Statusy będę wysyłać: [ustal częstotliwość, np. co tydzień mailem]
- Kolejny krok: [co dzieje się teraz — np. spotkanie kickoff / zebranie dostępów]

Żeby ruszyć, potrzebuję od Ciebie jeszcze:
[uzupełnij na podstawie checklisty onboardingowej — dostępy/materiały/kontakt]

Razem z tym mailem daj znać, jeśli masz pytania — chętnie je wyjaśnię przed startem.

Pozdrawiam,
[Twoje imię]`;
}

/** Miękka podpowiedź przy statusie "Wdrożone", dopóki opinia nie została
 * poproszona — czysto informacyjna, nigdy nie blokuje zmiany statusu. Wzorem
 * ONBOARDING_INCOMPLETE_HINT/CLIENT_STATUS_HINT. */
export const PROJECT_REVIEW_REQUEST_HINT =
  "Projekt jest Wdrożony — dobry moment na podsumowanie i prośbę o opinię (sekcja „Zamknięcie i opinia” niżej).";

/** Pełny tekst zgody na wykorzystanie referencji/case study — świadomie
 * bliżej formalnej zgody RODO/marketingowej niż prosty checkbox tak/nie
 * (decyzja właściciela przy starcie Modułu 15). Zapisywany jako snapshot w
 * `review_consent_text` w momencie akceptacji, żeby późniejsza zmiana treści
 * w kodzie nie podważała tego, na co klient faktycznie się zgodził. Wersja
 * językowa wg `project.jezyk` (dziedziczonego z oferty) — patrz Moduł 15,
 * kontynuacja: język formularza per klient PL/EN/DE. */
export const PROJECT_REVIEW_CONSENT_TEXT: Record<DocLang, string> = {
  pl: "Wyrażam zgodę na wykorzystanie przez Leggera Labs informacji o zrealizowanym projekcie — w tym mojej opinii, nazwy firmy oraz ogólnego zakresu współpracy — w materiałach marketingowych, referencyjnych oraz studiach przypadku (case study), publikowanych na stronie internetowej i w materiałach sprzedażowych Leggera Labs. Zgoda jest dobrowolna i można ją w każdej chwili wycofać, kontaktując się mailowo.",
  en: "I agree that Leggera Labs may use information about the completed project — including my feedback, company name, and a general description of our collaboration — in marketing materials, references, and case studies published on the website and in Leggera Labs' sales materials. This consent is voluntary and can be withdrawn at any time by contacting us via email.",
  de: "Ich stimme zu, dass Leggera Labs Informationen über das abgeschlossene Projekt — einschließlich meines Feedbacks, des Firmennamens und einer allgemeinen Beschreibung der Zusammenarbeit — in Marketingmaterialien, Referenzen und Fallstudien (Case Studies) verwenden darf, die auf der Website und in Vertriebsunterlagen von Leggera Labs veröffentlicht werden. Diese Einwilligung ist freiwillig und kann jederzeit per E-Mail widerrufen werden.",
};

/** Generuje szkic podsumowania projektu + prośby o opinię — gotowy tekst do
 * przejrzenia, edycji i wysłania (ręcznie skopiowanego albo mailem przez
 * panel). Wzorem buildOnboardingWelcomeMessage: panel niczego nie wysyła bez
 * jawnego kliknięcia. `reviewUrl` to link do publicznego formularza opinii
 * (patrz ensureProjectReviewToken). `lang` domyślnie 'pl' — w praktyce zawsze
 * `project.jezyk` (dziedziczony z oferty). */
export function buildProjectClosingSummary(
  project: { tytul: string },
  client: { nazwa: string; osoba_kontaktowa: string } | null,
  milestones: { nazwa: string; termin: string | null }[],
  reviewUrl: string,
  lang: DocLang = "pl"
): string {
  const nazwaKlienta = client?.nazwa ? ` (${client.nazwa})` : "";
  const etapy = milestones.length
    ? milestones.map((m) => `- ${m.nazwa}${m.termin ? ` (${formatPlDate(m.termin)})` : ""}`).join("\n")
    : null;

  if (lang === "en") {
    const powitanie = client?.osoba_kontaktowa ? `Hi ${client.osoba_kontaktowa},` : "Hi,";
    return `${powitanie}

The project "${project.tytul}"${nazwaKlienta} is complete — thank you for working with us!

What we did:
${etapy ?? "- [fill in what we did]"}

What's next: [fill in, if there's a plan for next steps/support]

I'd really appreciate it if you could spare 2 minutes to leave a short review of our collaboration:
${reviewUrl}

Thanks again, and see you on the next project!

Best,
[Your name]`;
  }

  if (lang === "de") {
    const powitanie = client?.osoba_kontaktowa ? `Hallo ${client.osoba_kontaktowa},` : "Hallo,";
    return `${powitanie}

das Projekt „${project.tytul}"${nazwaKlienta} ist abgeschlossen — vielen Dank für die Zusammenarbeit!

Was wir gemacht haben:
${etapy ?? "- [ergänzen, was wir gemacht haben]"}

Nächste Schritte: [ergänzen, falls es einen Plan für weitere Schritte/Support gibt]

Ich würde mich sehr freuen, wenn Sie sich 2 Minuten Zeit nehmen und eine kurze Bewertung unserer Zusammenarbeit abgeben:
${reviewUrl}

Nochmals vielen Dank und bis zum nächsten Projekt!

Viele Grüße,
[Ihr Name]`;
  }

  const powitanie = client?.osoba_kontaktowa ? `Cześć ${client.osoba_kontaktowa},` : "Cześć,";
  return `${powitanie}

Projekt „${project.tytul}"${nazwaKlienta} jest zakończony — dziękuję za współpracę!

Co zrobiliśmy:
${etapy ?? "- [uzupełnij, co zrobiliśmy]"}

Co dalej: [uzupełnij, jeśli jest plan na kolejne kroki/wsparcie]

Będzie mi bardzo miło, jeśli poświęcisz 2 minuty na krótką opinię o współpracy:
${reviewUrl}

Dziękuję jeszcze raz i do zobaczenia przy kolejnym projekcie!

Pozdrawiam,
[Twoje imię]`;
}

/** Średnia z trzech wymiarów oceny (jakość/terminowość/komunikacja) — null,
 * dopóki żadna ocena nie została jeszcze zebrana. */
export function projectReviewAverage(
  p: Pick<Project, "review_rating_jakosc" | "review_rating_terminowosc" | "review_rating_komunikacja">
): number | null {
  const vals = [p.review_rating_jakosc, p.review_rating_terminowosc, p.review_rating_komunikacja].filter(
    (v): v is number => typeof v === "number"
  );
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export const PROJECT_STATUSES = [
  "Pomysł",
  "Planowanie",
  "W trakcie",
  "Testy / review",
  "Wdrożone",
  "Wstrzymane",
] as const;

/** Kolor (hex) przypisany do statusu projektu — każdy status ma własną barwę,
 * żeby z daleka na osi czasu rozpoznać stan projektu (pasek jest kolorowany wg
 * statusu). Używane też do obramowania i gradientowego wypełnienia paska. */
/**
 * ŹRÓDŁEM PRAWDY dla koloru statusu są pigułki (`PROJECT_STATUS_CLASS` niżej).
 * Ta mapa jest ich odpowiednikiem w hex, bo oś czasu rysuje paski inline'owym
 * stylem i nie może użyć klas Tailwinda.
 *
 * Do 2026-07-20 panel miał TRZY sprzeczne mapy dla tego samego statusu: tę,
 * pigułki i `STATUS_ICON` w `ProjectKanban.tsx`. „W trakcie" był kolejno
 * niebieski, cyan i złoty; „Planowanie" — fioletowe, złote i szare. Ten sam
 * projekt miał inny kolor zależnie od tego, gdzie się na niego patrzyło.
 * Właściciel wybrał pigułki jako obowiązujące (są najczęściej widoczne i mówią
 * tym samym słownikiem, co leady, faktury i oferty), a pozostałe dwie zostały
 * do nich doprowadzone. **Zmieniasz kolor statusu → zmieniasz we WSZYSTKICH
 * trzech miejscach**, inaczej rozjazd wraca.
 */
export const PROJECT_STATUS_HEX: Record<string, string> = {
  Pomysł: "#8a8f98", // szary — luźny pomysł
  Planowanie: "#E0A93B", // złoto marki — planowanie
  "W trakcie": "#22D3EE", // cyan marki — w realizacji
  "Testy / review": "#f97316", // pomarańcz — testy/review
  Wdrożone: "#10b981", // zielony — zrobione
  Wstrzymane: "#8a8f98", // szary — pauza
};
export const DEFAULT_STATUS_HEX = "#8a8f98";

export const PROJECT_PRIORITIES = ["Niski", "Normalny", "Wysoki", "Krytyczny"] as const;

/** Szablon projektu — powtarzalna struktura zlecenia (kamienie milowe z
 * przesunięciami dni od startu + zadania pod każdym). Tworzy gotowy projekt
 * jednym kliknięciem zamiast klepania tego samego za każdym razem. Używane
 * przez POST /api/projects (rozwijane po stronie serwera) i przez picker w UI. */
export type ProjectTemplateMilestone = { nazwa: string; dayOffset: number; tasks: string[] };
export type ProjectTemplate = {
  id: string;
  name: string;
  emoji: string;
  opis: string;
  milestones: ProjectTemplateMilestone[];
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "www",
    name: "Wdrożenie strony WWW",
    emoji: "🌐",
    opis: "Projekt i wdrożenie strony internetowej dla klienta.",
    milestones: [
      { nazwa: "Discovery / brief", dayOffset: 7, tasks: ["Spotkanie kickoff", "Zebranie wymagań", "Analiza konkurencji"] },
      { nazwa: "Projekt (design)", dayOffset: 21, tasks: ["Wireframe", "Projekt UI", "Akceptacja klienta"] },
      { nazwa: "Wdrożenie", dayOffset: 42, tasks: ["Frontend", "Integracje / CMS", "Treści"] },
      { nazwa: "Testy / review", dayOffset: 49, tasks: ["QA", "Poprawki", "Akceptacja"] },
      { nazwa: "Launch", dayOffset: 56, tasks: ["Wdrożenie produkcyjne", "Analytics", "Przekazanie klientowi"] },
    ],
  },
  {
    id: "automatyzacja",
    name: "Automatyzacja / integracja",
    emoji: "⚙️",
    opis: "Automatyzacja procesu lub integracja systemów.",
    milestones: [
      { nazwa: "Analiza procesu", dayOffset: 7, tasks: ["Mapowanie procesu", "Identyfikacja wąskich gardeł", "Zakres MVP"] },
      { nazwa: "Proof of Concept", dayOffset: 21, tasks: ["Prototyp", "Test na danych", "Prezentacja PoC"] },
      { nazwa: "Wdrożenie", dayOffset: 42, tasks: ["Integracje API", "Automatyzacja", "Obsługa błędów"] },
      { nazwa: "Uruchomienie", dayOffset: 49, tasks: ["Testy end-to-end", "Szkolenie", "Dokumentacja"] },
    ],
  },
  {
    id: "audyt",
    name: "Audyt / konsultacja",
    emoji: "🔍",
    opis: "Audyt i rekomendacje dla klienta.",
    milestones: [
      { nazwa: "Zebranie danych", dayOffset: 5, tasks: ["Wywiady", "Dostęp do systemów", "Zebranie materiałów"] },
      { nazwa: "Analiza", dayOffset: 12, tasks: ["Analiza stanu obecnego", "Identyfikacja szans", "Benchmark"] },
      { nazwa: "Raport i rekomendacje", dayOffset: 18, tasks: ["Raport", "Rekomendacje", "Prezentacja dla klienta"] },
    ],
  },
];

export function getProjectTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}

export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Rozwija szablon projektu na konkretne daty (start = dziś, kamienie/termin
 * = dziś + dayOffset) — używane przez POST /api/projects i przez akceptację
 * oferty (POST /api/offers/:id/accept), żeby obie ścieżki tworzenia projektu
 * z szablonu liczyły daty identycznie. */
export function expandProjectTemplate(
  template: ProjectTemplate,
  today: Date = new Date()
): { opis: string; start: string; termin: string; milestones: { nazwa: string; termin: string; tasks: string[] }[] } {
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);
  const lastOffset = template.milestones.reduce((mx, m) => Math.max(mx, m.dayOffset), 0);
  return {
    opis: template.opis,
    start: toLocalISODate(base),
    termin: toLocalISODate(new Date(base.getTime() + lastOffset * 86400000)),
    milestones: template.milestones.map((m) => ({
      nazwa: m.nazwa,
      termin: toLocalISODate(new Date(base.getTime() + m.dayOffset * 86400000)),
      tasks: m.tasks,
    })),
  };
}

/** Paleta kolorów akcentu projektu (hex) — kilka spójnych, żywych barw jak w
 * Linear/Notion; wybierane ręcznie w panelu szczegółów. */
export const PROJECT_COLORS = [
  "#7C3AED", // fiolet (marka)
  "#E0A93B", // złoto (marka)
  "#4ea7fc", // niebieski
  "#22D3EE", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // czerwony
  "#ec4899", // różowy
  "#8b5cf6", // fioletowy jasny
  "#64748b", // szary
] as const;

/** Zestaw emoji-ikon projektu do szybkiego wyboru. */
export const PROJECT_ICONS = ["📁", "🌐", "⚙️", "🔍", "🚀", "📊", "💼", "🎨", "📝", "🤖", "💡", "🔧", "📦", "🎯", "🛠️", "📈"] as const;

export const DEFAULT_PROJECT_COLOR = "#4ea7fc";
export const DEFAULT_PROJECT_ICON = "📁";

export const PROJECT_STATUS_CLASS: Record<string, string> = {
  Pomysł: "bg-[var(--hairline)] text-muted",
  Planowanie: "bg-brand-gold/15 text-brand-gold",
  "W trakcie": "bg-brand-cyan/15 text-brand-cyan",
  "Testy / review": "bg-orange-500/15 text-orange-400",
  Wdrożone: "bg-emerald-500/20 text-emerald-400 font-semibold",
  Wstrzymane: "bg-[var(--hairline)] text-muted opacity-70",
};

export const PROJECT_STATUS_DOT: Record<string, string> = {
  Pomysł: "bg-[var(--fg-muted)]",
  Planowanie: "bg-brand-gold",
  "W trakcie": "bg-brand-cyan",
  "Testy / review": "bg-orange-500",
  Wdrożone: "bg-emerald-600",
  Wstrzymane: "bg-[var(--hairline)]",
};

export const CLOSED_PROJECT_STATUSES = new Set(["Wdrożone"]);

/** Projekt "wymaga działania" jeśli ma minięty/dzisiejszy termin i nie jest
 * zamknięty — ten sam duch co isOverdue() dla leadów. */
export function isProjectOverdue(p: Project): boolean {
  if (CLOSED_PROJECT_STATUSES.has(p.status)) return false;
  if (!p.termin) return false;
  return p.termin <= todayLocalISO();
}

/** Liczba dni od dziś do daty (dodatnia = przyszłość, 0 = dziś, ujemna =
 * przeszłość). null gdy brak/niepoprawna data. */
export function daysFromToday(s: string | null | undefined): number | null {
  if (!s) return null;
  const target = new Date(`${s.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/** Krótka etykieta względna terminu: „dziś", „jutro", „za 3 dni", „wczoraj",
 * „3 dni po terminie". Pusty string gdy brak daty. */
export function relativeDeadline(s: string | null | undefined): string {
  const d = daysFromToday(s);
  if (d == null) return "";
  if (d === 0) return "dziś";
  if (d === 1) return "jutro";
  if (d === -1) return "wczoraj";
  if (d > 1) return `za ${d} dni`;
  return `${-d} dni po terminie`;
}

// "Zdrowie" — ręcznie ustawiana ocena, niezależna od statusu na tablicy
// (styl Linear: projekt może być "W trakcie" i jednocześnie "Zagrożony").
export const PROJECT_HEALTHS = ["Na dobrej drodze", "Zagrożony", "Zerwany"] as const;

export const PROJECT_HEALTH_CLASS: Record<string, string> = {
  "Na dobrej drodze": "bg-emerald-500/15 text-emerald-400",
  Zagrożony: "bg-orange-500/15 text-orange-400",
  Zerwany: "bg-red-500/15 text-red-400",
};

/** Postęp checklisty/kamienia milowego jako "X% z Y" — bezpieczny na 0/0. */
export function progressOf(tasks: { done: boolean }[]): { pct: number; total: number; done: number } {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { pct: total === 0 ? 0 : Math.round((done / total) * 100), total, done };
}

/** Waliduje "sensowną" datę (YYYY-MM-DD, rok 2000–2100) — chroni przed
 * pułapką natywnego <input type="date">, gdzie da się przypadkowo zapisać
 * niepełny rok (np. wpisanie "202" i odkliknięcie pola zanim dopiszesz "6"). */
export function isPlausibleDateString(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const year = Number(m[1]);
  return year >= 2000 && year <= 2100;
}

/** Formatuje datę ISO (YYYY-MM-DD, ew. z częścią czasową) na czytelną
 * postać pl-PL — używane wszędzie tam, gdzie wcześniej wyciekały surowe
 * stringi/timestampy prosto z bazy. */
export function formatPlDate(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(`${s.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}
