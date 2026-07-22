// Zapis błędów i bicie serca automatów (Audyt 4, 2026-07-22).
//
// Warstwa bazy nad czystą logiką z lib/observability.ts — ten sam podział co
// lib/backup.ts (reguła) wobec /api/backup/ping (zapis).
//
// **Decyzja właściciela 2026-07-22:** własna tabela zamiast Sentry. Zero
// nowych usług, dane zostają u niego. Świadomie przyjęta wada: gdy padnie
// baza, ten plik nie zapisze nic. Dlatego wykrywanie CISZY (automation_runs)
// jest ważniejsze od zapisu błędów — brak meldunku działa nawet wtedy, gdy
// nikt nie miał jak się poskarżyć.

import { randomUUID } from "node:crypto";
import { getSql, ensureObservabilitySchema } from "./db";
import { sendEmail } from "./email";
import {
  type AutomationRun,
  type StanAutomatu,
  type Waga,
  ocenAutomaty,
  opisBledu,
  przygotujKomunikat,
  przygotujSzczegoly,
  wymagaUwagi,
} from "./observability";

export const ALARM_TO = "kontakt@leggeralabs.pl";

/** Ile alarmów o TYM SAMYM problemie wysyłamy — nie częściej niż raz na dobę.
 *
 * Wprost pod „prawie zero hałasu" (decyzja 2026-07-22). Padnięta skrzynka
 * potrafi zgłosić się przy każdym przebiegu; alarm przychodzący co godzinę
 * przestaje być alarmem, a zaczyna być tłem. */
const ALARM_CISZA_GODZIN = 24;

/** Ile wierszy historii trzymamy. Log ma służyć do rozpoznania wzorca
 * („sypie się od trzech dni"), a nie rosnąć w nieskończoność — ta sama
 * zasada co 60 wpisów w `backup_runs`. Krótka retencja to również mniej
 * danych do wytłumaczenia w Audycie 2 (RODO). */
const LIMIT_BLEDOW = 500;
const LIMIT_PRZEBIEGOW = 200;

export type WpisBledu = {
  id: string;
  zakres: string;
  waga: Waga;
  komunikat: string;
  szczegoly: string;
  przebieg_id: string | null;
  klucz: string;
  ile: number;
  pierwszy_raz: string;
  created_at: string;
};

/**
 * Zapisuje błąd do `error_log`.
 *
 * **Nigdy nie rzuca wyjątkiem** — i to nie jest ostrożność na wyrost. Ta
 * funkcja jest wołana wyłącznie z bloków `catch`; gdyby sama padła (bo padła
 * baza, czyli dokładnie ta sytuacja, którą chcemy zapisać), wywróciłaby
 * proces, który właśnie próbował się grzecznie pozbierać. Cichy zapis do
 * konsoli jest tu jedynym sensownym zachowaniem ostatniej instancji.
 *
 * `klucz` zwija powtórki: ten sam błąd rośnie licznikiem `ile`, zamiast
 * zasypywać tabelę setką identycznych wierszy.
 */
export async function zapiszBlad(wpis: {
  zakres: string;
  komunikat: string;
  szczegoly?: unknown;
  waga?: Waga;
  /** Domyślnie `zakres + komunikat` — podaj własny, gdy komunikat zawiera
   *  zmienną część (np. numer wiadomości), która rozbiłaby zwijanie. */
  klucz?: string;
  przebiegId?: string | null;
}): Promise<void> {
  try {
    const komunikat = przygotujKomunikat(wpis.komunikat);
    const szczegoly = wpis.szczegoly === undefined ? "" : przygotujSzczegoly(opisBledu(wpis.szczegoly));
    const klucz = (wpis.klucz ?? `${wpis.zakres}:${komunikat}`).slice(0, 200);

    await ensureObservabilitySchema();
    const sql = getSql();

    await sql`
      INSERT INTO error_log (id, zakres, waga, komunikat, szczegoly, przebieg_id, klucz)
      VALUES (
        ${randomUUID()}, ${wpis.zakres.slice(0, 100)}, ${wpis.waga ?? "blad"},
        ${komunikat}, ${szczegoly}, ${wpis.przebiegId ?? null}, ${klucz}
      )
      ON CONFLICT (klucz) DO UPDATE SET
        ile = error_log.ile + 1,
        created_at = now(),
        komunikat = EXCLUDED.komunikat,
        szczegoly = EXCLUDED.szczegoly,
        przebieg_id = EXCLUDED.przebieg_id;
    `;

    await sql`
      DELETE FROM error_log
      WHERE id NOT IN (SELECT id FROM error_log ORDER BY created_at DESC LIMIT ${LIMIT_BLEDOW});
    `;
  } catch (e) {
    console.error("[errorLog] nie udało się zapisać błędu — zapisuję tylko do konsoli", wpis.zakres, wpis.komunikat, e);
  }
}

/** Skrót do użycia wprost w `catch`. */
export async function zapiszWyjatek(zakres: string, komunikat: string, e: unknown, przebiegId?: string | null): Promise<void> {
  await zapiszBlad({ zakres, komunikat, szczegoly: e, przebiegId, klucz: `${zakres}:${komunikat}` });
}

/**
 * Meldunek automatu — wołany po KAŻDYM przebiegu, udanym i nieudanym.
 *
 * To drugie jest ważniejsze, dokładnie jak przy kopiach (`/api/backup/ping`):
 * bez meldunku o porażce widać tylko ciszę, a cisza znaczy jednocześnie
 * „nie zadziałało" i „w ogóle nie chodzi", czyli nic.
 *
 * Też nie rzuca — meldunek nie może wywrócić procesu, o którym melduje.
 */
export async function odnotujPrzebieg(klucz: string, ok: boolean, powod = "", trwaloMs?: number): Promise<void> {
  try {
    await ensureObservabilitySchema();
    const sql = getSql();
    await sql`
      INSERT INTO automation_runs (id, klucz, ok, powod, trwalo_ms)
      VALUES (${randomUUID()}, ${klucz}, ${ok}, ${przygotujKomunikat(powod)}, ${
        typeof trwaloMs === "number" && Number.isFinite(trwaloMs) ? Math.trunc(trwaloMs) : null
      });
    `;
    await sql`
      DELETE FROM automation_runs
      WHERE id NOT IN (SELECT id FROM automation_runs ORDER BY created_at DESC LIMIT ${LIMIT_PRZEBIEGOW});
    `;
  } catch (e) {
    console.error(`[errorLog] nie udało się odnotować przebiegu ${klucz}`, e);
  }
}

export async function wczytajPrzebiegi(): Promise<AutomationRun[]> {
  await ensureObservabilitySchema();
  const sql = getSql();
  return (await sql`
    SELECT id, klucz, ok, powod, trwalo_ms, created_at
    FROM automation_runs ORDER BY created_at DESC LIMIT ${LIMIT_PRZEBIEGOW};
  `) as unknown as AutomationRun[];
}

export async function wczytajBledy(limit = 50): Promise<WpisBledu[]> {
  await ensureObservabilitySchema();
  const sql = getSql();
  return (await sql`
    SELECT id, zakres, waga, komunikat, szczegoly, przebieg_id, klucz, ile, pierwszy_raz, created_at
    FROM error_log ORDER BY created_at DESC LIMIT ${limit};
  `) as unknown as WpisBledu[];
}

/** Stan wszystkich automatów — dla Pulpitu, dziennego maila i apki. */
export async function stanAutomatow(): Promise<StanAutomatu[]> {
  return ocenAutomaty(await wczytajPrzebiegi());
}

/**
 * Wysyła alarm o automatach, które stanęły — ale tylko o tych, o których
 * nie alarmowaliśmy w ciągu ostatniej doby.
 *
 * **Osobny mail, nie linijka w dziennym raporcie** (decyzja właściciela
 * 2026-07-22). Powód jest konkretny: dzienny raport przychodzi tą samą
 * drogą, którą właśnie diagnozujemy. Gdy padnie cron, raport nie wyjdzie —
 * więc ostrzeżenie schowane w jego treści zginie razem z nim. Ten mail idzie
 * z innego miejsca (ping z NAS-a), dlatego przeżywa śmierć crona.
 *
 * Zwraca liczbę wysłanych alarmów (0 = wszystko zdrowe albo już zgłoszone).
 */
export async function wyslijAlarmy(teraz: Date = new Date()): Promise<number> {
  let doZgloszenia: StanAutomatu[];
  try {
    doZgloszenia = (await stanAutomatow()).filter(wymagaUwagi);
  } catch (e) {
    console.error("[alarm] nie udało się ocenić stanu automatów", e);
    return 0;
  }
  if (doZgloszenia.length === 0) return 0;

  const sql = getSql();
  const swieze: StanAutomatu[] = [];
  for (const s of doZgloszenia) {
    const klucz = `automat:${s.automat.klucz}:${s.stan}`;
    try {
      // Jedno zapytanie zamiast „sprawdź, potem zapisz" — dwa równoległe
      // przebiegi (cron i ping z NAS-a potrafią się minąć o sekundy) inaczej
      // wysłałyby ten sam alarm dwa razy.
      const rows = (await sql`
        INSERT INTO alarm_state (klucz, ostatnio_wyslany) VALUES (${klucz}, now())
        ON CONFLICT (klucz) DO UPDATE SET ostatnio_wyslany = now()
        WHERE alarm_state.ostatnio_wyslany < now() - make_interval(hours => ${ALARM_CISZA_GODZIN})
        RETURNING klucz;
      `) as unknown as { klucz: string }[];
      if (rows.length > 0) swieze.push(s);
    } catch (e) {
      console.error(`[alarm] nie udało się sprawdzić wyciszenia ${klucz}`, e);
    }
  }
  if (swieze.length === 0) return 0;

  const tresc = [
    "To jest alarm z panelu — przychodzi TYLKO wtedy, gdy coś stanęło.",
    "",
    // Puste linie MIĘDZY wpisami zostają — filtrujemy wyłącznie opcjonalną
    // linijkę „Powód", która przy stanie „przestarzałe" nie istnieje.
    ...swieze.flatMap((s) =>
      [`■ ${s.opis}`, s.stan === "blad" ? `   Powód: ${s.powod}` : null, `   Co to znaczy: ${s.automat.skutek}`, ""].filter(
        (l): l is string => l !== null
      )
    ),
    "Ten sam stan nie będzie zgłaszany częściej niż raz na dobę.",
    "",
    "— nadzór automatów z /admin",
  ].join("\n");

  try {
    await sendEmail({
      to: ALARM_TO,
      subject:
        swieze.length === 1
          ? `[Panel] ALARM: ${swieze[0].automat.nazwa} nie działa`
          : `[Panel] ALARM: ${swieze.length} automaty nie działają`,
      text: tresc,
    });
  } catch (e) {
    // Nie da się wysłać alarmu o tym, że nie da się wysłać alarmu. Zostaje
    // konsola i pas na Pulpicie — stan i tak jest już w automation_runs.
    console.error("[alarm] nie udało się wysłać alarmu", e);
    return 0;
  }
  return swieze.length;
}
