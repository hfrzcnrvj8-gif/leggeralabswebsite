/**
 * Lokalna baza deweloperska (PGlite = Postgres w WASM, w procesie).
 *
 * Używana WYŁĄCZNIE gdy NODE_ENV=development i brak connection stringa do
 * prawdziwej bazy — patrz getSql() w db.ts. Nigdy na produkcji. Dzięki temu
 * `npm run dev` daje w pełni działający panel z danymi bez podłączania Neona,
 * bez Vercel CLI i bez ryzyka tknięcia produkcyjnych danych. Mówi prawdziwym
 * SQL-em, więc wszystkie route'y i migracje (`CREATE TABLE IF NOT EXISTS`)
 * działają bez zmian.
 *
 * Adapter naśladuje sygnaturę taga neon-a: `sql\`SELECT ... ${x}\`` → Promise<
 * rows[]>. Daty (DATE/TIMESTAMP) zwracamy jako stringi, tak jak robi to
 * neonowy klient HTTP — inaczej `parseDate`/`formatPlDate` dostałyby obiekty
 * Date i się wywaliły.
 */
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";

type Row = Record<string, unknown>;
type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>;

let db: PGlite | null = null;
let seedPromise: Promise<void> | null = null;

function getDb(): PGlite {
  if (!db) {
    db = new PGlite({
      // Zwracaj daty jako surowe stringi (jak neon), nie obiekty Date.
      parsers: {
        1082: (v: string) => v, // date
        1114: (v: string) => v, // timestamp
        1184: (v: string) => v, // timestamptz
      },
    });
  }
  return db;
}

/** Surowe zapytanie do PGlite — bez czekania na seed. Używane wewnętrznie
 * przez seeder i przez publiczny tag po wykonaniu seeda. */
async function raw(text: string, params: unknown[]): Promise<Row[]> {
  const res = await getDb().query(text, params);
  return res.rows as Row[];
}

/** Zamienia tagged-template neon-a na sparametryzowane zapytanie Postgresa
 * ($1, $2, …), które rozumie PGlite. */
function buildQuery(strings: TemplateStringsArray, values: unknown[]): { text: string; params: unknown[] } {
  let text = "";
  strings.forEach((part, i) => {
    text += part;
    if (i < values.length) text += `$${i + 1}`;
  });
  return { text, params: values };
}

function isDDL(text: string): boolean {
  return /^\s*(CREATE|ALTER|DROP)\b/i.test(text);
}

const day = 86400000;
function iso(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);
}

/** Wypełnia dev-bazę realistycznymi danymi RAZ — dopiero po tym, jak schemat
 * już istnieje (tworzą go migracje aplikacji przez getSql()). */
async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      // Schemat tworzą migracje aplikacji, ale seeder może odpalić się jako
      // pierwszy — więc na wszelki wypadek importujemy i uruchamiamy je tu.
      const { ensureLeadsSchema, ensureHubSchema } = await import("./db");
      await ensureLeadsSchema();
      await ensureHubSchema();

      const existing = await raw("SELECT COUNT(*)::int AS n FROM projects", []);
      if ((existing[0]?.n as number) > 0) return; // już zaseedowane

      // — Leady —
      const leadA = randomUUID();
      const leadB = randomUUID();
      await raw(
        `INSERT INTO leads (id, firma, osoba_kontaktowa, branza, telefon, email, www, miasto, zrodlo_kategoria, zrodlo, status, ostatni_kontakt, notatki)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13),($14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
        [
          leadA, "Kancelaria Kowalski", "Marek Kowalski", "Prawo", "600100200", "biuro@kowalski.pl", "kowalski.pl", "Warszawa", "Polecenie", "", "Rozmowa umówiona", iso(-2), "Zainteresowani automatyzacją umów.",
          leadB, "Piekarnia Złoty Kłos", "", "Gastronomia", "500300400", "kontakt@zlotyklos.pl", "zlotyklos.pl", "Wilanów", "Formularz na stronie", "", "Nowe zgłoszenie ze strony", iso(-6), "",
        ]
      );

      // — Projekty (z datami i kamieniami milowymi — żeby oś czasu żyła) —
      const projects = [
        { tytul: "Website", zdrowie: "Na dobrej drodze", priorytet: "Wysoki", start: iso(-8), termin: iso(40), lead: leadA,
          milestones: [ ["Discovery", iso(2)], ["Design", iso(18)], ["Wdrożenie", iso(34)] ] },
        { tytul: "Leggera Source", zdrowie: "Zagrożony", priorytet: "Normalny", start: iso(-1), termin: iso(55), lead: null,
          milestones: [ ["MVP scraper", iso(14)], ["Integracja API", iso(38)] ] },
        { tytul: "Leggera Flow", zdrowie: "Na dobrej drodze", priorytet: "Niski", start: iso(20), termin: iso(70), lead: null,
          milestones: [ ["Model procesu", iso(35)] ] },
      ];
      for (let i = 0; i < projects.length; i++) {
        const p = projects[i];
        const pid = randomUUID();
        await raw(
          `INSERT INTO projects (id, tytul, opis, status, priorytet, zdrowie, start, termin, lead_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [pid, p.tytul, "Opis przykładowego projektu — dev seed.", "W trakcie", p.priorytet, p.zdrowie, p.start, p.termin, p.lead]
        );
        for (let m = 0; m < p.milestones.length; m++) {
          await raw(
            `INSERT INTO project_milestones (id, project_id, nazwa, termin, position) VALUES ($1,$2,$3,$4,$5)`,
            [randomUUID(), pid, p.milestones[m][0], p.milestones[m][1], m]
          );
        }
        // Parę zadań, żeby pasek postępu na kartach kanbana coś pokazywał.
        for (let t = 0; t < 4; t++) {
          await raw(
            `INSERT INTO project_tasks (id, project_id, text, done, position) VALUES ($1,$2,$3,$4,$5)`,
            [randomUUID(), pid, `Zadanie ${t + 1}`, t < 2, t]
          );
        }
      }

      // — Notatki —
      await raw(
        `INSERT INTO notes (id, tytul, tresc, tagi) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)`,
        [
          randomUUID(), "Pomysł: newsletter", "Cotygodniowy mail z case studies.", "marketing, pomysł",
          randomUUID(), "Do przemyślenia: cennik", "Może pakiet founding partner?", "biznes",
        ]
      );

      // — Wydarzenia (dziś + w tym miesiącu) —
      await raw(
        `INSERT INTO events (id, tytul, data, godzina) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)`,
        [
          randomUUID(), "Call z klientem", iso(0), "10:00",
          randomUUID(), "Demo produktu", iso(3), "14:30",
        ]
      );
    })();
  }
  await seedPromise;
}

/** Publiczny tag — zgodny sygnaturą z klientem neon-a. */
export function getDevSql(): Sql {
  const tag: Sql = async (strings, ...values) => {
    const { text, params } = buildQuery(strings, values);
    // DDL (migracje) omija seed, żeby nie było zakleszczenia: seeder sam
    // wywołuje migracje, a te wracają tutaj jako DDL.
    if (isDDL(text)) return raw(text, params);
    await ensureSeeded();
    return raw(text, params);
  };
  return tag;
}

/** Odpowiednik `withTransaction()` z db.ts, ale na PGlite — używa wbudowanej
 * `db.transaction()` (prawdziwy BEGIN/COMMIT/ROLLBACK, PGlite to realny
 * silnik Postgresa w WASM, nie atrapa). */
export async function withDevTransaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  await ensureSeeded();
  return getDb().transaction(async (tx) => {
    const txSql: Sql = async (strings, ...values) => {
      const { text, params } = buildQuery(strings, values);
      const res = await tx.query(text, params);
      return res.rows as Row[];
    };
    return fn(txSql);
  });
}
