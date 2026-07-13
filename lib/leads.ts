// Czysta logika dot. leadów, bez "use client" — używana zarówno przez
// komponenty w app/[lang]/admin/leads/ (przez re-eksport z shared.tsx), jak
// i przez serwerowy route wysyłający dzienny raport mailowy
// (app/api/leads/notify/route.ts). Trzymana osobno, żeby route handler mógł
// ją zaimportować bez ciągnięcia za sobą granicy klienckiej.

import { todayLocalISO } from "./dates";

export type Lead = {
  id: string;
  firma: string;
  osoba_kontaktowa: string;
  branza: string;
  /** @deprecated zlepione pole z czasów przed rozbiciem na telefon/email/www — trzymane tylko dla wstecznej zgodności ze starymi wpisami */
  kontakt: string;
  telefon: string;
  email: string;
  www: string;
  ulica: string;
  kod: string;
  miasto: string;
  kraj: string;
  /** Kategoria źródła (stała lista, patrz SOURCE_CATEGORIES) — puste dla
   * leadów sprzed rozbicia źródła na kategorię+szczegóły. */
  zrodlo_kategoria: string;
  /** Szczegóły źródła (wolny tekst, np. "Wilanów", numer polecającego) —
   * dla starych leadów to wciąż całe, nieustrukturyzowane pole źródła. */
  zrodlo: string;
  status: string;
  ostatni_kontakt: string | null;
  next_followup: string | null;
  notatki: string;
  /** Ustawiony, gdy lead "awansował" na Klienta — automatycznie przy
   * pierwszej ofercie, albo ręcznie przyciskiem "Utwórz klienta" (patrz
   * lib/clients.ts). Null dopóki to wciąż tylko potencjalny kontakt. */
  client_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Activity = {
  id: string;
  lead_id: string;
  text: string;
  created_at: string;
};

export type SeedLead = Pick<
  Lead,
  "firma" | "branza" | "telefon" | "email" | "www" | "zrodlo" | "status" | "notatki"
>;

export const STATUSES = [
  "Nowe zgłoszenie ze strony",
  "Do kontaktu",
  "Napisano - czeka na odpowiedź",
  "Przypomnienie wysłane",
  "Rozmowa umówiona",
  "Pilotaż w trakcie",
  "Zamknięte - sukces",
  "Odrzucone / brak zainteresowania",
] as const;

// Odznaki statusu — półprzezroczyste na kolorze marki, czytelne w obu
// motywach (jasnym i ciemnym) dzięki alpha-blend zamiast litych barw.
export const STATUS_CLASS: Record<string, string> = {
  "Nowe zgłoszenie ze strony": "bg-red-500/15 text-red-400 dark:text-red-300",
  "Do kontaktu": "bg-[var(--hairline)] text-muted",
  "Napisano - czeka na odpowiedź": "bg-brand-gold/15 text-brand-gold",
  "Przypomnienie wysłane": "bg-orange-500/15 text-orange-400",
  "Rozmowa umówiona": "bg-brand-cyan/15 text-brand-cyan",
  "Pilotaż w trakcie": "bg-emerald-500/15 text-emerald-400",
  "Zamknięte - sukces": "bg-emerald-500/20 text-emerald-400 font-semibold",
  "Odrzucone / brak zainteresowania": "bg-[var(--hairline)] text-muted opacity-70",
};

// Kropka statusu w widoku kanban — pełny kolor marki/semantyczny.
export const STATUS_DOT: Record<string, string> = {
  "Nowe zgłoszenie ze strony": "bg-red-500",
  "Do kontaktu": "bg-[var(--fg-muted)]",
  "Napisano - czeka na odpowiedź": "bg-brand-gold",
  "Przypomnienie wysłane": "bg-orange-500",
  "Rozmowa umówiona": "bg-brand-cyan",
  "Pilotaż w trakcie": "bg-emerald-500",
  "Zamknięte - sukces": "bg-emerald-600",
  "Odrzucone / brak zainteresowania": "bg-[var(--hairline)]",
};

/** Stała lista kategorii źródła leada — zastępuje dawne jedno pole
 * "Źródło", które mieszało kategorię z dopiskiem (np. "Przysucha - ciepły?").
 * Kategoria + wolne "Szczegóły źródła" (pole `zrodlo`) to teraz dwie osobne
 * rzeczy. Puste `zrodlo_kategoria` = lead sprzed tej zmiany, patrz
 * leadSourceLabel(). */
export const SOURCE_CATEGORIES = [
  "WWW",
  "Polecenie",
  "Networking",
  "Zimny telefon",
  "Formularz na stronie",
  "Automatyczne wyszukiwanie",
  "Ręcznie dodane",
  "Inne",
] as const;

/** Etykieta źródła do wyświetlenia/filtrowania — dla nowych leadów to
 * kategoria, dla starych (bez kategorii) surowe, nieustrukturyzowane
 * `zrodlo`, żeby nic nie znikało z filtrów mimo braku migracji. */
export function leadSourceLabel(lead: Pick<Lead, "zrodlo_kategoria" | "zrodlo">): string {
  return lead.zrodlo_kategoria || lead.zrodlo || "—";
}

/** Deterministyczne (bez AI/LLM) dopasowanie starego, nieustrukturyzowanego
 * `zrodlo` do jednej z SOURCE_CATEGORIES — używane przez akcję "Uporządkuj
 * źródła" (LeadsDashboard.tsx), która jednorazowo doklasyfikowuje leady
 * sprzed rozbicia źródła na kategorię+szczegóły. Dopasowanie po słowach
 * kluczowych w surowym tekście; niejednoznaczne przypadki świadomie lądują
 * w "Inne" zamiast zgadywać — sam tekst zostaje nietknięty w "Szczegóły
 * źródła", więc kontekst się nie gubi. */
export function guessSourceCategory(zrodlo: string): string {
  const t = zrodlo.toLowerCase();
  if (t.includes("osm") || t.includes("auto-wyszuk") || t.includes("automatyczne")) return "Automatyczne wyszukiwanie";
  if (t.includes("formularz")) return "Formularz na stronie";
  if (t.includes("polecenie") || t.includes("polecił")) return "Polecenie";
  if (t.includes("ręcznie") || t.includes("recznie")) return "Ręcznie dodane";
  if (t.includes("networking") || t.includes("spotkanie") || t.includes("event") || t.includes("konferencj")) return "Networking";
  if (t.includes("zimny") || t.includes("cold call")) return "Zimny telefon";
  if (t.includes("www") || t.includes("http") || t.includes("strona")) return "WWW";
  return "Inne";
}

/** Normalizacja nazwy firmy do prostego dopasowania podobieństwa — usuwa
 * polskie znaki diakrytyczne, interpunkcję i różnice wielkości liter, żeby
 * "Kancelaria Kowalski" i "kancelaria kowalski sp. z o.o." trafiły na
 * siebie. Wyłącznie do miękkiego ostrzeżenia (findSimilarLead), nie do
 * jakiejkolwiek logiki biznesowej. */
function normalizeCompanyName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Pierwszy istniejący lead o bardzo podobnej nazwie firmy (identyczna po
 * normalizacji, albo jedna nazwa w całości zawiera drugą) — miękkie
 * ostrzeżenie przed przypadkowym duplikatem przy ręcznym dodawaniu leada
 * (LeadsDashboard.tsx addLead), nigdy blokada. Auto-wyszukiwanie (OSM) ma
 * już własne, dokładne sprawdzenie duplikatów po nazwie — to jest dla
 * ścieżki ręcznej, która go nie miała wcale. */
export function findSimilarLead(firma: string, leads: Lead[]): Lead | null {
  const needle = normalizeCompanyName(firma);
  if (!needle) return null;
  return (
    leads.find((l) => {
      const hay = normalizeCompanyName(l.firma);
      return hay.length > 0 && (hay === needle || hay.includes(needle) || needle.includes(hay));
    }) ?? null
  );
}

/** Miękkie, statyczne podpowiedzi "co zwykle dalej" per status — mentor
 * bez LLM (zgodne z zasadą "brak AI w logice przypominacza"). Czysto
 * informacyjne, nigdy nie blokują żadnej akcji. Wzorem CLIENT_STATUS_HINT
 * w lib/clients.ts. */
export const LEAD_STATUS_HINT: Record<string, string> = {
  "Nowe zgłoszenie ze strony": "Ktoś sam się zgłosił — odezwij się dziś, póki gorące. Zadzwoń albo napisz i zmień status.",
  "Do kontaktu": "Zrób pierwszy ruch: telefon lub krótki, spersonalizowany mail. Wspomnij, co konkretnie możesz zautomatyzować w ich branży.",
  "Napisano - czeka na odpowiedź": "Piłka po ich stronie. Jeśli cisza ~4 dni, panel przypomni o follow-upie.",
  "Przypomnienie wysłane": "Drugi kontakt poszedł. Brak odpowiedzi po kolejnym tygodniu? Rozważ zamknięcie albo zmianę kanału (telefon zamiast maila).",
  "Rozmowa umówiona": "Przygotuj kwalifikację: jaki problem, jaka skala, jaki budżet. Cel rozmowy = zgoda na PoC, nie od razu duży kontrakt.",
  "Pilotaż w trakcie": "PoC leci. Umów termin pokazania wyniku — to on domyka sprzedaż. Gdy klient powie „tak”, zrób z leada ofertę.",
  "Zamknięte - sukces": "Wygrane. Klient i projekt już są — pilnuj realizacji i poproś o referencję po wdrożeniu.",
  "Odrzucone / brak zainteresowania": "Zamknięte. Warto ustawić przypomnienie za parę miesięcy — sytuacja klienta się zmienia.",
};

/** Mapowanie statusu leada na krok uzgodnionego 12-krokowego procesu
 * (lib/process.ts) — do podświetlenia "jesteś tu" w ProcessMap. Przybliżone
 * z natury (kilka statusów kontaktowych mieści się w jednym kroku "Pierwszy
 * kontakt"), to miękka ściągawka, nie precyzyjny stan maszyny. */
export const LEAD_STATUS_STEP: Record<string, number> = {
  "Nowe zgłoszenie ze strony": 2,
  "Do kontaktu": 2,
  "Napisano - czeka na odpowiedź": 2,
  "Przypomnienie wysłane": 2,
  "Rozmowa umówiona": 3,
  "Pilotaż w trakcie": 4,
  "Zamknięte - sukces": 6,
  "Odrzucone / brak zainteresowania": 12,
};

// Startowa pula leadów zebrana ręcznie (Wilanów + Przysucha/Radom), z
// telefonem/mailem/www rozbitymi na osobne pola u źródła.
export const SEED: SeedLead[] = [
  { firma: "Kancelaria Prawna Tomasz Borawski", branza: "Kancelaria prawna", telefon: "+48 883 384 005", email: "biuro@radcaborawski.pl", www: "radcaborawski.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Radcy Prawnego Anna Czechowska-Miszczak", branza: "Kancelaria prawna", telefon: "604 448 808", email: "kancelaria@czechowskamiszczak.pl", www: "czechowskamiszczak.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Adwokacka Maciej Płacheta", branza: "Kancelaria prawna", telefon: "+48 696 599 733", email: "", www: "adwokatplacheta.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Adwokacka Jakub Wróblewski", branza: "Kancelaria prawna", telefon: "+48 691 130 236", email: "", www: "kancelaria-wroblewski.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Szeffner i Wspólnicy", branza: "Kancelaria prawna", telefon: "", email: "", www: "kancelaria-szeffner.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "EFEKTA Biuro Rachunkowe", branza: "Biuro rachunkowe", telefon: "+48 22 403 40 98", email: "biuro@efekta.waw.pl", www: "efekta.waw.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Anioły Przedsiębiorczości", branza: "Biuro rachunkowe", telefon: "+48 788 811 118 w.55", email: "ksiegowosc@ap-wb.pl", www: "", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "K2Tax", branza: "Biuro rachunkowe", telefon: "+48 606 266 277", email: "", www: "k2tax.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Euro Finance", branza: "Biuro rachunkowe", telefon: "608 658 212", email: "", www: "euro-finance.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Biuro Rachunkowe Agnieszka Kwiatkowska", branza: "Biuro rachunkowe", telefon: "", email: "a.kwiatkowska@kwiatkowska.com.pl", www: "", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "I&M Księgowi.pl", branza: "Biuro rachunkowe", telefon: "", email: "", www: "imksiegowi.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "TaxClear", branza: "Biuro rachunkowe", telefon: "+48 668 880 050", email: "", www: "taxclear.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Notarialna Kwiatkowska & Famurat", branza: "Notariusz", telefon: "(22) 258 77 32", email: "", www: "wilanow-notariusz.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Notarialna Józef Wadowski", branza: "Notariusz", telefon: "", email: "", www: "notariuszwadowski.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Kancelaria Notarialna Aleksandra Więcek", branza: "Notariusz", telefon: "", email: "", www: "", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "ul. Sarmacka 6 lok. U8" },
  { firma: "Kancelaria Notarialna Magdalena Sikorska", branza: "Notariusz", telefon: "", email: "", www: "", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "Miasteczko Wilanów" },
  { firma: "Kancelaria Notarialna W&W", branza: "Notariusz", telefon: "", email: "", www: "", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "Obsługuje Mokotów/Ursynów/Wilanów" },
  { firma: "Dental Wilanów", branza: "Klinika stomatologiczna", telefon: "", email: "", www: "dentalwilanow.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Dentistree", branza: "Klinika stomatologiczna", telefon: "", email: "", www: "dentistree.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "ul. Oś Królewska 18 lok. U2" },
  { firma: "Nieckula Dental Clinic", branza: "Klinika stomatologiczna", telefon: "", email: "", www: "stomatologiawilanow.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "XO Dental Clinic", branza: "Klinika stomatologiczna", telefon: "", email: "", www: "xodentalclinic.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Cićkiewicz Clinic", branza: "Klinika stomatologiczna", telefon: "", email: "", www: "cickiewiczclinic.com", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Smile Makers", branza: "Klinika stomatologiczna", telefon: "532 108 507", email: "", www: "smilemakers.com.pl", zrodlo: "Wilanów - www", status: "Do kontaktu", notatki: "" },
  { firma: "Elżbieta Chotecka Biuro Rachunkowe", branza: "Biuro rachunkowe", telefon: "", email: "", www: "", zrodlo: "Przysucha - ciepły?", status: "Do kontaktu", notatki: "ul. Hubala 43/10, Przysucha. Sprawdzić czy ktoś z rodziny zna osobiście" },
  { firma: "Biuro Rachunkowe Sylwia Płuciennik", branza: "Biuro rachunkowe", telefon: "", email: "", www: "", zrodlo: "Przysucha - ciepły?", status: "Do kontaktu", notatki: "ul. Grodzka 10, Przysucha. Sprawdzić czy ktoś z rodziny zna osobiście" },
  { firma: "Biuro Rachunkowe Anna Sobczyk-Józwowiak", branza: "Biuro rachunkowe", telefon: "", email: "", www: "", zrodlo: "Przysucha - ciepły?", status: "Do kontaktu", notatki: "Przysucha. Sprawdzić czy ktoś z rodziny zna osobiście" },
  { firma: "Marzanna Lisowska Biuro Rachunkowe", branza: "Biuro rachunkowe", telefon: "", email: "", www: "", zrodlo: "Przysucha - ciepły?", status: "Do kontaktu", notatki: "Przysucha. Sprawdzić czy ktoś z rodziny zna osobiście" },
  { firma: "NO TAX Biuro Rachunkowe", branza: "Biuro rachunkowe", telefon: "600 348 168 / 601 373 770", email: "notax.biuro@gmail.com", www: "", zrodlo: "Radom - www", status: "Do kontaktu", notatki: "" },
];

export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

const CLOSED_STATUSES = new Set(["Zamknięte - sukces", "Odrzucone / brak zainteresowania"]);

export function isOverdue(lead: Lead): boolean {
  if (CLOSED_STATUSES.has(lead.status)) return false;
  if (lead.status === "Nowe zgłoszenie ze strony") return true;

  // Jawnie ustawiona data przypomnienia bierze pierwszeństwo nad sztywną
  // regułą — jeśli ją ustawiłeś, to Ty decydujesz kiedy się odezwać.
  if (lead.next_followup) {
    return lead.next_followup <= todayLocalISO();
  }

  if (lead.status !== "Napisano - czeka na odpowiedź") return false;
  const d = daysSince(lead.ostatni_kontakt);
  return d !== null && d >= 4;
}

/** Krótki, czytelny opis dlaczego dany lead wymaga dziś działania — używany
 * zarówno w banerze w panelu, jak i w treści maila z dziennym raportem. */
export function overdueReason(lead: Lead): string {
  if (lead.status === "Nowe zgłoszenie ze strony") {
    return "nowe zgłoszenie ze strony, jeszcze nieobsłużone";
  }
  if (lead.next_followup) {
    return `ustawione przypomnienie na ${lead.next_followup}`;
  }
  const d = daysSince(lead.ostatni_kontakt);
  return `napisano ${d} dni temu, brak odpowiedzi`;
}
