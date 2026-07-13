import { neon, Pool, type NeonQueryFunction } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

export type Sql = NeonQueryFunction<false, false>;

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

/** Zamienia tagged-template `sql\`...${x}...\`` na sparametryzowane
 * zapytanie ($1, $2, …) — jak w dev-db.ts, potrzebne do wystawienia tej
 * samej sygnatury `Sql` na klientach, które (w przeciwieństwie do neon-http)
 * nie robią tego same. */
function toParamQuery(strings: TemplateStringsArray, values: unknown[]): { text: string; params: unknown[] } {
  let text = "";
  strings.forEach((part, i) => {
    text += part;
    if (i < values.length) text += `$${i + 1}`;
  });
  return { text, params: values };
}

/**
 * Uruchamia `fn` w jednej prawdziwej transakcji SQL (BEGIN/COMMIT/ROLLBACK) —
 * do miejsc, gdzie kilka zapisów musi przejść razem albo wcale (np. akceptacja
 * oferty: projekt + faktura + oznaczenie oferty jako zaakceptowanej —
 * awaria/wyścig w środku nie może zostawić osieroconych rekordów).
 *
 * `getSql()` (neon-http) to bezstanowe zapytania po HTTP — nie wspiera
 * interaktywnych transakcji między wieloma zapytaniami. Tu na czas jednej
 * transakcji łączymy się przez `Pool` (WebSocket, ten sam pakiet
 * `@neondatabase/serverless`, oficjalnie zalecany do transakcji). W dev
 * (PGlite) korzysta z wbudowanej `db.transaction()`. Rzuć błąd w `fn`, żeby
 * wymusić ROLLBACK — inaczej COMMIT po zwróceniu wyniku.
 */
export async function withTransaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  const hasRealDb = Boolean(
    process.env.DATABASE_URL ??
      process.env.POSTGRES_URL ??
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.POSTGRES_URL_NON_POOLING
  );
  if (process.env.NODE_ENV === "development" && !hasRealDb) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { withDevTransaction } = require("./dev-db") as typeof import("./dev-db");
    return withDevTransaction<T>(fn as unknown as Parameters<typeof withDevTransaction<T>>[0]);
  }

  const pool = new Pool({ connectionString: connectionString() });
  try {
    const poolClient = await pool.connect();
    try {
      await poolClient.query("BEGIN");
      const txSql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const { text, params } = toParamQuery(strings, values);
        const res = await poolClient.query(text, params);
        return res.rows;
      }) as unknown as Sql;
      const result = await fn(txSql);
      await poolClient.query("COMMIT");
      return result;
    } catch (err) {
      await poolClient.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      poolClient.release();
    }
  } finally {
    await pool.end();
  }
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

  // Osoba kontaktowa i adres — wcześniej leady nie miały żadnego z tych pól,
  // oba lądowały (jeśli w ogóle) upchane w wolnym tekście notatek. Wzorem
  // adresu klienta (ulica/kod/miasto/kraj, patrz createClientsSchema niżej).
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS osoba_kontaktowa TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ulica TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS kod TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS miasto TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS kraj TEXT NOT NULL DEFAULT '';`;

  // Rozbicie "źródła" na kategorię (stała lista, SOURCE_CATEGORIES w
  // lib/leads.ts) i szczegóły (istniejące pole `zrodlo`, teraz czysty wolny
  // tekst doprecyzowujący kategorię, zamiast mieszanki obu jak wcześniej).
  // Puste dla leadów sprzed tej zmiany — świadomie NIE migrujemy starych
  // wpisów (decyzja właściciela 2026-07-13); UI dla nich pokazuje surowe,
  // nieustrukturyzowane stare `zrodlo`.
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS zrodlo_kategoria TEXT NOT NULL DEFAULT '';`;

  // Moduł 3 — kanały kontaktu (docs/plany-modulow/03-kanaly-kontaktu.md):
  // link LinkedIn (osobne pole, świadomie nie wykrywane z `www`), tekstowy
  // "następny krok" obok next_followup (PO CO jest przypomnienie, nie tylko
  // KIEDY), i `ostatni_kanal` — zdenormalizowana kopia kanału z ostatniego
  // wpisu na osi (patrz .../activity POST), żeby kartom kanban nie trzeba
  // było dociągać całej historii tylko po ikonkę.
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS linkedin_url TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ostatni_kanal TEXT;`;

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
  // kanal: jedna z CONTACT_CHANNELS (lib/contact.ts), null = nieokreślony
  // (wpisy sprzed Modułu 3). kierunek: jedna z CONTACT_DIRECTIONS, null =
  // nieokreślony.
  await sql`ALTER TABLE lead_activity ADD COLUMN IF NOT EXISTS kanal TEXT;`;
  await sql`ALTER TABLE lead_activity ADD COLUMN IF NOT EXISTS kierunek TEXT;`;
  // Wynik połączenia (odebrane/nieodebrane) i czas trwania w sekundach —
  // sensowne tylko dla kanal='telefon', ale trzymane generycznie jak
  // kanal/kierunek. Null = nieokreślony (wpis sprzed tej zmiany albo inny
  // kanał niż telefon).
  await sql`ALTER TABLE lead_activity ADD COLUMN IF NOT EXISTS wynik TEXT;`;
  await sql`ALTER TABLE lead_activity ADD COLUMN IF NOT EXISTS czas_trwania_sek INTEGER;`;
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
  // Adres sprzedawcy rozbity na pola strukturalne (jak u nabywcy) — potrzebne
  // do FA(3)/KSeF (KodKraju + AdresL1) i czytelniejszego wydruku. Stare `adres`
  // zostaje jako fallback. `kraj` domyślnie PL (najczęstszy przypadek).
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS ulica TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS kod TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS miasto TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS kraj TEXT NOT NULL DEFAULT 'PL';`;
  // Domyślna treść "Uwag" — auto-wstawiana przy tworzeniu nowej faktury,
  // patrz komentarz przy CompanySettings.domyslne_uwagi w lib/invoices.ts.
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS domyslne_uwagi TEXT NOT NULL DEFAULT '';`;

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
  // Typ skutku korekty w ewidencji VAT (FA(3) <TypKorekty>): '1' = w dacie
  // ujęcia faktury pierwotnej (błąd na fakturze), '2' = w dacie wystawienia
  // korekty (przyczyna zaistniała później, np. rabat/zwrot), '3' = inna data.
  // Domyślnie '1'. Dotyczy tylko faktur z koryguje_id.
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS typ_korekty TEXT NOT NULL DEFAULT '1';`;
  // Rozliczenie zaliczki — ta faktura (końcowa/"rozliczeniowa", FA(3)
  // RodzajFaktury=ROZ) odejmuje od pełnej wartości zamówienia kwotę wskazanej
  // wcześniej faktury zaliczkowej (P_15 = kwota POZOSTAŁA do zapłaty).
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS rozlicza_zaliczke_id TEXT REFERENCES invoices(id) ON DELETE SET NULL;`;
  // Zamówienie/umowa (FA(3) <Zamowienie>, wymagane strukturalnie tylko przy
  // RodzajFaktury=ZAL) — pełna wartość BRUTTO całego zlecenia, którego ta
  // faktura zaliczkowa dotyczy (większa niż sama zaliczka), + krótki opis
  // (staje się jedynym <ZamowienieWiersz>/P_7Z). Dotyczy tylko faktur
  // zaliczkowych (typ_dokumentu='zaliczkowa'); opcjonalne — bez wypełnienia
  // XML nadal jest poprawny wg XSD (blok Zamowienie ma minOccurs=0), ale
  // walidacja przypomina o uzupełnieniu.
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS zamowienie_wartosc NUMERIC;`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS zamowienie_opis TEXT NOT NULL DEFAULT '';`;
  // Kurs NBP zastosowany do VAT na fakturze w walucie obcej (wymóg ustawy o
  // VAT — kwota VAT musi być dodatkowo wyrażona w PLN wg kursu z dnia
  // poprzedzającego wystawienie). Zapisywany raz, przy wystawieniu.
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS kurs_nbp NUMERIC;`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS kurs_nbp_data DATE;`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS kurs_nbp_tabela TEXT;`;
  // Sposób zapłaty na wydruku — wybieralny w edytorze (przelew/gotówka/
  // karta), domyślnie przelew (jak dotąd, gdy pole było zahardkodowane).
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sposob_platnosci TEXT NOT NULL DEFAULT 'przelew';`;
  // --- KSeF (Faza 2) — fundament pod natywną integrację z Krajowym Systemem
  // e-Faktur. Na tym etapie tylko przechowywanie stanu; żadne z tych pól nie
  // łączy się z siecią (generacja/wysyłka to osobne kroki). Faktura powstaje i
  // żyje bez KSeF — te pola są puste, dopóki właściciel świadomie nie wyśle.
  //   ksef_status  — nie_wyslano / wyslano / przyjeto / odrzucono (patrz lib/ksef.ts)
  //   ksef_tryb    — 'test' | 'prod', ustawiane przy wysyłce (NULL = nigdy nie wysłano)
  //   ksef_numer   — numer KSeF nadany po przyjęciu dokumentu
  //   ksef_upo     — treść UPO (XML) — urzędowe potwierdzenie odbioru
  //   ksef_blad    — czytelny komunikat przy odrzuceniu (które pole i dlaczego)
  //   ksef_wyslano_at — moment wysyłki do systemu
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ksef_status TEXT NOT NULL DEFAULT 'nie_wyslano';`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ksef_tryb TEXT;`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ksef_numer TEXT;`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ksef_upo TEXT;`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ksef_blad TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ksef_wyslano_at TIMESTAMPTZ;`;
  //   ksef_qr — link KOD I (weryfikujący) do kodu QR na wizualizacji faktury,
  //   budowany po przyjęciu: {baza}/invoice/{NIP}/{DD-MM-RRRR}/{hash Base64URL}
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ksef_qr TEXT;`;
  // Tryb wpisywania cen w edytorze (netto/brutto) — patrz komentarz przy
  // Invoice.ceny_brutto w lib/invoices.ts. Wyłącznie UI, baza zawsze netto.
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ceny_brutto BOOLEAN NOT NULL DEFAULT false;`;
  // Ubezpieczenie na poziomie bazy przeciwko wyścigowi przy nadawaniu numeru
  // (dwa równoczesne "Wystaw fakturę" nie mogą dać tej samej faktury dwa
  // razy ten sam numer — drugi UPDATE dostanie unique violation i ponowi
  // próbę z przeliczonym numerem, patrz app/api/invoices/[id]/issue).
  // Częściowy indeks — szkice bez numeru (NULL) mogą być w dowolnej liczbie.
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS invoices_numer_unique_idx ON invoices(numer) WHERE numer IS NOT NULL;`;

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
  // Rabat na pozycji (procentowy, naliczany przed VAT) — dodane po pierwszym
  // wdrożeniu modułu.
  await sql`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS rabat_procent NUMERIC NOT NULL DEFAULT 0;`;

  // Katalog usług/produktów — zapisane pozycje do szybkiego wstawiania na
  // fakturę (nazwa + cena + VAT + jednostka), żeby nie przepisywać ich za
  // każdym razem. Niezależny od faktur, jednoosobowy (bez właściciela/ról).
  await sql`
    CREATE TABLE IF NOT EXISTS service_catalog (
      id TEXT PRIMARY KEY,
      nazwa TEXT NOT NULL DEFAULT '',
      cena_netto NUMERIC NOT NULL DEFAULT 0,
      vat_stawka TEXT NOT NULL DEFAULT '23',
      jednostka TEXT NOT NULL DEFAULT 'szt.',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
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
  // E-mail nabywcy i token publicznego podglądu — jak w invoices, do wysyłki
  // oferty mailem z linkiem bez logowania.
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS klient_email TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS share_token TEXT;`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS offers_share_token_idx ON offers(share_token);`;
  // E-podpis akceptacji (Faza I) — dowód, że KLIENT (nie właściciel z
  // panelu) samodzielnie zaakceptował ofertę przez publiczny link.
  // accepted_by_name puste = zaakceptowano ręcznie w panelu (dotychczasowy
  // admin flow), wypełnione = klient podpisał się sam przez /oferta/[token].
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS accepted_by_name TEXT;`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS accepted_ip TEXT;`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS accepted_user_agent TEXT;`;

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

let clientsSchemaReady: Promise<void> | null = null;

/** Moduł Klienci — fundament pod resztę CRM (patrz virtual-company-roadmap w
 * pamięci): Klient to fizyczny/prawny kontrahent, z którym realnie zaczęła
 * się rozmowa (nie każdy Lead nim jest). Leady/Oferty/Faktury/Projekty
 * dostają opcjonalną kolumnę `client_id`, żeby dało się zbudować jedną,
 * chronologiczną historię kontaktu per klient. Świadomie NULLable wszędzie —
 * stare rekordy i szybkie jednorazowe dokumenty bez podpiętego klienta mają
 * dalej działać bez zmian. */
async function createClientsSchema(): Promise<void> {
  // client_id w leads/offers/invoices/projects odwołuje się do clients(id),
  // więc clients musi istnieć najpierw — a offers/invoices/projects muszą
  // istnieć, zanim dodamy im nowe kolumny.
  await ensureLeadsSchema();
  await ensureHubSchema();
  await ensureInvoicesSchema();
  await ensureOffersSchema();

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      nazwa TEXT NOT NULL DEFAULT '',
      nip TEXT NOT NULL DEFAULT '',
      ulica TEXT NOT NULL DEFAULT '',
      kod TEXT NOT NULL DEFAULT '',
      miasto TEXT NOT NULL DEFAULT '',
      kraj TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      telefon TEXT NOT NULL DEFAULT '',
      www TEXT NOT NULL DEFAULT '',
      branza TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Prospekt',
      ostatni_kontakt DATE,
      next_followup DATE,
      notatki TEXT NOT NULL DEFAULT '',
      lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS clients_status_idx ON clients(status);`;

  // Moduł 3 — kanały kontaktu, patrz analogiczny komentarz przy leads wyżej.
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS linkedin_url TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS next_action TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS ostatni_kanal TEXT;`;

  await sql`
    CREATE TABLE IF NOT EXISTS client_activity (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS client_activity_client_id_idx ON client_activity(client_id);`;
  await sql`ALTER TABLE client_activity ADD COLUMN IF NOT EXISTS kanal TEXT;`;
  await sql`ALTER TABLE client_activity ADD COLUMN IF NOT EXISTS kierunek TEXT;`;
  await sql`ALTER TABLE client_activity ADD COLUMN IF NOT EXISTS wynik TEXT;`;
  await sql`ALTER TABLE client_activity ADD COLUMN IF NOT EXISTS czas_trwania_sek INTEGER;`;

  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;`;

  // Zdarzenia systemowe (oferta wysłana, faktura wystawiona, wpłata itd.) —
  // osobno od `client_activity` (ręczne notatki właściciela), bo mają inny
  // cykl życia (zapisywane automatycznie przez routes, nigdy nie edytowane
  // ręcznie). GET /api/clients/:id scala oba źródła + lead_activity leada, z
  // którego klient powstał, w jeden chronologiczny feed — patrz
  // ClientDetailPanel.tsx. `amount` nullable — tylko zdarzenia pieniężne
  // (wpłata, wystawienie faktury) je mają, żeby feed mógł pokazać kwotę.
  await sql`
    CREATE TABLE IF NOT EXISTS client_events (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      text TEXT NOT NULL,
      amount NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS client_events_client_id_idx ON client_events(client_id);`;
}

export async function ensureClientsSchema(): Promise<void> {
  if (!clientsSchemaReady) clientsSchemaReady = createClientsSchema();
  await clientsSchemaReady;
}

/** Zapisz zdarzenie systemowe na osi czasu klienta — cichy no-op, gdy
 * `clientId` jest null (dokument bez podpiętego klienta). Wywoływane z
 * różnych routes (oferty/faktury/wpłaty/projekty) zaraz po akcji, żeby data
 * zdarzenia była prawdziwym momentem jego wystąpienia, nie odgadywana
 * później z `updated_at`. */
export async function logClientEvent(
  sql: Sql,
  clientId: string | null,
  kind: string,
  text: string,
  amount?: number | null
): Promise<void> {
  if (!clientId) return;
  await sql`
    INSERT INTO client_events (id, client_id, kind, text, amount)
    VALUES (${randomUUID()}, ${clientId}, ${kind}, ${text}, ${amount ?? null});
  `;
}

let followupsSchemaReady: Promise<void> | null = null;

/** Harmonogram automatycznego nurture (Moduł 2, luka ⑥) — gdy projekt
 * przechodzi w "Wdrożone", planujemy klientowi dwa przyszłe kontakty (14 i
 * 90 dni, patrz NURTURE_OFFSETS w lib/clients.ts) zamiast liczyć na to, że
 * właściciel sam ustawi next_followup. Osobna tabela zamiast nadpisywania
 * next_followup, bo trzeba trzymać DWA przyszłe terminy naraz bez gubienia
 * drugiego — i nie kolidować z ręcznie ustawionym next_followup (oba źródła
 * sumują się na Pulpicie, patrz app/api/hub/today). `project_id` służy do
 * deduplikacji (nie planuj drugi raz dla tego samego projektu). */
async function createFollowupsSchema(): Promise<void> {
  await ensureClientsSchema();
  await ensureHubSchema();
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS client_followups (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      due_date DATE NOT NULL,
      powod TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      done_at TIMESTAMPTZ
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS client_followups_client_id_idx ON client_followups(client_id);`;
  await sql`CREATE INDEX IF NOT EXISTS client_followups_due_date_idx ON client_followups(due_date);`;
}

export async function ensureFollowupsSchema(): Promise<void> {
  if (!followupsSchemaReady) followupsSchemaReady = createFollowupsSchema();
  await followupsSchemaReady;
}

let costsSchemaReady: Promise<void> | null = null;

/** Moduł Koszty (Faza G) — ewidencja faktur PRZYCHODZĄCYCH od dostawców, w
 * odróżnieniu od `invoices` (wyłącznie WYCHODZĄCE, sprzedażowe). Opcjonalny
 * `project_id` pozwala liczyć prostą rentowność projektu (przychód z
 * faktur projektu − koszty projektu) — patrz GET /api/projects/[id]. Świadomie
 * tylko PLN w v1. */
async function createCostsSchema(): Promise<void> {
  // Koszt może być podpięty do projektu (FK) — upewnij się, że istnieje.
  await ensureHubSchema();

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS costs (
      id TEXT PRIMARY KEY,
      dostawca_nazwa TEXT NOT NULL DEFAULT '',
      dostawca_nip TEXT NOT NULL DEFAULT '',
      kategoria TEXT NOT NULL DEFAULT 'Inne',
      opis TEXT NOT NULL DEFAULT '',
      data_wydatku DATE NOT NULL DEFAULT CURRENT_DATE,
      kwota_netto NUMERIC NOT NULL DEFAULT 0,
      vat_stawka TEXT NOT NULL DEFAULT '23',
      kwota_brutto NUMERIC NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Nieopłacony',
      data_platnosci DATE,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS costs_status_idx ON costs(status);`;
  await sql`CREATE INDEX IF NOT EXISTS costs_project_id_idx ON costs(project_id);`;
  // Skan/PDF faktury od dostawcy (Faza 3 mapy drogowej ERP) — świadomie
  // zapisany WPROST w bazie jako base64 (`zalacznik_dane`), nie w zewnętrznym
  // blob storage: brak nowej usługi/env do skonfigurowania (ten panel go
  // NIGDZIE indziej nie ma), a skan faktury/paragonu to pojedyncze pliki
  // rzędu KB–kilku MB, więc TEXT w Postgresie wystarcza z zapasem. Limit
  // rozmiaru pilnowany w API (patrz app/api/costs/[id]/attachment). Pusty
  // `zalacznik_dane` (NULL) = brak załącznika.
  await sql`ALTER TABLE costs ADD COLUMN IF NOT EXISTS zalacznik_nazwa TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE costs ADD COLUMN IF NOT EXISTS zalacznik_typ TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE costs ADD COLUMN IF NOT EXISTS zalacznik_dane TEXT;`;
  // KSeF przychodzący (Faza 3, część 2): koszt utworzony automatycznie z
  // faktury zakupowej pobranej z KSeF. `ksef_numer` = unikalny numer KSeF
  // faktury (klucz deduplikacji — nie importujemy tej samej faktury dwa razy),
  // `ksef_tryb` = środowisko, z którego pobrano (test/prod). NULL = koszt
  // wprowadzony ręcznie, nie z KSeF.
  await sql`ALTER TABLE costs ADD COLUMN IF NOT EXISTS ksef_numer TEXT;`;
  await sql`ALTER TABLE costs ADD COLUMN IF NOT EXISTS ksef_tryb TEXT;`;
  // Unikalny numer KSeF = dedup importu. Zwykły UNIQUE (nie częściowy): Postgres
  // traktuje NULL-e jako różne, więc koszty wprowadzane ręcznie (ksef_numer =
  // NULL) współistnieją bez ograniczeń, a `ON CONFLICT (ksef_numer)` przy
  // imporcie działa niezawodnie (arbiter to ten indeks).
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS costs_ksef_numer_idx ON costs(ksef_numer);`;
  // Moduł 9 (branżowy standard): metoda płatności (etykieta jak w
  // Ramp/Expensify — nie inicjuje płatności) + numer konta dostawcy (do
  // „Kopiuj dane do przelewu"). NULL/'' = nieustawiona.
  await sql`ALTER TABLE costs ADD COLUMN IF NOT EXISTS metoda_platnosci TEXT;`;
  await sql`ALTER TABLE costs ADD COLUMN IF NOT EXISTS dostawca_konto TEXT NOT NULL DEFAULT '';`;
  // Moduł 9, fundamenty zgodności (2026-07-14): `numer_faktury` — ustawowy
  // element faktury VAT (art. 106e) i osobne pole w rejestrze zakupów
  // JPK_V7 (`NrFaktury`); bez niego księgowa musi otwierać każdy załącznik,
  // żeby dopasować wpis do dokumentu. `data_wplywu` — data OTRZYMANIA
  // faktury, osobna od `data_wydatku` (data wystawienia) — to ona liczy się
  // dla terminu odliczenia VAT, jeśli różni się od daty wystawienia. NULL =
  // nieustawiona (świadomie opcjonalna, nie każdy koszt to wymaga).
  await sql`ALTER TABLE costs ADD COLUMN IF NOT EXISTS numer_faktury TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE costs ADD COLUMN IF NOT EXISTS data_wplywu DATE;`;
  // Moduł 9, ostrzeżenia podatkowe: procent VAT do odliczenia (100% domyślnie;
  // 50% dla samochodów mieszanego użytku, 0% dla reprezentacji — art. 88
  // ustawy o VAT). Miękka podpowiedź w UI, nie automatyczna reguła — właściciel
  // zawsze wybiera sam, panel niczego nie zgaduje.
  await sql`ALTER TABLE costs ADD COLUMN IF NOT EXISTS vat_odliczenie_procent INTEGER NOT NULL DEFAULT 100;`;
  // Moduł 9, dobre praktyki: koszt oznaczony jako potencjalny duplikat już
  // sprawdzonego wpisu (ten sam NIP+kwota+data) — właściciel może to
  // świadomie wyciszyć, żeby miękkie ostrzeżenie nie wracało przy każdym
  // otwarciu tego samego kosztu.
  await sql`ALTER TABLE costs ADD COLUMN IF NOT EXISTS duplikat_potwierdzony BOOLEAN NOT NULL DEFAULT false;`;
}

/** Lazily tworzy tabelę modułu Koszty. */
export async function ensureCostsSchema(): Promise<void> {
  if (!costsSchemaReady) costsSchemaReady = createCostsSchema();
  await costsSchemaReady;
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

export async function ensureOfferShareToken(sql: Sql, id: string, existingToken: string | null): Promise<string> {
  if (existingToken) return existingToken;
  const token = randomUUID().replace(/-/g, "");
  await sql`UPDATE offers SET share_token = ${token} WHERE id = ${id};`;
  return token;
}
