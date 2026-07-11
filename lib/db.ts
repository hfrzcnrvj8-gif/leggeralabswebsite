import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

type Sql = NeonQueryFunction<false, false>;

let client: Sql | null = null;
let schemaReady: Promise<void> | null = null;
let hubSchemaReady: Promise<void> | null = null;

function connectionString(): string {
  // Vercel's native Postgres product (and @vercel/postgres) is gone — DB
  // storage now comes from the Marketplace (Neon, Supabase, etc.), which
  // injects its own connection string env var. Check the common names so
  // this works regardless of which provider/naming was used.
  const cs =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING;
  if (!cs) {
    throw new Error(
      "Brak connection stringa do bazy danych (DATABASE_URL / POSTGRES_URL). Podłącz bazę Postgres (np. z Vercel Marketplace — Neon) do projektu; zmienna zostanie wstrzyknięta automatycznie."
    );
  }
  return cs;
}

/** Lazily creates (and caches) the Neon HTTP query client for this instance.
 *
 * W trybie deweloperskim BEZ prawdziwej bazy (brak DATABASE_URL/POSTGRES_URL)
 * używamy lokalnego PGlite (Postgres w WASM) z danymi testowymi — patrz
 * dev-db.ts. Pozwala to na `npm run dev` z w pełni działającym panelem bez
 * podłączania Neona. Na produkcji ten warunek nigdy nie jest spełniony
 * (NODE_ENV=production + realny DATABASE_URL). */
export function getSql(): Sql {
  if (client) return client;

  const hasRealDb = Boolean(
    process.env.DATABASE_URL ??
      process.env.POSTGRES_URL ??
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.POSTGRES_URL_NON_POOLING
  );
  if (process.env.NODE_ENV === "development" && !hasRealDb) {
    // Import wewnątrz warunku, żeby PGlite nie trafił do bundla produkcyjnego.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDevSql } = require("./dev-db") as typeof import("./dev-db");
    client = getDevSql() as unknown as Sql;
    return client;
  }

  client = neon(connectionString());
  return client;
}

async function createSchema(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      firma TEXT NOT NULL,
      branza TEXT NOT NULL DEFAULT '',
      kontakt TEXT NOT NULL DEFAULT '',
      zrodlo TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Do kontaktu',
      ostatni_kontakt DATE,
      notatki TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  // Jawna data "przypomnij mi" — zastępuje sztywną regułę "4 dni od
  // ostatniego kontaktu" czymś, co Ty sam ustawiasz przy każdej interakcji.
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_followup DATE;`;

  // Rozbicie dawnego, zlepionego pola "kontakt" (telefon+mail+www w jednym
  // stringu) na osobne, ustrukturyzowane kolumny. Stara kolumna `kontakt`
  // zostaje w bazie nietknięta (nie tracimy danych już tam zapisanych),
  // po prostu nowe zapisy lądują w nowych polach.
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS telefon TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS www TEXT NOT NULL DEFAULT '';`;

  // Chronologiczny log aktywności per lead — w przeciwieństwie do jednego
  // nadpisywanego pola notatek, każdy wpis zostaje na zawsze.
  await sql`
    CREATE TABLE IF NOT EXISTS lead_activity (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS lead_activity_lead_id_idx ON lead_activity(lead_id);`;
}

/**
 * Lazily creates the `leads` table on first use. Idempotent and cheap
 * (CREATE TABLE IF NOT EXISTS), cached per warm serverless instance.
 */
export async function ensureLeadsSchema(): Promise<void> {
  if (!schemaReady) schemaReady = createSchema();
  await schemaReady;
}

async function createHubSchema(): Promise<void> {
  // `projects.lead_id` odwołuje się kluczem obcym do `leads(id)`, więc tabela
  // leadów musi istnieć PRZED tworzeniem projektów. Na ciepłej instancji
  // produkcyjnej leady zwykle już były, ale na świeżej bazie (nowy deploy,
  // lokalny dev) kolejność ma znaczenie — dlatego jawnie zapewniamy schemat
  // leadów jako pierwszy.
  await ensureLeadsSchema();

  const sql = getSql();

  // Projekty/wdrożenia — druga tablica obok leadów, z tym samym duchem
  // (kanban po statusie), plus checklisty i log aktywności per projekt.
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      tytul TEXT NOT NULL,
      opis TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Pomysł',
      priorytet TEXT NOT NULL DEFAULT 'Normalny',
      termin DATE,
      lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS project_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT false,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS project_tasks_project_id_idx ON project_tasks(project_id);`;
  await sql`
    CREATE TABLE IF NOT EXISTS project_activity (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS project_activity_project_id_idx ON project_activity(project_id);`;
  // Rodzaj wpisu: "note" (ręczny) vs "system" (automatyczny log zmiany pola).
  await sql`ALTER TABLE project_activity ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'note';`;

  // Zdrowie projektu (Na dobrej drodze/Zagrożony/Zerwany) — ustawiane ręcznie,
  // niezależne od statusu na tablicy, styl Linear. Data startu potrzebna do
  // widoku osi czasu (pasek projektu rysuje się między start a termin).
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS zdrowie TEXT NOT NULL DEFAULT 'Na dobrej drodze';`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS start DATE;`;
  // Kolor akcentu (hex) i ikona (emoji) — tożsamość projektu w listach/osi czasu.
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS kolor TEXT;`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS ikona TEXT;`;

  // Kamienie milowe — grupują zadania z checklisty i pokazują postęp
  // ("Core 100% z 73") osobno dla każdego etapu projektu, nie tylko całości.
  await sql`
    CREATE TABLE IF NOT EXISTS project_milestones (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      nazwa TEXT NOT NULL,
      termin DATE,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS project_milestones_project_id_idx ON project_milestones(project_id);`;
  await sql`ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS milestone_id TEXT REFERENCES project_milestones(id) ON DELETE SET NULL;`;

  // Zasoby — linki do Figmy/dokumentów/notatek przypięte do projektu, żeby
  // nie szukać ich rozproszonych po mailu/Slacku.
  await sql`
    CREATE TABLE IF NOT EXISTS project_resources (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      etykieta TEXT NOT NULL,
      url TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS project_resources_project_id_idx ON project_resources(project_id);`;

  // Zależności między projektami (styl Linear Roadmap): project_id "zależy od"
  // depends_on_id (poprzednik musi się skończyć wcześniej) — rysowane jako
  // krzywe łączące koniec poprzednika ze startem następnika na osi czasu.
  await sql`
    CREATE TABLE IF NOT EXISTS project_dependencies (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      depends_on_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (project_id, depends_on_id)
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS project_dependencies_project_id_idx ON project_dependencies(project_id);`;

  // Notatnik — szybkie zapisywanie pomysłów, z tagami (proste CSV zamiast
  // typu tablicowego — mniej niespodzianek przy odczycie przez neon-http).
  await sql`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      tytul TEXT NOT NULL DEFAULT '',
      tresc TEXT NOT NULL DEFAULT '',
      tagi TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS notes_activity (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS notes_activity_note_id_idx ON notes_activity(note_id);`;

  // Kalendarz — pojedyncze wydarzenia, opcjonalnie powiązane z leadem lub
  // projektem, żeby dashboard mógł je pokazać w kontekście.
  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      tytul TEXT NOT NULL,
      opis TEXT NOT NULL DEFAULT '',
      data DATE NOT NULL,
      godzina TEXT,
      lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS events_data_idx ON events(data);`;
}

/** Lazily creates projects/notes/events tables (i tabele pomocnicze) na
 * pierwsze użycie — analogicznie do ensureLeadsSchema(). */
export async function ensureHubSchema(): Promise<void> {
  if (!hubSchemaReady) hubSchemaReady = createHubSchema();
  await hubSchemaReady;
}

let invoicesSchemaReady: Promise<void> | null = null;

async function createInvoicesSchema(): Promise<void> {
  const sql = getSql();
  // Faktura odwołuje się do leadów/projektów (FK) — upewnij się, że istnieją.
  await ensureLeadsSchema();
  await ensureHubSchema();

  // Dane sprzedawcy + tryb VAT — pojedynczy wiersz (singleton, id='default').
  await sql`
    CREATE TABLE IF NOT EXISTS company_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      nazwa TEXT NOT NULL DEFAULT '',
      nip TEXT NOT NULL DEFAULT '',
      adres TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      telefon TEXT NOT NULL DEFAULT '',
      konto TEXT NOT NULL DEFAULT '',
      vat_payer BOOLEAN NOT NULL DEFAULT true,
      zwolnienie_podstawa TEXT NOT NULL DEFAULT '',
      domyslny_termin_dni INTEGER NOT NULL DEFAULT 14,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`INSERT INTO company_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;`;
  // Nazwa banku + BIC/SWIFT — dodane po pierwszym wdrożeniu, do stopki
  // wydruku (przydatne zwłaszcza zagranicznym klientom płacącym SWIFT/SEPA).
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_nazwa TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS swift TEXT NOT NULL DEFAULT '';`;

  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      numer TEXT,
      lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      klient_nazwa TEXT NOT NULL DEFAULT '',
      klient_nip TEXT NOT NULL DEFAULT '',
      klient_adres TEXT NOT NULL DEFAULT '',
      data_wystawienia DATE,
      data_sprzedazy DATE,
      termin_platnosci DATE,
      status TEXT NOT NULL DEFAULT 'Szkic',
      waluta TEXT NOT NULL DEFAULT 'PLN',
      uwagi TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status);`;
  // Język wydruku faktury (pl/en/de) — dodany po pierwszym wdrożeniu modułu.
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS jezyk TEXT NOT NULL DEFAULT 'pl';`;
  // Rozbicie adresu nabywcy na pola strukturalne (zamiast jednego zlepionego
  // pola) — `klient_adres` zostaje tylko jako fallback dla starych faktur.
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS klient_ulica TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS klient_kod TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS klient_miasto TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS klient_kraj TEXT NOT NULL DEFAULT '';`;
  // Odbiorca — opcjonalny, osobny od nabywcy (np. faktura na centralę, towar
  // fizycznie dla oddziału), jak w Fakturowni/inFakt. Puste pola = brak.
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS odbiorca_nazwa TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS odbiorca_ulica TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS odbiorca_kod TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS odbiorca_miasto TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS odbiorca_kraj TEXT NOT NULL DEFAULT '';`;
  // E-mail nabywcy — do wysyłki faktury/przypomnień; share_token — losowy
  // token do publicznego (bez logowania) podglądu faktury przez klienta.
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS klient_email TEXT NOT NULL DEFAULT '';`;
  // share_token generowany w JS (randomUUID) przy tworzeniu faktury, nie w
  // SQL — bez zależności od rozszerzenia pgcrypto (niedostępnego w PGlite).
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS share_token TEXT;`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS invoices_share_token_idx ON invoices(share_token);`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;`;
  // Typ dokumentu — zwykła faktura / proforma (niefiskalna, własna numeracja,
  // nie wchodzi do KPI) / zaliczkowa (na poczet przyszłej faktury końcowej).
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS typ_dokumentu TEXT NOT NULL DEFAULT 'faktura';`;
  // Korekta — ta faktura POPRAWIA fakturę o id = koryguje_id; pozycje tej
  // faktury to stan PO korekcie, oryginał pozostaje nienaruszony (wydruk
  // liczy różnicę przez porównanie pozycji obu dokumentów).
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS koryguje_id TEXT REFERENCES invoices(id) ON DELETE SET NULL;`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS przyczyna_korekty TEXT NOT NULL DEFAULT '';`;
  // Rozliczenie zaliczki — ta faktura (końcowa) odejmuje od sumy kwotę
  // wskazanej wcześniej faktury zaliczkowej.
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS rozlicza_zaliczke_id TEXT REFERENCES invoices(id) ON DELETE SET NULL;`;
  // Kurs NBP zastosowany do VAT na fakturze w walucie obcej (wymóg ustawy o
  // VAT — kwota VAT musi być dodatkowo wyrażona w PLN wg kursu z dnia
  // poprzedzającego wystawienie). Zapisywany raz, przy wystawieniu.
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS kurs_nbp NUMERIC;`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS kurs_nbp_data DATE;`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS kurs_nbp_tabela TEXT;`;

  await sql`
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      kwota NUMERIC NOT NULL,
      data DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS invoice_payments_invoice_id_idx ON invoice_payments(invoice_id);`;

  await sql`
    CREATE TABLE IF NOT EXISTS recurring_invoices (
      id TEXT PRIMARY KEY,
      nazwa TEXT NOT NULL DEFAULT '',
      klient_nazwa TEXT NOT NULL DEFAULT '',
      klient_nip TEXT NOT NULL DEFAULT '',
      klient_ulica TEXT NOT NULL DEFAULT '',
      klient_kod TEXT NOT NULL DEFAULT '',
      klient_miasto TEXT NOT NULL DEFAULT '',
      klient_kraj TEXT NOT NULL DEFAULT '',
      klient_email TEXT NOT NULL DEFAULT '',
      waluta TEXT NOT NULL DEFAULT 'PLN',
      jezyk TEXT NOT NULL DEFAULT 'pl',
      termin_dni INTEGER NOT NULL DEFAULT 14,
      -- Pozycje szablonu jako JSON: [{nazwa, ilosc, jednostka, cena_netto, vat_stawka}]
      -- (nie osobna tabela — to tylko "odbitka" kopiowana przy generowaniu
      -- kolejnej faktury, bez potrzeby relacyjnej integralności).
      pozycje JSONB NOT NULL DEFAULT '[]',
      cykl TEXT NOT NULL DEFAULT 'miesiecznie',
      next_run DATE NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS recurring_invoices_active_idx ON recurring_invoices(active, next_run);`;

  await sql`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      nazwa TEXT NOT NULL DEFAULT '',
      ilosc NUMERIC NOT NULL DEFAULT 1,
      jednostka TEXT NOT NULL DEFAULT 'szt.',
      cena_netto NUMERIC NOT NULL DEFAULT 0,
      vat_stawka TEXT NOT NULL DEFAULT '23',
      position INTEGER NOT NULL DEFAULT 0
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON invoice_items(invoice_id);`;
}

/** Lazily tworzy tabele modułu Faktur (ustawienia firmy, faktury, pozycje). */
export async function ensureInvoicesSchema(): Promise<void> {
  if (!invoicesSchemaReady) invoicesSchemaReady = createInvoicesSchema();
  await invoicesSchemaReady;
}

let offersSchemaReady: Promise<void> | null = null;

async function createOffersSchema(): Promise<void> {
  const sql = getSql();
  // Oferta odwołuje się do leada, a po akceptacji do utworzonego projektu i
  // faktury (FK) — upewnij się, że te tabele istnieją.
  await ensureLeadsSchema();
  await ensureHubSchema();
  await ensureInvoicesSchema();

  await sql`
    CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY,
      tytul TEXT NOT NULL DEFAULT '',
      lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
      klient_nazwa TEXT NOT NULL DEFAULT '',
      klient_nip TEXT NOT NULL DEFAULT '',
      klient_adres TEXT NOT NULL DEFAULT '',
      wazna_do DATE,
      status TEXT NOT NULL DEFAULT 'Szkic',
      uwagi TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS offers_status_idx ON offers(status);`;
  // Język wydruku (pl/en/de) i strukturalny adres klienta — dodane po
  // pierwszym wdrożeniu modułu, tak samo jak w invoices.
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS jezyk TEXT NOT NULL DEFAULT 'pl';`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS klient_ulica TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS klient_kod TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS klient_miasto TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS klient_kraj TEXT NOT NULL DEFAULT '';`;

  await sql`
    CREATE TABLE IF NOT EXISTS offer_items (
      id TEXT PRIMARY KEY,
      offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
      nazwa TEXT NOT NULL DEFAULT '',
      ilosc NUMERIC NOT NULL DEFAULT 1,
      jednostka TEXT NOT NULL DEFAULT 'szt.',
      cena NUMERIC NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS offer_items_offer_id_idx ON offer_items(offer_id);`;
}

/** Lazily tworzy tabele modułu Ofert (oferty, pozycje). */
export async function ensureOffersSchema(): Promise<void> {
  if (!offersSchemaReady) offersSchemaReady = createOffersSchema();
  await offersSchemaReady;
}

/** Zwraca `share_token` faktury, generując go w locie (randomUUID), jeśli
 * jeszcze go nie ma — dotyczy faktur utworzonych przed wprowadzeniem
 * publicznego podglądu/wysyłki mailem. */
export async function ensureInvoiceShareToken(sql: Sql, id: string, existingToken: string | null): Promise<string> {
  if (existingToken) return existingToken;
  const token = randomUUID().replace(/-/g, "");
  await sql`UPDATE invoices SET share_token = ${token} WHERE id = ${id};`;
  return token;
}
