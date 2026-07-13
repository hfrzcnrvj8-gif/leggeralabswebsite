import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureHubSchema, ensureInvoicesSchema, ensureCostsSchema, ensureFollowupsSchema, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString, formatPlDate, CLOSED_PROJECT_STATUSES } from "@/lib/projects";
import { NURTURE_OFFSETS } from "@/lib/clients";
import { todayLocalISO } from "@/lib/dates";
import { addDaysISO } from "@/lib/documents";

export const runtime = "nodejs";

/** GET /api/projects/:id — project + its checklist + activity log. Admin-only. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureHubSchema();
  const sql = getSql();

  const rows = await sql`SELECT * FROM projects WHERE id = ${id};`;
  const project = rows[0];
  if (!project) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const tasks = await sql`
    SELECT * FROM project_tasks WHERE project_id = ${id} ORDER BY position ASC, created_at ASC;
  `;
  const activity = await sql`
    SELECT * FROM project_activity WHERE project_id = ${id} ORDER BY created_at DESC;
  `;
  const milestones = await sql`
    SELECT * FROM project_milestones WHERE project_id = ${id} ORDER BY position ASC, created_at ASC;
  `;
  const resources = await sql`
    SELECT * FROM project_resources WHERE project_id = ${id} ORDER BY position ASC, created_at ASC;
  `;
  const dependencies = await sql`SELECT depends_on_id FROM project_dependencies WHERE project_id = ${id};`;

  // Rentowność projektu: przychód netto z faktur projektu (wg tych samych
  // wykluczeń co licznik KSeF w InvoicesDashboard: bez proform/szkiców/
  // anulowanych, tylko PLN) minus koszty netto podpięte do projektu.
  // Świadomie tylko PLN w v1 — faktury w innych walutach są pomijane, o czym
  // informuje `ma_inne_waluty`.
  await ensureInvoicesSchema();
  await ensureCostsSchema();
  const [revenueRow] = await sql`
    SELECT COALESCE(SUM(t.netto), 0)::float8 AS netto
    FROM invoices i
    JOIN (
      SELECT invoice_id, SUM(ilosc * cena_netto) AS netto
      FROM invoice_items GROUP BY invoice_id
    ) t ON t.invoice_id = i.id
    WHERE i.project_id = ${id}
      AND i.typ_dokumentu != 'proforma'
      AND i.status != 'Szkic'
      AND i.status != 'Anulowana'
      AND i.waluta = 'PLN';
  `;
  const [nonPlnRow] = await sql`
    SELECT COUNT(*)::int AS n
    FROM invoices
    WHERE project_id = ${id}
      AND typ_dokumentu != 'proforma'
      AND status != 'Szkic'
      AND status != 'Anulowana'
      AND waluta != 'PLN';
  `;
  const [costsRow] = await sql`
    SELECT COALESCE(SUM(kwota_netto), 0)::float8 AS netto FROM costs WHERE project_id = ${id};
  `;
  const przychodNetto = Number(revenueRow?.netto ?? 0);
  const kosztyNetto = Number(costsRow?.netto ?? 0);
  const rentownosc = {
    przychod_netto: przychodNetto,
    koszty_netto: kosztyNetto,
    zysk_netto: przychodNetto - kosztyNetto,
    ma_inne_waluty: Number(nonPlnRow?.n ?? 0) > 0,
  };

  return NextResponse.json({ project, tasks, activity, milestones, resources, dependencies, rentownosc });
}

/** PATCH /api/projects/:id — update one or more fields. Admin-only. */
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

  await ensureHubSchema();
  const sql = getSql();
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  // Stan sprzed zmiany — potrzebny do automatycznego logu aktywności
  // ("Status: X → Y"). Bez tego log nie wiedziałby, co było wcześniej.
  const current = (await sql`SELECT * FROM projects WHERE id = ${id};`)[0] as
    | Record<string, unknown>
    | undefined;

  // Zbieramy czytelne opisy zmian pól śledzonych na osi historii projektu.
  const changes: string[] = [];
  const norm = (v: unknown) => (v == null ? "" : String(v));
  const dateLabel = (v: string) => (v ? formatPlDate(v) : "—");

  if ("tytul" in body) {
    await sql`UPDATE projects SET tytul = ${str(body.tytul)}, updated_at = now() WHERE id = ${id};`;
  }
  if ("opis" in body) {
    await sql`UPDATE projects SET opis = ${str(body.opis)}, updated_at = now() WHERE id = ${id};`;
  }
  let statusChangedTo: string | null = null;
  if ("status" in body) {
    const nv = str(body.status);
    if (current && norm(current.status) !== nv) {
      changes.push(`Status: ${norm(current.status) || "—"} → ${nv}`);
      statusChangedTo = nv;
    }
    await sql`UPDATE projects SET status = ${nv}, updated_at = now() WHERE id = ${id};`;
  }
  if ("priorytet" in body) {
    const nv = str(body.priorytet);
    if (current && norm(current.priorytet) !== nv) changes.push(`Priorytet: ${norm(current.priorytet) || "—"} → ${nv}`);
    await sql`UPDATE projects SET priorytet = ${nv}, updated_at = now() WHERE id = ${id};`;
  }
  if ("zdrowie" in body) {
    const nv = str(body.zdrowie);
    if (current && norm(current.zdrowie) !== nv) changes.push(`Zdrowie: ${norm(current.zdrowie) || "—"} → ${nv}`);
    await sql`UPDATE projects SET zdrowie = ${nv}, updated_at = now() WHERE id = ${id};`;
  }
  if ("termin" in body) {
    const raw = body.termin;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed && !isPlausibleDateString(trimmed)) {
      return NextResponse.json({ error: "invalid termin" }, { status: 400 });
    }
    const value = trimmed || null;
    const oldD = norm(current?.termin).slice(0, 10);
    const newD = value ? value.slice(0, 10) : "";
    if (current && oldD !== newD) changes.push(`Termin: ${dateLabel(oldD)} → ${dateLabel(newD)}`);
    await sql`UPDATE projects SET termin = ${value}, updated_at = now() WHERE id = ${id};`;
  }
  if ("start" in body) {
    const raw = body.start;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed && !isPlausibleDateString(trimmed)) {
      return NextResponse.json({ error: "invalid start" }, { status: 400 });
    }
    const value = trimmed || null;
    const oldD = norm(current?.start).slice(0, 10);
    const newD = value ? value.slice(0, 10) : "";
    if (current && oldD !== newD) changes.push(`Start: ${dateLabel(oldD)} → ${dateLabel(newD)}`);
    await sql`UPDATE projects SET start = ${value}, updated_at = now() WHERE id = ${id};`;
  }
  if ("lead_id" in body) {
    const raw = body.lead_id;
    const value = typeof raw === "string" && raw.trim() ? raw : null;
    await sql`UPDATE projects SET lead_id = ${value}, updated_at = now() WHERE id = ${id};`;
  }
  if ("kolor" in body) {
    const value = typeof body.kolor === "string" && body.kolor.trim() ? body.kolor.slice(0, 20) : null;
    await sql`UPDATE projects SET kolor = ${value}, updated_at = now() WHERE id = ${id};`;
  }
  if ("ikona" in body) {
    const value = typeof body.ikona === "string" && body.ikona.trim() ? body.ikona.slice(0, 16) : null;
    await sql`UPDATE projects SET ikona = ${value}, updated_at = now() WHERE id = ${id};`;
  }

  // Dopisz automatyczne wpisy „system" do logu aktywności (audyt zmian).
  for (const text of changes) {
    await sql`
      INSERT INTO project_activity (id, project_id, text, kind)
      VALUES (${randomUUID()}, ${id}, ${text}, 'system');
    `;
  }

  if (statusChangedTo && current) {
    const clientId = typeof current.client_id === "string" ? current.client_id : null;
    const tytul = typeof current.tytul === "string" ? current.tytul : "Projekt";
    await logClientEvent(sql, clientId, "project_status_changed", `Projekt „${tytul}” → ${statusChangedTo}`);

    // Nurture automatyczny (Moduł 2): przy wejściu w status zamknięty
    // ("Wdrożone") planujemy klientowi dwa przyszłe kontakty (14/90 dni),
    // bez klikania. Idempotentnie po project_id — nie duplikuj, jeśli status
    // wraca do "Wdrożone" po korekcie.
    if (clientId && CLOSED_PROJECT_STATUSES.has(statusChangedTo)) {
      await ensureFollowupsSchema();
      const existing = await sql`
        SELECT 1 FROM client_followups WHERE project_id = ${id} LIMIT 1;
      `;
      if (existing.length === 0) {
        const today = todayLocalISO();
        for (const offset of NURTURE_OFFSETS) {
          await sql`
            INSERT INTO client_followups (id, client_id, project_id, due_date, powod)
            VALUES (${randomUUID()}, ${clientId}, ${id}, ${addDaysISO(today, offset.days)}, ${offset.powod});
          `;
        }
        await logClientEvent(sql, clientId, "nurture_scheduled", "Zaplanowano kontakt kontrolny (14 i 90 dni)");
      }
    }
  }

  const activity = await sql`
    SELECT * FROM project_activity WHERE project_id = ${id} ORDER BY created_at DESC;
  `;
  return NextResponse.json({ ok: true, activity });
}

/** DELETE /api/projects/:id — remove a project (cascades tasks/activity). Admin-only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await ensureHubSchema();
  const sql = getSql();
  await sql`DELETE FROM projects WHERE id = ${id};`;
  return NextResponse.json({ ok: true });
}
