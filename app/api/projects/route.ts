import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import {
  getProjectTemplate,
  expandProjectTemplate,
  DEFAULT_ONBOARDING_ITEMS,
  isProjectStatus,
  isProjectPriority,
  isPlausibleDateString,
  PROJECT_STATUSES,
  PROJECT_PRIORITIES,
} from "@/lib/projects";

export const runtime = "nodejs";

/** Górny limit tego, ile projektów trasa odda naraz — ten sam wzorzec co przy
 * klientach (Moduł 54, krok 3a) i ofertach: sufit z GŁOŚNYM ostrzeżeniem
 * zamiast przedwczesnego stronicowania.
 *
 * Trasa świadomie NIE jest stronicowana z tego samego powodu co oferty: kanban
 * układa kolumny, oś czasu rysuje pasma, a licznik postępu sumuje zadania —
 * wszystko po stronie przeglądarki i wszystko o CAŁYM rejestrze, nie o jednej
 * stronie. Przy Projektach dochodzi jednak trzeci konsument, którego oferty nie
 * mają: **apka filtruje i sortuje lokalnie**, więc obcięta lista kłamałaby też
 * w szukaniu — telefon pokazywałby „nie znaleziono" na projekt, który istnieje.
 * Dlatego `total` leci również do apki, a nie tylko do panelu. */
const PROJECTS_LIMIT = 1000;

/** GET /api/projects — lista projektów z licznikiem zadań. Admin-only.
 * Zwraca `{ projects, total }` — patrz PROJECTS_LIMIT. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureHubSchema();
  const sql = getSql();
  // `COUNT(*) OVER ()` liczy się PRZED `LIMIT`, więc `total` to pełny rozmiar
  // rejestru, a nie długość zwróconej strony (jedno zapytanie zamiast dwóch —
  // neon() płaci rundę HTTP za każde).
  const rows = (await sql`
    SELECT p.*,
      COALESCE(t.total, 0)::int AS task_total,
      COALESCE(t.done, 0)::int AS task_done,
      COUNT(*) OVER () AS _total
    FROM projects p
    LEFT JOIN (
      SELECT project_id, COUNT(*) AS total, COUNT(*) FILTER (WHERE done) AS done
      FROM project_tasks GROUP BY project_id
    ) t ON t.project_id = p.id
    ORDER BY p.created_at DESC
    LIMIT ${PROJECTS_LIMIT};
  `) as unknown as Record<string, unknown>[];

  const total = rows.length > 0 ? Number(rows[0]._total) : 0;
  const projects = rows.map(({ _total, ...p }) => p);
  return NextResponse.json({ projects, total });
}

/** POST /api/projects — create a project. Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const tytul = typeof body?.tytul === "string" ? body.tytul.trim() : "";
  if (!tytul) {
    return NextResponse.json({ error: "tytul is required" }, { status: 400 });
  }

  await ensureHubSchema();
  const sql = getSql();

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const id = randomUUID();

  // Słownik na WEJŚCIU, nie tylko przy edycji (audyt 2026-07-31) — sonda
  // założyła tą trasą projekt ze statusem „CAŁKOWITA_BZDURA" i dostała 200.
  // Projekt zakładany z literówką w statusie wypada od razu z kanbanu, filtra
  // i koloru pigułki, a nikt tego nie zauważa, bo trasa nie protestuje.
  const status = str(body?.status, 100).trim() || "Pomysł";
  if (!isProjectStatus(status)) {
    return NextResponse.json(
      { error: `Nieznany status projektu. Dozwolone: ${PROJECT_STATUSES.join(", ")}.` },
      { status: 400 }
    );
  }
  const priorytet = str(body?.priorytet, 50).trim() || "Normalny";
  if (!isProjectPriority(priorytet)) {
    return NextResponse.json(
      { error: `Nieznany priorytet. Dozwolone: ${PROJECT_PRIORITIES.join(", ")}.` },
      { status: 400 }
    );
  }
  const leadId = typeof body?.lead_id === "string" && body.lead_id.trim() ? body.lead_id : null;

  // Szablon: rozwijamy kamienie milowe + zadania po stronie serwera (atomowo,
  // jednym żądaniem zamiast wielu z klienta). Start = dziś, termin = ostatni
  // kamień; daty kamieni = dziś + dayOffset. Opis i tytuł mogą wejść z szablonu.
  const template = typeof body?.template === "string" ? getProjectTemplate(body.template) : undefined;
  let opis = str(body?.opis, 4000);
  let start: string | null = null;
  // Termin przez `isPlausibleDateString` — tak jak w PATCH i w kamieniach
  // milowych. Zakładanie projektu było ostatnią drogą, którą `<input
  // type="date">` mógł wpuścić rok „0202" (znana pułapka, CLAUDE.md).
  const terminRaw = typeof body?.termin === "string" ? body.termin.trim() : "";
  if (terminRaw && !isPlausibleDateString(terminRaw)) {
    return NextResponse.json({ error: "invalid termin" }, { status: 400 });
  }
  let termin: string | null = terminRaw || null;

  let milestones: { nazwa: string; termin: string; tasks: string[] }[] = [];
  if (template) {
    const exp = expandProjectTemplate(template);
    if (!opis) opis = exp.opis;
    start = exp.start;
    termin = exp.termin;
    milestones = exp.milestones;
  }

  await sql`
    INSERT INTO projects (id, tytul, opis, status, priorytet, start, termin, lead_id)
    VALUES (${id}, ${tytul.slice(0, 300)}, ${opis}, ${status}, ${priorytet}, ${start}, ${termin}, ${leadId});
  `;

  let mPos = 0;
  for (const m of milestones) {
    const milestoneId = randomUUID();
    await sql`
      INSERT INTO project_milestones (id, project_id, nazwa, termin, position)
      VALUES (${milestoneId}, ${id}, ${m.nazwa.slice(0, 200)}, ${m.termin}, ${mPos});
    `;
    let tPos = 0;
    for (const taskText of m.tasks) {
      await sql`
        INSERT INTO project_tasks (id, project_id, text, position, milestone_id)
        VALUES (${randomUUID()}, ${id}, ${taskText.slice(0, 1000)}, ${tPos}, ${milestoneId});
      `;
      tPos += 1;
    }
    mPos += 1;
  }

  // Domyślna checklista onboardingowa (Moduł 14) — wsiewana od razu, dowolnie
  // edytowalna później w ProjectDetailPanel.
  let oPos = 0;
  for (const tekst of DEFAULT_ONBOARDING_ITEMS) {
    await sql`
      INSERT INTO project_onboarding_items (id, project_id, tekst, position)
      VALUES (${randomUUID()}, ${id}, ${tekst}, ${oPos});
    `;
    oPos += 1;
  }

  return NextResponse.json({ ok: true, id });
}
