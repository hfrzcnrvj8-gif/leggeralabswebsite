import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureRemindersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";
import { isPlausibleTimeString, normalizePriority } from "@/lib/reminders";

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
  const rows = await sql`
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
             r.termin ASC NULLS LAST,
             r.priorytet DESC,
             r.created_at ASC;
  `;
  return NextResponse.json({ reminders: rows });
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

  // Termin jest OPCJONALNY (to odróżnia przypomnienie od wydarzenia), ale
  // jeśli jest — musi przejść tę samą walidację co każda data w panelu
  // (pułapka „0202" z `<input type="date">`, patrz CLAUDE.md).
  const terminRaw = typeof body?.termin === "string" ? body.termin.trim() : "";
  if (terminRaw && !isPlausibleDateString(terminRaw)) {
    return NextResponse.json({ error: "invalid termin" }, { status: 400 });
  }
  const godzinaRaw = typeof body?.godzina === "string" ? body.godzina.trim() : "";
  if (godzinaRaw && !isPlausibleTimeString(godzinaRaw)) {
    return NextResponse.json({ error: "invalid godzina" }, { status: 400 });
  }
  // Godzina bez terminu nie znaczy nic — nie zapisujemy jej po cichu, bo
  // wróciłaby jako „przypomnienie na 14:00 nigdy".
  const termin = terminRaw || null;
  const godzina = termin ? godzinaRaw || null : null;

  await ensureRemindersSchema();
  const sql = getSql();

  const id = randomUUID();
  const notatka = typeof body?.notatka === "string" ? body.notatka.slice(0, 2000) : "";
  const priorytet = normalizePriority(body?.priorytet);
  const idOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

  await sql`
    INSERT INTO reminders (id, tytul, notatka, termin, godzina, priorytet, lista_id, lead_id, client_id, project_id)
    VALUES (${id}, ${tytul.slice(0, 300)}, ${notatka}, ${termin}, ${godzina}, ${priorytet},
            ${idOrNull(body?.lista_id)}, ${idOrNull(body?.lead_id)}, ${idOrNull(body?.client_id)}, ${idOrNull(body?.project_id)});
  `;

  return NextResponse.json({ ok: true, id });
}
