import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

let client: Sql | null = null;
let schemaReady: Promise<void> | null = null;

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
