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

import { type DocLang, documentYear } from "./documents";
import { mapaStanow } from "./kolorStanu";

export type ContractTyp = "umowa" | "nda" | "dpa" | "aneks";

/** Typy, które da się utworzyć od zera przyciskiem „+ Nowy dokument".
 *
 * Aneksu **nie ma na tej liście świadomie** — aneks nie istnieje samodzielnie,
 * zawsze powstaje z konkretnej podpisanej umowy (`POST /api/contracts/:id/aneks`).
 * Aneks bez umowy-matki nie miałby czego zmieniać. */
export const CONTRACT_TYPY: ContractTyp[] = ["umowa", "nda", "dpa"];

export const CONTRACT_TYP_LABEL: Record<ContractTyp, string> = {
  umowa: "Umowa",
  nda: "NDA",
  dpa: "Powierzenie danych",
  aneks: "Aneks",
};

/** Etykieta typu dokumentu wg języka wydruku (`contract.jezyk`) — używana
 * tylko na publicznym/podglądowym wydruku (ContractPrint.tsx), NIE w panelu
 * admina (tam zawsze po polsku, patrz CONTRACT_TYP_LABEL). */
export const CONTRACT_TYP_LABEL_LANG: Record<DocLang, Record<ContractTyp, string>> = {
  pl: { umowa: "Umowa", nda: "NDA", dpa: "Umowa powierzenia przetwarzania danych osobowych", aneks: "Aneks" },
  en: { umowa: "Agreement", nda: "NDA", dpa: "Data Processing Agreement", aneks: "Amendment" },
  de: { umowa: "Vertrag", nda: "NDA", dpa: "Auftragsverarbeitungsvertrag", aneks: "Nachtrag" },
};

export type ContractStatus = "Szkic" | "Wysłana" | "Podpisana" | "Odrzucona";
export const CONTRACT_STATUSES: ContractStatus[] = ["Szkic", "Wysłana", "Podpisana", "Odrzucona"];

/* „Wysłana" fioletem — patrz komentarz przy OFFER_STATUS_CLASS (lib/offers.ts).
 * Umowa wysłana do podpisu to dokładnie ta sama sytuacja co oferta wysłana do
 * decyzji, więc ma ten sam kolor po obu stronach. */
export const CONTRACT_STATUS_CLASS: Record<string, string> = mapaStanow({
  Szkic: "nieruszone",
  Wysłana: "uNich",
  Podpisana: "sukces",
  // Neutralnie, nie czerwono — patrz OFFER_STATUS_CLASS (lib/offers.ts).
  Odrzucona: "zamkniete",
});

/** Dlaczego druga strona nie podpisała — krótka, ZAMKNIĘTA lista (audyt
 * Modułu 11, 2026-07-27), wzorem `OFFER_REJECT_REASONS`.
 *
 * Powody są INNE niż przy ofercie i to jest sedno: ofertę przegrywa się na
 * cenie i terminie, a umowę na zapisach — odpowiedzialności, prawach do kodu,
 * poufności. Wspólna lista dla obu dokumentów zlałaby dwie różne porażki
 * w jedną statystykę i nie powiedziałaby nic o tym, którą klauzulę trzeba
 * przepisać. */
export const CONTRACT_REJECT_REASONS = [
  "Zapisy nie do przyjęcia",
  "Wymagają własnego wzoru umowy",
  "Zmiana planów po ich stronie",
  "Brak decyzji / ucichło",
  "Inny powód",
] as const;
export type ContractRejectReason = (typeof CONTRACT_REJECT_REASONS)[number];

export function isContractRejectReason(v: unknown): v is ContractRejectReason {
  return typeof v === "string" && (CONTRACT_REJECT_REASONS as readonly string[]).includes(v);
}

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
  /** Moduł 40 — ręczne unieważnienie publicznego linku. Blokuje i podgląd,
   * i złożenie e-podpisu (patrz lib/shareLinks.ts). */
  share_revoked_at: string | null;
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
  /** Ślad otwarcia publicznego linku (wzorem ofert) — automaty się nie liczą,
   * patrz lib/publicVisit.ts. */
  otwarta_at: string | null;
  ostatnio_otwarta_at: string | null;
  liczba_otwarc: number;
  /** Ostatnie przypomnienie o niepodpisanym dokumencie (`/remind`). */
  przypomniano_at: string | null;
  /** Okres obowiązywania UMOWY — co innego niż `termin_realizacji` (koniec
   * pracy). `odnawialna` = przedłuża się milcząco, więc liczy się termin
   * wypowiedzenia, nie sama data końca. */
  obowiazuje_od: string | null;
  obowiazuje_do: string | null;
  wypowiedzenie_dni: number;
  odnawialna: boolean;
  /** Rodzaj umowy — wybiera zestaw stałych klauzul (CONTRACT_TEMPLATES). */
  szablon: string;
  /** DPA (art. 28 ust. 3 RODO) — bez tych trzech pól umowa powierzenia jest
   * niekompletna: przepis wymaga wskazania rodzaju danych, kategorii osób
   * i (przy podpowierzeniu) dalszych podmiotów przetwarzających. */
  dpa_kategorie_danych: string;
  dpa_kategorie_osob: string;
  dpa_podprocesorzy: string;
  /** Płatność etapami — zaliczka w procentach wynagrodzenia i opis kamieni
   * płatniczych. 0 = płatność jednorazowo po zakończeniu (jak dotąd). */
  zaliczka_procent: number;
  platnosci_opis: string;
  /** Stanowisko osoby podpisującej po drugiej stronie — wpisuje je ONA sama
   * przy składaniu podpisu, nie właściciel za nią. */
  accepted_by_role: string | null;
  /** Podpis po naszej stronie — data i imię, bez IP (to nie jest podpis
   * złożony przez internet, tylko odnotowanie własnego). */
  podpis_nasz_at: string | null;
  podpis_nasz_osoba: string | null;
  /** Dlaczego druga strona nie podpisała — jeden z `CONTRACT_REJECT_REASONS`
   * (pusty dla dokumentów, które nie są odrzucone) plus zdanie własnymi
   * słowami. Wyjście ze statusu „Odrzucona" czyści oba pola. */
  powod_odrzucenia: string;
  komentarz_odrzucenia: string;
  odrzucona_at: string | null;
  created_at: string;
  updated_at: string;
  /** Aneks (Moduł 58) — umowa-matka, numer aneksu w jej obrębie i migawka
   * warunków, które aneks zmienia. Dla umowy/NDA: `null`, 0, `null`.
   * Szczegóły i uzasadnienie: sekcja „Aneks" na dole tego pliku. */
  parent_contract_id: string | null;
  aneks_nr: number;
  poprzednie: PoprzednieWarunki | null;
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

/* ------------------------------------ Migawka dokumentu (audyt Modułu 11) -- */

/** Pola dokumentu, które przy podglądzie publicznym MUSZĄ być żywe, nawet gdy
 * reszta idzie z migawki zrobionej przy wysyłce.
 *
 * Zasada jest ta sama, co przy ofertach (audyt Modułu 57): **do migawki idzie
 * to, co NAPISAŁ właściciel; żywe zostaje to, co ZROBIŁA druga strona (podpis,
 * nazwisko) i sterowanie dokumentem** (status, unieważnienie linku). Bez tego
 * druga strona po złożeniu podpisu dalej widziałaby przycisk „Podpisuję".
 *
 * `id` i `created_at` są tu, bo z nich liczy się referencja dokumentu
 * (`contractReference`) i adres linku — migawka nie ma prawa ich zmienić.
 *
 * **Kolejność scalania jest całą różnicą**: migawka jest PODSTAWĄ, a z bazy
 * dokłada się wyłącznie ta lista. Odwrotna kolejność (`{...migawka, ...wiersz}`)
 * unieważnia funkcję po cichu — na tym poległa pierwsza wersja migawki oferty. */
export const CONTRACT_ZAWSZE_ZYWE = [
  "id",
  "created_at",
  "status",
  "accepted_at",
  "accepted_by_name",
  // Stanowisko wpisuje druga strona przy podpisie — to jest jej ruch, jak sam
  // podpis, więc nigdy nie idzie do migawki.
  "accepted_by_role",
  // Nasz podpis może zostać dopisany PO wysyłce (np. podpisujemy jako drudzy),
  // a druga strona ma widzieć aktualny stan obu rubryk.
  "podpis_nasz_at",
  "podpis_nasz_osoba",
  "share_revoked_at",
] as const;

/** Pola idące do migawki — czyli treść dokumentu w chwili wysyłki.
 *
 * Świadomie wyliczone z nazwy, nie „wszystko poza X": nowa kolumna ma domyślnie
 * NIE trafiać do migawki, dopóki ktoś świadomie jej tu nie dopisze. Odwrotna
 * domyślność zamroziłaby kiedyś pole, które powinno żyć — dokładnie tak
 * `wybrana` i `wazna_do` wpadły do migawki oferty. */
export const CONTRACT_MIGAWKA_POLA = [
  "typ",
  "jezyk",
  "klient_nazwa",
  "klient_nip",
  "klient_ulica",
  "klient_kod",
  "klient_miasto",
  "klient_kraj",
  "klient_email",
  "zakres_prac",
  "cena",
  "waluta",
  "termin_realizacji",
  "uwagi",
  "aneks_nr",
  "poprzednie",
  // Okres obowiązywania i rodzaj umowy to TREŚĆ dokumentu — zamrażamy razem
  // z resztą (2026-07-27). Zmiana daty końca po wysyłce nie może po cichu
  // zmienić dokumentu, który druga strona już czyta.
  "obowiazuje_od",
  "obowiazuje_do",
  "wypowiedzenie_dni",
  "odnawialna",
  "szablon",
  "dpa_kategorie_danych",
  "dpa_kategorie_osob",
  "dpa_podprocesorzy",
  "zaliczka_procent",
  "platnosci_opis",
] as const;

/** Klauzule umowy powierzenia przetwarzania danych osobowych (DPA).
 *
 * **Skąd ta lista.** To nie jest twórczość prawna, tylko odwzorowanie
 * wymagań art. 28 ust. 3 RODO punkt po punkcie: przetwarzanie wyłącznie na
 * udokumentowane polecenie, zobowiązanie do poufności, środki bezpieczeństwa
 * (art. 32), warunki podpowierzenia, pomoc administratorowi przy prawach osób
 * i przy naruszeniach, usunięcie albo zwrot danych po zakończeniu, oraz
 * udostępnienie informacji i poddanie się audytom. Brzmienie i tak wymaga
 * weryfikacji prawnika — dokument nosi LEGAL_PLACEHOLDER_NOTE jak reszta.
 *
 * **Czego tu ŚWIADOMIE nie ma:** rodzaju danych, kategorii osób, celu i czasu
 * przetwarzania. To nie są klauzule stałe — art. 28 wymaga określenia ich
 * KONKRETNIE dla danego powierzenia, więc mieszkają w polach rekordu
 * (`dpa_kategorie_danych`, `dpa_kategorie_osob`, `zakres_prac`,
 * `obowiazuje_od/do`) i drukują się nad klauzulami. Wpisanie ich na sztywno
 * dałoby dokument, który wygląda poprawnie i mówi nieprawdę. */
export const DPA_CLAUSES: Clause[] = [
  {
    title: "Role stron",
    text: "Zamawiający jest administratorem danych osobowych w rozumieniu RODO, a Wykonawca podmiotem przetwarzającym. Wykonawca przetwarza dane osobowe wyłącznie w zakresie i w celu niezbędnym do wykonania umowy głównej, wskazanym powyżej.",
  },
  {
    title: "Polecenia administratora",
    text: "Wykonawca przetwarza dane osobowe wyłącznie na udokumentowane polecenie Zamawiającego, w tym w zakresie przekazywania danych do państwa trzeciego, chyba że obowiązek taki nakłada na niego prawo Unii lub prawo państwa członkowskiego. W takim przypadku Wykonawca informuje Zamawiającego o tym obowiązku przed rozpoczęciem przetwarzania, o ile prawo to nie zabrania takiego informowania.",
  },
  {
    title: "Poufność osób upoważnionych",
    text: "Wykonawca zapewnia, by osoby upoważnione do przetwarzania danych osobowych zobowiązały się do zachowania poufności lub podlegały odpowiedniemu ustawowemu obowiązkowi zachowania tajemnicy. Wykonawca prowadzi ewidencję osób upoważnionych.",
  },
  {
    title: "Bezpieczeństwo przetwarzania",
    text: "Wykonawca wdraża środki techniczne i organizacyjne zapewniające stopień bezpieczeństwa odpowiadający ryzyku, zgodnie z art. 32 RODO — w szczególności kontrolę dostępu do systemów, szyfrowanie nośników i kopii zapasowych oraz rozdzielenie środowisk. Wdrożenia realizowane lokalnie w infrastrukturze Zamawiającego pozostają pod jego kontrolą techniczną; Wykonawca odpowiada za środki po swojej stronie.",
  },
  {
    title: "Dalsze podmioty przetwarzające",
    text: "Wykonawca nie korzysta z usług innego podmiotu przetwarzającego bez uprzedniej szczegółowej lub ogólnej pisemnej zgody Zamawiającego. Podmioty, z których Wykonawca korzysta na dzień zawarcia niniejszej umowy, wskazano powyżej. O zamierzonych zmianach Wykonawca informuje Zamawiającego, dając mu możliwość wyrażenia sprzeciwu. Na dalsze podmioty przetwarzające Wykonawca nakłada te same obowiązki ochrony danych, które wynikają z niniejszej umowy.",
  },
  {
    title: "Pomoc administratorowi",
    text: "Wykonawca, biorąc pod uwagę charakter przetwarzania, pomaga Zamawiającemu wywiązać się z obowiązku odpowiadania na żądania osób, których dane dotyczą, oraz — uwzględniając charakter przetwarzania i dostępne mu informacje — z obowiązków określonych w art. 32–36 RODO (bezpieczeństwo, zgłaszanie naruszeń, ocena skutków, uprzednie konsultacje).",
  },
  {
    title: "Zgłaszanie naruszeń",
    text: "Wykonawca zgłasza Zamawiającemu każde naruszenie ochrony danych osobowych bez zbędnej zwłoki, nie później niż w ciągu 24 godzin od jego stwierdzenia, przekazując informacje niezbędne do wykonania przez Zamawiającego obowiązku zgłoszenia organowi nadzorczemu.",
  },
  {
    title: "Zwrot albo usunięcie danych",
    text: "Po zakończeniu świadczenia usług związanych z przetwarzaniem Wykonawca, zależnie od decyzji Zamawiającego, usuwa lub zwraca mu wszelkie dane osobowe oraz usuwa ich istniejące kopie, chyba że prawo Unii lub prawo państwa członkowskiego nakazuje przechowywanie tych danych.",
  },
  {
    title: "Informacje i audyty",
    text: "Wykonawca udostępnia Zamawiającemu informacje niezbędne do wykazania spełnienia obowiązków określonych w art. 28 RODO oraz umożliwia Zamawiającemu lub audytorowi przez niego upoważnionemu przeprowadzanie audytów, w tym inspekcji, i przyczynia się do nich. Audyt odbywa się w uzgodnionym terminie, w godzinach pracy i w sposób nieutrudniający bieżącej działalności Wykonawcy.",
  },
  {
    title: "Odpowiedzialność",
    text: "Wykonawca odpowiada za szkody spowodowane przetwarzaniem, jeśli nie dopełnił obowiązków, które RODO nakłada bezpośrednio na podmioty przetwarzające, lub gdy działał poza zgodnymi z prawem poleceniami Zamawiającego albo wbrew tym poleceniom. W pozostałym zakresie stosuje się ograniczenie odpowiedzialności z umowy głównej.",
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
  const prefix = c.typ === "nda" ? "NDA" : c.typ === "dpa" ? "DPA" : "UM";
  // `documentYear`, NIE `new Date()` — patrz komentarz przy tej funkcji
  // (znacznik czasu z Postgresa jest nieparsowalny dla Safari).
  return `${prefix}-${documentYear(c.created_at)}-${c.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
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

/* ------------------------------------------- Aneks (Moduł 58, 2026-07-27) -- */

/**
 * **Dlaczego aneks w ogóle powstał.** `lib/blokadaDokumentu.ts` odmawia zmiany
 * podpisanej umowy zdaniem „Zmiana wymaga aneksu." — a aneksu w systemie nie
 * było. Panel odsyłał właściciela po coś, czego nie potrafił zrobić, więc
 * podpisana umowa była ślepym zaułkiem. Audyt Modułu 57 nazwał to najcięższym
 * brakiem w całym łańcuchu dokumentów: faktura ma korektę, oferta ma nową
 * wersję, umowa nie miała nic.
 *
 * **Czym aneks NIE jest.** Nie jest nową wersją umowy w rozumieniu ofert.
 * Zastąpiona oferta dostaje `superseded_at` i wypada z liczników, bo nie jest
 * ani wygrana, ani przegrana. Aneksowana umowa **dalej obowiązuje** — obie
 * strony ją podpisały i nic tego nie cofa. Dlatego oryginał zostaje
 * nietknięty, w statusie „Podpisana", i liczy się dalej wszędzie, gdzie się
 * liczył. Aneks jest dokumentem OBOK, nie ZAMIAST.
 *
 * **Dlaczego „było → jest", a nie pełna kopia umowy** (decyzja właściciela
 * 2026-07-27): przy zmianie samego terminu pełna kopia kazałaby klientowi
 * czytać dziesięć stron po raz drugi, żeby znaleźć jedno zdanie. Aneks pokazuje
 * WYŁĄCZNIE to, co się zmienia, i kończy zdaniem „pozostałe postanowienia
 * pozostają bez zmian" — czyli dokładnie tak, jak wygląda aneks papierowy.
 */

/** Pola umowy, które aneks potrafi zmienić.
 *
 * Świadomie WĄSKA lista: to są warunki handlowe, o które toczy się rozmowa po
 * podpisaniu (zakres wzrósł, cena za nim, termin się przesunął). Danych stron
 * (nazwa, NIP, adres) aneks NIE zmienia — zmiana strony umowy to nie aneks,
 * tylko nowa umowa z innym podmiotem. Stałe klauzule też nie: są identyczne
 * dla każdej umowy i żyją w kodzie, nie w wierszu. */
export const POLA_ANEKSU = ["zakres_prac", "cena", "waluta", "termin_realizacji"] as const;
export type PoleAneksu = (typeof POLA_ANEKSU)[number];

/** Nagłówki zmienianych pól na wydruku aneksu, per język dokumentu. */
export const POLE_ANEKSU_LABEL: Record<DocLang, Record<PoleAneksu, string>> = {
  pl: {
    zakres_prac: "Przedmiot umowy",
    cena: "Wynagrodzenie",
    waluta: "Waluta wynagrodzenia",
    termin_realizacji: "Termin realizacji",
  },
  en: {
    zakres_prac: "Subject of the agreement",
    cena: "Fee",
    waluta: "Fee currency",
    termin_realizacji: "Completion date",
  },
  de: {
    zakres_prac: "Vertragsgegenstand",
    cena: "Vergütung",
    waluta: "Währung der Vergütung",
    termin_realizacji: "Fertigstellungstermin",
  },
};

/** Migawka warunków umowy-matki z chwili sporządzenia aneksu — kolumna
 * `contracts.poprzednie` (JSONB).
 *
 * **Migawka, a nie odczyt z umowy-matki przy każdym wyświetleniu.** Oryginał
 * jest wprawdzie zablokowany (`blokadaUmowy`), więc teoretycznie nie ma czego
 * pilnować — ale to jest dokładnie ten rodzaj założenia, który audyt Modułu 57
 * obalił w ofertach. Kolumna „było" ma być tym, co strony przeczytały, nawet
 * gdyby ktoś kiedyś odblokował edycję albo umowa-matka została usunięta. */
export type PoprzednieWarunki = {
  /** Referencja umowy-matki, np. „UM-2026-A1B2C3" — wydrukowana w nagłówku. */
  reference: string;
  /** Data zawarcia umowy-matki (jej `created_at`) — „…z dnia 12.07.2026". */
  zawarta: string;
  zakres_prac: string;
  cena: number;
  waluta: string;
  termin_realizacji: string | null;
};

/** Jedna pozycja tabeli „było → jest". */
export type ZmianaAneksu = {
  pole: PoleAneksu;
  bylo: string | number | null;
  jest: string | number | null;
};

/** Porównuje warunki z migawki z warunkami aneksu i zwraca WYŁĄCZNIE to, co
 * się różni.
 *
 * Pusta lista to stan poprawny i ważny: aneks, w którym niczego jeszcze nie
 * zmieniono, jest szkicem bez treści — wydruk i trasa wysyłki mają wtedy
 * powiedzieć wprost, że nie ma czego wysyłać, zamiast wysłać klientowi kartkę
 * z samym zdaniem „pozostałe postanowienia bez zmian".
 *
 * Porównanie jest ZNORMALIZOWANE: `cena` przez liczbę (żeby „5000" i „5000.00"
 * z NUMERIC-a Postgresa nie udawały zmiany), daty przez pierwsze 10 znaków
 * (kolumna DATE potrafi wrócić jako „2026-09-30T00:00:00.000Z"), teksty po
 * obcięciu białych znaków. Bez tego lista zmian pokazywałaby różnice, których
 * człowiek nie widzi — a to jest dokument, który idzie do podpisu. */
export function roznicaAneksu(
  poprzednie: PoprzednieWarunki,
  aneks: Pick<Contract, "zakres_prac" | "cena" | "waluta" | "termin_realizacji">
): ZmianaAneksu[] {
  const zmiany: ZmianaAneksu[] = [];

  const tekstBylo = (poprzednie.zakres_prac ?? "").trim();
  const tekstJest = (aneks.zakres_prac ?? "").trim();
  if (tekstBylo !== tekstJest) zmiany.push({ pole: "zakres_prac", bylo: tekstBylo, jest: tekstJest });

  const cenaBylo = Number(poprzednie.cena) || 0;
  const cenaJest = Number(aneks.cena) || 0;
  if (cenaBylo !== cenaJest) zmiany.push({ pole: "cena", bylo: cenaBylo, jest: cenaJest });

  const walutaBylo = (poprzednie.waluta || "PLN").trim();
  const walutaJest = (aneks.waluta || "PLN").trim();
  if (walutaBylo !== walutaJest) zmiany.push({ pole: "waluta", bylo: walutaBylo, jest: walutaJest });

  const dzien = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : null);
  const terminBylo = dzien(poprzednie.termin_realizacji);
  const terminJest = dzien(aneks.termin_realizacji);
  if (terminBylo !== terminJest) zmiany.push({ pole: "termin_realizacji", bylo: terminBylo, jest: terminJest });

  return zmiany;
}

/** Referencja aneksu do wydruku, np. „ANEKS-1-UM-2026-A1B2C3".
 *
 * Świadomie zawiera numer aneksu ORAZ referencję umowy-matki: przy sporze
 * sam identyfikator ma powiedzieć, czego dokument dotyczy i który to z kolei,
 * bez zaglądania do bazy. */
export function aneksReference(nr: number, referencjaUmowy: string): string {
  return `ANEKS-${nr}-${referencjaUmowy}`;
}

/* ─────────────── Rodzaje umowy (szablony klauzul, 2026-07-27) ───────────── */

/**
 * **Szablon wybiera ZESTAW istniejących klauzul — nie pisze nowej treści
 * prawnej.** To jest cała różnica wobec szablonów ofert (Moduł 20), gdzie
 * treść pisze właściciel. Klauzule umowy nie przeszły jeszcze weryfikacji
 * prawnika (LEGAL_PLACEHOLDER_NOTE), więc mnożenie ich wariantów byłoby
 * mnożeniem ryzyka. Mechanizm jest gotowy; brakujące klauzule (np. SLA dla
 * umowy utrzymaniowej) są WYPISANE w docs/DO-PRAWNIKA-I-TLUMACZA.md jako
 * treść do napisania, a nie zmyślone tutaj.
 *
 * Trzy rodzaje wynikają z tego, co właściciel realnie sprzedaje: jednorazowe
 * wdrożenie, opiekę powdrożeniową i płatny PoC przed decyzją.
 */
export type ContractSzablon = "wdrozeniowa" | "utrzymaniowa" | "poc";

export const CONTRACT_SZABLONY: ContractSzablon[] = ["wdrozeniowa", "utrzymaniowa", "poc"];

export const CONTRACT_SZABLON_LABEL: Record<ContractSzablon, string> = {
  wdrozeniowa: "Wdrożeniowa (jednorazowa)",
  utrzymaniowa: "Utrzymaniowa (opieka, odnawialna)",
  poc: "PoC / pilotaż (przed decyzją)",
};

export const CONTRACT_SZABLON_OPIS: Record<ContractSzablon, string> = {
  wdrozeniowa:
    "Pełny zestaw klauzul: odbiór prac, prawa autorskie po zapłacie, dwie rundy poprawek, wsparcie jako odrębna usługa.",
  utrzymaniowa:
    "Umowa ciągła — wypełnij okres obowiązywania i termin wypowiedzenia. Klauzule o odbiorze etapów i rundach poprawek nie mają tu zastosowania.",
  poc:
    "Krótki, zamknięty test przed decyzją: bez wsparcia powdrożeniowego i bez przenoszenia praw do kodu (PoC nie jest wdrożeniem).",
};

/** Które klauzule ODPADAJĄ przy danym rodzaju umowy.
 *
 * Świadomie „co usunąć", nie „co dodać": punktem wyjścia jest jeden,
 * kompletny zestaw, który już istnieje i który zna prawnik. Odjęcie klauzuli,
 * która nie ma zastosowania, jest bezpieczne; dopisanie nowej — nie. */
const SZABLON_POMIJA: Record<ContractSzablon, string[]> = {
  wdrozeniowa: [],
  utrzymaniowa: ["Reklamacje i poprawki", "Odbiór prac", "Wsparcie powdrożeniowe"],
  poc: ["Własność intelektualna", "Wsparcie powdrożeniowe", "Reklamacje i poprawki"],
};

/** Klauzule dokumentu wg TYPU i rodzaju. Jedno miejsce dla panelu, wydruku
 * i apki — wcześniej wydruk liczył je lokalnie i drukował klauzulę, której
 * panel dla tego rodzaju nie pokazywał. */
export function clausesDokumentu(typ: string, szablon: string | null | undefined): Clause[] {
  if (typ === "aneks") return [];
  if (typ === "nda") return NDA_CLAUSES;
  if (typ === "dpa") return DPA_CLAUSES;
  return clausesDlaSzablonu(szablon);
}

/** Klauzule dokumentu wg rodzaju umowy. Dla NDA i aneksu bez zmian. */
export function clausesDlaSzablonu(szablon: string | null | undefined): Clause[] {
  const s = (szablon ?? "wdrozeniowa") as ContractSzablon;
  const pomin = new Set(SZABLON_POMIJA[s] ?? []);
  return CONTRACT_CLAUSES.filter((c) => !pomin.has(c.title));
}

/* ──────────────── Koniec umowy i odnowienie (2026-07-27) ────────────────── */

/** Ile dni przed końcem umowy panel zaczyna się odzywać.
 *
 * 60 dni to punkt, w którym da się jeszcze zrobić coś sensownego: umówić
 * rozmowę o przedłużeniu albo wypowiedzieć w terminie. Przy umowie z długim
 * wypowiedzeniem próg przesuwa się sam (patrz dniDoDzialaniaUmowy) — alert
 * dwa tygodnie po upływie terminu wypowiedzenia byłby alarmem o pożarze
 * wysłanym po pożarze. */
export const CONTRACT_RENEWAL_ALERT_DAYS = 60;

/** Ile dni zostało do dnia, w którym trzeba zadziałać.
 *
 * Dla umowy zwykłej to koniec obowiązywania. Dla ODNAWIALNEJ — ostatni dzień
 * na wypowiedzenie (koniec minus okres wypowiedzenia): po nim umowa przedłuża
 * się sama, więc alert po tej dacie jest bezużyteczny.
 *
 * `null`, gdy nie ma czego liczyć (brak daty końca albo dokument nie jest
 * podpisany — niepodpisana umowa nie obowiązuje).
 *
 * Liczone KALENDARZOWO (dni, nie momenty) — ta sama zasada co przy terminach
 * projektów, patrz daysBetweenISO w lib/dates.ts. */
export function dniDoDzialaniaUmowy(
  c: Pick<Contract, "status" | "obowiazuje_do" | "wypowiedzenie_dni" | "odnawialna">,
  dzisISO: string
): number | null {
  if (c.status !== "Podpisana") return null;
  if (!c.obowiazuje_do) return null;
  const koniec = String(c.obowiazuje_do).slice(0, 10);
  const dzien = new Date(`${koniec}T00:00:00Z`).getTime();
  if (!Number.isFinite(dzien)) return null;
  const zapas = c.odnawialna ? Math.max(0, Number(c.wypowiedzenie_dni) || 0) : 0;
  const dzisMs = new Date(`${dzisISO}T00:00:00Z`).getTime();
  return Math.round((dzien - zapas * 86_400_000 - dzisMs) / 86_400_000);
}

/** Czy umowa wymaga decyzji o przedłużeniu/wypowiedzeniu.
 *
 * Próg rośnie razem z okresem wypowiedzenia: przy trzymiesięcznym
 * wypowiedzeniu 60 dni ostrzeżenia to za mało, żeby zdążyć. */
export function umowaDoOdnowienia(
  c: Pick<Contract, "status" | "obowiazuje_do" | "wypowiedzenie_dni" | "odnawialna">,
  dzisISO: string
): boolean {
  const dni = dniDoDzialaniaUmowy(c, dzisISO);
  if (dni == null) return false;
  const prog = Math.max(CONTRACT_RENEWAL_ALERT_DAYS, (Number(c.wypowiedzenie_dni) || 0) + 14);
  return dni <= prog;
}

/** Jednozdaniowe wyjaśnienie, CO trzeba zrobić i do kiedy — na Pulpit,
 * do maila i do apki. Jedno źródło, żeby trzy ekrany nie mówiły trzech
 * różnych rzeczy. */
export function powodOdnowienia(
  c: Pick<Contract, "status" | "obowiazuje_do" | "wypowiedzenie_dni" | "odnawialna">,
  dzisISO: string
): string {
  const dni = dniDoDzialaniaUmowy(c, dzisISO);
  if (dni == null) return "";
  if (c.odnawialna) {
    if (dni < 0) return "Termin wypowiedzenia minął — umowa przedłużyła się na kolejny okres.";
    if (dni === 0) return "Dziś ostatni dzień na wypowiedzenie — jutro umowa przedłuża się sama.";
    return `Do wypowiedzenia zostało ${dni} dni — potem umowa przedłuży się sama.`;
  }
  if (dni < 0) return "Umowa wygasła — jeśli współpraca trwa, potrzebna jest nowa.";
  if (dni === 0) return "Umowa kończy się dziś.";
  return `Umowa kończy się za ${dni} dni.`;
}
