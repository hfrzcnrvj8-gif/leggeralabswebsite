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

import { todayLocalISO, daysBetweenISO } from "./dates";
import { type DocLang, type DanePodpisu } from "./documents";
import { mapaStanow, mapaKropek, type Stan } from "./kolorStanu";

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
  /** Pochodzenie klienta (skąd przyszedł jako lead) — wolny tekst, kopiowany
   * z leada przy awansie. Do 2026-07-26 opisane tu jako „nigdy nie edytowane
   * ręcznie potem" i faktycznie nieprzyjmowane przez PATCH; poprawialne od
   * drugiej rundy audytu Klientów, bo pole, po którym liczy się pętla poleceń,
   * nie może zostawać błędne na zawsze (i było puste u wszystkich klientów
   * sprzed rozbicia źródła na kategorię + szczegóły). */
  zrodlo: string;
  /** Kategoria źródła (SOURCE_CATEGORIES w lib/leads.ts) — patrz zrodlo. */
  zrodlo_kategoria: string;
  branza: string;
  status: ClientStatus;
  ostatni_kontakt: string | null;
  next_followup: string | null;
  /** Tekstowy "następny krok" obok next_followup — PO CO jest przypomnienie. */
  next_action: string;
  /** Co ile MIESIĘCY odzywać się do tego klienta. `null` = bez pilnowania.
   * Patrz CLIENT_RHYTHMS i isClientOverdue. */
  rytm_kontaktu_mies: number | null;
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

/** Osoba kontaktowa przy firmie (Moduł 54, krok 4).
 *
 * Lista tych rekordów zastępuje w interfejsie pojedyncze pole
 * `Client.osoba_kontaktowa`, ale samo pole zostaje jako **migawka osoby
 * głównej** — czyta je dwanaście miejsc w panelu i apce. Zapis osoby głównej
 * przepisuje jej imię do tamtej kolumny.
 *
 * `email` osoby wchodzi do dopasowania przychodzącej poczty
 * (`findContactsByEmail`, decyzja właściciela 2026-07-26): mail od Anny wpada
 * do firmy sam, ale dopasowanie zostaje deterministyczne — równość adresu,
 * nigdy zgadywanie z treści. */
export type ClientContact = {
  id: string;
  client_id: string;
  imie: string;
  /** Stanowisko/rola — wolny tekst („prezes", „księgowość", „IT"). */
  rola: string;
  telefon: string;
  email: string;
  /** Czym się ta osoba zajmuje, o czym pamiętać — jedno zdanie, nie CRM. */
  notatka: string;
  /** Osoba główna. Baza pilnuje, że jest ich najwyżej jedna na klienta
   * (`client_contacts_glowna_idx`). */
  glowna: boolean;
  created_at: string;
};

/** Kim jest ta osoba w jednej linijce — do wiersza listy i podpisu w apce.
 * Rola bywa pusta (osoby zasiane z dawnego pola jej nie mają). */
export function clientContactLine(c: Pick<ClientContact, "imie" | "rola">): string {
  const imie = c.imie.trim();
  const rola = c.rola.trim();
  if (!imie) return rola;
  return rola ? `${imie} — ${rola}` : imie;
}

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
  // Moduł 57 — druga połowa historii oferty. Do 2026-07-26 oś czasu klienta
  // znała wyłącznie sukces (utworzono / wysłano / zaakceptowano), więc klient,
  // który powiedział „nie", kończył się na wpisie „wysłano ofertę".
  "offer_opened",
  "offer_change_requested",
  "offer_rejected",
  "offer_expired",
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
  // Odrzucenie umowy/NDA (audyt Modułu 11) — do tej rundy oś czasu znała
  // wyłącznie sukces, jak przy ofertach przed Modułem 57.
  "contract_rejected",
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

/* Ikony osi czasu klienta mieszkają w `app/[lang]/admin/icons.tsx`
 * (`<ClientEventIcon kind={…} />`, Moduł 33) — ten plik zostaje czystą logiką
 * bez Reacta. Rodzaje zdarzeń nadal są zwykłym tekstem w bazie, więc mapa tam
 * ma fallback na kropkę dla nieznanego `kind`. */

/** Moduł 12 (fundament linkowania) — do jakiego segmentu URL-a
 * (`/admin/<segment>/<id>`) prowadzi dane zdarzenie, na podstawie `kind`.
 * `null` = zdarzenie świadomie bez celu (client_created, nurture_scheduled —
 * nie ma osobnego rekordu, do którego dałoby się linkować). */
export const CLIENT_EVENT_TARGET: Record<string, "offers" | "invoices" | "projects" | "contracts" | null> = {
  client_created: null,
  offer_created: "offers",
  offer_sent: "offers",
  offer_accepted: "offers",
  offer_opened: "offers",
  offer_change_requested: "offers",
  offer_rejected: "offers",
  offer_expired: "offers",
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
  contract_rejected: "contracts",
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

/* Kolory statusu wyrównane do apki 2026-07-26 (audyt Klientów): fiolet marki
 * = relacja żyje, złoto = prospekt, szarość = reszta. Do tego dnia panel mówił
 * co innego niż telefon (cyan/zieleń) — ta sama oś, dwa słowniki. Wygrała
 * apka: jej paleta przeszła osobny audyt koloru, a zieleń jest w niej
 * zarezerwowana dla „zrobione/sukces". Bliźniak: `kolorStatusuKlienta`
 * w `PulpitView.swift`. */
/* Moduł 59: te same kolory co dotąd, ale wzięte ze WSPÓLNEJ skali
 * (`lib/kolorStanu.ts`) zamiast wpisane tutaj. Klienci przeszli audyt koloru
 * w Module 51 i dlatego skala się z nimi zgadza co do wartości — to z nich
 * (i z Ofert) została wyciągnięta, nie odwrotnie. */
const CLIENT_STAN: Record<ClientStatus, Stan> = {
  Prospekt: "mojRuch",
  Aktywny: "uNich",
  Uśpiony: "nieruszone",
  Stracony: "zamkniete",
};

export const CLIENT_STATUS_CLASS: Record<string, string> = mapaStanow(CLIENT_STAN);
export const CLIENT_STATUS_DOT: Record<string, string> = mapaKropek(CLIENT_STAN);

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
  lang: DocLang = "pl",
  /** Faza 2 (A1) — kto podpisuje. Ta sama wada, co w szkicach z
   *  lib/projects.ts: szkic kończył się nawiasem „[Twoje imię]", a trasa
   *  `POST /api/client-followups/[id]/send` wysyłała go bez mrugnięcia. */
  podpis: DanePodpisu | null = null
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
${podpis?.imie ?? "[Your name]"}`;
    }
    return `${greeting}

It's been three months since we wrapped up "${project.tytul}"${nazwaKlienta} — how has it been working out day to day? If new needs have come up that we could automate together, I'd love to hear about them.

And if you know anyone who could use similar help, feel free to send them my way — always appreciated!

Best,
${podpis?.imie ?? "[Your name]"}`;
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
${podpis?.imie ?? "[Ihr Name]"}`;
    }
    return `${greeting}

seit dem Abschluss von „${project.tytul}"${nazwaKlienta} sind drei Monate vergangen — wie läuft es im Alltag? Falls neue Bedürfnisse entstanden sind, die wir gemeinsam automatisieren könnten, würde ich das gerne hören.

Und falls Sie jemanden kennen, dem eine ähnliche Unterstützung helfen würde — ich freue mich immer über Empfehlungen!

Viele Grüße,
${podpis?.imie ?? "[Ihr Name]"}`;
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
${podpis?.imie ?? "[Twoje imię]"}`;
  }
  return `${greeting}

Minęły trzy miesiące odkąd zamknęliśmy „${project.tytul}"${nazwaKlienta} — jak sprawdza się to na co dzień? Jeśli pojawiły się nowe potrzeby, które moglibyśmy razem zautomatyzować, chętnie o nich usłyszę.

I jeśli znasz kogoś, komu przydałaby się podobna pomoc — śmiało polecaj, zawsze to doceniam!

Pozdrawiam,
${podpis?.imie ?? "[Twoje imię]"}`;
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  // Dni KALENDARZOWE — ten sam powód co w lib/leads.ts (kolumna DATE parsowana
  // jako północ UTC dawała wynik o 1 za mały tuż po lokalnej północy). Tu tylko
  // do wyświetlenia „N dni" w tabeli/Kanbanie klientów, ale spójność liczenia
  // z leadami i apką jest warta jednej linii. Audyt 6, 2026-07-23.
  return daysBetweenISO(dateStr.slice(0, 10), todayLocalISO());
}

const CLOSED_CLIENT_STATUSES = new Set<ClientStatus>(["Stracony"]);

/** Rytmy do wyboru (miesiące). `null` = bez pilnowania i to jest DOMYŚLKA.
 *
 * Wzorzec z Claya (osobisty CRM): rytm jest decyzją per relacja, nie stałą dla
 * wszystkich. Sztywny próg ciszy — taki jak `DNI_CISZY_W_OTWARTYM` u leadów —
 * został tu wcześniej świadomie odrzucony właśnie dlatego, że tempo kontaktu
 * z klientem jest zbyt różne: do jednego dzwoni się co tydzień, do innego raz
 * na rok i to jest w porządku. Rytm ustawiany ręcznie godzi jedno z drugim. */
export const CLIENT_RHYTHMS: { label: string; miesiace: number | null }[] = [
  { label: "Bez pilnowania", miesiace: null },
  { label: "Co miesiąc", miesiace: 1 },
  { label: "Co kwartał", miesiace: 3 },
  { label: "Co pół roku", miesiace: 6 },
  { label: "Co rok", miesiace: 12 },
];

/** Miesiąc liczony jako 30 dni — świadomie, bo to próg „mniej więcej", a nie
 * termin. Liczenie kalendarzowe dawałoby złudzenie precyzji, której ta reguła
 * nie ma. */
const DNI_W_MIESIACU = 30;

/** Ile dni ciszy u tego klienta — od ostatniego kontaktu, a gdy go NIGDY nie
 * było, od utworzenia rekordu. Ta druga część jest istotna: klient, do którego
 * nikt się nie odezwał ani razu, milczałby inaczej wiecznie — a to właśnie
 * o nim najłatwiej zapomnieć (ta sama zasada, co przy ciszy leada, Moduł 52). */
export function clientSilenceDays(
  client: Pick<Client, "ostatni_kontakt" | "created_at">
): number | null {
  return daysSince(client.ostatni_kontakt ?? client.created_at ?? null);
}

/** Czy minął ustawiony rytm kontaktu. `false`, gdy rytmu nie ma. */
export function clientRhythmOverdue(
  client: Pick<Client, "ostatni_kontakt" | "created_at" | "rytm_kontaktu_mies">
): boolean {
  const rytm = client.rytm_kontaktu_mies;
  if (!rytm || rytm <= 0) return false;
  const cisza = clientSilenceDays(client);
  return cisza !== null && cisza >= rytm * DNI_W_MIESIACU;
}

/** Klient „wymaga działania dziś" z DWÓCH powodów, nie jednego.
 *
 * 1. Jawne przypomnienie (`next_followup`) — jak dotąd.
 * 2. Minął ustawiony rytm kontaktu (2026-07-26). Bez tego klient, któremu
 *    nigdy nie ustawiono daty, mógł milczeć rok i nie pojawić się nigdzie —
 *    ani na Pulpicie, ani w porannym mailu. Sztywnego progu dla wszystkich
 *    świadomie NIE ma; pilnujemy tylko tych, przy których sam ustawiłeś rytm.
 */
export function isClientOverdue(
  client: Pick<Client, "status" | "next_followup" | "ostatni_kontakt" | "created_at" | "rytm_kontaktu_mies">
): boolean {
  if (CLOSED_CLIENT_STATUSES.has(client.status)) return false;
  if (client.next_followup && client.next_followup <= todayLocalISO()) return true;
  return clientRhythmOverdue(client);
}

export function clientOverdueReason(
  client: Pick<Client, "next_followup" | "next_action" | "ostatni_kontakt" | "created_at" | "rytm_kontaktu_mies">
): string {
  if (client.next_followup && client.next_followup <= todayLocalISO()) {
    const action = client.next_action?.trim();
    return `ustawione przypomnienie na ${client.next_followup}${action ? ` — ${action}` : ""}`;
  }
  const cisza = clientSilenceDays(client);
  const rytm = CLIENT_RHYTHMS.find((r) => r.miesiace === client.rytm_kontaktu_mies)?.label.toLowerCase();
  return `minął rytm kontaktu (${rytm ?? "ustawiony"}) — cisza od ${cisza ?? 0} dni`;
}

export { daysSince as clientDaysSince };

/** Porządek listy klientów. Do 2026-07-26 był JEDEN, zaszyty w kodzie:
 * wymagające działania na górę, reszta alfabetycznie. Alfabet odpowiada na
 * pytanie „gdzie jest firma X", ale nie na to, które realnie się zadaje przy
 * przeglądaniu rejestru — „kto najdłużej milczy". Przy trzech klientach to bez
 * znaczenia, przy stu decyduje o tym, czy ktoś wypadnie z pola widzenia. */
export const CLIENT_SORTS = ["Alfabetycznie", "Najdłużej bez kontaktu", "Wymagające działania"] as const;
export type ClientSort = (typeof CLIENT_SORTS)[number];

/** Wspólna reguła sortowania — panel i apka mają ten sam bliźniak
 * (`SortowanieKlientow` w rdzeniu apki). Klient bez ani jednego kontaktu jest
 * traktowany jak milczący NAJDŁUŻEJ, nie jak świeży: to o nim najłatwiej
 * zapomnieć (ta sama zasada, co przy ciszy leada w Module 52). */
export function sortClients<
  T extends Pick<
    Client,
    "nazwa" | "status" | "ostatni_kontakt" | "next_followup" | "created_at" | "rytm_kontaktu_mies"
  >,
>(
  clients: T[],
  sort: ClientSort
): T[] {
  const alfabetycznie = (a: T, b: T) => a.nazwa.localeCompare(b.nazwa, "pl");
  const list = [...clients];

  if (sort === "Najdłużej bez kontaktu") {
    return list.sort((a, b) => {
      const da = daysSince(a.ostatni_kontakt);
      const db = daysSince(b.ostatni_kontakt);
      // null = nigdy nie było kontaktu → na samą górę.
      if (da === null && db === null) return alfabetycznie(a, b);
      if (da === null) return -1;
      if (db === null) return 1;
      return db - da || alfabetycznie(a, b);
    });
  }

  if (sort === "Wymagające działania") {
    return list.sort((a, b) => {
      const ao = isClientOverdue(a) ? 0 : 1;
      const bo = isClientOverdue(b) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      // W obrębie zaległych: najstarszy termin pierwszy.
      if (ao === 0) return (a.next_followup ?? "").localeCompare(b.next_followup ?? "");
      return alfabetycznie(a, b);
    });
  }

  return list.sort(alfabetycznie);
}
