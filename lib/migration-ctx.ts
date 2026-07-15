// Znacznik "to zapytanie jest częścią MIGRACJI, nie logiki runtime".
//
// Potrzebny tylko dev-bazie (lib/dev-db.ts), ale mieszka w osobnym pliku, bo
// importuje go też lib/db.ts — a ten działa na produkcji i NIE MOŻE ciągnąć
// PGlite (devDependency). Tutaj jest wyłącznie AsyncLocalStorage z Node'a,
// więc import jest bezpieczny wszędzie; na produkcji to martwy kod.
//
// Po co: dev-baza seeduje się leniwie przy pierwszym zapytaniu (ensureSeeded
// w dev-db.ts), a seeder sam odpala migracje. Gdy migracja wykona zapytanie
// nie-DDL (`INSERT INTO company_settings ... ON CONFLICT DO NOTHING` i
// podobne singletony), trafia ono do taga, który przed wykonaniem czeka na
// seed — i powstaje cykl:
//
//   route → ensureMailSchema() [promise w locie]
//         → ensureInvoicesSchema() → INSERT company_settings
//         → czeka na ensureSeeded()
//              → seeder → ensureMailSchema() → czeka na promise route'a  ✗
//
// Objaw: każde /api/* w dev wisi kilkadziesiąt sekund. Filtr `isDDL()` w
// dev-db.ts celował dokładnie w ten problem ("migracje omijają seed"), ale
// łapie tylko CREATE/ALTER/DROP — INSERT się przez niego prześlizguje.
//
// Rozwiązaniem NIE może być rozpoznawanie po treści SQL-a (np. "INSERT ...
// ON CONFLICT DO NOTHING"), bo taki sam kształt mają zapytania runtime —
// choćby dedup poczty (`INSERT INTO mail_messages ... ON CONFLICT
// (message_id) DO NOTHING` w lib/mailSync.ts), które na seed czekać MUSZĄ.
// Dlatego migracja oznacza się jawnie, przez ten kontekst.
import { AsyncLocalStorage } from "node:async_hooks";

const migrationCtx = new AsyncLocalStorage<true>();

/** Oznacz zapytanie(a) jako część migracji schematu. AsyncLocalStorage
 * propaguje się przez await-y, więc wystarczy owinąć samo zapytanie. */
export function inMigration<T>(fn: () => Promise<T>): Promise<T> {
  return migrationCtx.run(true, fn);
}

/** Czy bieżący łańcuch wywołań biegnie wewnątrz migracji (patrz dev-db.ts). */
export function isInMigration(): boolean {
  return migrationCtx.getStore() === true;
}
