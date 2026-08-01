import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureRemindersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { isPlausibleTimeString, normalizePriority } from "@/lib/reminders";
import { normalizujCykl, pierwszeWystapienieOd } from "@/lib/recurrence";
import { todayLocalISO } from "@/lib/dates";

export const runtime = "nodejs";

/** Przesuwa termin powtarzalnego przypomnienia na kolejne wystąpienie zamiast
 * je gasić. Zwraca `false`, gdy nie ma czego przesuwać — bo przypomnienie nie
 * jest powtarzalne, nie ma terminu, albo seria właśnie się skończyła
 * (`powtarzanie_do` minęło). Wołający wykonuje wtedy zwykłe odhaczenie.
 *
 * Ostatnie wystąpienie serii MA się dać ukończyć na dobre — inaczej zadanie
 * z datą końca nigdy by nie zniknęło z listy, a to jest cichy sposób na to,
 * żeby lista zaczęła kłamać. */
async function przesunSerie(sql: ReturnType<typeof getSql>, id: string): Promise<boolean> {
  const rows = (await sql`
    SELECT termin::text AS termin, powtarzanie,
           powtarzanie_do::text AS powtarzanie_do, powtarzanie_od::text AS powtarzanie_od
    FROM reminders WHERE id = ${id};
  `) as unknown as {
    termin: string | null;
    powtarzanie: string | null;
    powtarzanie_do: string | null;
    powtarzanie_od: string | null;
  }[];
  const r = rows[0];
  if (!r?.termin) return false;
  const cykl = normalizujCykl(r.powtarzanie);
  if (!cykl) return false;

  // Rytm liczymy od KOTWICY, nie od bieżącego terminu — inaczej „co miesiąc
  // od 31." po jednym lutym przykleiłoby się do 28. na zawsze. Kotwicy może
  // brakować przy wierszach sprzed tej migracji; bieżący termin jest wtedy
  // najlepszym, co mamy.
  const kotwica = r.powtarzanie_od ?? r.termin;
  // Odhaczone wystąpienie to `termin`, więc szukamy PO nim — a jeśli zadanie
  // było zaległe, wracamy na najbliższy przyszły punkt rytmu, zamiast od razu
  // podstawiać kolejny przeterminowany dzień.
  const od = r.termin > todayLocalISO() ? r.termin : todayLocalISO();
  const nastepny = pierwszeWystapienieOd(
    { start: kotwica, cykl, doISO: r.powtarzanie_do, pominiete: [r.termin] },
    od
  );
  if (!nastepny) return false;

  await sql`
    UPDATE reminders
    SET termin = ${nastepny}, ukonczone = false, ukonczone_at = NULL
    WHERE id = ${id};
  `;
  return true;
}

/** GET /api/reminders/:id — jedno przypomnienie. Admin-only.
 *
 * Powstało dla ADRESU REKORDU (`/admin/reminders/<id>`, Moduł 59, paczka E):
 * do tej pory jedyną drogą do przypomnienia było kliknięcie w wiersz listy,
 * więc nie dało się go wkleić w rozmowę ani zapisać w zakładkach.
 *
 * Zwraca też podzadania — profil pokazuje je tak samo jak lista, a drugie
 * żądanie po nie byłoby zapytaniem więcej przy każdym wejściu (neon() = jedno
 * żądanie HTTP na zapytanie). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureRemindersSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT r.*, l.nazwa AS lista_nazwa, l.kolor AS lista_kolor
    FROM reminders r
    LEFT JOIN reminder_lists l ON l.id = r.lista_id
    WHERE r.id = ${id};
  `;
  const reminder = rows[0];
  if (!reminder) return NextResponse.json({ error: "not found" }, { status: 404 });
  const podzadania = await sql`
    SELECT r.*, l.nazwa AS lista_nazwa, l.kolor AS lista_kolor
    FROM reminders r
    LEFT JOIN reminder_lists l ON l.id = r.lista_id
    WHERE r.parent_id = ${id}
    ORDER BY r.ukonczone ASC, r.termin ASC NULLS LAST, r.created_at ASC;
  `;
  return NextResponse.json({ reminder: { ...reminder, podzadania } });
}

/** Wartość pola „opcjonalna data/tekst": brak, `null` i pusty string znaczą
 * ZDEJMIJ, string znaczy USTAW, a cokolwiek innego to pomyłka wołającego.
 *
 * Osobna funkcja, bo przed audytem Modułu 66 ten trzeci przypadek nie istniał:
 * `typeof raw === "string"` było jedynym warunkiem, więc `{"termin": 20260901}`
 * (liczba zamiast stringa — realny wynik pomyłki w kliencie) wpadało do gałęzi
 * „zdejmij" i **KASOWAŁO termin**, oddając `{"ok":true}`. W module, w którym
 * data uruchamia powiadomienie, cicha zamiana śmiecia na „nigdy" jest
 * najgorszą z możliwych podmian. */
type Opcjonalna = { rodzaj: "brak" } | { rodzaj: "zdejmij" } | { rodzaj: "ustaw"; wartosc: string } | { rodzaj: "blad" };

function odczytajOpcjonalna(body: Record<string, unknown>, pole: string): Opcjonalna {
  if (!(pole in body)) return { rodzaj: "brak" };
  const raw = body[pole];
  if (raw === null || raw === "") return { rodzaj: "zdejmij" };
  if (typeof raw !== "string") return { rodzaj: "blad" };
  const trimmed = raw.trim();
  return trimmed ? { rodzaj: "ustaw", wartosc: trimmed } : { rodzaj: "zdejmij" };
}

/** PATCH /api/reminders/:id — zmiana pól, pole po polu. Admin-only.
 *
 * Przebieg jest DWUFAZOWY: najpierw sprawdzamy komplet pól i stan rekordu,
 * dopiero potem zapisujemy. Wcześniej było odwrotnie — walidacja stała przy
 * każdym `UPDATE` z osobna, więc ciało `{"tytul":"PO","termin":"0202-01-01"}`
 * zapisywało tytuł, po czym oddawało 400. Panel pokazywał wtedy „Nie udało się
 * zapisać zmiany", a zmiana częściowo weszła — komunikat kłamał (zmierzone
 * sondą 2026-08-01). Neon nie daje transakcji w kliencie HTTP, więc atomowość
 * bierzemy stąd, że po pierwszym zapisie nie ma już czego odrzucić. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  await ensureRemindersSchema();
  const sql = getSql();

  const zle = (powod: string) => NextResponse.json({ error: powod }, { status: 400 });

  /* ── FAZA 1: kształt pól, bez oglądania się na bazę ───────────────────── */

  let tytul: string | null = null;
  if ("tytul" in body) {
    const v = typeof body.tytul === "string" ? body.tytul.trim() : "";
    if (!v) return zle("tytul must not be empty");
    tytul = v.slice(0, 300);
  }

  let notatka: string | null = null;
  if ("notatka" in body) {
    if (typeof body.notatka !== "string") return zle("notatka must be a string");
    notatka = body.notatka.slice(0, 2000);
  }

  const terminIn = odczytajOpcjonalna(body, "termin");
  if (terminIn.rodzaj === "blad") return zle("termin must be a date string or null");
  if (terminIn.rodzaj === "ustaw" && !isPlausibleDateString(terminIn.wartosc)) return zle("invalid termin");

  const godzinaIn = odczytajOpcjonalna(body, "godzina");
  if (godzinaIn.rodzaj === "blad") return zle("godzina must be a time string or null");
  if (godzinaIn.rodzaj === "ustaw" && !isPlausibleTimeString(godzinaIn.wartosc)) return zle("invalid godzina");

  // Priorytet spoza skali NIE jest przycinany. `normalizePriority` robił z „99"
  // trójkę, a ze stringa „wysoki" — ZERO, czyli „Brak": śmieć zamieniał się
  // w przeciwieństwo tego, co wołający miał na myśli, i to z `{"ok":true}`.
  let priorytet: number | null = null;
  if ("priorytet" in body) {
    const v = body.priorytet;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 3) return zle("invalid priorytet");
    priorytet = normalizePriority(v);
  }

  for (const flagowe of ["ukonczone", "flaga", "przy_wyjsciu"] as const) {
    if (flagowe in body && typeof body[flagowe] !== "boolean") return zle(`${flagowe} must be a boolean`);
  }

  // Nieznany cykl dostaje 400, ale `null`/`""` dalej znaczy „nie powtarza się".
  // `normalizujCykl` sam z siebie oddaje null na jedno i drugie, więc bez tego
  // rozróżnienia literówka w kluczu („co tydzień" zamiast `co_tydzien`) cicho
  // zapisywała przypomnienie BEZ powtarzania — złapane na własnej sondzie.
  const cyklIn = odczytajOpcjonalna(body, "powtarzanie");
  if (cyklIn.rodzaj === "blad") return zle("powtarzanie must be a string or null");
  if (cyklIn.rodzaj === "ustaw" && !normalizujCykl(cyklIn.wartosc)) return zle("invalid powtarzanie");

  const doIn = odczytajOpcjonalna(body, "powtarzanie_do");
  if (doIn.rodzaj === "blad") return zle("powtarzanie_do must be a date string or null");
  if (doIn.rodzaj === "ustaw" && !isPlausibleDateString(doIn.wartosc)) return zle("invalid powtarzanie_do");

  const rodzicIn = odczytajOpcjonalna(body, "parent_id");
  if (rodzicIn.rodzaj === "blad") return zle("parent_id must be an id or null");
  if (rodzicIn.rodzaj === "ustaw" && rodzicIn.wartosc === id) {
    return zle("reminder cannot be its own parent");
  }

  /* ── FAZA 2: reguły, które zależą od tego, co JEST w bazie ────────────── */

  const [obecny] = (await sql`
    SELECT termin::text AS termin, powtarzanie, parent_id FROM reminders WHERE id = ${id};
  `) as unknown as { termin: string | null; powtarzanie: string | null; parent_id: string | null }[];
  if (!obecny) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Stan PO tym patchu — reguły dotyczą wyniku, nie punktu wyjścia. Bez tego
  // `{"termin":"2026-09-01","godzina":"14:00"}` w jednym żądaniu wywracałoby
  // się na tym, że w chwili sprawdzania terminu jeszcze nie ma.
  const terminPo =
    terminIn.rodzaj === "ustaw" ? terminIn.wartosc : terminIn.rodzaj === "zdejmij" ? null : obecny.termin;
  const rodzicPo =
    rodzicIn.rodzaj === "ustaw" ? rodzicIn.wartosc : rodzicIn.rodzaj === "zdejmij" ? null : obecny.parent_id;
  const cyklPo =
    cyklIn.rodzaj === "ustaw"
      ? cyklIn.wartosc
      : cyklIn.rodzaj === "zdejmij" || terminIn.rodzaj === "zdejmij"
        ? null
        : obecny.powtarzanie;

  // Trzy ODMOWY zamiast trzech cichych no-opów. Do audytu Modułu 66 każdy
  // z tych warunków siedział w `WHERE` zapytania, więc zapytanie po prostu nie
  // zmieniało nic, a trasa i tak odpowiadała `{"ok":true}`: godzina 14:00
  // ustawiona na bezterminowym przepadała bez śladu, cykl na podzadaniu też.
  // Cicha odmowa jest w skutkach tym samym, co cicha podmiana — użytkownik
  // widzi „zapisano" i wierzy w stan, którego nie ma.
  if (godzinaIn.rodzaj === "ustaw" && !terminPo) return zle("godzina requires termin");
  if (cyklIn.rodzaj === "ustaw" && !terminPo) return zle("powtarzanie requires termin");
  if (cyklIn.rodzaj === "ustaw" && rodzicPo) return zle("powtarzanie not allowed on a subtask");
  if (doIn.rodzaj === "ustaw" && !cyklPo) return zle("powtarzanie_do requires powtarzanie");

  if (rodzicIn.rodzaj === "ustaw") {
    // Rodzic musi ISTNIEĆ i sam być pozycją najwyższego poziomu. Wcześniej
    // nieistniejące id leciało prosto na klucz obcy i wracało jako 500, a para
    // A→B / B→A zapisywała się bez mrugnięcia — po czym OBA zadania znikały
    // z listy, bo zagnieżdżanie w GET wpychało każde z nich w drugie i żadne
    // nie trafiało na najwyższy poziom. Dwa zadania parowały bez śladu
    // (zmierzone sondą 2026-08-01). Kroki są JEDNOPOZIOMOWE — wnuk i tak nigdy
    // by się nie narysował, bo lista rysuje jeden poziom wcięcia.
    const [kandydat] = (await sql`
      SELECT parent_id FROM reminders WHERE id = ${rodzicIn.wartosc};
    `) as unknown as { parent_id: string | null }[];
    if (!kandydat) return zle("parent_id does not exist");
    if (kandydat.parent_id) return zle("a subtask cannot have subtasks");
  }

  // Powiązania też sprawdzamy PRZED zapisem: nieistniejące id leciało wcześniej
  // prosto na klucz obcy i wracało jako 500 w środku ciągu zapisów, czyli
  // z częścią pól już zmienioną.
  const powiazania: { kolumna: "lista_id" | "lead_id" | "client_id" | "project_id"; wartosc: string | null }[] = [];
  for (const kolumna of ["lista_id", "lead_id", "client_id", "project_id"] as const) {
    const wejscie = odczytajOpcjonalna(body, kolumna);
    if (wejscie.rodzaj === "brak") continue;
    if (wejscie.rodzaj === "blad") return zle(`${kolumna} must be an id or null`);
    const wartosc = wejscie.rodzaj === "ustaw" ? wejscie.wartosc : null;
    if (wartosc) {
      // Cztery osobne zapytania zamiast jednego z nazwą tabeli w zmiennej:
      // `neon()` nie ma buildera, a wstawianie nazwy tabeli stringiem to ta
      // sama droga, co sklejanie SQL-a (patrz komentarz w GET /api/reminders).
      const [jest] = (await (kolumna === "lista_id"
        ? sql`SELECT 1 AS x FROM reminder_lists WHERE id = ${wartosc};`
        : kolumna === "lead_id"
          ? sql`SELECT 1 AS x FROM leads WHERE id = ${wartosc};`
          : kolumna === "client_id"
            ? sql`SELECT 1 AS x FROM clients WHERE id = ${wartosc};`
            : sql`SELECT 1 AS x FROM projects WHERE id = ${wartosc};`)) as unknown as { x: number }[];
      if (!jest) return zle(`${kolumna} does not exist`);
    }
    powiazania.push({ kolumna, wartosc });
  }

  /* ── FAZA 3: zapisy. Od tego miejsca nic już nie może oddać 400 ───────── */

  if (tytul !== null) await sql`UPDATE reminders SET tytul = ${tytul} WHERE id = ${id};`;
  if (notatka !== null) await sql`UPDATE reminders SET notatka = ${notatka} WHERE id = ${id};`;

  if (terminIn.rodzaj === "ustaw") {
    // Ręczna zmiana terminu PRZESTAWIA kotwicę serii — właściciel przesuwa
    // rytm, a nie jedno wystąpienie (pojedyncze wystąpienie przesuwa się
    // przez odhaczenie). Bez tego „co miesiąc" po przeniesieniu na inny
    // dzień dalej liczyłoby się od starej daty.
    await sql`
      UPDATE reminders
      SET termin = ${terminIn.wartosc},
          powtarzanie_od = CASE WHEN powtarzanie IS NULL THEN NULL ELSE ${terminIn.wartosc}::date END
      WHERE id = ${id};
    `;
  } else if (terminIn.rodzaj === "zdejmij") {
    // Zdjęcie terminu zabiera ze sobą godzinę — patrz komentarz w POST.
    // I cykl: powtarzanie odmierza się OD terminu, więc bez niego zostałaby
    // seria bez punktu zaczepienia.
    await sql`
      UPDATE reminders
      SET termin = NULL, godzina = NULL, powtarzanie = NULL, powtarzanie_do = NULL, powtarzanie_od = NULL
      WHERE id = ${id};
    `;
  }

  if (godzinaIn.rodzaj === "ustaw") {
    await sql`UPDATE reminders SET godzina = ${godzinaIn.wartosc} WHERE id = ${id};`;
  } else if (godzinaIn.rodzaj === "zdejmij") {
    await sql`UPDATE reminders SET godzina = NULL WHERE id = ${id};`;
  }

  if (priorytet !== null) await sql`UPDATE reminders SET priorytet = ${priorytet} WHERE id = ${id};`;

  if (cyklIn.rodzaj === "ustaw") {
    await sql`UPDATE reminders SET powtarzanie = ${cyklIn.wartosc}, powtarzanie_od = termin WHERE id = ${id};`;
  } else if (cyklIn.rodzaj === "zdejmij") {
    await sql`
      UPDATE reminders SET powtarzanie = NULL, powtarzanie_do = NULL, powtarzanie_od = NULL WHERE id = ${id};
    `;
  }

  if (doIn.rodzaj === "ustaw") {
    await sql`UPDATE reminders SET powtarzanie_do = ${doIn.wartosc} WHERE id = ${id};`;
  } else if (doIn.rodzaj === "zdejmij") {
    await sql`UPDATE reminders SET powtarzanie_do = NULL WHERE id = ${id};`;
  }

  if ("ukonczone" in body) {
    // `ukonczone_at` ustawia SERWER, nie klient — data odhaczenia ma być
    // faktem z jednego zegara, a nie tym, co pokazuje telefon.
    const value = body.ukonczone === true;

    // Odhaczenie POWTARZALNEGO przypomnienia zamyka WYSTĄPIENIE, nie serię
    // (decyzja właściciela z 2026-07-22, wzorzec Apple Reminders): „rozliczenie
    // z księgową zrobione na lipiec" ≠ „nigdy więcej się nie rozliczam".
    // Zamiast gasić zadanie, przesuwamy `termin` na kolejny cykl i zostawiamy
    // je nieukończone.
    //
    // Decyzja SERWERA, nie klienta — dokładnie tak jak `ukonczone_at`. Panel
    // i apka odhaczają tym samym PATCH-em co dotąd i obie dostają to samo
    // zachowanie, bez powielania reguły w dwóch językach.
    //
    // Przesuwamy od DZISIAJ, nie od starego terminu: zaległe comiesięczne
    // zadanie odhaczone po trzech miesiącach ma wrócić za miesiąc, a nie
    // wyskoczyć od razu z kolejnym zaległym terminem sprzed dwóch miesięcy.
    const przesuniete = value ? await przesunSerie(sql, id) : false;
    if (!przesuniete) {
      await sql`
        UPDATE reminders
        SET ukonczone = ${value}, ukonczone_at = ${value ? "now()" : null}::timestamptz
        WHERE id = ${id};
      `;
    }

    // Odhaczenie zadania odhacza jego KROKI (decyzja właściciela z 2026-08-01,
    // wzorzec Apple Reminders). Wcześniej kroki zostawały nieodhaczone, a że
    // rodzic znikał z listy, wyskakiwały na jej wierzch luzem — „Kupić farbę"
    // bez „Remontu biura" nad sobą wygląda jak zadanie, które wzięło się
    // znikąd. Zrobione na SERWERZE, żeby panel i apka nie musiały powtarzać
    // reguły w dwóch językach.
    //
    // W drugą stronę NIE kaskadujemy: cofnięcie odhaczenia rodzica nie ma
    // odhaczać kroków, które faktycznie są zrobione.
    //
    // Przy serii jest odwrotnie i celowo: kolejne wystąpienie to kolejny raz
    // TA SAMA robota, więc jego kroki wracają na start razem z terminem.
    if (value) {
      await sql`
        UPDATE reminders
        SET ukonczone = ${!przesuniete},
            ukonczone_at = ${przesuniete ? null : "now()"}::timestamptz
        WHERE parent_id = ${id};
      `;
    }
  }

  if ("flaga" in body) {
    await sql`UPDATE reminders SET flaga = ${body.flaga === true} WHERE id = ${id};`;
  }
  if ("przy_wyjsciu" in body) {
    await sql`UPDATE reminders SET przy_wyjsciu = ${body.przy_wyjsciu === true} WHERE id = ${id};`;
  }
  if (rodzicIn.rodzaj !== "brak") {
    await sql`UPDATE reminders SET parent_id = ${rodzicIn.rodzaj === "ustaw" ? rodzicIn.wartosc : null} WHERE id = ${id};`;
  }
  if ("lokalizacja" in body || "lokalizacja_lat" in body) {
    // Miejsce zapisuje się w KOMPLECIE albo wcale: nazwa bez współrzędnych to
    // notatka, a współrzędne bez nazwy to liczby, których nikt nie przeczyta.
    // Ustawianie ich osobnymi PATCH-ami dawałoby stany pośrednie, w których
    // apka nie wie, czy ma pilnować obszaru.
    const nazwa = typeof body.lokalizacja === "string" && body.lokalizacja.trim()
      ? body.lokalizacja.trim().slice(0, 300)
      : null;
    const liczba = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const lat = liczba(body.lokalizacja_lat);
    const lon = liczba(body.lokalizacja_lon);
    const promien = liczba(body.lokalizacja_promien);
    await sql`
      UPDATE reminders
      SET lokalizacja = ${nazwa},
          lokalizacja_lat = ${nazwa ? lat : null},
          lokalizacja_lon = ${nazwa ? lon : null},
          lokalizacja_promien = ${nazwa && promien !== null ? Math.max(50, Math.min(10000, Math.round(promien))) : null}
      WHERE id = ${id};
    `;
  }
  for (const { kolumna, wartosc } of powiazania) {
    if (kolumna === "lista_id") {
      await sql`UPDATE reminders SET lista_id = ${wartosc} WHERE id = ${id};`;
    } else if (kolumna === "lead_id") {
      await sql`UPDATE reminders SET lead_id = ${wartosc} WHERE id = ${id};`;
    } else if (kolumna === "client_id") {
      await sql`UPDATE reminders SET client_id = ${wartosc} WHERE id = ${id};`;
    } else {
      await sql`UPDATE reminders SET project_id = ${wartosc} WHERE id = ${id};`;
    }
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/reminders/:id — usuwa przypomnienie. Admin-only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureRemindersSchema();
  const sql = getSql();
  await sql`DELETE FROM reminders WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
