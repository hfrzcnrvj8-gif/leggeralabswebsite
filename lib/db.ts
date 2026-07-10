import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

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

/** Lazily creates (and caches) the Neon HTTP query client for this instance. */
export function getSql(): Sql {
  if (!client) client = neon(connectionString());
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

  // Zdrowie projektu (Na dobrej drodze/Zagrożony/Zerwany) — ustawiane ręcznie,
  // niezależne od statusu na tablicy, styl Linear. Data startu potrzebna do
  // widoku osi czasu (pasek projektu rysuje się między start a termin).
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS zdrowie TEXT NOT NULL DEFAULT 'Na dobrej drodze';`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS start DATE;`;

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
