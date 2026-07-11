import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/invoices — lista faktur z sumą brutto (do listy). Admin-only. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureInvoicesSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT i.*,
      COALESCE(t.netto, 0)::float8 AS netto,
      COALESCE(t.vat, 0)::float8 AS vat,
      COALESCE(t.brutto, 0)::float8 AS brutto,
      COALESCE(p.zaplacono, 0)::float8 AS zaplacono
    FROM invoices i
    LEFT JOIN (
      SELECT invoice_id,
        SUM(ilosc * cena_netto) AS netto,
        SUM(ilosc * cena_netto * CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END) AS vat,
        SUM(ilosc * cena_netto * (1 + CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END)) AS brutto
      FROM invoice_items GROUP BY invoice_id
    ) t ON t.invoice_id = i.id
    LEFT JOIN (
      SELECT invoice_id, SUM(kwota) AS zaplacono FROM invoice_payments GROUP BY invoice_id
    ) p ON p.invoice_id = i.id
    ORDER BY i.created_at DESC;
  `;
  return NextResponse.json({ invoices: rows });
}

/** POST /api/invoices — nowa faktura (szkic). Może wejść z leada/projektu
 * (kopiujemy dane klienta z leada). Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  await ensureInvoicesSchema();
  const sql = getSql();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

  const id = randomUUID();
  const shareToken = randomUUID().replace(/-/g, "");
  const leadId = typeof body?.lead_id === "string" && body.lead_id.trim() ? body.lead_id : null;
  const projectId = typeof body?.project_id === "string" && body.project_id.trim() ? body.project_id : null;
  const typ = typeof body?.typ_dokumentu === "string" && ["faktura", "proforma", "zaliczkowa"].includes(body.typ_dokumentu) ? body.typ_dokumentu : "faktura";

  // Jeśli podpięto leada — skopiuj jego firmę jako dane klienta na start.
  let klientNazwa = str(body?.klient_nazwa, 300);
  if (!klientNazwa && leadId) {
    const lead = await sql`SELECT firma FROM leads WHERE id = ${leadId};`;
    klientNazwa = typeof lead[0]?.firma === "string" ? lead[0].firma : "";
  }

  await sql`
    INSERT INTO invoices (id, lead_id, project_id, klient_nazwa, klient_nip, klient_adres, share_token, typ_dokumentu)
    VALUES (${id}, ${leadId}, ${projectId}, ${klientNazwa}, ${str(body?.klient_nip, 30)}, ${str(body?.klient_adres, 500)}, ${shareToken}, ${typ});
  `;
  return NextResponse.json({ ok: true, id });
}
