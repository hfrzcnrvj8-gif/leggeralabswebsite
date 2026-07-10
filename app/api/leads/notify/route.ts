import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureLeadsSchema, ensureHubSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isOverdue, overdueReason, STATUSES, type Lead } from "@/lib/leads";
import { isProjectOverdue, type Project } from "@/lib/projects";
import type { HubEvent } from "@/lib/events";

export const runtime = "nodejs";
export const maxDuration = 30;

const NOTIFY_TO = "kontakt@leggeralabs.pl";

/** Dzienny raport ze wszystkich modułów panelu (leady + projekty +
 * dzisiejszy kalendarz), nie tylko z rejestru leadów — jeden mail spinający
 * całość, zamiast osobnych powiadomień per moduł. */
async function buildAndSendDigest(): Promise<{ overdue: number; total: number }> {
  await ensureLeadsSchema();
  await ensureHubSchema();
  const sql = getSql();
  const today = new Date().toISOString().slice(0, 10);

  const [leads, projects, todayEvents] = await Promise.all([
    sql`SELECT * FROM leads ORDER BY created_at DESC;` as unknown as Promise<Lead[]>,
    sql`SELECT * FROM projects ORDER BY created_at DESC;` as unknown as Promise<Project[]>,
    sql`SELECT * FROM events WHERE data = ${today} ORDER BY godzina ASC NULLS LAST;` as unknown as Promise<HubEvent[]>,
  ]);

  const overdueLeads = leads.filter(isOverdue);
  const dueProjects = projects.filter(isProjectOverdue);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length]));

  const leadLines = overdueLeads.length
    ? overdueLeads.map((l) => `- ${l.firma} — ${overdueReason(l)}`).join("\n")
    : "Brak leadów wymagających dziś działania.";

  const projectLines = dueProjects.length
    ? dueProjects.map((p) => `- ${p.tytul} — termin ${p.termin}`).join("\n")
    : "Brak projektów z minionym terminem.";

  const eventLines = todayEvents.length
    ? todayEvents.map((e) => `- ${e.godzina ? `${e.godzina} ` : ""}${e.tytul}`).join("\n")
    : "Brak wydarzeń w kalendarzu na dziś.";

  const summaryLines = STATUSES.map((s) => `  ${s}: ${counts[s] ?? 0}`).join("\n");
  const totalActionable = overdueLeads.length + dueProjects.length;

  const text = [
    "Dzień dobry,",
    "",
    "Dzienny przegląd panelu Leggera Labs:",
    "",
    `Leady wymagające działania dziś (${overdueLeads.length}):`,
    leadLines,
    "",
    `Projekty z minionym terminem (${dueProjects.length}):`,
    projectLines,
    "",
    `Dziś w kalendarzu (${todayEvents.length}):`,
    eventLines,
    "",
    "Podsumowanie leadów wg statusu:",
    summaryLines,
    "",
    `Łącznie: ${leads.length} leadów, ${projects.length} projektów.`,
    "",
    "— automatyczny raport z /admin",
  ].join("\n");

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Brak RESEND_API_KEY — dodaj klucz Resend w zmiennych środowiskowych, żeby raporty mogły się wysyłać."
    );
  }
  const from = process.env.RESEND_FROM || "Leggera Labs <onboarding@resend.dev>";
  const subject =
    totalActionable > 0
      ? `[Panel] ${totalActionable} ${totalActionable === 1 ? "sprawa wymaga" : "spraw wymaga"} dziś działania`
      : "[Panel] Dzienny raport — wszystko ogarnięte";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [NOTIFY_TO], subject, text }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Resend zwrócił błąd ${res.status}: ${errText.slice(0, 300)}`);
  }

  return { overdue: totalActionable, total: leads.length + projects.length };
}

/**
 * GET /api/leads/notify — wywoływane raz dziennie przez Vercel Cron (patrz
 * vercel.json). Jeśli ustawiono CRON_SECRET, żąda nagłówka
 * `Authorization: Bearer <CRON_SECRET>`, który Vercel dołącza automatycznie
 * do wywołań crona — chroni endpoint przed przypadkowym/obcym wywołaniem.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  try {
    const result = await buildAndSendDigest();
    return NextResponse.json({ ok: true, sent: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** POST /api/leads/notify — ręczne wysłanie raportu z panelu admina
 * (przycisk "Wyślij raport teraz"). Admin-only. */
export async function POST() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await buildAndSendDigest();
    return NextResponse.json({ ok: true, sent: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
