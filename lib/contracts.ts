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

import { type DocLang } from "./documents";

export type ContractTyp = "umowa" | "nda";
export const CONTRACT_TYPY: ContractTyp[] = ["umowa", "nda"];
export const CONTRACT_TYP_LABEL: Record<ContractTyp, string> = {
  umowa: "Umowa",
  nda: "NDA",
};

/** Etykieta typu dokumentu wg języka wydruku (`contract.jezyk`) — używana
 * tylko na publicznym/podglądowym wydruku (ContractPrint.tsx), NIE w panelu
 * admina (tam zawsze po polsku, patrz CONTRACT_TYP_LABEL). */
export const CONTRACT_TYP_LABEL_LANG: Record<DocLang, Record<ContractTyp, string>> = {
  pl: { umowa: "Umowa", nda: "NDA" },
  en: { umowa: "Agreement", nda: "NDA" },
  de: { umowa: "Vertrag", nda: "NDA" },
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
  /** Kiedy dokument ostatnio poszedł mailem do podpisu (Moduł 31). Osobno od
   * `updated_at`, które skacze przy każdej edycji — na tym stoi licznik dni
   * ciszy na Pulpicie (patrz contractSilenceDays). Null = nigdy nie wysłany
   * mailem z panelu. */
  sent_at: string | null;
  /** E-podpis (ten sam mechanizm co Oferty, lib/offerAccept.ts). Puste
   * accepted_by_name = podpisano ręcznie w panelu (właściciel/papierowo),
   * wypełnione = druga strona podpisała się sama przez publiczny link. */
  accepted_at: string | null;
  accepted_by_name: string | null;
  accepted_ip: string | null;
  accepted_user_agent: string | null;
  created_at: string;
  updated_at: string;
  /** Język wydruku/publicznego linku (pl/en/de) — dla typ="umowa" dziedziczony
   * z języka oferty przy generowaniu (app/api/contracts POST), dla typ="nda"
   * zawsze 'pl' (NDA nie ma powiązanej oferty, z której można by dziedziczyć).
   * WAŻNE: dotyczy tylko "chrome" wydruku (nagłówki, przyciski, e-podpis) —
   * treść klauzul (CONTRACT_CLAUSES/NDA_CLAUSES) zostaje świadomie tylko po
   * polsku, patrz komentarz na górze pliku. */
  jezyk: DocLang;
};

/** Ostrzeżenie wyświetlane na każdym dokumencie (panel + wydruk/publiczny
 * link) — treść klauzul to roboczy szablon, nie wolno używać z prawdziwym
 * klientem bez weryfikacji prawnika. Patrz uzasadnienie na górze pliku. */
export const LEGAL_PLACEHOLDER_NOTE =
  "SZABLON — WYMAGA WERYFIKACJI PRAWNEJ przed użyciem z prawdziwym klientem. Treść poniżej to robocza wersja, nie sprawdzona jeszcze przez prawnika.";

/** Wersje językowe LEGAL_PLACEHOLDER_NOTE — to metainformacja o dokumencie
 * ("to szkic, wymaga weryfikacji prawnej"), NIE klauzula prawna, więc
 * bezpieczna do tłumaczenia już teraz, mimo że same klauzule (CONTRACT_
 * CLAUSES/NDA_CLAUSES) świadomie zostają tylko po polsku, dopóki nie
 * przejdą weryfikacji prawnika. */
export const LEGAL_PLACEHOLDER_NOTE_LANG: Record<DocLang, string> = {
  pl: LEGAL_PLACEHOLDER_NOTE,
  en: "TEMPLATE — REQUIRES LEGAL REVIEW before use with a real client. The content below is a working draft, not yet reviewed by a lawyer.",
  de: "VORLAGE — RECHTLICHE PRÜFUNG ERFORDERLICH vor der Verwendung mit einem echten Kunden. Der nachfolgende Inhalt ist ein Arbeitsentwurf, der noch nicht von einem Anwalt geprüft wurde.",
};

/** Pokazywana obok klauzul na wydruku niepolskojęzycznym — same klauzule
 * renderują się nadal po polsku (patrz CONTRACT_CLAUSES/NDA_CLAUSES),
 * więc czytelnik obcojęzycznej wersji dokumentu musi wiedzieć, że czeka je
 * jeszcze tłumaczenie + weryfikacja prawna, zanim będzie można użyć ich z
 * prawdziwym zagranicznym klientem. */
export const CLAUSES_UNTRANSLATED_NOTE: Record<DocLang, string> = {
  pl: "",
  en: "The clauses below are currently available in Polish only — translation and legal review are pending.",
  de: "Die folgenden Klauseln liegen derzeit nur auf Polnisch vor — Übersetzung und rechtliche Prüfung stehen noch aus.",
};

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
    title: "Kopie zapasowe i zmiany po stronie Zamawiającego",
    text: "Zamawiający odpowiada za wykonywanie i przechowywanie własnych kopii zapasowych danych i systemów, chyba że wykonywanie kopii zapasowych zostało wyraźnie ujęte w przedmiocie umowy. Wykonawca nie ponosi odpowiedzialności za utratę danych, błędy działania ani przerwy w dostępności wynikające ze zmian wprowadzonych w systemie, konfiguracji lub danych przez Zamawiającego lub osoby trzecie po odbiorze prac, dokonanych bez wiedzy i pisemnej zgody Wykonawcy.",
  },
  {
    title: "Zależność od systemów i usług stron trzecich",
    text: "Wykonawca nie ponosi odpowiedzialności za nieprawidłowe działanie, przerwy w dostępności, zmiany w interfejsach (API), warunkach korzystania lub cennikach systemów i usług stron trzecich (w tym systemów Zamawiającego oraz zewnętrznych dostawców oprogramowania/chmury), z których korzysta wdrożone rozwiązanie, o ile pozostają one poza kontrolą Wykonawcy.",
  },
  {
    title: "Dane i dostępy dostarczane przez Zamawiającego",
    text: "Realizacja przedmiotu umowy opiera się na danych, dostępach i dokumentacji dostarczonych przez Zamawiającego. Opóźnienia lub błędy wynikające z niekompletnych, nieaktualnych lub błędnych danych/dostępów, a także z opóźnienia w ich dostarczeniu, przesuwają odpowiednio terminy realizacji i nie obciążają Wykonawcy.",
  },
  {
    title: "Charakter modeli AI i weryfikacja wyników",
    text: "Wykonawca nie gwarantuje, że wyniki generowane przez modele sztucznej inteligencji (w tym modele językowe uruchamiane lokalnie) będą w każdym przypadku poprawne, kompletne lub wolne od błędów ('halucynacji'). Zamawiający zobowiązuje się nie wykorzystywać tych wyników bez weryfikacji przez człowieka w procesach o istotnym znaczeniu (finansowych, prawnych, medycznych, bezpieczeństwa) i ponosi odpowiedzialność za decyzje podjęte na ich podstawie.",
  },
  {
    title: "Licencje modeli i komponentów open-source",
    text: "Wdrożone modele językowe i inne komponenty open-source podlegają własnym licencjom producentów. Zamawiający odpowiada za przestrzeganie warunków tych licencji (w tym ewentualnych ograniczeń komercyjnych) w toku dalszego korzystania z wdrożonego rozwiązania; Wykonawca informuje o wybranej licencji na etapie doboru modelu, lecz nie ponosi odpowiedzialności za jej późniejszą zmianę przez producenta.",
  },
  {
    title: "Infrastruktura i dostępność",
    text: "O ile Strony nie uzgodniły inaczej w odrębnym dokumencie, Zamawiający odpowiada za zapewnienie infrastruktury (sprzętu, mocy obliczeniowej, hostingu) wymaganej do działania wdrożonego rozwiązania, w tym modeli uruchamianych lokalnie. Wykonawca nie gwarantuje określonego poziomu dostępności (SLA) usługi, chyba że został on wyraźnie określony i wyceniony jako odrębny element przedmiotu umowy.",
  },
  {
    title: "Odbiór prac",
    text: "Zakończenie danego etapu lub całości prac potwierdzane jest pisemnie (w tym mailowo) przez Zamawiającego w oparciu o zgodność z przedmiotem umowy. Brak zgłoszenia uwag w terminie 7 dni od przekazania informacji o zakończeniu etapu uznaje się za jego milczący odbiór.",
  },
  {
    title: "Ochrona danych osobowych",
    text: "Jeżeli w toku realizacji przedmiotu umowy Wykonawca uzyskuje dostęp do danych osobowych przetwarzanych przez Zamawiającego, Strony zawrą odrębną umowę powierzenia przetwarzania danych osobowych (zgodną z RODO), która ma pierwszeństwo w zakresie zasad przetwarzania tych danych.",
  },
  {
    title: "Wsparcie powdrożeniowe",
    text: "Niniejsza umowa obejmuje jednorazowe wdrożenie opisane w przedmiocie umowy. Dalsze utrzymanie, monitorowanie i dostosowywanie wdrożonego rozwiązania do zmian w systemach zewnętrznych (w tym w integrowanych systemach i API) stanowi odrębną, dodatkowo płatną usługę, chyba że wyraźnie ujęto ją w przedmiocie umowy.",
  },
  {
    title: "Poufność",
    text: "Strony zobowiązują się zachować w poufności informacje techniczne i handlowe uzyskane w związku z realizacją niniejszej umowy, również po jej zakończeniu. Wykonawca zachowuje prawo do wykorzystywania ogólnej wiedzy, doświadczenia, metodologii i narzędzi (frameworków) wypracowanych w toku realizacji w innych, niekonkurencyjnych projektach, o ile nie ujawnia przy tym informacji poufnych ani danych identyfikujących Zamawiającego.",
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

/* --------------------------------------------- Moduł 31 — cisza po wysyłce -- */

/** Po ilu dniach ciszy umowa/NDA odzywa się na Pulpicie i w dziennym mailu.
 * Decyzja właściciela 2026-07-17: tydzień. Klient zdążył przeczytać i
 * przemyśleć, a Ty nie dostajesz szturchańca następnego dnia po wysyłce —
 * Pulpit, który krzyczy bez powodu, uczy się ignorować. */
export const CONTRACT_STALE_DAYS = 7;

/** Ile pełnych dni minęło od wysłania dokumentu do podpisu.
 *
 * `null`, gdy nie ma czego liczyć: dokument nie jest "Wysłana" (szkic nigdzie
 * nie poszedł, podpisany/odrzucony jest zamknięty), albo nie ma `sent_at`.
 * Puste `sent_at` przy statusie "Wysłana" jest możliwe tylko teoretycznie —
 * migracja robi backfill z `updated_at` (lib/db.ts, createContractsSchema) —
 * ale wolimy milczeć niż zgadywać.
 *
 * `sent_at` to TIMESTAMPTZ, więc porównujemy MOMENTY, nie dni kalendarzowe —
 * `new Date()` jest tu na miejscu (ta sama zasada co notificationAge w
 * lib/notifications.ts, nie dotyczy jej ostrzeżenie o todayLocalISO).
 */
export function contractSilenceDays(
  c: Pick<Contract, "status" | "sent_at">,
  now: number = Date.now()
): number | null {
  if (c.status !== "Wysłana") return null;
  if (!c.sent_at) return null;
  const sent = new Date(c.sent_at).getTime();
  if (!Number.isFinite(sent)) return null;
  const days = Math.floor((now - sent) / 86_400_000);
  return days < 0 ? 0 : days;
}

/** Czy dokument wisi niepodpisany na tyle długo, żeby się o nim przypomnieć. */
export function isContractStale(c: Pick<Contract, "status" | "sent_at">, now: number = Date.now()): boolean {
  const days = contractSilenceDays(c, now);
  return days != null && days >= CONTRACT_STALE_DAYS;
}

/** Czy projekt wystartował formalnie zgodnie z zasadą "papier przed pracą".
 *
 * Miara Etapu 3 z mapy drogi klienta (cel: 100%). Liczona TYLKO po projektach
 * z klientem — projekt bez `client_id` to robota wewnętrzna, nie ma z kim
 * podpisywać umowy, a wliczanie go zaniżałoby wskaźnik i uczyło go ignorować
 * (ta sama granica co bramka w api/projects/[id], decyzja właściciela
 * 2026-07-17). Zwraca `null`, gdy nie ma czego mierzyć — zero projektów z
 * klientem daje "—", nie mylące "0%".
 */
export function signedContractRate(
  projects: { id: string; client_id: string | null }[],
  contracts: Pick<Contract, "typ" | "status" | "project_id">[]
): { rate: number; withContract: number; total: number } | null {
  const clientProjects = projects.filter((p) => p.client_id);
  if (clientProjects.length === 0) return null;
  const signedFor = new Set(
    contracts
      .filter((c) => c.typ === "umowa" && c.status === "Podpisana" && c.project_id)
      .map((c) => c.project_id as string)
  );
  const withContract = clientProjects.filter((p) => signedFor.has(p.id)).length;
  return { rate: withContract / clientProjects.length, withContract, total: clientProjects.length };
}
