// Moduł 22 — wspólny słownik powiązań rekordu z CRM.
//
// Przed tym modułem to samo („z kim jest związany ten rekord?") robiły w
// panelu trzy różne mechanizmy: ClientPickerButton (oferty/faktury), własne
// selecty PropTrigger (projekty) i surowy <select> (kalendarz) — a pickera
// leada nie było w ogóle, stąd komplet luk przy `lead_id`. Ten plik to czysta
// logika (bez "use client"), re-używana przez API routes i UI — zgodnie z
// architekturą modułów opisaną w CLAUDE.md.
//
// UWAGA do akapitu wyżej: do Modułu 30 mówił on o ClientPickerButtonie w
// czasie przeszłym, a przycisk nadal żył w OfferEditor i InvoiceEditor —
// Moduł 22 wymienił pięć ekranów, ale Faktur i Ofert nie tknął. Moduł 30
// (2026-07-17) dokończył zamianę: oba edytory używają dziś `LinkPicker`
// (przez `ClientLinkPicker` w components.tsx), a ClientPickerButton już nie
// istnieje. Teraz to zdanie jest prawdziwe.
//
// Sekcje Modułu 30 (migawka vs powiązanie, powiązanie wstecz) są niżej w tym
// pliku.

/** Rodzaj rekordu, z którym można powiązać inny rekord. */
export type LinkKind = "client" | "lead" | "project";

/** Jedna pozycja na liście wyboru w LinkPickerze. */
export type LinkTarget = {
  kind: LinkKind;
  id: string;
  nazwa: string;
  /** Drugi wiersz pozycji — NIP, miasto, status. Sam nie jest przeszukiwany,
   * chyba że autor listy wrzuci to samo do `szukaj`. */
  hint?: string;
  /** Tekst, po którym filtruje wyszukiwarka (nazwa + NIP + miasto + e-mail).
   * Budowany przy tworzeniu listy, żeby nie sklejać go przy każdym wpisanym
   * znaku. */
  szukaj: string;
};

/** Wartość pola powiązania. Klucze odpowiadają 1:1 kolumnom w bazie, więc
 * obiekt idzie prosto do `fetch(..., { body: JSON.stringify(value) })`. */
export type LinkValue = {
  client_id?: string | null;
  lead_id?: string | null;
  project_id?: string | null;
};

const COLUMN: Record<LinkKind, keyof LinkValue> = {
  client: "client_id",
  lead: "lead_id",
  project: "project_id",
};

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  client: "Klient",
  lead: "Lead",
  project: "Projekt",
};

/** Nagłówki sekcji w pickerze. Osobna mapa, bo polska liczba mnoga nie da się
 * skleić regułą („Klient" → „Klienci", nie „Klienty"). */
export const LINK_KIND_LABEL_PLURAL: Record<LinkKind, string> = {
  client: "Klienci",
  lead: "Leady",
  project: "Projekty",
};

/** Emoji rodzaju rekordu.
 *
 * Uzasadnienie „emoji zamiast ikon — świadoma decyzja projektu" było
 * NIEAKTUALNE już w chwili pisania (decyzja odwrócona 2026-07-11, panel ma
 * @tabler/icons-react). Kierunek jest rozstrzygnięty — w panelu ikony, w
 * mailach emoji — a zamiana ma własny Moduł 33. Do tego czasu te emoji
 * ZOSTAJĄ: wyrywanie ich przy okazji innych zmian rozjechałoby panel na pół
 * drogi. Patrz CLAUDE.md → „Emoji vs ikony". */
export const LINK_KIND_EMOJI: Record<LinkKind, string> = {
  client: "🤝",
  lead: "🎯",
  project: "📁",
};

/** Buduje `LinkValue` dla wyboru `picked` spośród pól `kinds`.
 *
 * Relacja jest WYŁĄCZNA w obrębie `kinds` — wybór klienta czyści leada i
 * odwrotnie (decyzja właściciela 2026-07-16; tak od początku zachowywał się
 * PATCH /api/mail/[id]). Dzięki temu jedno pole „Powiązanie" w UI odpowiada
 * jednej odpowiedzi na pytanie „czyj to rekord", zamiast dwóch pól, z których
 * drugie prawie zawsze zostaje puste.
 *
 * `picked === null` czyści wszystkie pola z `kinds` („— brak —").
 *
 * Uwaga: to reguła dla RĘCZNEGO wyboru. Automatyczne dziedziczenie przy
 * akceptacji oferty (lib/offerAccept.ts) świadomie ustawia `lead_id` i
 * `client_id` naraz — tam oba pola to ślad pochodzenia rekordu, nie wybór.
 */
export function linkValueFor(kinds: LinkKind[], picked: LinkTarget | null): LinkValue {
  const value: LinkValue = {};
  for (const kind of kinds) value[COLUMN[kind]] = null;
  if (picked && kinds.includes(picked.kind)) value[COLUMN[picked.kind]] = picked.id;
  return value;
}

// ---------------------------------------------------------------------------
// Moduł 30 — powiązanie z klientem na Ofertach/Fakturach.
//
// Na dokumencie żyją DWIE niezależne rzeczy o tym samym kliencie, które
// wyglądają identycznie przy wpisywaniu, a robią co innego:
//
//  * pola `klient_*` — MIGAWKA danych nabywcy na moment wystawienia. Celowo
//    odklejona od karty klienta: zmiana adresu na karcie nie rusza już
//    wystawionej faktury (wymóg księgowy). Nie „naprawiaj" tego.
//  * `client_id` — POWIĄZANIE. Niewidoczne na wydruku, ale na nim wisi karta
//    klienta, oś czasu i kontakt retencyjny (api/projects/[id] → `if
//    (clientId && …)`). Bez niego dokument istnieje, tylko cicho wypada z
//    końcówki drogi klienta.
//
// Picker ustawia oba naraz; ręczne wpisanie nazwy — tylko migawkę. Stąd dwie
// podpowiedzi niżej. Obie są MIĘKKIE i nigdy niczego nie blokują (zasada
// panelu: podpowiedzi zamiast bramek).
// ---------------------------------------------------------------------------

/** Co dokładnie odpada, gdy dokument nie ma `client_id`. Świadomie wymienia
 * skutki, nie samą diagnozę — „brak powiązania" nic właścicielowi nie mówi. */
export const UNLINKED_CLIENT_HINT =
  "Ten dokument nie jest powiązany z klientem — nie pojawi się na jego karcie ani na osi czasu, a po zamknięciu projektu nie zaplanuje się kontakt kontrolny. Wybierz klienta z bazy, żeby to podpiąć (samo wpisanie nazwy nie wystarczy).";

/** Dane nabywcy z dokumentu, na tyle, ile trzeba do porównania z klientem. */
export type BuyerSnapshot = { client_id: string | null; klient_nazwa: string; klient_nip: string };

/** Klient z bazy, na tyle, ile trzeba do porównania. */
export type LinkedClient = { nazwa: string; nip: string };

const normNazwa = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
const normNip = (v: string) => v.replace(/\D/g, "");

/** Stan powiązania dokumentu z klientem:
 *  - `"ok"` — powiązany i dane nabywcy się zgadzają (albo nie ma o co pytać),
 *  - `"unlinked"` — brak `client_id` (patrz UNLINKED_CLIENT_HINT),
 *  - `"mismatch"` — powiązany, ale migawka mówi o KIMŚ INNYM. Typowo: ktoś
 *    zduplikował fakturę Kowalskiego i przepisał nazwę na Nowaka ręcznie,
 *    z pominięciem pickera — na wydruku Nowak, na karcie klienta Kowalski.
 *
 * Świadomie zachowawcze: przy niepewności zwraca `"ok"`. Podpowiedź, która
 * krzyczy bez powodu, uczy właściciela ją ignorować.
 */
export function clientLinkStatus(doc: BuyerSnapshot, client: LinkedClient | null): "ok" | "unlinked" | "mismatch" {
  if (!doc.client_id) return "unlinked";
  // Klienta jeszcze nie wczytano albo został usunięty — nie ma z czym
  // porównywać, więc milczymy zamiast zgadywać.
  if (!client) return "ok";

  // NIP to najmocniejszy sygnał: jeśli oba są i się różnią, to na pewno inna
  // firma (nie literówka w nazwie ani inna forma prawna).
  const nipDoc = normNip(doc.klient_nip);
  const nipCli = normNip(client.nip);
  if (nipDoc && nipCli) return nipDoc === nipCli ? "ok" : "mismatch";

  // Bez NIP-u zostaje nazwa. Pusta nazwa = dokument dopiero powstaje, nie ma
  // o czym mówić.
  const nazwaDoc = normNazwa(doc.klient_nazwa);
  const nazwaCli = normNazwa(client.nazwa);
  if (!nazwaDoc || !nazwaCli) return "ok";
  return nazwaDoc === nazwaCli ? "ok" : "mismatch";
}

/** Treść podpowiedzi o rozjeździe — z nazwą powiązanego klienta, żeby dało
 * się zdecydować bez otwierania jego karty. */
export function clientMismatchHint(clientNazwa: string): string {
  return `Dane nabywcy na tym dokumencie nie zgadzają się z powiązanym klientem („${clientNazwa || "bez nazwy"}”). Jeśli to dokument dla kogoś innego — wybierz właściwego klienta z bazy. Jeśli po prostu poprawiłeś dane tej samej firmy, zignoruj tę uwagę.`;
}

/* ------------------------------------------------- powiązanie wstecz (30) --- */

/** Dokument bez `client_id`, kandydat do powiązania wstecz. */
export type OrphanDoc = { id: string; klient_nazwa: string; klient_nip: string };

/** Kandydat na klienta dla osieroconego dokumentu. */
export type MatchCandidate = { id: string; nazwa: string; nip: string };

/** Propozycja powiązania wstecz — ZAWSZE do ręcznego zatwierdzenia.
 * `pewnosc` steruje tym, jak mocno panel może ją podpowiadać, nie tym, czy
 * wolno ją zastosować bez pytania (nie wolno nigdy). */
export type MatchProposal = { clientId: string; clientNazwa: string; pewnosc: "nip" | "nazwa" };

/** Znajdź klienta pasującego do osieroconego dokumentu.
 *
 * Świadomie BEZ modelu AI i bez dopasowania rozmytego (literówki, skróty
 * form prawnych) — zgodnie z zasadą projektu „wyłącznie deterministyczne
 * reguły" (CLAUDE.md). Wolimy nie zaproponować nic, niż zaproponować
 * prawdopodobne-ale-złe: to właściciel klika „powiąż", więc każdy fałszywy
 * trop kosztuje go uwagę i podkopuje zaufanie do całej listy.
 *
 * Zwraca `null`, gdy nie ma pewnego dopasowania ALBO gdy jest ich kilka
 * (dwaj klienci o tej samej nazwie bez NIP-u — panel nie zgaduje, który).
 */
export function matchClientForOrphan(doc: OrphanDoc, clients: MatchCandidate[]): MatchProposal | null {
  const nipDoc = normNip(doc.klient_nip);
  if (nipDoc) {
    const byNip = clients.filter((c) => normNip(c.nip) === nipDoc);
    // NIP jest unikalny z natury — jeden trafiony wystarczy, żeby być pewnym.
    if (byNip.length === 1) return { clientId: byNip[0].id, clientNazwa: byNip[0].nazwa, pewnosc: "nip" };
    if (byNip.length > 1) return null;
  }

  const nazwaDoc = normNazwa(doc.klient_nazwa);
  if (!nazwaDoc) return null;
  const byNazwa = clients.filter((c) => normNazwa(c.nazwa) === nazwaDoc);
  if (byNazwa.length === 1) return { clientId: byNazwa[0].id, clientNazwa: byNazwa[0].nazwa, pewnosc: "nazwa" };
  return null;
}

/** Odwrotność `linkValueFor` — który z targetów jest dziś wybrany.
 *
 * Kolejność `kinds` jest kolejnością pierwszeństwa: przy rekordzie mającym
 * ustawione i `client_id`, i `lead_id` (np. projekt z zaakceptowanej oferty)
 * wygrywa ten wcześniejszy. Wołający podaje `["client", "lead"]`, bo klient to
 * aktualniejsza relacja niż lead, z którego powstał — ta sama zasada co w
 * findContactsByEmail() (lib/contactLookup.ts).
 */
export function pickedTarget(kinds: LinkKind[], value: LinkValue, targets: LinkTarget[]): LinkTarget | null {
  for (const kind of kinds) {
    const id = value[COLUMN[kind]];
    if (!id) continue;
    const found = targets.find((t) => t.kind === kind && t.id === id);
    // Rekord skasowany albo lista jeszcze się nie wczytała — pokaż, że
    // powiązanie JEST, zamiast udawać "— brak —" i skusić do nadpisania.
    return found ?? { kind, id, nazwa: "(usunięty rekord)", szukaj: "" };
  }
  return null;
}
