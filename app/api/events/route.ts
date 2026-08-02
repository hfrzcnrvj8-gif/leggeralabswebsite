import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema, ensureEventAttendeesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { todayLocalISO, isPlausibleTimeString } from "@/lib/dates";
import { isPlausibleDateString } from "@/lib/projects";
import {
  odczytajLiczbeWydarzenia,
  odczytajOpcjonalnyTekst,
  odczytajTekstWydarzenia,
  rozwinSerieWydarzen,
  type HubEvent,
} from "@/lib/events";
import { normalizujCykl } from "@/lib/recurrence";

export const runtime = "nodejs";

/** Ostatni dzień miesiąca `YYYY-MM`, jako ISO. Dzień 0 kolejnego miesiąca. */
function miesiacKoniec(prefix: string): string {
  const [y, m] = prefix.split("-").map(Number);
  const d = new Date(y, m, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** GET /api/events?month=YYYY-MM — list events in a given month (default: current). Admin-only. */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureHubSchema();
  await ensureEventAttendeesSchema();
  const sql = getSql();

  const month = req.nextUrl.searchParams.get("month");
  const prefix = month && /^\d{4}-\d{2}$/.test(month) ? month : todayLocalISO().slice(0, 7);
  const monthStart = `${prefix}-01`;

  // Zakres nakładania się z miesiącem, nie dopasowanie samej `data` — inaczej
  // wielodniowe wydarzenie (data_koniec) rozpoczęte w poprzednim miesiącu
  // zniknęłoby z widoku miesiąca, w którym realnie trwa.
  // Liczniki zaproszeń doliczane w TYM SAMYM zapytaniu (2026-07-22): kalendarz
  // ma pokazywać „2/3 potwierdziło" przy wydarzeniu, a osobna runda do bazy per
  // miesiąc kosztowałaby drugie żądanie HTTP (neon() = jedno na zapytanie).
  // Zero uczestników → 0/0, czyli plakietka się nie rysuje.
  // Wiersz-wzorzec serii ma `data` z PIERWSZEGO wystąpienia, więc warunek
  // „nakłada się na miesiąc" musi go przepuścić inaczej niż wydarzenie
  // jednorazowe: seria wchodzi, gdy zaczęła się nie później niż koniec
  // miesiąca i nie skończyła przed jego początkiem. Bez tej gałęzi cotygodniowy
  // przegląd założony w styczniu zniknąłby z lipca.
  //
  // Nadal JEDNO zapytanie na miesiąc (wymóg z briefu) — wystąpienia liczy
  // `rozwinSerieWydarzen()` w pamięci, nie baza.
  const rows = (await sql`
    SELECT e.*,
           COUNT(a.id)::int AS uczestnicy_total,
           COUNT(a.id) FILTER (WHERE a.status = 'przyjete')::int AS uczestnicy_tak
    FROM events e
    LEFT JOIN event_attendees a ON a.event_id = e.id
    WHERE e.data <= (date_trunc('month', ${monthStart}::date) + interval '1 month' - interval '1 day')::date
      AND (
        (e.powtarzanie IS NULL AND COALESCE(e.data_koniec, e.data) >= ${monthStart}::date)
        OR (e.powtarzanie IS NOT NULL AND (e.powtarzanie_do IS NULL OR e.powtarzanie_do >= ${monthStart}::date))
      )
    GROUP BY e.id
    ORDER BY e.data ASC, e.godzina ASC NULLS LAST;
  `) as unknown as HubEvent[];

  const monthEnd = miesiacKoniec(prefix);
  return NextResponse.json({ events: rozwinSerieWydarzen(rows, monthStart, monthEnd) });
}

/** POST /api/events — create an event. Admin-only.
 *
 * Czyta pola tymi samymi funkcjami, co PATCH (`lib/events.ts`), żeby ta sama
 * treść zapisana dwiema drogami wychodziła identycznie. Do audytu Kalendarza
 * (2026-08-02) obie trasy miały własne reguły i różniły się w obie strony:
 * POST tnął tytuł na 300 znaków po cichu, a PATCH nie tnął wcale; POST
 * traktował literówkę w kluczu cyklu jako „bez powtarzania", PATCH — jako
 * skasowanie serii. Śmieć w polu liczbowym obie zamieniały na `null`. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const zle = (powod: string) => NextResponse.json({ error: powod }, { status: 400 });

  const tytulIn = odczytajTekstWydarzenia(body, "tytul");
  if (tytulIn.rodzaj === "blad") return zle(tytulIn.powod);
  const dataIn = odczytajOpcjonalnyTekst(body, "data");
  if (dataIn.rodzaj === "blad") return zle(dataIn.powod);
  if (tytulIn.rodzaj !== "ustaw" || dataIn.rodzaj !== "ustaw") {
    return zle("tytul and data are required");
  }
  const tytul = tytulIn.wartosc;
  const data = dataIn.wartosc;
  if (!isPlausibleDateString(data)) return zle("invalid data");

  const opisIn = odczytajTekstWydarzenia(body, "opis");
  if (opisIn.rodzaj === "blad") return zle(opisIn.powod);
  const opis = opisIn.rodzaj === "ustaw" ? opisIn.wartosc : "";

  const koniecIn = odczytajOpcjonalnyTekst(body, "data_koniec");
  if (koniecIn.rodzaj === "blad") return zle(koniecIn.powod);
  if (koniecIn.rodzaj === "ustaw" && !isPlausibleDateString(koniecIn.wartosc)) return zle("invalid data_koniec");
  if (koniecIn.rodzaj === "ustaw" && koniecIn.wartosc < data) {
    return zle("data_koniec must not be before data");
  }
  const dataKoniec = koniecIn.rodzaj === "ustaw" ? koniecIn.wartosc : null;

  // Pusta godzina = wydarzenie całodniowe; podana MUSI być godziną. Kolumna
  // jest TEXT-em, więc bez tej bramki wchodził tu dowolny napis (audyt
  // Notatnika 2026-08-02 — ta sama dziura była w trzech miejscach naraz).
  const godzinaIn = odczytajOpcjonalnyTekst(body, "godzina");
  if (godzinaIn.rodzaj === "blad") return zle(godzinaIn.powod);
  if (godzinaIn.rodzaj === "ustaw" && !isPlausibleTimeString(godzinaIn.wartosc)) return zle("invalid godzina");
  const godzina = godzinaIn.rodzaj === "ustaw" ? godzinaIn.wartosc : null;

  const lokalizacjaIn = odczytajTekstWydarzenia(body, "lokalizacja");
  if (lokalizacjaIn.rodzaj === "blad") return zle(lokalizacjaIn.powod);
  const lokalizacja = lokalizacjaIn.rodzaj === "ustaw" ? lokalizacjaIn.wartosc : null;

  const czasIn = odczytajLiczbeWydarzenia(body, "czas_trwania_min", 1, 1440);
  if (czasIn.rodzaj === "blad") return zle(czasIn.powod);
  const czasTrwaniaMin = czasIn.rodzaj === "ustaw" ? czasIn.wartosc : null;

  const alertIn = odczytajLiczbeWydarzenia(body, "alert_minut_przed", 0, 43200);
  if (alertIn.rodzaj === "blad") return zle(alertIn.powod);
  const alertMinutPrzed = alertIn.rodzaj === "ustaw" ? alertIn.wartosc : null;

  // Cykl spoza słownika to 400, nie „bez powtarzania": literówka w kluczu
  // zakładała wydarzenie jednorazowe i odpowiadała `{"ok":true}`, więc seria
  // po prostu nie powstawała, a nikt się o tym nie dowiadywał.
  const cyklIn = odczytajOpcjonalnyTekst(body, "powtarzanie");
  if (cyklIn.rodzaj === "blad") return zle(cyklIn.powod);
  const powtarzanie = cyklIn.rodzaj === "ustaw" ? normalizujCykl(cyklIn.wartosc) : null;
  if (cyklIn.rodzaj === "ustaw" && !powtarzanie) return zle("invalid powtarzanie");

  const cyklDoIn = odczytajOpcjonalnyTekst(body, "powtarzanie_do");
  if (cyklDoIn.rodzaj === "blad") return zle(cyklDoIn.powod);
  if (cyklDoIn.rodzaj === "ustaw" && !isPlausibleDateString(cyklDoIn.wartosc)) return zle("invalid powtarzanie_do");
  if (cyklDoIn.rodzaj === "ustaw" && cyklDoIn.wartosc < data) {
    return zle("powtarzanie_do must not be before data");
  }
  // „Do kiedy" bez cyklu nie znaczy nic i nie zapisuje się po cichu — inaczej
  // wracałoby jako seria bez reguły (ta sama odmowa, co w PATCH).
  if (cyklDoIn.rodzaj === "ustaw" && !powtarzanie) return zle("powtarzanie_do requires powtarzanie");
  const powtarzanieDo = cyklDoIn.rodzaj === "ustaw" ? cyklDoIn.wartosc : null;

  await ensureHubSchema();
  const sql = getSql();

  // Powiązania sprawdzane PRZED wstawieniem: nieistniejące id leciało prosto
  // na klucz obcy i wracało gołym 500 (zmierzone sondą 2026-08-02).
  const powiazania: Record<"lead_id" | "project_id" | "client_id", string | null> = {
    lead_id: null,
    project_id: null,
    client_id: null,
  };
  for (const kolumna of ["lead_id", "project_id", "client_id"] as const) {
    const wejscie = odczytajOpcjonalnyTekst(body, kolumna);
    if (wejscie.rodzaj === "blad") return zle(wejscie.powod);
    if (wejscie.rodzaj !== "ustaw") continue;
    const [jest] = (await (kolumna === "lead_id"
      ? sql`SELECT 1 AS x FROM leads WHERE id = ${wejscie.wartosc};`
      : kolumna === "client_id"
        ? sql`SELECT 1 AS x FROM clients WHERE id = ${wejscie.wartosc};`
        : sql`SELECT 1 AS x FROM projects WHERE id = ${wejscie.wartosc};`)) as unknown as { x: number }[];
    if (!jest) return zle(`${kolumna} does not exist`);
    powiazania[kolumna] = wejscie.wartosc;
  }

  const id = randomUUID();
  await sql`
    INSERT INTO events (id, tytul, opis, data, godzina, lead_id, project_id, client_id, data_koniec, czas_trwania_min, lokalizacja, alert_minut_przed, powtarzanie, powtarzanie_do)
    VALUES (${id}, ${tytul}, ${opis}, ${data}, ${godzina}, ${powiazania.lead_id}, ${powiazania.project_id}, ${powiazania.client_id}, ${dataKoniec}, ${czasTrwaniaMin}, ${lokalizacja}, ${alertMinutPrzed}, ${powtarzanie}, ${powtarzanieDo});
  `;

  return NextResponse.json({ ok: true, id });
}
