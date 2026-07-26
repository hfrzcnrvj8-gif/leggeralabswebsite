// Klient WŁASNEGO Postgresa (Moduł 55 — przeprowadzka na NAS, 2026-07-26).
//
// Trzeci backend obok `neon()` (chmura) i PGlite (`dev-db.ts`, tryb
// deweloperski). Ten mówi zwykłym protokołem Postgresa po TCP, więc obsługuje
// bazę stojącą OBOK panelu — na NAS-ie, w sąsiednim kontenerze.
//
// Powód istnienia: `@neondatabase/serverless` gada wyłącznie z Neonem. Tryb
// HTTP (`neon()`) uderza w ich endpoint REST, a `Pool` z tego samego pakietu
// idzie po WebSocket przez ich proxy. Żaden z nich nie postawi połączenia
// z Postgresem, który nie jest Neonem — i to była JEDYNA rzecz w kodzie
// naprawdę przywiązująca panel do chmury.
//
// Kształt sygnatury (`Sql`, tagged template) jest ten sam, co w pozostałych
// dwóch backendach, więc 149 plików tras nie wie o istnieniu tego pliku i nie
// musi wiedzieć. Ta abstrakcja istniała już wcześniej — dla PGlite — więc
// dołożenie trzeciego klienta to droga raz przetarta, nie nowa.
import { Pool, types, type PoolClient } from "pg";

/**
 * Daty i znaczniki czasu jako SUROWE STRINGI — dokładnie tak, jak oddaje je
 * `neon()` i jak ustawia to PGlite w `dev-db.ts`.
 *
 * Bez tego `pg` zamienia je na obiekty `Date`, a cały panel zakłada stringi:
 * porównuje je z `"2026-07-26"`, robi `.slice(0, 10)`, `.trim()` i wkłada
 * wprost do JSON-a lecącego do apki.
 *
 * Nie jest to teoria — kontener uruchomiony na tym sterowniku wywalił się
 * na `e.trim is not a function` przy odczycie stanu automatów, zanim te trzy
 * linijki powstały (2026-07-26). Objaw był oddalony od przyczyny o kilka
 * warstw, bo `Date` przechodzi przez większość kodu bez protestu i pęka
 * dopiero tam, gdzie ktoś traktuje go jak tekst.
 *
 * Ustawiane RAZ, na module — `pg` trzyma parsery globalnie, nie per pula.
 */
types.setTypeParser(1082, (v: string) => v); // date
types.setTypeParser(1114, (v: string) => v); // timestamp
types.setTypeParser(1184, (v: string) => v); // timestamptz

let pool: Pool | null = null;

/**
 * Czy connection string wskazuje na NEONA, czy na własną bazę.
 *
 * Rozpoznajemy po hoście, nie po osobnym przełączniku w środowisku. Powód jest
 * ten sam, dla którego dev-login sprawdza `NODE_ENV`, a nie samą zmienną:
 * przełącznik można ustawić źle i dostać cichą awarię („panel nie widzi bazy"
 * przy poprawnym adresie). Host jest faktem — albo w adresie stoi `neon.tech`,
 * albo nie.
 *
 * `pooler`/`aws.neon.tech` łapią się w to samo `neon.tech`.
 */
export function czyNeon(connectionString: string): boolean {
  try {
    return new URL(connectionString).hostname.endsWith("neon.tech");
  } catch {
    // Nieparsowalny adres — zachowaj się jak dotąd (Neon). Błąd i tak wyjdzie
    // przy pierwszym zapytaniu, z komunikatem sterownika, a nie z tej funkcji.
    return true;
  }
}

/**
 * Pula połączeń do własnej bazy — jedna na instancję procesu.
 *
 * `max: 10` bo panel jest jednoosobowy: równolegle biegnie najwyżej kilka
 * żądań, a każde zajmuje jedno połączenie na czas zapytania. Wyższa liczba
 * zjadałaby pamięć Postgresa na NAS-ie bez żadnego zysku.
 *
 * Bez `ssl` domyślnie: baza stoi w sąsiednim kontenerze, ruch nie opuszcza
 * maszyny. Gdyby kiedyś stanęła na innym hoście, adres z `sslmode=require`
 * włączy TLS sam — `pg` czyta to z connection stringa.
 */
function getPool(connectionString: string): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 10,
      // Połączenie bezczynne dłużej niż 30 s nie jest nic warte, a trzyma
      // slot po stronie Postgresa.
      idleTimeoutMillis: 30_000,
      // Bez limitu czekanie na wolne połączenie wisi w nieskończoność —
      // ta sama klasa błędu, co `waitsForConnectivity` bez limitu w apce
      // (7 dni czekania zamiast błędu).
      connectionTimeoutMillis: 10_000,
    });
    // Bez tego błąd na bezczynnym połączeniu (restart Postgresa, zerwana
    // sieć) wywraca CAŁY proces Node'a — `pg` emituje go na puli, a nieobsłużony
    // 'error' w EventEmitterze jest w Node fatalny. Pula sama zastąpi zepsute
    // połączenie, więc log wystarczy.
    pool.on("error", (e) => console.error("[db] błąd bezczynnego połączenia", e));
  }
  return pool;
}

/** Tagged-template → zapytanie sparametryzowane ($1, $2, …). Bliźniak
 * `toParamQuery` z `db.ts` i tej samej funkcji w `dev-db.ts`. */
function naParametry(strings: TemplateStringsArray, values: unknown[]): { text: string; params: unknown[] } {
  let text = "";
  strings.forEach((part, i) => {
    text += part;
    if (i < values.length) text += `$${i + 1}`;
  });
  return { text, params: values };
}

/** Klient zapytań o sygnaturze zgodnej z `neon()` — zwraca same wiersze. */
export function getOwnSql(connectionString: string) {
  const p = getPool(connectionString);
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const { text, params } = naParametry(strings, values);
    const res = await p.query(text, params);
    return res.rows;
  };
}

/** Prawdziwa transakcja na własnej bazie — odpowiednik gałęzi `Pool`
 * z `withTransaction` w `db.ts`. Jedno połączenie na całą transakcję, bo
 * BEGIN/COMMIT muszą trafić w to samo. */
export async function withOwnTransaction<T>(
  connectionString: string,
  fn: (sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>) => Promise<T>
): Promise<T> {
  const p = getPool(connectionString);
  const klient: PoolClient = await p.connect();
  try {
    await klient.query("BEGIN");
    const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const { text, params } = naParametry(strings, values);
      const res = await klient.query(text, params);
      return res.rows;
    };
    const wynik = await fn(sql);
    await klient.query("COMMIT");
    return wynik;
  } catch (e) {
    await klient.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    klient.release();
  }
}
