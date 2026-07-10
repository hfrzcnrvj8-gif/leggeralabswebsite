import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureLeadsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isOverdue, overdueReason, STATUSES, type Lead } from "@/lib/leads";

export const runtime = "nodejs";
export const maxDuration = 30;

const NOTIFY_TO = "kontakt@leggeralabs.pl";

async function buildAndSendDigest(): Promise<{ overdue: number; total: number }> {
  await ensureLeadsSchema();
  const sql = getSql();
  const leads = (await sql`SELECT * FROM leads ORDER BY created_at DESC;`) as unknown as Lead[];

  const overdue = leads.filter(isOverdue);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length]));

  const overdueLines = overdue.length
    ? overdue.map((l) => `- ${l.firma} — ${overdueReason(l)}`).join("\n")
    : "Brak leadów wymagających dziś działania.";

  const summaryLines = STATUSES.map((s) => `  ${s}: ${counts[s] ?? 0}`).join("\n");

  const text = [
    "Dzień dobry,",
    "",
    "Dzienny przegląd rejestru leadów Leggera Labs:",
    "",
    `Wymaga działania dziś (${overdue.length}):`,
    overdueLines,
    "",
    "Podsumowanie wg statusu:",
    summaryLines,
    "",
    `Łącznie w rejestrze: ${leads.length} leadów.`,
    "",
    "— automatyczny raport z /admin/leads",
  ].join("\n");

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Brak RESEND_API_KEY — dodaj klucz Resend w zmiennych środowiskowych, żeby raporty mogły się wysyłać."
    );
  }
  const from = process.env.RESEND_FROM || "Leggera Labs <onboarding@resend.dev>";
  const subject =
    overdue.length > 0
      ? `[Leady] ${overdue.length} ${overdue.length === 1 ? "sprawa wymaga" : "spraw wymaga"} dziś działania`
      : "[Leady] Dzienny raport — wszystko ogarnięte";

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

  return { overdue: overdue.length, total: leads.length };
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
