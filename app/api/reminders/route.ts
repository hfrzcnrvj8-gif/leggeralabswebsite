import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureRemindersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { isPlausibleTimeString, normalizePriority, type Reminder } from "@/lib/reminders";
import { normalizujCykl } from "@/lib/recurrence";

export const runtime = "nodejs";

/** GET /api/reminders — lista przypomnień. Admin-only.
 *
 * Parametry (wszystkie opcjonalne, łączą się przez AND):
 * - `lista`   — id listy; `brak` = przypomnienia bez listy
 * - `month`   — `YYYY-MM`, tylko z terminem w tym miesiącu (Kalendarz)
 * - `dzien`   — `YYYY-MM-DD`, tylko na ten dzień
 * - `ukonczone` — `1` dołącza ukończone (domyślnie WYŁĄCZONE: lista ma
 *   pokazywać to, co jeszcze wisi; odhaczone są dostępne na żądanie)
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureRemindersSchema();
  const sql = getSql();

  const q = req.nextUrl.searchParams;
  const lista = q.get("lista");
  const month = q.get("month");
  const dzien = q.get("dzien");
  const zUkonczonymi = q.get("ukonczone") === "1";

  const monthPrefix = month && /^\d{4}-\d{2}$/.test(month) ? month : null;
  const dzienISO = dzien && isPlausibleDateString(dzien) ? dzien : null;

  // Jedno zapytanie z warunkami „parametr pusty = brak filtra" zamiast
  // sklejania SQL-a stringami — neon() nie ma buildera, a sklejanie to
  // wektor na wstrzyknięcie.
  const rows = (await sql`
    SELECT r.*, l.nazwa AS lista_nazwa, l.kolor AS lista_kolor
    FROM reminders r
    LEFT JOIN reminder_lists l ON l.id = r.lista_id
    WHERE (${zUkonczonymi}::boolean OR r.ukonczone = false)
      AND (${lista === null}::boolean
           OR (${lista === "brak"}::boolean AND r.lista_id IS NULL)
           OR r.lista_id = ${lista === "brak" ? null : lista})
      AND (${monthPrefix}::text IS NULL OR to_char(r.termin, 'YYYY-MM') = ${monthPrefix})
      AND (${dzienISO}::text IS NULL OR r.termin = ${dzienISO}::date)
    ORDER BY r.ukonczone ASC,
             r.flaga DESC,
             r.termin ASC NULLS LAST,
             r.priorytet DESC,
             r.created_at ASC;
  `) as unknown as Reminder[];

  // Podzadania wracają ZAGNIEŻDŻONE w rodzicu, nie jako osobne wiersze listy.
  // Płaska lista pokazywałaby „Kupić farbę" obok „Remont" bez żadnego związku,
  // a filtr po liście/terminie i tak dotyczy rodzica.
  //
  // Podzadanie, którego rodzic nie przeszedł filtra (np. rodzic ukończony,
  // a filtr pomija ukończone), NIE jest gubione — ląduje na najwyższym
  // poziomie. Ciche zniknięcie zadania jest gorsze niż zadanie bez wcięcia.
  //
  // Zagnieżdżamy DOKŁADNIE JEDEN poziom: wcięcie dostaje tylko to, czyj rodzic
  // sam stoi na wierzchu. Dwa powody, oba zmierzone przy audycie Modułu 66:
  // lista i tak rysuje jedno wcięcie, więc „wnuk" nigdy nie trafiał na ekran;
  // a para A→B / B→A (zapisywalna do tego audytu) wpychała każde zadanie
  // w drugie i ŻADNE nie trafiało na najwyższy poziom — dwa zadania znikały
  // z listy bez śladu. Trasa zapisu takiej pary już nie przyjmie, ale odczyt
  // musi być odporny na to, co siedzi w bazie od wcześniej.
  const wgID = new Map(rows.map((r) => [r.id, r]));
  const najwyzsze: Reminder[] = [];
  for (const r of rows) {
    const rodzic = r.parent_id ? wgID.get(r.parent_id) : null;
    if (rodzic && !rodzic.parent_id) {
      (rodzic.podzadania ??= []).push(r);
    } else {
      najwyzsze.push(r);
    }
  }
  return NextResponse.json({ reminders: najwyzsze });
}

/** POST /api/reminders — nowe przypomnienie. Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const tytul = typeof body?.tytul === "string" ? body.tytul.trim() : "";
  if (!tytul) {
    return NextResponse.json({ error: "tytul is required" }, { status: 400 });
  }

  const zle = (powod: string) => NextResponse.json({ error: powod }, { status: 400 });

  // Wartość „opcjonalna": brak / `null` / `""` znaczy PUSTO, string znaczy
  // wartość, a inny typ to pomyłka wołającego — nie cichy powrót do pustego.
  // Bliźniak `odczytajOpcjonalna()` z `[id]/route.ts`; powód rozdzielenia tych
  // trzech przypadków opisany tam.
  const opcjonalna = (pole: string): { ok: true; wartosc: string | null } | { ok: false } => {
    const raw = (body as Record<string, unknown>)?.[pole];
    if (raw === undefined || raw === null || raw === "") return { ok: true, wartosc: null };
    if (typeof raw !== "string") return { ok: false };
    const trimmed = raw.trim();
    return { ok: true, wartosc: trimmed || null };
  };

  // Termin jest OPCJONALNY (to odróżnia przypomnienie od wydarzenia), ale
  // jeśli jest — musi przejść tę samą walidację co każda data w panelu
  // (pułapka „0202" z `<input type="date">`, patrz CLAUDE.md).
  const terminIn = opcjonalna("termin");
  if (!terminIn.ok) return zle("termin must be a date string or null");
  if (terminIn.wartosc && !isPlausibleDateString(terminIn.wartosc)) return zle("invalid termin");
  const termin = terminIn.wartosc;

  const godzinaIn = opcjonalna("godzina");
  if (!godzinaIn.ok) return zle("godzina must be a time string or null");
  if (godzinaIn.wartosc && !isPlausibleTimeString(godzinaIn.wartosc)) return zle("invalid godzina");
  // Godzina bez terminu nie znaczy nic — i do audytu Modułu 66 znikała tu po
  // cichu, razem z `{"ok":true}`. Teraz jest odmowa z powodem: „14:00 nigdy"
  // to pomyłka, o której wołający ma się dowiedzieć.
  if (godzinaIn.wartosc && !termin) return zle("godzina requires termin");
  const godzina = godzinaIn.wartosc;

  if ("notatka" in (body ?? {}) && typeof body?.notatka !== "string") return zle("notatka must be a string");
  const notatka = typeof body?.notatka === "string" ? body.notatka.slice(0, 2000) : "";

  // Priorytet spoza skali 0–3 NIE jest przycinany — patrz `[id]/route.ts`.
  if ("priorytet" in (body ?? {})) {
    const v = body?.priorytet;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 3) return zle("invalid priorytet");
  }
  const priorytet = normalizePriority(body?.priorytet);

  await ensureRemindersSchema();
  const sql = getSql();

  const id = randomUUID();
  const idOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

  // Rodzic musi ISTNIEĆ i sam być pozycją najwyższego poziomu. Wcześniej
  // nieistniejące id leciało prosto na klucz obcy i wracało jako **500**;
  // odpowiedź „coś się popsuło" na dane, o których wiadomo dokładnie, co jest
  // z nimi nie tak.
  const rodzic = idOrNull(body?.parent_id);
  if (rodzic) {
    const [kandydat] = (await sql`
      SELECT parent_id FROM reminders WHERE id = ${rodzic};
    `) as unknown as { parent_id: string | null }[];
    if (!kandydat) return zle("parent_id does not exist");
    if (kandydat.parent_id) return zle("a subtask cannot have subtasks");
  }

  // Geofence tylko z KOMPLETEM współrzędnych. Sama nazwa miejsca zapisuje się
  // jako notatka „gdzie", ale nie obiecuje powiadomienia — patrz `maGeofence()`.
  const liczba = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const lat = liczba(body?.lokalizacja_lat);
  const lon = liczba(body?.lokalizacja_lon);
  const promien = liczba(body?.lokalizacja_promien);

  // Cykl — ten sam słownik, co w Kalendarzu (`lib/recurrence.ts`). Bez terminu
  // nie zapisuje się wcale: powtarzanie odmierza się OD terminu, więc
  // „co tydzień, począwszy od nigdy" nie znaczy nic — dokładnie ta sama
  // zasada, co przy godzinie bez terminu wyżej. Kroki (`parent_id`) też cyklu
  // nie dostają: powtarza się całe zadanie, nie pojedynczy krok w środku.
  //
  // Nieznany klucz cyklu to 400, nie ciche „bez powtarzania": `normalizujCykl`
  // zwraca null i na `""`, i na literówkę („co tydzień" zamiast `co_tydzien`),
  // więc bez tego rozróżnienia pomyłka w kliencie dawała zadanie, które
  // wygląda na cykliczne, a nigdy nie wróci. Złapane własną sondą 2026-08-01.
  const cyklIn = opcjonalna("powtarzanie");
  if (!cyklIn.ok) return zle("powtarzanie must be a string or null");
  if (cyklIn.wartosc && !normalizujCykl(cyklIn.wartosc)) return zle("invalid powtarzanie");
  if (cyklIn.wartosc && !termin) return zle("powtarzanie requires termin");
  if (cyklIn.wartosc && rodzic) return zle("powtarzanie not allowed on a subtask");
  const powtarzanie = cyklIn.wartosc ? normalizujCykl(cyklIn.wartosc) : null;

  const doIn = opcjonalna("powtarzanie_do");
  if (!doIn.ok) return zle("powtarzanie_do must be a date string or null");
  if (doIn.wartosc && !isPlausibleDateString(doIn.wartosc)) return zle("invalid powtarzanie_do");
  if (doIn.wartosc && !powtarzanie) return zle("powtarzanie_do requires powtarzanie");
  const powtarzanieDo = doIn.wartosc;

  // Powiązania — ta sama zasada, co przy rodzicu: nieistniejące id ma wrócić
  // jako 400 z nazwą pola, a nie jako 500 z klucza obcego.
  const listaId = idOrNull(body?.lista_id);
  const leadId = idOrNull(body?.lead_id);
  const clientId = idOrNull(body?.client_id);
  const projectId = idOrNull(body?.project_id);
  if (listaId) {
    const [jest] = (await sql`SELECT 1 AS x FROM reminder_lists WHERE id = ${listaId};`) as unknown as { x: number }[];
    if (!jest) return zle("lista_id does not exist");
  }
  if (leadId) {
    const [jest] = (await sql`SELECT 1 AS x FROM leads WHERE id = ${leadId};`) as unknown as { x: number }[];
    if (!jest) return zle("lead_id does not exist");
  }
  if (clientId) {
    const [jest] = (await sql`SELECT 1 AS x FROM clients WHERE id = ${clientId};`) as unknown as { x: number }[];
    if (!jest) return zle("client_id does not exist");
  }
  if (projectId) {
    const [jest] = (await sql`SELECT 1 AS x FROM projects WHERE id = ${projectId};`) as unknown as { x: number }[];
    if (!jest) return zle("project_id does not exist");
  }

  await sql`
    INSERT INTO reminders (id, tytul, notatka, termin, godzina, priorytet, lista_id, lead_id, client_id, project_id,
                           flaga, parent_id, lokalizacja, lokalizacja_lat, lokalizacja_lon, lokalizacja_promien, przy_wyjsciu,
                           powtarzanie, powtarzanie_do, powtarzanie_od)
    VALUES (${id}, ${tytul.slice(0, 300)}, ${notatka}, ${termin}, ${godzina}, ${priorytet},
            ${listaId}, ${leadId}, ${clientId}, ${projectId},
            ${body?.flaga === true}, ${rodzic},
            ${typeof body?.lokalizacja === "string" && body.lokalizacja.trim() ? body.lokalizacja.trim().slice(0, 300) : null},
            ${lat}, ${lon},
            ${promien !== null ? Math.max(50, Math.min(10000, Math.round(promien))) : null},
            ${body?.przy_wyjsciu === true},
            ${powtarzanie}, ${powtarzanieDo}, ${powtarzanie ? termin : null});
  `;

  return NextResponse.json({ ok: true, id });
}
