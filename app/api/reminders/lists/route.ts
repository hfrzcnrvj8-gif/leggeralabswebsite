import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureRemindersSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { DEFAULT_LIST_COLOR, isReminderListColor } from "@/lib/reminders";

export const runtime = "nodejs";

/** GET /api/reminders/lists — listy właściciela wraz z licznikiem tego, co na
 * nich jeszcze wisi. Licznik liczy SERWER: gdyby liczyła apka, musiałaby
 * ściągnąć wszystkie przypomnienia tylko po to, żeby narysować cyfrę. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureRemindersSchema();
  const sql = getSql();

  const rows = await sql`
    SELECT l.*, COUNT(r.id) FILTER (WHERE r.ukonczone = false) AS liczba_nieukonczonych
    FROM reminder_lists l
    LEFT JOIN reminders r ON r.lista_id = l.id
    GROUP BY l.id
    ORDER BY l.kolejnosc ASC, l.created_at ASC;
  `;

  // COUNT wraca z Postgresa jako string (bigint) — apka i panel chcą liczby.
  const lists = (rows as unknown as Record<string, unknown>[]).map((r) => ({
    ...r,
    liczba_nieukonczonych: Number(r.liczba_nieukonczonych ?? 0),
  }));

  // Ile przypomnień siedzi POZA listami — „Bez listy" jest pozycją w UI,
  // ale nie wierszem w tabeli, więc licznik musi przyjść osobno.
  const [bezListy] = (await sql`
    SELECT COUNT(*) AS ile FROM reminders WHERE lista_id IS NULL AND ukonczone = false;
  `) as unknown as { ile: string }[];

  return NextResponse.json({ lists, bez_listy: Number(bezListy?.ile ?? 0) });
}

/** POST /api/reminders/lists — nowa lista. Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const nazwa = typeof body?.nazwa === "string" ? body.nazwa.trim() : "";
  if (!nazwa) {
    return NextResponse.json({ error: "nazwa is required" }, { status: 400 });
  }
  const kolor = isReminderListColor(body?.kolor) ? body.kolor : DEFAULT_LIST_COLOR;

  await ensureRemindersSchema();
  const sql = getSql();

  // Nowa lista ląduje na końcu — kolejność jest ręczna, więc nie ma powodu
  // przestawiać istniejących.
  const [max] = (await sql`SELECT COALESCE(MAX(kolejnosc), -1) AS m FROM reminder_lists;`) as unknown as {
    m: number;
  }[];
  const id = randomUUID();
  await sql`
    INSERT INTO reminder_lists (id, nazwa, kolor, kolejnosc)
    VALUES (${id}, ${nazwa.slice(0, 120)}, ${kolor}, ${Number(max?.m ?? -1) + 1});
  `;

  return NextResponse.json({ ok: true, id });
}
