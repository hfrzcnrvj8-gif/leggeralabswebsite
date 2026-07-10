import { NextResponse } from "next/server";
import { getSql, ensureLeadsSchema, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isOverdue, type Lead } from "@/lib/leads";
import { isProjectOverdue, type Project } from "@/lib/projects";
import type { HubEvent } from "@/lib/events";
import type { Note } from "@/lib/notes";

export const runtime = "nodejs";

/** GET /api/hub/today — agreguje dane z leadów, projektów, kalendarza i
 * notatnika w jeden widok "co dziś" dla pulpitu. Admin-only. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureLeadsSchema();
  await ensureHubSchema();
  const sql = getSql();

  const today = new Date().toISOString().slice(0, 10);

  const [leads, projects, todayEvents, recentNotes] = await Promise.all([
    sql`SELECT * FROM leads;` as unknown as Promise<Lead[]>,
    sql`SELECT * FROM projects;` as unknown as Promise<Project[]>,
    sql`SELECT * FROM events WHERE data = ${today} ORDER BY godzina ASC NULLS LAST;` as unknown as Promise<HubEvent[]>,
    sql`SELECT * FROM notes ORDER BY updated_at DESC LIMIT 5;` as unknown as Promise<Note[]>,
  ]);

  const overdueLeads = leads.filter(isOverdue);
  const dueProjects = projects.filter(isProjectOverdue);

  return NextResponse.json({
    overdueLeads,
    dueProjects,
    todayEvents,
    recentNotes,
    counts: {
      leads: leads.length,
      projects: projects.length,
    },
  });
}
