import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureClientsSchema, ensureContractsSchema, ensureFollowupsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { offerReference } from "@/lib/offers";
import { contractReference, type ContractTyp } from "@/lib/contracts";
import { isPlausibleDateString } from "@/lib/projects";
import { CLIENT_STATUSES } from "@/lib/clients";
import { rematchUnassigned } from "@/lib/mailSync";
import { logFieldChanges, deleteFieldChanges } from "@/lib/auditLog";
import { osobyKlienta } from "@/lib/clientContacts";

export const runtime = "nodejs";

/** GET /api/clients/:id — klient + JEDEN scalony chronologiczny feed
 * ("pełna historia akcji": ręczne notatki + historia z leada sprzed awansu
 * na klienta + zdarzenia systemowe jak wysłanie oferty/wystawienie
 * faktury/wpłata) + powiązane oferty/faktury/projekty (szybkie linki do
 * aktualnego stanu). */
type OfferRow = { id: string; tytul: string; status: string; project_id: string | null; waluta?: string | null; created_at: string };
type ContractRow = {
  id: string;
  typ: string;
  status: string;
  offer_id: string | null;
  project_id: string | null;
  parent_contract_id: string | null;
  aneks_nr: number;
  created_at: string;
};
type ProjectRow = { id: string; tytul: string; status: string; created_at: string };
type InvoiceRow = {
  id: string;
  numer: string | null;
  status: string;
  typ_dokumentu: string;
  offer_id: string | null;
  contract_id: string | null;
  project_id: string | null;
  created_at: string;
};

/** Jeden krok ścieżki — tyle, ile potrzeba, żeby narysować wiersz i kliknąć. */
export type KrokSciezki = {
  rodzaj: "offer" | "contract" | "project" | "invoice";
  id: string;
  /** Co to za dokument („Oferta", „Aneks", „Zaliczka") — osobno od numeru,
   * żeby UI nie sklejało „Faktura Zaliczka (szkic)". */
  prefiks: string;
  etykieta: string;
  status: string;
  created_at: string;
};

/** Łączy dokumenty w wątki „oferta → umowa (→ aneks) → faktura".
 *
 * Zasada: wątek zaczyna OFERTA, bo od niej zaczyna się sprzedaż. Dokumenty bez
 * oferty (NDA, powierzenie danych, umowa wolnostojąca, faktura wpisana ręcznie)
 * dostają własny, jednoelementowy wątek — zamiast być doklejone do przypadkowej
 * oferty albo zniknąć z widoku. Ukryty dokument jest gorszy niż samotny.
 */
function zbudujSciezki(
  offers: OfferRow[],
  contracts: ContractRow[],
  invoices: InvoiceRow[],
  projects: ProjectRow[]
): KrokSciezki[][] {
  const uzyteUmowy = new Set<string>();
  const uzyteFaktury = new Set<string>();
  const uzyteProjekty = new Set<string>();

  const krokOferty = (o: OfferRow): KrokSciezki => ({
    rodzaj: "offer",
    id: o.id,
    prefiks: "Oferta",
    etykieta: offerReference(o),
    status: o.status,
    created_at: o.created_at,
  });
  const krokUmowy = (c: ContractRow): KrokSciezki => ({
    rodzaj: "contract",
    id: c.id,
    prefiks: c.typ === "aneks" ? "Aneks" : c.typ === "nda" ? "NDA" : c.typ === "dpa" ? "Powierzenie" : "Umowa",
    etykieta:
      c.typ === "aneks"
        ? `nr ${c.aneks_nr}`
        : contractReference({ id: c.id, typ: c.typ as ContractTyp, created_at: c.created_at }),
    status: c.status,
    created_at: c.created_at,
  });
  const krokFaktury = (i: InvoiceRow): KrokSciezki => ({
    rodzaj: "invoice",
    id: i.id,
    prefiks: i.typ_dokumentu === "zaliczkowa" ? "Zaliczka" : i.typ_dokumentu === "proforma" ? "Proforma" : "Faktura",
    etykieta: i.numer || "(szkic)",
    status: i.status,
    created_at: i.created_at,
  });

  const krokProjektu = (p: ProjectRow): KrokSciezki => ({
    rodzaj: "project",
    id: p.id,
    prefiks: "Projekt",
    etykieta: p.tytul || "(bez tytułu)",
    status: p.status,
    created_at: p.created_at,
  });

  const sciezki: KrokSciezki[][] = [];

  for (const o of offers) {
    const krok = [krokOferty(o)];
    // Umowy z tej oferty + ich aneksy (aneks idzie ZARAZ za swoją umową, nie
    // na końcu wątku — inaczej „nr 1" wisiałby pod fakturą i nie było widać,
    // czego dotyczy).
    // Faktury z umów zbieramy NA BOK i dokładamy dopiero za projektem —
    // kolejność ma czytać się jak lejek (oferta → papier → praca → pieniądze),
    // a nie jak kolejność pętli w kodzie.
    const fakturyUmow: KrokSciezki[] = [];
    for (const c of contracts.filter((x) => x.offer_id === o.id && x.typ !== "aneks")) {
      krok.push(krokUmowy(c));
      uzyteUmowy.add(c.id);
      for (const a of contracts.filter((x) => x.parent_contract_id === c.id)) {
        krok.push(krokUmowy(a));
        uzyteUmowy.add(a.id);
      }
      for (const f of invoices.filter((x) => x.contract_id === c.id)) {
        fakturyUmow.push(krokFaktury(f));
        uzyteFaktury.add(f.id);
      }
    }
    // Projekt wchodzi PO umowie, a przed fakturami — tak biegnie lejek
    // (papier przed pracą, praca przed rozliczeniem). Tylko raz, nawet gdy
    // wskazuje na niego i oferta, i umowa.
    const projektId =
      contracts.find((c) => c.offer_id === o.id && c.project_id)?.project_id ??
      o.project_id ??
      invoices.find((f) => f.offer_id === o.id && f.project_id)?.project_id ??
      null;
    const projekt = projektId ? projects.find((p) => p.id === projektId) : undefined;
    if (projekt && !uzyteProjekty.has(projekt.id)) {
      krok.push(krokProjektu(projekt));
      uzyteProjekty.add(projekt.id);
    }
    krok.push(...fakturyUmow);
    for (const f of invoices.filter((x) => x.offer_id === o.id && !uzyteFaktury.has(x.id))) {
      krok.push(krokFaktury(f));
      uzyteFaktury.add(f.id);
    }
    sciezki.push(krok);
  }

  for (const c of contracts.filter((x) => !uzyteUmowy.has(x.id) && x.typ !== "aneks")) {
    const krok = [krokUmowy(c)];
    for (const a of contracts.filter((x) => x.parent_contract_id === c.id && !uzyteUmowy.has(x.id))) krok.push(krokUmowy(a));
    const p = c.project_id ? projects.find((x) => x.id === c.project_id) : undefined;
    if (p && !uzyteProjekty.has(p.id)) {
      krok.push(krokProjektu(p));
      uzyteProjekty.add(p.id);
    }
    for (const f of invoices.filter((x) => x.contract_id === c.id && !uzyteFaktury.has(x.id))) {
      krok.push(krokFaktury(f));
      uzyteFaktury.add(f.id);
    }
    sciezki.push(krok);
  }

  // Pojedynczy dokument NIE jest ścieżką — sam ze sobą nic nie tworzy, a
  // wyświetlony w tej sekcji wygląda jak powtórzenie listy niżej (zgłoszenie
  // właściciela 2026-07-27: „jak mam to odczytywać?"). Dokumenty bez związku
  // zostają tam, gdzie i tak są: w rejestrze pod spodem.
  return sciezki.filter((s) => s.length >= 2);
}

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
    leadId
      ? (sql`SELECT id, text, kanal, kierunek, wynik, czas_trwania_sek, mail_message_id, created_at FROM lead_activity WHERE lead_id = ${leadId};` as unknown as Promise<RawActivity[]>)
      : Promise.resolve([] as RawActivity[]),
    sql`SELECT id, kind, text, amount, related_id, created_at FROM client_events WHERE client_id = ${id};`,
    sql`SELECT id, tytul, status, wazna_do, waluta, project_id, created_at FROM offers WHERE client_id = ${id} ORDER BY created_at DESC;`,
    sql`SELECT id, numer, status, typ_dokumentu, offer_id, contract_id, project_id, created_at FROM invoices WHERE client_id = ${id} ORDER BY created_at DESC;`,
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
    sql`SELECT id, typ, status, project_id, offer_id, parent_contract_id, aneks_nr, accepted_at, created_at FROM contracts WHERE client_id = ${id} ORDER BY created_at DESC;`,
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

  return NextResponse.json({ client, feed, offers, invoices, projects, contracts, mail, followups, contacts, sciezki });
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
  // zapytanie. Brak wiersza = klient skasowany w międzyczasie; UPDATE-y niżej
  // i tak nic nie trafią, a log zostaje pusty zamiast zmyślać starą wartość.
  const beforeRows = await sql`SELECT * FROM clients WHERE id = ${id};`;
  const before = (beforeRows[0] ?? {}) as Record<string, unknown>;
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
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureClientsSchema();
  const sql = getSql();
  await sql`DELETE FROM clients WHERE id = ${id};`;
  await deleteFieldChanges("client", id);
  return NextResponse.json({ ok: true });
}
