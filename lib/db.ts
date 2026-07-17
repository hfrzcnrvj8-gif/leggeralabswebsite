import { neon, Pool, type NeonQueryFunction } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { inMigration } from "./migration-ctx";
import { MAIL_NUDGE_DAYS, type NudgeThread } from "./mail";

export type Sql = NeonQueryFunction<false, false>;

let client: Sql | null = null;
let schemaReady: Promise<void> | null = null;
let hubSchemaReady: Promise<void> | null = null;

/**
 * ── Bramka migracji (2026-07-15) ─────────────────────────────────────────
 *
 * PROBLEM, który to rozwiązuje. Każdy moduł tworzy swój schemat leniwie, przy
 * pierwszym użyciu (`CREATE TABLE IF NOT EXISTS` / `ALTER ... ADD COLUMN IF
 * NOT EXISTS`). Wzorzec jest wygodny, ale klient `neon()` w trybie HTTP
 * wysyła KAŻDE zapytanie jako osobne żądanie — a łańcuch zależności potrafi
 * mieć 150+ zapytań (poczta ciągnie leady + klientów + faktury, te ciągną
 * oferty i hub). Przy zimnym starcie funkcji na Vercelu to kilka sekund
 * samego czekania na sieć, ZANIM cokolwiek się policzy. Właściciel zgłosił to
 * wprost 2026-07-15: „wszystko wczytuje się bardzo wolno".
 *
 * ROZWIĄZANIE. Zapisujemy w bazie, w jakiej wersji kodu dany schemat został
 * już zastosowany. Wersja = SHA commita z Vercela, czyli zmienia się dokładnie
 * przy każdym wdrożeniu. Pierwsze żądanie po wdrożeniu wykonuje migracje i
 * odhacza je; każde kolejne (także po zimnym starcie) płaci 2 zapytania
 * zamiast 150+.
 *
 * DLACZEGO TO BEZPIECZNE. Migracje i tak są idempotentne — bramka nie zmienia
 * ich treści, tylko pomija ponowne wykonywanie tego, co już zrobiono w TEJ
 * wersji kodu. Nowy commit = nowa wersja = migracje lecą znowu. Gdy padną w
 * połowie, wersja NIE zostaje zapisana, więc następne żądanie spróbuje od
 * nowa. Dwa równoległe zimne starty mogą wykonać migracje naraz — to nadal
 * bezpieczne, bo są idempotentne.
 *
 * W DEV BRAMKA JEST WYŁĄCZONA (brak SHA) — migracje lecą zawsze. To celowe:
 * lokalnie baza to PGlite w tym samym procesie (zapytanie ≈ darmowe), a przy
 * dopisywaniu kolumn chcemy, żeby zmiana schematu działała od razu, bez
 * kombinowania z wersjami.
 */
const SCHEMA_VERSION: string | null =
  process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? null;

let appliedVersions: Promise<Map<string, string>> | null = null;

async function loadAppliedVersions(): Promise<Map<string, string>> {
  const sql = getSql();
  // CAŁOŚĆ w inMigration(): to odczyt maszynerii migracji, nie logika runtime.
  // Bez tego `SELECT` (który nie jest DDL) czekałby w dev na seed, a seeder
  // woła migracje → migracje czekają na wersję → wersja czeka na seed.
  // Zakleszczenie; złapane testem 2026-07-15 (wszystkie /api/* wisiały 60 s).
  // Patrz lib/migration-ctx.ts — dokładnie ta sama pułapka co przy INSERT-ach
  // singletonów.
  return inMigration(async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_state (
        name TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    const rows = (await sql`SELECT name, version FROM schema_state;`) as unknown as { name: string; version: string }[];
    return new Map(rows.map((r) => [r.name, r.version]));
  });
}

/** Czy schemat `name` jest już w bazie w wersji odpowiadającej temu kodowi.
 * `false` w dev (brak SHA) → migracje wykonują się normalnie. */
async function schemaUpToDate(name: string): Promise<boolean> {
  if (!SCHEMA_VERSION) return false;
  if (!appliedVersions) appliedVersions = loadAppliedVersions();
  try {
    return (await appliedVersions).get(name) === SCHEMA_VERSION;
  } catch (e) {
    // Nie udało się odczytać stanu → zachowaj się jak dotąd i wykonaj
    // migracje. Bramka to optymalizacja, nie warunek poprawności.
    console.error("[db] nie udało się odczytać schema_state — wykonuję migracje", e);
    appliedVersions = null;
    return false;
  }
}

/** Odhacz schemat jako zastosowany w tej wersji kodu. W dev nic nie robi. */
async function markSchemaApplied(name: string): Promise<void> {
  if (!SCHEMA_VERSION) return;
  const sql = getSql();
  await inMigration(
    () => sql`
      INSERT INTO schema_state (name, version) VALUES (${name}, ${SCHEMA_VERSION})
      ON CONFLICT (name) DO UPDATE SET version = EXCLUDED.version, applied_at = now();
    `
  );
  const cache = await appliedVersions;
  cache?.set(name, SCHEMA_VERSION);
}

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
  // Bramka: ten schemat jest już w bazie w tej wersji kodu (patrz
  // komentarz przy SCHEMA_VERSION). W dev zawsze false → migracje lecą.
  if (await schemaUpToDate("leads")) return;

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

  await markSchemaApplied("leads");
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
  // Bramka: ten schemat jest już w bazie w tej wersji kodu (patrz
  // komentarz przy SCHEMA_VERSION). W dev zawsze false → migracje lecą.
  if (await schemaUpToDate("hub")) return;

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

  // Zamknięcie projektu i opinia (Moduł 15) — token publicznego formularza
  // oceny (wzorem share_token oferty), trzy wymiary oceny 1-5, komentarz,
  // zgoda na case study/referencję (pełny tekst do zaakceptowania, nie tylko
  // checkbox — decyzja właściciela 2026-07-14) + dowód złożenia zgody
  // (imię, IP, user-agent), tym samym wzorcem co e-podpis oferty/umowy.
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS review_token TEXT;`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS projects_review_token_idx ON projects(review_token);`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ;`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS review_rating_jakosc SMALLINT;`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS review_rating_terminowosc SMALLINT;`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS review_rating_komunikacja SMALLINT;`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS review_comment TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS review_submitted_at TIMESTAMPTZ;`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS review_consent_case_study BOOLEAN NOT NULL DEFAULT false;`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS review_consent_text TEXT;`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS review_consent_name TEXT;`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS review_consent_ip TEXT;`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS review_consent_user_agent TEXT;`;

  // Język projektu (pl/en/de) — dziedziczony z języka oferty przy akceptacji
  // (lib/offerAccept.ts), decyduje o wersji językowej publicznego formularza
  // opinii i szkicu podsumowania (Moduł 15). Wzorem `offers.jezyk`/
  // `invoices.jezyk` (DocLang w lib/documents.ts).
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS jezyk TEXT NOT NULL DEFAULT 'pl';`;

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

  // Checklista onboardingowa (Moduł 14) — co trzeba zebrać od klienta przed
  // startem realizacji (dostępy, materiały, kontakt do decydenta). Domyślne
  // punkty (DEFAULT_ONBOARDING_ITEMS w lib/projects.ts) wsiewane przy
  // tworzeniu projektu (POST /api/projects i acceptOffer), potem dowolnie
  // edytowalne per projekt — miękka podpowiedź, nigdy twarda brama.
  await sql`
    CREATE TABLE IF NOT EXISTS project_onboarding_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      tekst TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT false,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS project_onboarding_items_project_id_idx ON project_onboarding_items(project_id);`;

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
  // Moduł 26 — przypięcie i archiwum. Do tej pory wszystkie notatki były
  // równorzędne (sort zawsze updated_at DESC), a jedynym sposobem zejścia z
  // biurka było skasowanie.
  await sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;`;
  await sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;`;

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

  // Moduł 10 — wydarzenia wielodniowe (np. urlop, wyjazd): NULL = wydarzenie
  // jednodniowe (dotychczasowe zachowanie), wypełnione = zakres [data,
  // data_koniec] włącznie.
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS data_koniec DATE;`;

  // Moduł 10, druga tura — czas trwania (minuty), tylko gdy `godzina`
  // ustawiona; NULL = nieznany/całodniowe. Napędza siatkę godzinową
  // (bloki wysokość=czas trwania) w widokach Dzień/Tydzień.
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS czas_trwania_min INTEGER;`;

  // Moduł 26 — ślad po „Do kalendarza". Tu, a nie przy tabeli `notes`, bo
  // REFERENCES wymaga istniejącej tabeli docelowej, a `events` powstaje wyżej
  // dopiero teraz. ON DELETE SET NULL: skasowanie wydarzenia ma odblokować
  // notatkę (da się zaplanować ponownie), nie zabrać jej ze sobą.
  await sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS event_id TEXT REFERENCES events(id) ON DELETE SET NULL;`;

  await markSchemaApplied("hub");
}

/** Lazily creates projects/notes/events tables (i tabele pomocnicze) na
 * pierwsze użycie — analogicznie do ensureLeadsSchema(). */
export async function ensureHubSchema(): Promise<void> {
  if (!hubSchemaReady) hubSchemaReady = createHubSchema();
  await hubSchemaReady;
}

let invoicesSchemaReady: Promise<void> | null = null;

async function createInvoicesSchema(): Promise<void> {
  // Bramka: ten schemat jest już w bazie w tej wersji kodu (patrz
  // komentarz przy SCHEMA_VERSION). W dev zawsze false → migracje lecą.
  if (await schemaUpToDate("invoices")) return;

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
  // inMigration(): to zapytanie jest częścią migracji, nie runtime'u — w dev
  // nie może czekać na seed (patrz lib/migration-ctx.ts).
  await inMigration(() => sql`INSERT INTO company_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;`);
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
  // Moduł 13 — windykacja (stawka odsetek ustawowych, wpisywana ręcznie —
  // nigdy aktualizowana automatycznie) i rezerwa podatkowa (trzy osobne
  // stawki VAT/PIT/ZUS) — patrz komentarze przy CompanySettings w lib/invoices.ts.
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS stawka_odsetek_ustawowych NUMERIC;`;
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS rezerwa_vat_procent NUMERIC NOT NULL DEFAULT 0;`;
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS rezerwa_pit_procent NUMERIC NOT NULL DEFAULT 0;`;
  await sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS rezerwa_zus_procent NUMERIC NOT NULL DEFAULT 0;`;

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
  // Moduł 13 — eskalacja windykacji: reminder_level pilnuje, żeby ten sam
  // poziom (0 = żaden, 1-3 wg REMINDER_LEVELS w lib/invoices.ts) nie poszedł
  // dwa razy. wezwanie_* to formalne wezwanie do zapłaty (poziom 3) — osobny
  // token publiczny, bo to inny dokument niż sama faktura (patrz
  // app/[lang]/wezwanie/[token]).
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminder_level INTEGER NOT NULL DEFAULT 0;`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS wezwanie_wystawiono_at TIMESTAMPTZ;`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS wezwanie_share_token TEXT;`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS invoices_wezwanie_share_token_idx ON invoices(wezwanie_share_token);`;
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

  // Moduł 13 — historia wysłanych przypomnień/wezwań (osobno od
  // last_reminder_at, który dotąd był jedynym, nadpisywanym śladem) — żeby
  // w edytorze faktury było widać ILE poszło i na jakim poziomie eskalacji.
  await sql`
    CREATE TABLE IF NOT EXISTS invoice_reminders (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      level INTEGER NOT NULL,
      kind TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS invoice_reminders_invoice_id_idx ON invoice_reminders(invoice_id);`;

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

  await markSchemaApplied("invoices");
}

/** Lazily tworzy tabele modułu Faktur (ustawienia firmy, faktury, pozycje). */
export async function ensureInvoicesSchema(): Promise<void> {
  if (!invoicesSchemaReady) invoicesSchemaReady = createInvoicesSchema();
  await invoicesSchemaReady;
}

let offersSchemaReady: Promise<void> | null = null;

async function createOffersSchema(): Promise<void> {
  // Bramka: ten schemat jest już w bazie w tej wersji kodu (patrz
  // komentarz przy SCHEMA_VERSION). W dev zawsze false → migracje lecą.
  if (await schemaUpToDate("offers")) return;

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

  await markSchemaApplied("offers");
}

/** Lazily tworzy tabele modułu Ofert (oferty, pozycje). */
export async function ensureOffersSchema(): Promise<void> {
  if (!offersSchemaReady) offersSchemaReady = createOffersSchema();
  await offersSchemaReady;
}

let offerTemplatesSchemaReady: Promise<void> | null = null;

/** Moduł 20 (szablony ofert) — pozycje jako JSONB "odbitka" (jak
 * recurring_invoices.pozycje), bo tylko kopiowane do nowej oferty przy
 * "wstaw z szablonu", bez potrzeby relacyjnej integralności. Przy pierwszym
 * uruchomieniu (tabela jeszcze nie istnieje) zasiewa 3 przykładowe szablony
 * zaakceptowane przez właściciela (2026-07-15) + jeden pusty wzór — dalej w
 * pełni edytowalne/usuwalne z panelu, bez ponownego zasiewania przy kolejnych
 * cold-startach (to_regclass sprawdza istnienie PRZED CREATE TABLE).
 */
async function createOfferTemplatesSchema(): Promise<void> {
  // Bramka: ten schemat jest już w bazie w tej wersji kodu (patrz
  // komentarz przy SCHEMA_VERSION). W dev zawsze false → migracje lecą.
  if (await schemaUpToDate("offer_templates")) return;

  const sql = getSql();
  const existing = await sql`SELECT to_regclass('public.offer_templates') AS reg;`;
  const isNew = !existing[0]?.reg;

  await sql`
    CREATE TABLE IF NOT EXISTS offer_templates (
      id TEXT PRIMARY KEY,
      nazwa TEXT NOT NULL DEFAULT '',
      opis TEXT NOT NULL DEFAULT '',
      pozycje JSONB NOT NULL DEFAULT '[]',
      uwagi TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  if (isNew) {
    const seed: { id: string; nazwa: string; opis: string; pozycje: unknown[]; uwagi: string }[] = [
      {
        id: "seed-audyt-poc",
        nazwa: "Audyt / PoC AI",
        opis: "Krótki projekt diagnostyczny — sprawdzenie wykonalności przed większym wdrożeniem.",
        pozycje: [
          { nazwa: "Audyt procesów i danych", ilosc: 1, jednostka: "kpl.", cena: 3000 },
          { nazwa: "Prototyp (PoC) wybranego rozwiązania", ilosc: 1, jednostka: "kpl.", cena: 4000 },
          { nazwa: "Raport z rekomendacjami", ilosc: 1, jednostka: "kpl.", cena: 1000 },
        ],
        uwagi:
          "Zakres: analiza obecnych procesów i danych, wskazanie miejsc do automatyzacji, działający prototyp jednego wybranego rozwiązania, raport z rekomendacją dalszych kroków. Czas realizacji: ok. 2 tygodnie od akceptacji.",
      },
      {
        id: "seed-wdrozenie-automatyzacji",
        nazwa: "Wdrożenie automatyzacji",
        opis: "Pełne wdrożenie automatyzacji wybranego procesu — od analizy po szkolenie zespołu.",
        pozycje: [
          { nazwa: "Analiza i projekt rozwiązania", ilosc: 1, jednostka: "kpl.", cena: 3000 },
          { nazwa: "Wdrożenie automatyzacji", ilosc: 1, jednostka: "kpl.", cena: 10000 },
          { nazwa: "Szkolenie zespołu", ilosc: 1, jednostka: "kpl.", cena: 1500 },
          { nazwa: "Wsparcie powdrożeniowe (30 dni)", ilosc: 1, jednostka: "kpl.", cena: 1500 },
        ],
        uwagi:
          "Zakres: analiza procesu, wdrożenie automatyzacji w wybranym narzędziu, szkolenie zespołu z obsługi, 30 dni wsparcia powdrożeniowego. Płatność: 50% zaliczki, 50% po wdrożeniu.",
      },
      {
        id: "seed-abonament-opieka",
        nazwa: "Abonament / opieka miesięczna",
        opis: "Stałe wsparcie i drobne usprawnienia w modelu miesięcznym.",
        pozycje: [{ nazwa: "Opieka i monitoring — abonament miesięczny", ilosc: 1, jednostka: "m-c", cena: 1500 }],
        uwagi:
          "Zakres: monitoring działania wdrożonych automatyzacji, drobne poprawki i usprawnienia, konsultacje do 2h/miesiąc. Rozliczenie miesięczne, umowa na czas nieokreślony z 30-dniowym okresem wypowiedzenia.",
      },
      {
        id: "seed-pusty-wzor",
        nazwa: "Nowy szablon (pusty wzór)",
        opis: "Punkt startowy do własnego szablonu — uzupełnij pozycje i uwagi.",
        pozycje: [],
        uwagi: "",
      },
    ];
    for (const t of seed) {
      await inMigration(
        () => sql`
          INSERT INTO offer_templates (id, nazwa, opis, pozycje, uwagi)
          VALUES (${t.id}, ${t.nazwa}, ${t.opis}, ${JSON.stringify(t.pozycje)}, ${t.uwagi})
          ON CONFLICT (id) DO NOTHING;
        `
      );
    }
  }

  await markSchemaApplied("offer_templates");
}

/** Lazily tworzy tabelę modułu Szablony ofert. */
export async function ensureOfferTemplatesSchema(): Promise<void> {
  if (!offerTemplatesSchemaReady) offerTemplatesSchemaReady = createOfferTemplatesSchema();
  await offerTemplatesSchemaReady;
}

let contractsSchemaReady: Promise<void> | null = null;

/** Moduł Umowy + NDA (Moduł 11, patrz docs/plany-modulow/11-umowy-i-nda.md)
 * — jedna tabela dla obu typów dokumentu (typ: "umowa" | "nda"), bo dzielą
 * e-podpis, wysyłkę mailem i cały wzorzec strukturalny (patrz komentarz na
 * górze lib/contracts.ts). Umowa odwołuje się opcjonalnie do oferty, z
 * której powstała (zakres/cena kopiowane przy tworzeniu); NDA zwykle tylko
 * do leada (wysyłane przed sprzedażą, zanim powstanie klient/projekt). */
async function createContractsSchema(): Promise<void> {
  // Bramka: ten schemat jest już w bazie w tej wersji kodu (patrz
  // komentarz przy SCHEMA_VERSION). W dev zawsze false → migracje lecą.
  if (await schemaUpToDate("contracts")) return;

  const sql = getSql();
  await ensureLeadsSchema();
  await ensureHubSchema();
  await ensureClientsSchema();
  await ensureOffersSchema();

  await sql`
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      typ TEXT NOT NULL DEFAULT 'umowa',
      status TEXT NOT NULL DEFAULT 'Szkic',
      lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
      client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      offer_id TEXT REFERENCES offers(id) ON DELETE SET NULL,
      klient_nazwa TEXT NOT NULL DEFAULT '',
      klient_nip TEXT NOT NULL DEFAULT '',
      klient_ulica TEXT NOT NULL DEFAULT '',
      klient_kod TEXT NOT NULL DEFAULT '',
      klient_miasto TEXT NOT NULL DEFAULT '',
      klient_kraj TEXT NOT NULL DEFAULT '',
      klient_email TEXT NOT NULL DEFAULT '',
      zakres_prac TEXT NOT NULL DEFAULT '',
      cena NUMERIC NOT NULL DEFAULT 0,
      waluta TEXT NOT NULL DEFAULT 'PLN',
      termin_realizacji DATE,
      uwagi TEXT NOT NULL DEFAULT '',
      share_token TEXT,
      accepted_at TIMESTAMPTZ,
      accepted_by_name TEXT,
      accepted_ip TEXT,
      accepted_user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS contracts_status_idx ON contracts(status);`;
  await sql`CREATE INDEX IF NOT EXISTS contracts_typ_idx ON contracts(typ);`;
  await sql`CREATE INDEX IF NOT EXISTS contracts_project_id_idx ON contracts(project_id);`;
  await sql`CREATE INDEX IF NOT EXISTS contracts_lead_id_idx ON contracts(lead_id);`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS contracts_share_token_idx ON contracts(share_token);`;
  // Język wydruku (pl/en/de) — dla Umów dziedziczony z języka oferty przy
  // generowaniu (app/api/contracts), dla NDA zawsze 'pl'. Dotyczy tylko
  // "chrome" wydruku — treść klauzul zostaje świadomie tylko po polsku,
  // patrz komentarz na górze lib/contracts.ts.
  await sql`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS jezyk TEXT NOT NULL DEFAULT 'pl';`;

  await markSchemaApplied("contracts");
}

/** Lazily tworzy tabele modułu Umowy + NDA. */
export async function ensureContractsSchema(): Promise<void> {
  if (!contractsSchemaReady) contractsSchemaReady = createContractsSchema();
  await contractsSchemaReady;
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
  // Bramka: ten schemat jest już w bazie w tej wersji kodu (patrz
  // komentarz przy SCHEMA_VERSION). W dev zawsze false → migracje lecą.
  if (await schemaUpToDate("clients")) return;

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
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;`;

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

  // Moduł 12 (fundament linkowania) — id rekordu, do którego zdarzenie się
  // odnosi (oferta/faktura/projekt/umowa), żeby oś czasu klienta mogła
  // linkować wprost do niego. Typ tego rekordu (a więc i URL) wynika z
  // `kind` — patrz CLIENT_EVENT_TARGET w lib/clients.ts — więc nie
  // potrzebujemy osobnej kolumny "related_type".
  await sql`ALTER TABLE client_events ADD COLUMN IF NOT EXISTS related_id TEXT;`;

  // Moduł 12 — pola gubione dziś przy konwersji Lead→Klient (osoba
  // kontaktowa, LinkedIn już ma kolumnę wyżej, źródło leada) — patrz
  // app/api/leads/[id]/promote i app/api/offers/route.ts POST.
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS osoba_kontaktowa TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS zrodlo TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS zrodlo_kategoria TEXT NOT NULL DEFAULT '';`;

  await markSchemaApplied("clients");
}

export async function ensureClientsSchema(): Promise<void> {
  if (!clientsSchemaReady) clientsSchemaReady = createClientsSchema();
  await clientsSchemaReady;
}

/** Zapisz zdarzenie systemowe na osi czasu klienta — cichy no-op, gdy
 * `clientId` jest null (dokument bez podpiętego klienta). Wywoływane z
 * różnych routes (oferty/faktury/wpłaty/projekty) zaraz po akcji, żeby data
 * zdarzenia była prawdziwym momentem jego wystąpienia, nie odgadywana
 * później z `updated_at`. `relatedId` (Moduł 12) to id oferty/faktury/
 * projektu/umowy, do którego zdarzenie się odnosi — pozwala osi czasu
 * linkować wprost do rekordu (patrz CLIENT_EVENT_TARGET w lib/clients.ts). */
export async function logClientEvent(
  sql: Sql,
  clientId: string | null,
  kind: string,
  text: string,
  amount?: number | null,
  relatedId?: string | null
): Promise<void> {
  if (!clientId) return;
  await sql`
    INSERT INTO client_events (id, client_id, kind, text, amount, related_id)
    VALUES (${randomUUID()}, ${clientId}, ${kind}, ${text}, ${amount ?? null}, ${relatedId ?? null});
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
  // Bramka: ten schemat jest już w bazie w tej wersji kodu (patrz
  // komentarz przy SCHEMA_VERSION). W dev zawsze false → migracje lecą.
  if (await schemaUpToDate("followups")) return;

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

  await markSchemaApplied("followups");
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
  // Bramka: ten schemat jest już w bazie w tej wersji kodu (patrz
  // komentarz przy SCHEMA_VERSION). W dev zawsze false → migracje lecą.
  if (await schemaUpToDate("costs")) return;

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

  // Moduł 9, koszty cykliczne (2026-07-14) — wzorem `recurring_invoices`
  // (lib/recurring.ts): szablon, z którego dzienny raport (ten sam co
  // faktury cykliczne, app/api/leads/notify) generuje kolejny koszt-SZKIC,
  // gdy nadejdzie `next_run`. Właściciel i tak musi ręcznie sprawdzić i
  // oznaczyć jako opłacony — to tylko oszczędza przepisywanie tych samych
  // danych co miesiąc dla abonamentów/subskrypcji.
  await sql`
    CREATE TABLE IF NOT EXISTS recurring_costs (
      id TEXT PRIMARY KEY,
      nazwa TEXT NOT NULL DEFAULT '',
      dostawca_nazwa TEXT NOT NULL DEFAULT '',
      dostawca_nip TEXT NOT NULL DEFAULT '',
      dostawca_konto TEXT NOT NULL DEFAULT '',
      kategoria TEXT NOT NULL DEFAULT 'Inne',
      opis TEXT NOT NULL DEFAULT '',
      kwota_netto NUMERIC NOT NULL DEFAULT 0,
      vat_stawka TEXT NOT NULL DEFAULT '23',
      metoda_platnosci TEXT,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      cykl TEXT NOT NULL DEFAULT 'miesiecznie',
      next_run DATE NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS recurring_costs_active_idx ON recurring_costs(active, next_run);`;

  await markSchemaApplied("costs");
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

/** Token publicznego podglądu wezwania do zapłaty (Moduł 13) — osobny od
 * `share_token` faktury, bo to inny dokument (patrz app/[lang]/wezwanie/[token]). */
export async function ensureInvoiceWezwanieShareToken(sql: Sql, id: string, existingToken: string | null): Promise<string> {
  if (existingToken) return existingToken;
  const token = randomUUID().replace(/-/g, "");
  await sql`UPDATE invoices SET wezwanie_share_token = ${token} WHERE id = ${id};`;
  return token;
}

export async function ensureOfferShareToken(sql: Sql, id: string, existingToken: string | null): Promise<string> {
  if (existingToken) return existingToken;
  const token = randomUUID().replace(/-/g, "");
  await sql`UPDATE offers SET share_token = ${token} WHERE id = ${id};`;
  return token;
}

export async function ensureContractShareToken(sql: Sql, id: string, existingToken: string | null): Promise<string> {
  if (existingToken) return existingToken;
  const token = randomUUID().replace(/-/g, "");
  await sql`UPDATE contracts SET share_token = ${token} WHERE id = ${id};`;
  return token;
}

/** Token publicznego formularza opinii (Moduł 15) — wzorem ensureOfferShareToken. */
export async function ensureProjectReviewToken(sql: Sql, id: string, existingToken: string | null): Promise<string> {
  if (existingToken) return existingToken;
  const token = randomUUID().replace(/-/g, "");
  await sql`UPDATE projects SET review_token = ${token} WHERE id = ${id};`;
  return token;
}

let timeSchemaReady: Promise<void> | null = null;

/** Moduł 19 (śledzenie czasu pracy): jeden wpis = albo ręcznie wpisana liczba
 * minut, albo sesja stopera. `task_id` opcjonalny (czas można zalogować
 * ogólnie na projekt, bez wybierania zadania) — `ON DELETE SET NULL`, żeby
 * usunięcie zadania nie kasowało historii czasu. `ended_at IS NULL` = stoper
 * aktualnie działa; panel jest jednoosobowy, więc w danym momencie może być
 * aktywny co najwyżej jeden taki wiersz (pilnowane w API, nie w bazie). */
async function createTimeSchema(): Promise<void> {
  // Bramka: ten schemat jest już w bazie w tej wersji kodu (patrz
  // komentarz przy SCHEMA_VERSION). W dev zawsze false → migracje lecą.
  if (await schemaUpToDate("time")) return;

  await ensureHubSchema();

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      task_id TEXT REFERENCES project_tasks(id) ON DELETE SET NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
      started_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ,
      minutes NUMERIC NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  // `minutes` zaczynał jako INTEGER (zaokrąglone w górę do pełnej minuty) —
  // zmienione na NUMERIC, żeby krótkie sesje stopera (poniżej minuty)
  // zapisywały się z realną długością zamiast sztywnego "1 min". Bezpieczne
  // do wielokrotnego uruchomienia: rzutowanie NUMERIC→NUMERIC to no-op.
  await sql`ALTER TABLE time_entries ALTER COLUMN minutes TYPE NUMERIC USING minutes::numeric;`;
  await sql`CREATE INDEX IF NOT EXISTS time_entries_project_id_idx ON time_entries(project_id);`;
  await sql`CREATE INDEX IF NOT EXISTS time_entries_task_id_idx ON time_entries(task_id);`;
  // Szybkie wyszukanie aktywnego stopera (globalnie, bez filtra po projekcie).
  await sql`CREATE INDEX IF NOT EXISTS time_entries_running_idx ON time_entries(ended_at) WHERE ended_at IS NULL;`;

  await markSchemaApplied("time");
}

/** Lazily tworzy tabelę modułu Śledzenie czasu. */
export async function ensureTimeSchema(): Promise<void> {
  if (!timeSchemaReady) timeSchemaReady = createTimeSchema();
  await timeSchemaReady;
}

let mailSchemaReady: Promise<void> | null = null;

/** Moduł 4 (poczta IMAP/SMTP, docs/plany-modulow/04-skrzynka-mailowa.md).
 *
 * `mail_messages` = robocza kopia korespondencji ze skrzynki az.pl; oryginały
 * zostają na serwerze pocztowym (panel niczego tam nie kasuje). Dlatego
 * retencja (24 mies., decyzja właściciela 2026-07-15) może bezpiecznie
 * czyścić stare wiersze — patrz MAIL_RETENTION_MONTHS w lib/mail.ts.
 *
 * `message_id UNIQUE` to sedno dedupu: podwójny sync (otwarcie widoku +
 * cron o 6:00) nie zdublikuje wiadomości, bo INSERT ... ON CONFLICT DO
 * NOTHING po prostu ją pominie. Dlatego UID-y są tylko optymalizacją
 * (skąd zacząć czytać), a nie gwarancją poprawności.
 *
 * client_id/lead_id/invoice_id nullable i wszystkie naraz mogą być NULL —
 * to właśnie kolejka "Nieprzypisane" (mail z nieznanego adresu). ON DELETE
 * SET NULL, żeby usunięcie klienta nie kasowało korespondencji. */
async function createMailSchema(): Promise<void> {
  // Bramka: ten schemat jest już w bazie w tej wersji kodu (patrz
  // komentarz przy SCHEMA_VERSION). W dev zawsze false → migracje lecą.
  if (await schemaUpToDate("mail")) return;

  // Poczta dopina się do klientów, leadów i faktur — ich tabele muszą
  // istnieć, zanim założymy klucze obce.
  await ensureLeadsSchema();
  await ensureClientsSchema();
  await ensureInvoicesSchema();

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS mail_messages (
      id TEXT PRIMARY KEY,
      uid INTEGER,
      kierunek TEXT NOT NULL DEFAULT 'in',
      client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
      lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
      invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
      from_addr TEXT NOT NULL DEFAULT '',
      from_name TEXT NOT NULL DEFAULT '',
      to_addr TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      body_text TEXT NOT NULL DEFAULT '',
      body_html TEXT NOT NULL DEFAULT '',
      message_id TEXT NOT NULL UNIQUE,
      in_reply_to TEXT,
      refs TEXT,
      status TEXT NOT NULL DEFAULT 'nowy',
      received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      handled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  // Kategoria (Moduł 4, druga tura 2026-07-15): reklama/rachunek/urzedowe/
  // oferta/inne — wyliczana deterministycznie przy zapisie przez
  // classifyMail() (lib/mail.ts), bez AI.
  //
  // ŚWIADOMIE nullable, bez DEFAULT: NULL znaczy "jeszcze nieskategoryzowana"
  // i tym różni się od 'inne' ("sprawdzona, zwykła rozmowa"). Wiersze
  // pobrane przed tą zmianą dostają NULL, dzięki czemu backfillCategories()
  // (lib/mailSync.ts) potrafi je odróżnić i przeliczyć przy najbliższym
  // syncu — bez tego maile już pobrane zostałyby z błędnym statusem na
  // zawsze, bo dedup po message_id nie pozwala ich pobrać ponownie.
  await sql`ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS kategoria TEXT;`;

  // Sygnały ze standardowych nagłówków masówki (List-Unsubscribe,
  // Precedence, Auto-Submitted) — patrz isNoiseMail() w lib/mail.ts.
  // Zapisujemy je, bo bez nich NIE DA SIĘ poprawnie przeklasyfikować już
  // pobranej wiadomości: sam adres to za słaby sygnał (Calendly czy n8n nie
  // mają "noreply" w adresie, a są masówką). Właściciel zgłosił to
  // 2026-07-15 — maile Calendly lądowały w "Zapytaniach".
  // NULL = nie wiemy (wiersz sprzed tej zmiany); false = sprawdzone, nie ma.
  await sql`ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS list_unsubscribe BOOLEAN;`;
  await sql`ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS precedence TEXT;`;
  await sql`ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS auto_submitted TEXT;`;

  // DW (Cc) oryginalnej wiadomości — Etap 1 Modułu 4b (2026-07-15), potrzebne
  // do "Odpowiedz wszystkim". Ten sam wzorzec co `kategoria`: nullable BEZ
  // DEFAULT, żeby NULL ("jeszcze nie sprawdzone") różniło się od ""
  // ("sprawdzone, bez DW") — backfillCc() (lib/mailSync.ts) dociąga braki po
  // UID-zie, dedup po message_id nie pozwala pobrać starych wiadomości
  // ponownie w całości.
  await sql`ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS cc_addr TEXT;`;
  await sql`CREATE INDEX IF NOT EXISTS mail_messages_kategoria_idx ON mail_messages(kategoria);`;
  await sql`CREATE INDEX IF NOT EXISTS mail_messages_client_id_idx ON mail_messages(client_id);`;
  await sql`CREATE INDEX IF NOT EXISTS mail_messages_lead_id_idx ON mail_messages(lead_id);`;
  await sql`CREATE INDEX IF NOT EXISTS mail_messages_status_idx ON mail_messages(status);`;
  await sql`CREATE INDEX IF NOT EXISTS mail_messages_received_at_idx ON mail_messages(received_at DESC);`;
  // Kolejka "Nieprzypisane" — mail bez klienta i bez leada. Indeks częściowy,
  // bo pytamy o to na Pulpicie i w zakładce Poczta przy każdym otwarciu.
  await sql`
    CREATE INDEX IF NOT EXISTS mail_messages_unassigned_idx
      ON mail_messages(received_at DESC)
      WHERE client_id IS NULL AND lead_id IS NULL;
  `;

  // Stan skrzynki (od którego UID-a czytać dalej). ŚWIADOMIE osobna
  // 1-wierszowa tabela zamiast kolumny w `company_settings`: tamta należy do
  // schematu faktur ("dane sprzedawcy") i ciągnęłaby zależność poczty od
  // ensureInvoicesSchema() bez powodu merytorycznego.
  //
  // `uid_validity` jest tu nie dla ozdoby: serwer IMAP może przenumerować
  // skrzynkę (np. przy migracji/odtworzeniu z backupu) i wtedy stare UID-y
  // wskazują zupełnie inne wiadomości. Gdy UIDVALIDITY się zmieni,
  // resetujemy last_seen_uid i czytamy od nowa — dedup po message_id
  // sprawia, że to bezpieczne, a nie skutkuje lawiną duplikatów.
  await sql`
    CREATE TABLE IF NOT EXISTS mail_state (
      id TEXT PRIMARY KEY DEFAULT 'default',
      last_seen_uid INTEGER NOT NULL DEFAULT 0,
      uid_validity BIGINT,
      last_sync_at TIMESTAMPTZ,
      last_error TEXT
    );
  `;
  await inMigration(() => sql`INSERT INTO mail_state (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;`);

  // Moduł 4 — link z wpisu na osi kontaktu wprost do pełnej treści maila.
  // `client_events.related_id` (Moduł 12) rozwiązuje ten sam problem dla
  // zdarzeń systemowych, ale mail ląduje w `client_activity` (kanał e-mail,
  // jak telefon z Modułu 3 — patrz app/api/telefonia/webhook), a tamta
  // tabela nie ma related_id. Osobna, jawnie nazwana kolumna jest tu
  // czytelniejsza niż generyczne related_id: wiadomo bez zgadywania, na co
  // wskazuje. ON DELETE SET NULL — wyczyszczenie maila przez retencję
  // zostawia wpis na osi (traci tylko link do treści).
  await sql`ALTER TABLE client_activity ADD COLUMN IF NOT EXISTS mail_message_id TEXT REFERENCES mail_messages(id) ON DELETE SET NULL;`;
  await sql`ALTER TABLE lead_activity ADD COLUMN IF NOT EXISTS mail_message_id TEXT REFERENCES mail_messages(id) ON DELETE SET NULL;`;

  // Etap 2 Modułu 4b (2026-07-16) — REALNY folder na serwerze IMAP
  // (Odebrane/Wysłane/Kosz/Archiwum), niezależny od `kierunek` (in/out).
  // Domyślnie 'inbox', bo dotąd panel czytał wyłącznie INBOX — patrz
  // ensureMailFoldersSchema() dla kursorów per-folder.
  await sql`ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS folder TEXT NOT NULL DEFAULT 'inbox';`;
  await sql`CREATE INDEX IF NOT EXISTS mail_messages_folder_idx ON mail_messages(folder);`;
  await sql`CREATE INDEX IF NOT EXISTS mail_messages_folder_received_idx ON mail_messages(folder, received_at DESC);`;
  // Maile wysłane z panelu (kierunek='out') fizycznie lądują w Sent
  // (appendToSent, lib/mailbox.ts) — bez tego backfillu "Wysłane" byłoby
  // puste, dopóki discoverMailFolders() nie odkryje tego folderu (a wtedy i
  // tak czyta go świadomie bez historii, patrz ensureMailFoldersSchema()).
  // Idempotentne: po pierwszym przebiegu WHERE folder='inbox' nie dopasowuje
  // już nic więcej.
  await inMigration(() => sql`UPDATE mail_messages SET folder = 'sent' WHERE kierunek = 'out' AND folder = 'inbox';`);

  // Moduł 4e (2026-07-16) — wartość linku wypisu z listy dystrybucyjnej, nie
  // sama obecność nagłówka (tę już trzyma `list_unsubscribe` wyżej). Nullable
  // bez DEFAULT, ten sam wzorzec co `cc_addr`/`kategoria`: NULL = jeszcze nie
  // sprawdzone, '' = sprawdzone ale bez sensownego linku, string = realny URL.
  await sql`ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS list_unsubscribe_url TEXT;`;

  // Moduł 4e, runda 2 (2026-07-16) — flaga "ważne", świadomie TYLKO lokalna
  // (decyzja właściciela): nie synchronizuje się z `\Flagged` po IMAP, to
  // czysto nasz znacznik w panelu. Pełna dwustronna synchronizacja flag z
  // Outlookiem zostaje odłożona jak w `docs/plany-modulow/04b-poczta-pelny-klient.md`
  // (Etap 2, "Flagi") — większy zakres, niezweryfikowane wsparcie własnych
  // keywordów na az.pl/Dovecot.
  await sql`ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT false;`;

  // Moduł 4, Etap 3 (2026-07-16) — wątkowanie (threading). Wątek BEZ
  // dopasowania jest sam swoim korzeniem: `thread_id = message_id` własnej
  // wiadomości, zero syntetycznych UUID-ów. Dopasowanie liczy
  // resolveThreadId() (lib/mailSync.ts) — References/In-Reply-To najpierw,
  // potem temat+uczestnicy+okno 30 dni jako fallback; historyczne wiersze
  // dociąga backfillThreadIds(), wołane z syncMailbox() jak
  // backfillCategories()/backfillCc(). ⚠️ W PRZECIWIEŃSTWIE do tamtych, ten
  // backfill NIE jest w pełni samo-naprawiający się: wiersz raz
  // samo-zakorzeniony (bo jego prawdziwy poprzednik nie był jeszcze
  // zsynchronizowany) zostaje osobnym wątkiem na zawsze — backfill patrzy
  // tylko na `WHERE thread_id IS NULL`. Akceptowalne przy chronologicznym
  // napływie poczty jednej skrzynki.
  await sql`ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS thread_id TEXT;`;
  await sql`CREATE INDEX IF NOT EXISTS mail_messages_thread_id_idx ON mail_messages(thread_id);`;

  // Moduł 4, Etap 3 (2026-07-16) — screener nowych nadawców. Wpis 'pending'
  // powstaje TYLKO przy pierwszym zsynchronizowanym mailu kategorii 'oferta'
  // (saveIncoming() w lib/mailSync.ts); zatwierdzenie/blokada to zapis JEDNEGO
  // wiersza tutaj — bramkowanie widoczności w listach idzie przez LEFT JOIN
  // przy odczycie (app/api/mail/route.ts), NIE przez flagę na wiadomości, więc
  // decyzja działa od razu na całą historię tego nadawcy bez backfillu.
  await sql`
    CREATE TABLE IF NOT EXISTS mail_senders (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      decided_at TIMESTAMPTZ
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS mail_senders_status_idx ON mail_senders(status);`;

  // Moduł 4, Etap 3 (2026-07-16) — Snooze/Odłóż. Kolumna WPROST na
  // wiadomości (nie osobna tabela jak mail_senders) — snooze jest
  // własnością POJEDYNCZEJ wiadomości, nie nadawcy. NULL = nie odłożona.
  // "Wraca sam" NIE wymaga crona: widoczność liczy się w locie przy KAŻDYM
  // odczycie (snooze_until IS NULL OR snooze_until <= now()) po stronie
  // przeglądarki (MailDashboard.tsx, filtered) — ten sam duch co bramka
  // screenera, tylko bez SQL-a, bo lista i tak ma LIMIT 200/folder.
  // Świadomie BEZ własnego indeksu, ten sam wzorzec co `flagged` wyżej.
  await sql`ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS snooze_until TIMESTAMPTZ;`;

  // Etap 1 Modułu 4b, druga runda (2026-07-16) — UDW (Bcc) wychodzącej
  // wiadomości, zapisane dla WŁASNEGO wglądu właściciela w panelu. Adres
  // NIGDY nie trafia do nagłówków samego maila (patrz sendMail() w
  // lib/mailbox.ts — Bcc idzie tylko do koperty SMTP) — to jedynie kopia w
  // naszej bazie, ten sam wzorzec co cc_addr wyżej.
  await sql`ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS bcc_addr TEXT;`;

  // Moduł 4f (2026-07-16) — Nudge/Follow-up ("wysłałeś, cisza od N dni").
  // Kolumna WPROST na wiadomości wychodzącej — pozwala ręcznie wyciszyć
  // pojedynczy przypominacz ("wiem że nie odpowie, przestań przypominać"),
  // wzorem snooze_until wyżej. NULL = nie wyciszony. W PRZECIWIEŃSTWIE do
  // snooze_until MA własny indeks częściowy: getNudgeThreads() (niżej)
  // odpytuje go przy KAŻDYM odczycie zakładki „Bez odpowiedzi" i dziennego
  // digestu, a warunek WHERE kierunek='out' AND folder='sent' zawęża go do
  // ułamka wszystkich wiadomości — snooze filtruje cały folder='inbox' z
  // naturalnym limitem 200, tu takiego ogranicznika nie ma.
  await sql`ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS nudge_dismissed_at TIMESTAMPTZ;`;
  await sql`
    CREATE INDEX IF NOT EXISTS mail_messages_nudge_idx
      ON mail_messages(thread_id, received_at DESC)
      WHERE kierunek = 'out' AND folder = 'sent';
  `;

  // Jednorazowy backfill (2026-07-16) — naprawa luki w saveOutgoingFromServer()/
  // saveArchivedOrTrashed() (lib/mailSync.ts): ON CONFLICT aktualizował TYLKO
  // `folder`, więc self-mail przeniesiony ręcznie z Odebranych do Archiwum/
  // Kosza, a potem odkryty w Wysłane, kończył jako folder='sent' z
  // kierunek='in'/status='nowy' nienaruszonymi — wiadomość w zakładce
  // "Wysłane" z ikoną koperty i tagiem "Do odpowiedzi" (zgłoszone przez
  // właściciela). Sam kod od teraz tego nie powtórzy, ale JUŻ zepsute wiersze
  // same się nie naprawią (guard `folder <> EXCLUDED.folder` w ON CONFLICT nie
  // odpali się drugi raz, skoro folder już jest 'sent') — stąd to jednorazowe
  // dogonienie istniejących danych. Bezpieczne uruchamiać wielokrotnie: po
  // pierwszym przebiegu warunek WHERE nie znajduje już żadnych wierszy.
  await inMigration(
    () => sql`UPDATE mail_messages SET kierunek = 'out', status = 'obsłużony' WHERE folder = 'sent' AND kierunek = 'in';`
  );

  await markSchemaApplied("mail");
}

/** Lazily tworzy tabele modułu Poczta. */
export async function ensureMailSchema(): Promise<void> {
  if (!mailSchemaReady) mailSchemaReady = createMailSchema();
  await mailSchemaReady;
}

/** Moduł 4f (2026-07-16) — wątki bez odpowiedzi: wysłałeś OSTATNIĄ wiadomość
 * w wątku (kierunek='out', folder='sent') i minęło `days` dni bez ŻADNEJ
 * odpowiedzi (kierunek='in') w tym samym wątku — niezależnie od folderu,
 * odpowiedź może leżeć w Odebranych/Archiwum/Koszu. Dlatego to NIE jest
 * filtr na już pobranej liście jednego folderu (jak VIP/Snooze) — wymaga
 * osobnego zapytania w poprzek dwóch folderów, patrz
 * docs/plany-modulow/04f-poczta-nudge.md.
 *
 * `DISTINCT ON (thread_id)` wybiera reprezentanta wątku — NAJNOWSZĄ
 * wychodzącą wiadomość — więc próg dni i wyciszenie (nudge_dismissed_at)
 * liczą się od NIEJ, nie od pierwszej wiadomości w wątku (jeśli dosłałeś
 * przypomnienie, licznik startuje od przypomnienia). Współdzielone przez
 * zakładkę „Bez odpowiedzi" (app/api/mail/nudge/route.ts) i dzienny digest
 * (app/api/leads/notify/route.ts) — jedna definicja w obu miejscach, żeby
 * nigdy się nie rozjechały. */
export async function getNudgeThreads(sql: Sql, days: number = MAIL_NUDGE_DAYS): Promise<NudgeThread[]> {
  return (await sql`
    SELECT t.id, t.thread_id, t.to_addr, t.subject, t.received_at, t.client_id, t.lead_id,
           c.nazwa AS client_nazwa, l.firma AS lead_nazwa
    FROM (
      SELECT DISTINCT ON (m.thread_id)
        m.id, m.thread_id, m.to_addr, m.subject, m.received_at, m.client_id, m.lead_id
      FROM mail_messages m
      WHERE m.kierunek = 'out' AND m.folder = 'sent' AND m.thread_id IS NOT NULL
        AND m.nudge_dismissed_at IS NULL
      ORDER BY m.thread_id, m.received_at DESC
    ) t
    LEFT JOIN clients c ON c.id = t.client_id
    LEFT JOIN leads l ON l.id = t.lead_id
    WHERE t.received_at <= now() - make_interval(days => ${days})
      AND NOT EXISTS (
        SELECT 1 FROM mail_messages r WHERE r.thread_id = t.thread_id AND r.kierunek = 'in'
      )
    ORDER BY t.received_at ASC;
  `) as unknown as NudgeThread[];
}

let mailFoldersSchemaReady: Promise<void> | null = null;

/** Etap 2 Modułu 4b (2026-07-16) — kursory PER FOLDER na serwerze IMAP,
 * zamiast jednego globalnego `last_seen_uid` w `mail_state` (który zakładał,
 * że istnieje tylko INBOX). `role` to NASZ własny, stabilny klucz
 * ('inbox'/'sent'/'trash'/'archive') — `imap_path` to realna ścieżka na
 * serwerze, wynik `discoverMailFolders()` (lib/mailbox.ts), bo ta bywa różna
 * zależnie od serwera/locale ("Sent" vs "INBOX.Sent" vs "Wysłane").
 * `special_use` mówi, czy serwer w ogóle zgłosił RFC 6154 (SPECIAL-USE) dla
 * tego folderu, czy trafiliśmy fallbackiem po nazwie — przydatne do
 * diagnostyki na produkcji (patrz vercel logs).
 *
 * Wiersz 'inbox' migrujemy NATYCHMIAST z istniejącego `mail_state`, żeby nie
 * zgubić postępu synchronizacji. Wiersze 'sent'/'trash'/'archive' powstają
 * dopiero przy pierwszym `syncMailbox()` po wdrożeniu (lib/mailSync.ts) — nie
 * znamy ich `imap_path` bez połączenia z serwerem, a kursor dla nich
 * świadomie startuje "od teraz" (bieżący najwyższy UID w danym folderze w
 * chwili odkrycia), NIE od zera — właściciel nie chce, żeby stara, już raz
 * odrzucona/zarchiwizowana korespondencja z Kosza/Archiwum nagle dopisała
 * się na oś kontaktu klienta (decyzja 2026-07-16). */
async function createMailFoldersSchema(): Promise<void> {
  if (await schemaUpToDate("mail_folders")) return;
  await ensureMailSchema();
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS mail_folders (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL UNIQUE,
      imap_path TEXT NOT NULL,
      special_use TEXT,
      uidvalidity BIGINT,
      last_seen_uid INTEGER NOT NULL DEFAULT 0,
      last_sync_at TIMESTAMPTZ,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await inMigration(
    () => sql`
      INSERT INTO mail_folders (id, role, imap_path, uidvalidity, last_seen_uid)
      SELECT ${randomUUID()}, 'inbox', 'INBOX', uid_validity, last_seen_uid
      FROM mail_state WHERE id = 'default'
      ON CONFLICT (role) DO NOTHING;
    `
  );

  await markSchemaApplied("mail_folders");
}

/** Lazily tworzy tabelę kursorów per-folder (Etap 2 Modułu 4b). */
export async function ensureMailFoldersSchema(): Promise<void> {
  if (!mailFoldersSchemaReady) mailFoldersSchemaReady = createMailFoldersSchema();
  await mailFoldersSchemaReady;
}

let mailTemplatesSchemaReady: Promise<void> | null = null;

/** Moduł 4b, Etap 1 — szablony wiadomości (Superhuman Snippets). Ten sam
 * kształt co `offer_templates`: nazwa + gotowa treść do wstawienia, tu
 * dodatkowo `temat` (przydatny głównie przy "Nowa wiadomość" pisanej od
 * zera — Odpowiedź/Przekazanie i tak biorą temat z wątku). Bez seeda —
 * właściciel tworzy własne od zera, nie ma tu gotowego kanonu jak przy
 * ofertach. */
async function createMailTemplatesSchema(): Promise<void> {
  if (await schemaUpToDate("mail_templates")) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS mail_templates (
      id TEXT PRIMARY KEY,
      nazwa TEXT NOT NULL DEFAULT '',
      temat TEXT NOT NULL DEFAULT '',
      tresc TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await markSchemaApplied("mail_templates");
}

/** Lazily tworzy tabelę szablonów wiadomości. */
export async function ensureMailTemplatesSchema(): Promise<void> {
  if (!mailTemplatesSchemaReady) mailTemplatesSchemaReady = createMailTemplatesSchema();
  await mailTemplatesSchemaReady;
}

/* ------------------------------------------------- Moduł 22 — powiązania --- */

let linksSchemaReady: Promise<void> | null = null;

/** Moduł 22 — domknięcie powiązań z CRM tam, gdzie brakowało kolumny.
 *
 * Osobny schemat (a nie dopisek do `clients`/`costs`), bo dotyka tabel z
 * czterech różnych schematów naraz — musi więc poczekać, aż wszystkie
 * powstaną. Bramka `links` pozwala mu przy tym kosztować zero zapytań na
 * zimny start jak reszta (patrz HUB_SETUP.md → „Bramka migracji").
 *
 * Świadomie NIE dokłada tu UI notatnika — to Moduł 26. Kolumny powstają
 * wcześniej, żeby 26 miał na czym stanąć.
 */
async function createLinksSchema(): Promise<void> {
  if (await schemaUpToDate("links")) return;

  // Każdy `REFERENCES` poniżej wymaga istniejącej tabeli docelowej ORAZ
  // źródłowej: clients/leads (cel), notes+events (hub), costs, mail.
  await ensureClientsSchema();
  await ensureCostsSchema();
  await ensureMailSchema();

  const sql = getSql();

  // Koszty — dotąd klient dało się wywnioskować TYLKO pośrednio, przez
  // projekt (costs.project_id). Koszt bez projektu, ale „na rzecz" klienta
  // (np. licencja kupiona pod jedno wdrożenie) nie miał gdzie tego zapisać.
  await sql`ALTER TABLE costs ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;`;
  await sql`ALTER TABLE costs ADD COLUMN IF NOT EXISTS lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL;`;

  // ...i to samo w szablonie kosztu cyklicznego, żeby wygenerowany koszt
  // dziedziczył powiązanie zamiast gubić je co miesiąc.
  await sql`ALTER TABLE recurring_costs ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;`;
  await sql`ALTER TABLE recurring_costs ADD COLUMN IF NOT EXISTS lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL;`;

  // Notatnik był jedynym modułem całkowicie odciętym od CRM — zero kolumn
  // powiązań.
  await sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;`;
  await sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL;`;
  await sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;`;

  // Aliasy adresów e-mail (decyzja właściciela 2026-07-16).
  //
  // Auto-dopasowanie poczty umie tylko równość adresu z tym zapisanym w
  // kartotece (findContactsByEmail), więc gdy klient napisze z prywatnej
  // czy nowej skrzynki, wiadomość ląduje w „Nieprzypisane" — i lądowała tam
  // KAŻDA kolejna, bo ręczne przypięcie dotyczyło jednej wiadomości. Ta
  // tabela zapamiętuje decyzję „ten adres to ten klient" raz.
  //
  // `email` jako PRIMARY KEY: jeden adres = jeden właściciel. Nadpisanie
  // (ON CONFLICT) to naturalny sposób poprawienia pomyłki.
  await sql`
    CREATE TABLE IF NOT EXISTS mail_address_links (
      email TEXT PRIMARY KEY,
      client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
      lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await markSchemaApplied("links");
}

/** Lazily tworzy kolumny powiązań Modułu 22 + tabelę aliasów adresów. */
export async function ensureLinksSchema(): Promise<void> {
  if (!linksSchemaReady) linksSchemaReady = createLinksSchema();
  await linksSchemaReady;
}

let auditSchemaReady: Promise<void> | null = null;

/**
 * Audyt zmian pól (Moduł 23) — „kiedy i z czego na co".
 *
 * Panel dotąd NIE zapisywał historii zmian nigdzie: PATCH-e aktualizowały samo
 * `updated_at`, więc po poprawieniu numeru telefonu stara wartość znikała bez
 * śladu. `client_events` to co innego — log zdarzeń BIZNESOWYCH (oferta
 * wysłana, faktura opłacona), a leady nie mają nawet tego.
 *
 * Panel jest jednoosobowy, więc świadomie NIE ma tu kolumny „kto" — zawsze
 * jest to ten sam człowiek. Wartość jest w „kiedy i z czego na co".
 *
 * `entity` jest tekstem od początku ("client"/"lead"), a nie osobną tabelą na
 * moduł, żeby dołożenie faktur/ofert/projektów później było jedną linią w ich
 * PATCH-u, bez migracji. Decyzja właściciela 2026-07-17: na start wpinamy hook
 * TYLKO w klientów i leady.
 *
 * Świadomie BEZ `REFERENCES` — log ma przeżyć skasowanie rekordu, do którego
 * się odnosi (usunięcie klienta nie powinno kasować historii jego zmian).
 */
async function createAuditSchema(): Promise<void> {
  if (await schemaUpToDate("audit")) return;

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS field_changes (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  // Jedyne zapytanie, jakie robi UI: „log zmian TEGO rekordu, od najnowszej".
  await sql`
    CREATE INDEX IF NOT EXISTS field_changes_entity_idx
      ON field_changes (entity, entity_id, created_at DESC);
  `;

  await markSchemaApplied("audit");
}

/** Lazily tworzy tabelę audytu zmian pól (Moduł 23). */
export async function ensureAuditSchema(): Promise<void> {
  if (!auditSchemaReady) auditSchemaReady = createAuditSchema();
  await auditSchemaReady;
}

let notificationsSchemaReady: Promise<void> | null = null;

/**
 * Centrum powiadomień (Moduł 24) — kronika zdarzeń „co się wydarzyło, gdy Cię
 * nie było". Świadomie NIE jest to lista „co jest do zrobienia": tamtą liczy
 * na żywo Pulpit (`app/api/hub/today`) z reguł, bez żadnej tabeli. Dwie różne
 * osie — dzwonek odpowiada na „czego przegapiłem", Pulpit na „co robić"
 * (decyzja właściciela 2026-07-17).
 *
 * `dedupe_key` to serce tej tabeli, nie ozdoba. Cron leci CODZIENNIE o 06:00,
 * więc bez klucza „faktura X po terminie" wpadałaby do dzwonka co rano od
 * nowa i po tygodniu licznik pokazywałby 40 kopii tego samego zdarzenia.
 * Każdy zapis idzie przez `ON CONFLICT (dedupe_key) DO NOTHING`, a klucz
 * opisuje ZDARZENIE, nie moment (np. `invoice_reminder:<id>:2` — drugi
 * poziom eskalacji tej faktury zdarzył się raz i tyle razy ma być widoczny).
 * Dlatego kolumna jest NOT NULL: powiadomienie bez klucza to powiadomienie,
 * które prędzej czy później się zduplikuje.
 *
 * Świadomie BEZ `REFERENCES` — ta sama decyzja co w `field_changes`: kronika
 * ma przeżyć skasowanie rekordu, którego dotyczy. Kliknięcie w martwy wpis
 * prowadzi do 404, co jest uczciwsze niż ciche zniknięcie historii.
 *
 * Kolumny są celowo płaskie (`entity` + `entity_id` jako TEKST, bez enuma) —
 * ten sam kształt, który w Module 23 pozwolił dopiąć audyt kolejnej encji
 * jedną linią, bez migracji. Kiedyś ma z tej tabeli karmić się push w PWA
 * (Moduł 5) — stąd `read_at` zamiast zwykłego boola `read`: push musi wiedzieć
 * KIEDY właściciel przeczytał, żeby nie budzić telefonu tym, co już widział.
 */
async function createNotificationsSchema(): Promise<void> {
  if (await schemaUpToDate("notifications")) return;

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      entity TEXT,
      entity_id TEXT,
      dedupe_key TEXT NOT NULL UNIQUE,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  // Jedyne dwa zapytania, jakie robi UI: „ostatnie N wpisów, od najnowszego"
  // i „ile nieprzeczytanych".
  await sql`
    CREATE INDEX IF NOT EXISTS notifications_created_idx
      ON notifications (created_at DESC);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS notifications_unread_idx
      ON notifications (read_at) WHERE read_at IS NULL;
  `;

  await markSchemaApplied("notifications");
}

/** Lazily tworzy tabelę centrum powiadomień (Moduł 24). */
export async function ensureNotificationsSchema(): Promise<void> {
  if (!notificationsSchemaReady) notificationsSchemaReady = createNotificationsSchema();
  await notificationsSchemaReady;
}
