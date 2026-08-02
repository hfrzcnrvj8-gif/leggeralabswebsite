import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { isPlausibleTimeString } from "@/lib/dates";
import {
  EVENT_LIMITS,
  odczytajLiczbeWydarzenia,
  odczytajOpcjonalnyTekst,
  odczytajTekstWydarzenia,
} from "@/lib/events";
import { normalizujCykl, pominieteDoTekstu, pominieteZTekstu, rozbierzIdWystapienia } from "@/lib/recurrence";

export const runtime = "nodejs";

/** GET /api/events/:id — jedno wydarzenie. Admin-only.
 *
 * Powstało dla ADRESU REKORDU (`/admin/calendar/<id>`, Moduł 59, paczka E):
 * wydarzenie dało się dotąd otworzyć wyłącznie klikając w dzień w siatce, więc
 * „przyślij mi link do tego spotkania" nie miało odpowiedzi.
 *
 * `:id` może być syntetycznym id WYSTĄPIENIA serii (`<id-wzorca>~<data>`) —
 * tak samo jak w PATCH/DELETE, bo tak wracają rozwinięte wystąpienia z listy.
 * Wtedy wczytujemy wzorzec i podmieniamy datę na datę tego wystąpienia:
 * właściciel kliknął w konkretny dzień i o ten dzień pyta, a nie o pierwszy
 * termin serii sprzed pół roku. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: rawId } = await params;
  const { idWzorca, wystapienie } = rozbierzIdWystapienia(rawId);
  await ensureHubSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM events WHERE id = ${idWzorca};`;
  const event = rows[0];
  if (!event) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (wystapienie && isPlausibleDateString(wystapienie)) {
    return NextResponse.json({ event: { ...event, id: rawId, data: wystapienie } });
  }
  return NextResponse.json({ event });
}

/** PATCH /api/events/:id — zmiana pól, pole po polu. Admin-only.
 *
 * `:id` może być syntetycznym id WYSTĄPIENIA serii (`<id-wzorca>~<data>`),
 * bo tak wracają rozwinięte wystąpienia z `GET /api/events`. Edycja zawsze
 * dotyczy CAŁEJ serii (decyzja właściciela z 2026-07-22: wyjątki tylko przy
 * kasowaniu), więc datę wystąpienia tu odrzucamy i pracujemy na wzorcu.
 *
 * **Przebieg jest TRÓJFAZOWY** (audyt Kalendarza 2026-08-02, ostatnia trasa
 * PATCH w panelu bez tego podziału — wzorzec z Modułu 66 i Notatnika):
 * najpierw kształt wszystkich pól, potem reguły zależne od tego, co siedzi
 * w bazie, i dopiero na końcu zapisy. Wcześniej sprawdzenie daty stało
 * w środku ciągu `UPDATE`-ów, więc ciało `{"tytul":"PO","data":"0202-01-01"}`
 * zapisywało tytuł i oddawało 400 — panel pisał wtedy „Nie udało się
 * zaktualizować wydarzenia", a zmiana częściowo weszła (zmierzone sondą).
 * Neon nie daje transakcji w kliencie HTTP, więc atomowość bierzemy stąd, że
 * po pierwszym zapisie nie ma już czego odrzucić. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { idWzorca: id } = rozbierzIdWystapienia((await params).id);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  await ensureHubSchema();
  const sql = getSql();
  const zle = (powod: string) => NextResponse.json({ error: powod }, { status: 400 });

  /* ── FAZA 1: kształt pól, bez oglądania się na bazę ───────────────────── */

  const tytulIn = odczytajTekstWydarzenia(body, "tytul");
  if (tytulIn.rodzaj === "blad") return zle(tytulIn.powod);
  // Wydarzenie bez tytułu to pusta pastylka w siatce dnia — nie do odróżnienia
  // od sąsiadów i nie do znalezienia. `null` na tym polu jest pomyłką, nie
  // życzeniem, więc odmawiamy zamiast czyścić.
  if (tytulIn.rodzaj === "zdejmij") return zle("tytul must not be empty");

  const opisIn = odczytajTekstWydarzenia(body, "opis");
  if (opisIn.rodzaj === "blad") return zle(opisIn.powod);

  const lokalizacjaIn = odczytajTekstWydarzenia(body, "lokalizacja");
  if (lokalizacjaIn.rodzaj === "blad") return zle(lokalizacjaIn.powod);

  // Data jest jedynym polem, którego wydarzenie nie może NIE mieć: bez niej
  // nie ma dnia, w którym miałoby się narysować. `null` to więc odmowa,
  // a nie wyczyszczenie kolumny.
  const dataIn = odczytajOpcjonalnyTekst(body, "data");
  if (dataIn.rodzaj === "blad") return zle(dataIn.powod);
  if (dataIn.rodzaj === "zdejmij") return zle("data must not be empty");
  if (dataIn.rodzaj === "ustaw" && !isPlausibleDateString(dataIn.wartosc)) return zle("invalid data");

  const godzinaIn = odczytajOpcjonalnyTekst(body, "godzina");
  if (godzinaIn.rodzaj === "blad") return zle(godzinaIn.powod);
  if (godzinaIn.rodzaj === "ustaw" && !isPlausibleTimeString(godzinaIn.wartosc)) return zle("invalid godzina");

  const koniecIn = odczytajOpcjonalnyTekst(body, "data_koniec");
  if (koniecIn.rodzaj === "blad") return zle(koniecIn.powod);
  if (koniecIn.rodzaj === "ustaw" && !isPlausibleDateString(koniecIn.wartosc)) return zle("invalid data_koniec");

  const czasIn = odczytajLiczbeWydarzenia(body, "czas_trwania_min", 1, 1440);
  if (czasIn.rodzaj === "blad") return zle(czasIn.powod);

  const alertIn = odczytajLiczbeWydarzenia(body, "alert_minut_przed", 0, 43200);
  if (alertIn.rodzaj === "blad") return zle(alertIn.powod);

  // Nieznany cykl dostaje 400, ale `null`/`""` dalej znaczy „nie powtarza się".
  // `normalizujCykl` sam z siebie oddaje null na jedno i drugie, więc bez tego
  // rozróżnienia literówka w kluczu („co tydzien" zamiast `co_tydzien`) cicho
  // KASOWAŁA serię razem z jej końcem i listą pominiętych wystąpień — złapane
  // na sondzie, dokładnie ta sama dziura, co w Przypomnieniach.
  const cyklIn = odczytajOpcjonalnyTekst(body, "powtarzanie");
  if (cyklIn.rodzaj === "blad") return zle(cyklIn.powod);
  const cyklZnormalizowany = cyklIn.rodzaj === "ustaw" ? normalizujCykl(cyklIn.wartosc) : null;
  if (cyklIn.rodzaj === "ustaw" && !cyklZnormalizowany) return zle("invalid powtarzanie");

  const cyklDoIn = odczytajOpcjonalnyTekst(body, "powtarzanie_do");
  if (cyklDoIn.rodzaj === "blad") return zle(cyklDoIn.powod);
  if (cyklDoIn.rodzaj === "ustaw" && !isPlausibleDateString(cyklDoIn.wartosc)) {
    return zle("invalid powtarzanie_do");
  }

  const powiazania: { kolumna: "lead_id" | "project_id" | "client_id"; wartosc: string | null }[] = [];
  for (const kolumna of ["lead_id", "project_id", "client_id"] as const) {
    const wejscie = odczytajOpcjonalnyTekst(body, kolumna);
    if (wejscie.rodzaj === "brak") continue;
    if (wejscie.rodzaj === "blad") return zle(wejscie.powod);
    powiazania.push({ kolumna, wartosc: wejscie.rodzaj === "ustaw" ? wejscie.wartosc : null });
  }

  /* ── FAZA 2: reguły, które zależą od tego, co JEST w bazie ────────────── */

  const [obecny] = (await sql`
    SELECT data::text AS data, data_koniec::text AS data_koniec, powtarzanie
    FROM events WHERE id = ${id};
  `) as unknown as { data: string; data_koniec: string | null; powtarzanie: string | null }[];
  // Bez tego PATCH nieistniejącego wydarzenia wykonywał ciąg `UPDATE`-ów, które
  // nie trafiały w żaden wiersz, i odpowiadał `{"ok":true}` — cicha odmowa jest
  // w skutkach tym samym, co cicha podmiana.
  if (!obecny) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Stan PO tym patchu — reguły dotyczą wyniku, nie punktu wyjścia. Bez tego
  // `{"data":"2026-09-01","data_koniec":"2026-09-03"}` w jednym żądaniu
  // wywracałoby się na starej dacie początku.
  const dataPo = dataIn.rodzaj === "ustaw" ? dataIn.wartosc : obecny.data;
  const koniecPo =
    koniecIn.rodzaj === "ustaw" ? koniecIn.wartosc : koniecIn.rodzaj === "zdejmij" ? null : obecny.data_koniec;
  const cyklPo =
    cyklIn.rodzaj === "ustaw" ? cyklZnormalizowany : cyklIn.rodzaj === "zdejmij" ? null : obecny.powtarzanie;

  // Ten warunek stał dotąd WYŁĄCZNIE w POST, więc wydarzenie kończące się przed
  // swoim początkiem dało się zrobić edycją — i `expandEventDays()` cicho
  // sprowadzało je z powrotem do jednego dnia, czyli koniec po prostu znikał.
  if (koniecPo && koniecPo < dataPo) return zle("data_koniec must not be before data");

  // Dwie ODMOWY zamiast dwóch cichych no-opów. Warunek „tylko gdy jest cykl"
  // siedział w `WHERE` zapytania, więc `{"powtarzanie_do":"2026-12-31"}` na
  // wydarzeniu jednorazowym nie zmieniało nic, a trasa i tak mówiła „zapisano".
  if (cyklDoIn.rodzaj === "ustaw" && !cyklPo) return zle("powtarzanie_do requires powtarzanie");
  if (cyklDoIn.rodzaj === "ustaw" && cyklDoIn.wartosc < dataPo) {
    return zle("powtarzanie_do must not be before data");
  }

  // Powiązania sprawdzamy PRZED zapisem: nieistniejące id leciało wcześniej
  // prosto na klucz obcy i wracało jako gołe 500 w środku ciągu zapisów, czyli
  // z częścią pól już zmienioną. Cztery osobne zapytania zamiast jednego
  // z nazwą tabeli w zmiennej — `neon()` nie ma buildera, a wstawianie nazwy
  // tabeli stringiem to ta sama droga, co sklejanie SQL-a.
  for (const { kolumna, wartosc } of powiazania) {
    if (!wartosc) continue;
    const [jest] = (await (kolumna === "lead_id"
      ? sql`SELECT 1 AS x FROM leads WHERE id = ${wartosc};`
      : kolumna === "client_id"
        ? sql`SELECT 1 AS x FROM clients WHERE id = ${wartosc};`
        : sql`SELECT 1 AS x FROM projects WHERE id = ${wartosc};`)) as unknown as { x: number }[];
    if (!jest) return zle(`${kolumna} does not exist`);
  }

  /* ── FAZA 3: zapisy. Od tego miejsca nic już nie może oddać 400 ───────── */

  if (tytulIn.rodzaj === "ustaw") {
    await sql`UPDATE events SET tytul = ${tytulIn.wartosc} WHERE id = ${id};`;
  }
  if (opisIn.rodzaj !== "brak") {
    await sql`UPDATE events SET opis = ${opisIn.rodzaj === "ustaw" ? opisIn.wartosc : ""} WHERE id = ${id};`;
  }
  if (dataIn.rodzaj === "ustaw") {
    await sql`UPDATE events SET data = ${dataIn.wartosc} WHERE id = ${id};`;
  }
  if (godzinaIn.rodzaj !== "brak") {
    await sql`UPDATE events SET godzina = ${godzinaIn.rodzaj === "ustaw" ? godzinaIn.wartosc : null} WHERE id = ${id};`;
  }
  for (const { kolumna, wartosc } of powiazania) {
    await (kolumna === "lead_id"
      ? sql`UPDATE events SET lead_id = ${wartosc} WHERE id = ${id};`
      : kolumna === "client_id"
        ? sql`UPDATE events SET client_id = ${wartosc} WHERE id = ${id};`
        : sql`UPDATE events SET project_id = ${wartosc} WHERE id = ${id};`);
  }
  if (koniecIn.rodzaj !== "brak") {
    await sql`UPDATE events SET data_koniec = ${koniecIn.rodzaj === "ustaw" ? koniecIn.wartosc : null} WHERE id = ${id};`;
  }
  if (czasIn.rodzaj !== "brak") {
    await sql`UPDATE events SET czas_trwania_min = ${czasIn.rodzaj === "ustaw" ? czasIn.wartosc : null} WHERE id = ${id};`;
  }
  if (lokalizacjaIn.rodzaj !== "brak") {
    await sql`UPDATE events SET lokalizacja = ${lokalizacjaIn.rodzaj === "ustaw" ? lokalizacjaIn.wartosc : null} WHERE id = ${id};`;
  }
  if (alertIn.rodzaj !== "brak") {
    await sql`UPDATE events SET alert_minut_przed = ${alertIn.rodzaj === "ustaw" ? alertIn.wartosc : null} WHERE id = ${id};`;
  }
  if (cyklIn.rodzaj === "ustaw") {
    await sql`UPDATE events SET powtarzanie = ${cyklZnormalizowany} WHERE id = ${id};`;
  } else if (cyklIn.rodzaj === "zdejmij") {
    // Zdjęcie cyklu czyści też „do kiedy" i listę pominiętych wystąpień —
    // zostawione, wróciłyby przy ponownym włączeniu powtarzania jako dziury,
    // o których nikt już nie pamięta.
    await sql`UPDATE events SET powtarzanie = NULL, powtarzanie_do = NULL, powtarzanie_pominiete = NULL WHERE id = ${id};`;
  }
  if (cyklDoIn.rodzaj === "ustaw") {
    await sql`UPDATE events SET powtarzanie_do = ${cyklDoIn.wartosc} WHERE id = ${id};`;
  } else if (cyklDoIn.rodzaj === "zdejmij") {
    await sql`UPDATE events SET powtarzanie_do = NULL WHERE id = ${id};`;
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/events/:id — remove an event. Admin-only.
 *
 * Dla wydarzenia z serii `:id` jest syntetycznym id wystąpienia
 * (`<id-wzorca>~<data>`), a `?zakres=` mówi, co skasować:
 * - `seria` (domyślnie) — cały wiersz-wzorzec, czyli wszystkie wystąpienia,
 * - `okazja` — TYLKO to jedno wystąpienie: jego data dopisuje się do
 *   `powtarzanie_pominiete` i schodzi do `.ics` jako `EXDATE`.
 *
 * Zakres `okazja` bez daty wystąpienia w id nie ma czego pominąć, więc to
 * błąd 400, a nie ciche skasowanie całej serii. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { idWzorca, wystapienie } = rozbierzIdWystapienia((await params).id);
  const zakres = req.nextUrl.searchParams.get("zakres") === "okazja" ? "okazja" : "seria";
  await ensureHubSchema();
  const sql = getSql();

  if (zakres === "okazja") {
    if (!wystapienie) {
      return NextResponse.json({ error: "zakres=okazja requires an occurrence id" }, { status: 400 });
    }
    const rows = (await sql`
      SELECT powtarzanie_pominiete FROM events WHERE id = ${idWzorca};
    `) as unknown as { powtarzanie_pominiete: string | null }[];
    if (rows.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const pominiete = pominieteDoTekstu([...pominieteZTekstu(rows[0].powtarzanie_pominiete), wystapienie]);
    await sql`UPDATE events SET powtarzanie_pominiete = ${pominiete} WHERE id = ${idWzorca};`;
    return NextResponse.json({ ok: true, zakres });
  }

  // `RETURNING id` zamiast gołego `DELETE`: kasowanie nieistniejącego
  // wydarzenia odpowiadało `{"ok":true}`, więc druga karta z nieaktualną listą
  // dostawała potwierdzenie usunięcia czegoś, czego dawno nie ma (ten sam
  // wzorzec, co w trzech miejscach Notatnika).
  const usuniete = (await sql`
    DELETE FROM events WHERE id = ${idWzorca} RETURNING id;
  `) as unknown as { id: string }[];
  if (usuniete.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, zakres });
}
