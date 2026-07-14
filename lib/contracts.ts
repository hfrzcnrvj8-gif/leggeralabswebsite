// Czysta logika modułu Umowy + NDA — bez "use client", re-używana przez UI i
// serwerowe route'y. Wzorowane na lib/offers.ts: ten sam e-podpis
// (accepted_at/by_name/ip/user_agent), ten sam mechanizm share_token.
//
// Świadomie JEDNA tabela dla obu typów dokumentu (typ: "umowa" | "nda"), nie
// dwie osobne — dzielą e-podpis, wysyłkę mailem i cały wzorzec strukturalny,
// różni je tylko treść klauzul i to, które pola zmienne mają sens (Umowa ma
// zakres/cenę z oferty, NDA nie).
//
// Treść klauzul (CONTRACT_CLAUSES/NDA_CLAUSES) jest ŚWIADOMIE stała — jeden
// szablon prawny na wszystkie umowy/NDA (decyzja właściciela z 2026-07-14),
// zmienne są tylko pola per-rekord (zakres prac, cena, waluta, termin).
// WAŻNE: treść jest roboczym szablonem, NIE przeszła jeszcze weryfikacji
// prawnika — stąd LEGAL_PLACEHOLDER_NOTE wyświetlana na każdym dokumencie
// (patrz docs/plany-modulow/11-umowy-i-nda.md, pytanie 5). Świadomie tylko
// po polsku — treść prawna wymaga weryfikacji prawnika niezależnie od
// języka, tłumaczenie dokładałoby pracę bez realnej wartości na tym etapie.

export type ContractTyp = "umowa" | "nda";
export const CONTRACT_TYPY: ContractTyp[] = ["umowa", "nda"];
export const CONTRACT_TYP_LABEL: Record<ContractTyp, string> = {
  umowa: "Umowa",
  nda: "NDA",
};

export type ContractStatus = "Szkic" | "Wysłana" | "Podpisana" | "Odrzucona";
export const CONTRACT_STATUSES: ContractStatus[] = ["Szkic", "Wysłana", "Podpisana", "Odrzucona"];

export const CONTRACT_STATUS_CLASS: Record<string, string> = {
  Szkic: "bg-[var(--hairline)] text-muted",
  Wysłana: "bg-brand-cyan/15 text-brand-cyan",
  Podpisana: "bg-emerald-500/20 text-emerald-400 font-semibold",
  Odrzucona: "bg-red-500/15 text-red-400",
};

/** Statusy zamknięte — dokument nie jest już "w grze". */
export const CLOSED_CONTRACT_STATUSES = new Set<ContractStatus>(["Podpisana", "Odrzucona"]);

export type Contract = {
  id: string;
  typ: ContractTyp;
  status: ContractStatus;
  lead_id: string | null;
  client_id: string | null;
  project_id: string | null;
  offer_id: string | null;
  klient_nazwa: string;
  klient_nip: string;
  klient_ulica: string;
  klient_kod: string;
  klient_miasto: string;
  klient_kraj: string;
  klient_email: string;
  /** Tylko dla typ="umowa" — kopiowane z zaakceptowanej oferty, edytowalne. */
  zakres_prac: string;
  cena: number;
  waluta: string;
  termin_realizacji: string | null;
  uwagi: string;
  share_token: string | null;
  /** E-podpis (ten sam mechanizm co Oferty, lib/offerAccept.ts). Puste
   * accepted_by_name = podpisano ręcznie w panelu (właściciel/papierowo),
   * wypełnione = druga strona podpisała się sama przez publiczny link. */
  accepted_at: string | null;
  accepted_by_name: string | null;
  accepted_ip: string | null;
  accepted_user_agent: string | null;
  created_at: string;
  updated_at: string;
};

/** Ostrzeżenie wyświetlane na każdym dokumencie (panel + wydruk/publiczny
 * link) — treść klauzul to roboczy szablon, nie wolno używać z prawdziwym
 * klientem bez weryfikacji prawnika. Patrz uzasadnienie na górze pliku. */
export const LEGAL_PLACEHOLDER_NOTE =
  "SZABLON — WYMAGA WERYFIKACJI PRAWNEJ przed użyciem z prawdziwym klientem. Treść poniżej to robocza wersja, nie sprawdzona jeszcze przez prawnika.";

export type Clause = { title: string; text: string };

/** Stałe klauzule Umowy — pole "Przedmiot umowy" NIE jest tu, bo to pole
 * zmienne (contract.zakres_prac), renderowane osobno przed tą listą. */
export const CONTRACT_CLAUSES: Clause[] = [
  {
    title: "Wyłączenia",
    text: "Zakres nie obejmuje prac wykraczających poza przedmiot umowy opisany wyżej. Wszelkie prace dodatkowe wymagają odrębnej wyceny i pisemnej (w tym mailowej) akceptacji obu stron przed ich rozpoczęciem.",
  },
  {
    title: "Zmiana zakresu",
    text: "Każda zmiana zakresu prac (change request) wymaga sporządzenia odrębnej wyceny lub aneksu do niniejszej umowy i nie jest realizowana bez uprzedniej pisemnej zgody Zamawiającego co do zakresu i dodatkowego wynagrodzenia.",
  },
  {
    title: "Reklamacje i poprawki",
    text: "Wykonawca zapewnia dwie bezpłatne rundy poprawek w terminie 14 dni od odbioru danego etapu prac. Zgłoszenia po tym terminie lub wykraczające poza uzgodniony zakres traktowane są jako nowe, odrębnie wyceniane zlecenie.",
  },
  {
    title: "Własność intelektualna",
    text: "Z chwilą dokonania pełnej zapłaty wynagrodzenia autorskie prawa majątkowe do utworów stworzonych w ramach niniejszej umowy (w tym kodu źródłowego) przechodzą na Zamawiającego w zakresie objętym przedmiotem umowy. Do czasu pełnej zapłaty prawa te pozostają przy Wykonawcy.",
  },
  {
    title: "Ograniczenie odpowiedzialności",
    text: "Odpowiedzialność Wykonawcy za szkody wynikłe z niewykonania lub nienależytego wykonania niniejszej umowy jest ograniczona do wysokości wynagrodzenia otrzymanego za przedmiot umowy, z wyłączeniem szkód wyrządzonych umyślnie.",
  },
  {
    title: "Warunki płatności",
    text: "Wynagrodzenie płatne jest na podstawie faktury VAT wystawionej po zakończeniu prac lub uzgodnionego etapu, w terminie 14 dni od daty wystawienia, przelewem na rachunek bankowy wskazany na fakturze.",
  },
];

/** Stałe klauzule NDA. */
export const NDA_CLAUSES: Clause[] = [
  {
    title: "Cel",
    text: "Strony zamierzają prowadzić rozmowy dotyczące potencjalnej współpracy, w toku których mogą ujawniać sobie informacje poufne dotyczące swojej działalności, systemów i danych.",
  },
  {
    title: "Informacje poufne",
    text: "Za informacje poufne uznaje się wszelkie informacje techniczne, handlowe, organizacyjne i osobowe ujawnione przez jedną stronę drugiej w związku z rozmowami, oznaczone jako poufne lub takie, których poufny charakter wynika z okoliczności ujawnienia.",
  },
  {
    title: "Zobowiązanie do zachowania poufności",
    text: "Strona otrzymująca zobowiązuje się nie ujawniać informacji poufnych osobom trzecim oraz wykorzystywać je wyłącznie w celu oceny i realizacji potencjalnej współpracy.",
  },
  {
    title: "Wyłączenia",
    text: "Zobowiązanie nie dotyczy informacji, które są publicznie dostępne, były już znane stronie otrzymującej przed ujawnieniem, lub muszą zostać ujawnione na podstawie bezwzględnie obowiązujących przepisów prawa.",
  },
  {
    title: "Okres obowiązywania",
    text: "Zobowiązanie do zachowania poufności obowiązuje przez 2 lata od dnia podpisania niniejszej umowy.",
  },
];

/** Adres klienta jako linie do wydruku — wzorem lib/documents.ts. */
export function clientAddressLines(
  c: Pick<Contract, "klient_ulica" | "klient_kod" | "klient_miasto" | "klient_kraj">
): string[] {
  const lines: string[] = [];
  if (c.klient_ulica) lines.push(c.klient_ulica);
  const kodMiasto = [c.klient_kod, c.klient_miasto].filter(Boolean).join(" ");
  if (kodMiasto) lines.push(kodMiasto);
  if (c.klient_kraj) lines.push(c.klient_kraj);
  return lines;
}

/** Referencja dokumentu do wydruku (np. "UM-2026-A1B2C3" / "NDA-2026-A1B2C3")
 * — wzorem offerReference, bez formalnej numeracji fiskalnej. */
export function contractReference(c: Pick<Contract, "id" | "typ" | "created_at">): string {
  const prefix = c.typ === "nda" ? "NDA" : "UM";
  const year = new Date(c.created_at).getFullYear();
  return `${prefix}-${year}-${c.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/** Czy dokument jeszcze "czeka" — pomocnicze do liczników na Pulpicie/liście. */
export function isContractPending(c: Pick<Contract, "status">): boolean {
  return !CLOSED_CONTRACT_STATUSES.has(c.status);
}
