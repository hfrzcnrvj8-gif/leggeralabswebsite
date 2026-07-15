import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureMailSchema, ensureHubSchema } from "@/lib/db";
import type { MailMessage } from "@/lib/mail";

export const runtime = "nodejs";

/**
 * GET /api/mail/[id]/to-task — projekty, do których można wrzucić zadanie z
 * tej wiadomości (projekty klienta, do którego mail jest przypisany).
 * Świadomie bez zgadywania "właściwego" projektu — właściciel wybiera z listy.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  await ensureMailSchema();
  await ensureHubSchema();
  const sql = getSql();

  const rows = (await sql`SELECT client_id FROM mail_messages WHERE id = ${id};`) as unknown as { client_id: string | null }[];
  const mail = rows[0];
  if (!mail) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!mail.client_id) return NextResponse.json({ projects: [] });

  const projects = await sql`
    SELECT id, tytul, status FROM projects
    WHERE client_id = ${mail.client_id}
    ORDER BY created_at DESC;
  `;
  return NextResponse.json({ projects });
}

/**
 * POST /api/mail/[id]/to-task — "Z maila → zadanie" (warstwa 2 z briefu).
 *
 * Prośba "zmieńcie X" staje się konkretnym zadaniem w projekcie. Treść
 * zadania podaje WŁAŚCICIEL (domyślnie podpowiadamy temat maila) — model
 * niczego tu nie wnioskuje z treści, zgodnie z zasadą modułu: to Ty
 * decydujesz kliknięciem.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as { project_id?: unknown; text?: unknown } | null;
  const projectId = typeof body?.project_id === "string" ? body.project_id.trim() : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!projectId) return NextResponse.json({ error: "Wybierz projekt, do którego ma trafić zadanie." }, { status: 400 });
  if (!text) return NextResponse.json({ error: "Treść zadania nie może być pusta." }, { status: 400 });

  await ensureMailSchema();
  await ensureHubSchema();
  const sql = getSql();

  const rows = (await sql`SELECT * FROM mail_messages WHERE id = ${id};`) as unknown as MailMessage[];
  const mail = rows[0];
  if (!mail) return NextResponse.json({ error: "not found" }, { status: 404 });

  const projectRows = (await sql`SELECT id FROM projects WHERE id = ${projectId};`) as unknown as { id: string }[];
  if (projectRows.length === 0) return NextResponse.json({ error: "Taki projekt nie istnieje." }, { status: 400 });

  const countRows = await sql`SELECT COUNT(*)::int AS n FROM project_tasks WHERE project_id = ${projectId};`;
  const position = (countRows[0]?.n as number | undefined) ?? 0;

  const taskId = randomUUID();
  await sql`
    INSERT INTO project_tasks (id, project_id, text, position)
    VALUES (${taskId}, ${projectId}, ${text.slice(0, 500)}, ${position});
  `;

  // Ślad w historii projektu — skąd wzięło się to zadanie. Bez tego za
  // miesiąc nie da się odtworzyć, że to była prośba klienta z maila.
  // kind='system', bo to automatyczny log, nie ręczna notatka właściciela.
  await sql`
    INSERT INTO project_activity (id, project_id, text, kind)
    VALUES (${randomUUID()}, ${projectId}, ${`Zadanie z wiadomości e-mail od ${mail.from_addr}: ${(mail.subject || "(bez tematu)").slice(0, 200)}`}, 'system');
  `;

  // Zadanie powstało = mail obsłużony.
  await sql`UPDATE mail_messages SET status = 'obsłużony', handled_at = now() WHERE id = ${id};`;

  return NextResponse.json({ ok: true, task_id: taskId, project_id: projectId });
}
