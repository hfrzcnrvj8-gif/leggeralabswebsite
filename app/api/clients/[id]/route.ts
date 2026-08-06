import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureClientsSchema, ensureContractsSchema, ensureFollowupsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { odczytajPotwierdzenie, odmowaPotwierdzenia } from "@/lib/nieodwracalne";
import {
  zbudujSciezki,
  type OfferRow,
  type ContractRow,
  type InvoiceRow,
  type ProjectRow,
} from "@/lib/sciezkaDokumentow";
import { isPlausibleDateString } from "@/lib/projects";
import { contractReference, type ContractTyp } from "@/lib/contracts";
import { offerReference } from "@/lib/offers";
import { CLIENT_STATUSES } from "@/lib/clients";
import { rematchUnassigned } from "@/lib/mailSync";
import { logFieldChanges, deleteFieldChanges } from "@/lib/auditLog";
import { osobyKlienta } from "@/lib/clientContacts";
import { odpowiedzBrakRekordu } from "@/lib/brakRekordu";

export const runtime = "nodejs";

/** GET /api/clients/:id — klient + JEDEN scalony chronologiczny feed
 * ("pełna historia akcji": ręczne notatki + historia z leada sprzed awansu
 * na klienta + zdarzenia systemowe jak wysłanie oferty/wystawienie
 * faktury/wpłata) + powiązane oferty/faktury/projekty (szybkie linki do
 * aktualnego stanu). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureClientsSchema();
  const sql = getSql();

  const rows = await sql`SELECT * FROM clients WHERE id = ${id};`;
  const client = rows[0];
  if (!client) return NextResponse.json({ error: "not found" }, { status: 404 });
  const leadId = typeof client.lead_id === "string" ? client.lead_id : null;

  type RawActivity = {
    id: string;
    text: string;
    kanal: string | null;
    kierunek: string | null;
    wynik: string | null;
    czas_trwania_sek: number | null;
    mail_message_id: string | null;
    created_at: string;
  };
  // Moduł 31 — umowy dociągane tym samym `Promise.all` co reszta. Oś czasu
  // klienta umowy widziała od Modułu 11 (client_events: contract_created/sent/
  // signed), ale sekcja "Powiązane" ich nie znała, więc nie dało się z karty
  // klienta sprawdzić, czy papier w ogóle jest podpisany — a to warunek startu
  // jego projektów (bramka w api/projects/[id]).
  await ensureContractsSchema();
  await ensureFollowupsSchema();
  const [clientActivity, leadActivity, events, offers, invoices, projects, contracts, mail, followups, contacts] = await Promise.all([
    sql`SELECT id, text, kanal, kierunek, wynik, czas_trwania_sek, mail_message_id, created_at FROM client_activity WHERE client_id = ${id};` as unknown as Promise<RawActivity[]>,
    // `kind IS NULL` = wpisy o PRAWDZIWYM kontakcie (ręczna notatka, telefon,
    // mail) — tylko one dociągają się z leada. Zdarzenia dokumentowe (krok 4,
    // B1) mają `kind` niepuste i klient dostaje je własną drogą, z
    // `client_events`; bez tego warunku każda wysłana oferta pokazałaby się na
    // osi klienta DWA razy, bo od kroku 4 zapisuje się w obu tabelach naraz.
    leadId
      ? (sql`SELECT id, text, kanal, kierunek, wynik, czas_trwania_sek, mail_message_id, created_at FROM lead_activity WHERE lead_id = ${leadId} AND kind IS NULL;` as unknown as Promise<RawActivity[]>)
      : Promise.resolve([] as RawActivity[]),
    sql`SELECT id, kind, text, amount, related_id, created_at FROM client_events WHERE client_id = ${id};`,
    // Kwota oferty liczona w bazie (suma pozycji bez odrzuconych opcji) —
    // dokładnie tak, jak liczy ją lista Ofert.
    sql`
      SELECT o.id, o.tytul, o.status, o.wazna_do, o.waluta, o.project_id, o.created_at,
             COALESCE(t.kwota, 0)::float8 AS kwota
      FROM offers o
      LEFT JOIN (
        SELECT offer_id, SUM(ilosc * cena) FILTER (WHERE NOT opcjonalna OR wybrana) AS kwota
        FROM offer_items GROUP BY offer_id
      ) t ON t.offer_id = o.id
      WHERE o.client_id = ${id} ORDER BY o.created_at DESC;
    `,
    // Kwota faktury z rabatem — tak jak wszędzie indziej przy fakturach.
    // Znalezione przy audycie Projektów (2026-07-31): ta trasa i rentowność
    // projektu miały tę samą literówkę (suma po cenie katalogowej), więc kwota
    // faktury w profilu klienta rozjeżdżała się z kwotą na liście Faktur.
    sql`
      SELECT i.id, i.numer, i.status, i.typ_dokumentu, i.offer_id, i.contract_id, i.project_id,
             i.waluta, i.created_at,
             COALESCE(t.kwota, 0)::float8 AS kwota
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(ilosc * cena_netto * (1 - rabat_procent / 100)) AS kwota FROM invoice_items GROUP BY invoice_id
      ) t ON t.invoice_id = i.id
      WHERE i.client_id = ${id} ORDER BY i.created_at DESC;
    `,
    // Pola opinii (Moduł 15) jadą razem z projektem: gwiazdka z listy klientów
    // mówiła TYLE, że jakaś opinia jest, ale profil klienta milczał o tym, KTÓRY
    // projekt ją przyniósł i czy klient zgodził się na referencję — a to jedyne
    // miejsce, gdzie ta zgoda ma sens biznesowy (portfolio nowej firmy).
    sql`
      SELECT id, tytul, status, termin, created_at,
        review_rating_jakosc, review_rating_terminowosc, review_rating_komunikacja,
        review_comment, review_submitted_at, review_consent_case_study
      FROM projects WHERE client_id = ${id} ORDER BY created_at DESC;
    `,
    sql`SELECT id, typ, status, project_id, offer_id, parent_contract_id, aneks_nr, cena, waluta, accepted_at, created_at FROM contracts WHERE client_id = ${id} ORDER BY created_at DESC;`,
    // Kartoteka korespondencji (04d pkt 2) — osobny rejestr obok scalonego
    // feedu, na wyraźną prośbę właściciela (nadpisuje wcześniejszą decyzję z
    // 04-skrzynka-mailowa.md o braku osobnej sekcji).
    sql`SELECT id, subject, kierunek, status, received_at FROM mail_messages WHERE client_id = ${id} ORDER BY received_at DESC LIMIT 100;`,
    // Kontakty kontrolne (Moduł 17). Do 2026-07-26 widać je było WYŁĄCZNIE na
    // Pulpicie i tylko w dniu terminu — z karty klienta nie dało się sprawdzić
    // „kiedy mam do niego wrócić" ani odwołać kontaktu, mimo że to jedyny
    // mechanizm domykający pętlę retencji.
    sql`SELECT id, project_id, due_date, powod, done_at, created_at FROM client_followups WHERE client_id = ${id} ORDER BY due_date ASC;`,
    // Osoby kontaktowe (Moduł 54, krok 4) — razem z profilem, nie osobnym
    // żądaniem: to kilka wierszy, które karta pokazuje ZAWSZE, w odróżnieniu
    // od logu zmian (osobny endpoint, bo zwykle nikt go nie otwiera).
    osobyKlienta(sql, id),
  ]);
  // Audyt zmian (Moduł 23) świadomie NIE jest tutaj — ma własny endpoint
  // `/changes`, dociągany dopiero po otwarciu zakładki. Dwa powody: profil nie
  // płaci zapytania za log, którego zwykle nikt nie otworzy, a log zostaje
  // aktualny po edycji pola w wizytówce (inaczej pokazywałby stan sprzed
  // zmiany aż do przeładowania całego profilu).

  // Scalony feed — trzy różne źródła, wspólny kształt, posortowane
  // chronologicznie (najnowsze pierwsze). `source: "lead"` oznacza wpisy
  // sprzed awansu na klienta (dociągnięte z leada, z którego powstał) —
  // UI pokazuje je z osobnym tagiem, żeby było jasne skąd się wzięły.
  const feed = [
    ...clientActivity.map((a) => ({
      id: a.id,
      created_at: a.created_at,
      kind: "note" as const,
      text: a.text,
      amount: null as number | null,
      kanal: a.kanal ?? null,
      kierunek: a.kierunek ?? null,
      wynik: a.wynik ?? null,
      czas_trwania_sek: a.czas_trwania_sek ?? null,
      related_id: null as string | null,
      mail_message_id: a.mail_message_id ?? null,
      source: "client" as const,
    })),
    ...leadActivity.map((a) => ({
      id: a.id,
      created_at: a.created_at,
      kind: "note" as const,
      text: a.text,
      amount: null as number | null,
      kanal: a.kanal ?? null,
      kierunek: a.kierunek ?? null,
      wynik: a.wynik ?? null,
      czas_trwania_sek: a.czas_trwania_sek ?? null,
      related_id: null as string | null,
      mail_message_id: a.mail_message_id ?? null,
      source: "lead" as const,
    })),
    ...events.map((e) => ({
      id: e.id as string,
      created_at: e.created_at as string,
      kind: e.kind as string,
      text: e.text as string,
      amount: e.amount != null ? Number(e.amount) : null,
      kanal: null as string | null,
      kierunek: null as string | null,
      wynik: null as string | null,
      czas_trwania_sek: null as number | null,
      related_id: (e.related_id as string | null) ?? null,
      mail_message_id: null as string | null,
      source: "system" as const,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // ŚCIEŻKI DOKUMENTÓW (2026-07-27, prośba właściciela) — „z oferty powstała
  // umowa, a z niej faktura". Oś czasu pokazuje zdarzenia po kolei, ale nie
  // mówi, co z czego WYNIKA: przy dwóch równoległych wątkach sprzedaży to
  // dwie różne historie przeplecione datami.
  //
  // Budujemy je z JAWNYCH powiązań (`contracts.offer_id`, `invoices.offer_id`,
  // `invoices.contract_id`, `parent_contract_id`), nie ze zgadywania po
  // projekcie — starsze faktury tych kolumn nie mają i świadomie NIE próbujemy
  // ich dopisać wstecz: fałszywe powiązanie na dokumencie finansowym jest
  // gorsze niż jego brak. Trafiają do wątku „bez źródła".
  const sciezki = zbudujSciezki(
    offers as OfferRow[],
    contracts as ContractRow[],
    invoices as InvoiceRow[],
    projects as ProjectRow[]
  );

  // NUMER dokumentu liczony TU, nie w apce (Moduł 59). Mini-mapa wyżej mówiła
  // „UM-2026-F57862", a płaski rejestr pod nią trzy razy „Umowa" — bo apka
  // dostawała `typ` i budowała z niego etykietę słowną, a numer istnieje
  // wyłącznie jako funkcja panelu (`contractReference`). Przepisanie tej
  // arytmetyki do Swifta dałoby DRUGIE źródło numeru dokumentu; zamiast tego
  // trasa dokłada gotowe pole, a apka je tylko wyświetla.
  const contractsZNumerem = (contracts as ContractRow[]).map((c) => ({
    ...c,
    numer: contractReference({ id: c.id, typ: c.typ as ContractTyp, created_at: c.created_at }),
  }));
  const offersZNumerem = (offers as OfferRow[]).map((o) => ({ ...o, numer: offerReference(o) }));

  return NextResponse.json({
    client,
    feed,
    offers: offersZNumerem,
    invoices,
    projects,
    contracts: contractsZNumerem,
    mail,
    followups,
    contacts,
    sciezki,
  });
}

/** PATCH /api/clients/:id — aktualizacja pól karty klienta. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  await ensureClientsSchema();
  const sql = getSql();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const dateOrNull = (v: unknown): string | null | undefined => {
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    if (!t) return null;
    return isPlausibleDateString(t) ? t : undefined;
  };

  // Audyt zmian (Moduł 23) — stan sprzed zapisu, do porównania „z czego na co".
  // Jeden SELECT na cały PATCH, nie na pole: neon() płaci rundę HTTP za każde
  // zapytanie.
  const beforeRows = await sql`SELECT * FROM clients WHERE id = ${id};`;
  // Brak wiersza = klient skasowany w międzyczasie (najczęściej w drugim oknie
  // panelu). Do etapu 3 stał tu komentarz „UPDATE-y niżej i tak nic nie trafią"
  // — i to prawda, tylko że trasa odpowiadała wtedy `{"ok":true}`, więc ekran
  // pisał „Zapisano" nad treścią, której nie ma w bazie. Patrz lib/brakRekordu.ts.
  if (!beforeRows[0]) return odpowiedzBrakRekordu("klient");
  const before = beforeRows[0] as Record<string, unknown>;
  // Co realnie ustawiamy — zbierane po walidacji, żeby log nie zapisał
  // wartości, której baza nie przyjęła.
  const applied: Record<string, unknown> = {};

  if ("nazwa" in body) {
    applied.nazwa = str(body.nazwa, 300);
    await sql`UPDATE clients SET nazwa = ${applied.nazwa}, updated_at = now() WHERE id = ${id};`;
  }
  if ("nip" in body) {
    applied.nip = str(body.nip, 30);
    await sql`UPDATE clients SET nip = ${applied.nip}, updated_at = now() WHERE id = ${id};`;
  }
  if ("ulica" in body) {
    applied.ulica = str(body.ulica, 300);
    await sql`UPDATE clients SET ulica = ${applied.ulica}, updated_at = now() WHERE id = ${id};`;
  }
  if ("kod" in body) {
    applied.kod = str(body.kod, 20);
    await sql`UPDATE clients SET kod = ${applied.kod}, updated_at = now() WHERE id = ${id};`;
  }
  if ("miasto" in body) {
    applied.miasto = str(body.miasto, 200);
    await sql`UPDATE clients SET miasto = ${applied.miasto}, updated_at = now() WHERE id = ${id};`;
  }
  if ("kraj" in body) {
    applied.kraj = str(body.kraj, 100);
    await sql`UPDATE clients SET kraj = ${applied.kraj}, updated_at = now() WHERE id = ${id};`;
  }
  if ("email" in body) {
    const email = str(body.email, 200);
    applied.email = email;
    await sql`UPDATE clients SET email = ${email}, updated_at = now() WHERE id = ${id};`;
    // Nowy/zmieniony adres — dopnij od razu zaległą korespondencję (04d pkt 1).
    if (email.trim()) {
      await rematchUnassigned().catch((e) => console.error("[clients] rematch poczty nie powiódł się", e));
    }
  }
  if ("telefon" in body) {
    applied.telefon = str(body.telefon, 100);
    await sql`UPDATE clients SET telefon = ${applied.telefon}, updated_at = now() WHERE id = ${id};`;
  }
  if ("www" in body) {
    applied.www = str(body.www, 200);
    await sql`UPDATE clients SET www = ${applied.www}, updated_at = now() WHERE id = ${id};`;
  }
  // `osoba_kontaktowa` świadomie NIE jest tu przyjmowana (Moduł 54, krok 4).
  //
  // Od listy osób kontaktowych ta kolumna jest MIGAWKĄ osoby głównej, liczoną
  // przez `synchronizujMigawke` w `lib/clientContacts.ts`. Drugi pisarz
  // rozjechałby ją z listą: wizytówka pokazywałaby gwiazdkę przy jednej
  // osobie, a wiersz listy i powitanie w mailu — imię innej, aż do najbliższej
  // zmiany osób, która po cichu skasowałaby ręczny wpis. Osobę zmienia się
  // przez `/api/clients/:id/contacts`.
  //
  // Krótko (2026-07-26, ten sam dzień) pole BYŁO tu przyjmowane — dołożone
  // w audycie Klientów, gdy jeszcze było jedynym nośnikiem tej informacji.
  // Źródło — edytowalne od 2026-07-26, druga runda audytu Klientów. Pierwsza
  // zostawiła je tylko do odczytu („migawka z chwili awansu z leada"), co dało
  // asymetrię nie do obronienia: lead ma picker do poprawienia kategorii,
  // klient nie miał nic, a klienci sprzed tej zmiany mają pole PUSTE. Po tej
  // kolumnie liczy się pętla poleceń, więc pole, którego nie da się poprawić,
  // po prostu zostaje błędne na zawsze.
  if ("zrodlo_kategoria" in body) {
    applied.zrodlo_kategoria = str(body.zrodlo_kategoria, 100);
    await sql`UPDATE clients SET zrodlo_kategoria = ${applied.zrodlo_kategoria}, updated_at = now() WHERE id = ${id};`;
  }
  if ("zrodlo" in body) {
    applied.zrodlo = str(body.zrodlo, 300);
    await sql`UPDATE clients SET zrodlo = ${applied.zrodlo}, updated_at = now() WHERE id = ${id};`;
  }
  if ("linkedin_url" in body) {
    applied.linkedin_url = str(body.linkedin_url, 300);
    await sql`UPDATE clients SET linkedin_url = ${applied.linkedin_url}, updated_at = now() WHERE id = ${id};`;
  }
  // Rytm kontaktu — liczba miesięcy albo NULL (bez pilnowania). Pusty string
  // i 0 traktujemy jak brak: „wyłącz pilnowanie" ma być jednym ruchem, nie
  // szukaniem właściwej wartości.
  if ("rytm_kontaktu_mies" in body) {
    const raw = Number(body.rytm_kontaktu_mies);
    const rytm = Number.isFinite(raw) && raw > 0 ? Math.min(Math.round(raw), 60) : null;
    applied.rytm_kontaktu_mies = rytm;
    await sql`UPDATE clients SET rytm_kontaktu_mies = ${rytm}, updated_at = now() WHERE id = ${id};`;
  }
  if ("next_action" in body) {
    applied.next_action = str(body.next_action, 500);
    await sql`UPDATE clients SET next_action = ${applied.next_action}, updated_at = now() WHERE id = ${id};`;
  }
  if ("branza" in body) {
    applied.branza = str(body.branza, 200);
    await sql`UPDATE clients SET branza = ${applied.branza}, updated_at = now() WHERE id = ${id};`;
  }
  if ("notatki" in body) {
    applied.notatki = str(body.notatki, 4000);
    await sql`UPDATE clients SET notatki = ${applied.notatki}, updated_at = now() WHERE id = ${id};`;
  }
  if ("status" in body) {
    const v = typeof body.status === "string" && (CLIENT_STATUSES as readonly string[]).includes(body.status) ? body.status : "Prospekt";
    applied.status = v;
    await sql`UPDATE clients SET status = ${v}, updated_at = now() WHERE id = ${id};`;
  }
  if ("ostatni_kontakt" in body) {
    const v = dateOrNull(body.ostatni_kontakt);
    if (v === undefined) return NextResponse.json({ error: "invalid ostatni_kontakt" }, { status: 400 });
    applied.ostatni_kontakt = v;
    await sql`UPDATE clients SET ostatni_kontakt = ${v}, updated_at = now() WHERE id = ${id};`;
  }
  if ("next_followup" in body) {
    const v = dateOrNull(body.next_followup);
    if (v === undefined) return NextResponse.json({ error: "invalid next_followup" }, { status: 400 });
    applied.next_followup = v;
    await sql`UPDATE clients SET next_followup = ${v}, updated_at = now() WHERE id = ${id};`;
  }

  await logFieldChanges("client", id, before, applied);

  return NextResponse.json({ ok: true });
}

/** DELETE /api/clients/:id — usuwa klienta. Powiązane leady/oferty/faktury/
 * projekty NIE są usuwane, tylko odpinane (client_id -> NULL, ON DELETE SET
 * NULL) — to już osobne, samodzielne byty, jak przy usuwaniu leada z oferty.
 * Faktury/umowy zostają z migawką danych (obowiązek podatkowy 5 lat).
 * Audyt zmian kasujemy jawnie — nie ma FK, więc kaskada bazy by go nie ruszyła
 * i zostałyby surowe stare/nowe e-maile klienta (RODO, Audyt 2). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureClientsSchema();
  const sql = getSql();

  // POTWIERDZENIE (Faza 4), poziom „mocne" — znika cała historia kontaktów
  // i osoby kontaktowe, a tego nie odtworzy żaden inny zapis w panelu.
  // Nazwę czytamy z bazy, bo to SERWER rozstrzyga, czy przepisano właściwą
  // (gdyby porównywał panel, bariera byłaby ozdobą).
  const istnieje = await sql`SELECT nazwa FROM clients WHERE id = ${id};`;
  if (!istnieje[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  const odmowaPotw = odmowaPotwierdzenia(
    "klient-usun",
    odczytajPotwierdzenie(req.headers),
    typeof istnieje[0].nazwa === "string" ? istnieje[0].nazwa : null
  );
  if (odmowaPotw) {
    return NextResponse.json({ error: odmowaPotw.error, potwierdzenie: odmowaPotw.potwierdzenie }, { status: odmowaPotw.status });
  }

  await sql`DELETE FROM clients WHERE id = ${id};`;
  await deleteFieldChanges("client", id);
  return NextResponse.json({ ok: true });
}
