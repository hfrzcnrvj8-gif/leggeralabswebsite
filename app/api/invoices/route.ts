import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureInvoicesSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/invoices — lista faktur z sumą brutto (do listy + KPI). Admin-only.
 *
 * `brutto` = "kwota należności z TEGO dokumentu": dla zwykłej faktury pełna
 * wartość pozycji; dla faktury ROZLICZENIOWEJ (rozlicza_zaliczke_id ustawione)
 * PEŁNA wartość MINUS brutto rozliczanej zaliczki — czyli dokładnie to, co
 * faktycznie trzeba jeszcze zebrać od klienta (FA(3) P_15, patrz lib/ksef.ts).
 * To świadomie INNA liczba niż w eksporcie CSV dla księgowej (który pokazuje
 * pełną wartość z dokumentu, bez odjęcia — zgodnie z tym, co widnieje na
 * fakturze): tu chodzi o ściągalność należności i próg KSeF bez podwójnego
 * liczenia przychodu już zafakturowanego zaliczką. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureInvoicesSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT i.*,
      COALESCE(t.netto, 0)::float8 AS netto,
      COALESCE(t.vat, 0)::float8 AS vat,
      (COALESCE(t.brutto, 0) - COALESCE(z.brutto, 0))::float8 AS brutto,
      COALESCE(p.zaplacono, 0)::float8 AS zaplacono
    FROM invoices i
    LEFT JOIN (
      SELECT invoice_id,
        SUM(ilosc * cena_netto * (1 - rabat_procent / 100)) AS netto,
        SUM(ilosc * cena_netto * (1 - rabat_procent / 100) * CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END) AS vat,
        SUM(ilosc * cena_netto * (1 - rabat_procent / 100) * (1 + CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END)) AS brutto
      FROM invoice_items GROUP BY invoice_id
    ) t ON t.invoice_id = i.id
    LEFT JOIN (
      SELECT invoice_id,
        SUM(ilosc * cena_netto * (1 - rabat_procent / 100) * (1 + CASE WHEN vat_stawka ~ '^[0-9]+$' THEN vat_stawka::numeric / 100 ELSE 0 END)) AS brutto
      FROM invoice_items GROUP BY invoice_id
    ) z ON z.invoice_id = i.rozlicza_zaliczke_id
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

  // Domyślne uwagi z Danych firmy — wygodne, żeby nie przepisywać tej samej
  // formułki na każdej nowej fakturze (można nadpisać w edytorze jak dotąd).
  const settingsRows = await sql`SELECT domyslne_uwagi FROM company_settings WHERE id = 'default';`;
  const domyslneUwagi = typeof settingsRows[0]?.domyslne_uwagi === "string" ? settingsRows[0].domyslne_uwagi : "";

  // Zaliczka to naturalnie kwota BRUTTO (tyle płaci klient) — domyślnie
  // przełącz tryb wpisywania ceny na brutto, żeby nie trzeba było ręcznie
  // przeliczać na netto. Można nadpisać w edytorze jak każdą inną fakturę.
  const cenyBrutto = typ === "zaliczkowa";

  await sql`
    INSERT INTO invoices (id, lead_id, project_id, klient_nazwa, klient_nip, klient_adres, share_token, typ_dokumentu, uwagi, ceny_brutto)
    VALUES (${id}, ${leadId}, ${projectId}, ${klientNazwa}, ${str(body?.klient_nip, 30)}, ${str(body?.klient_adres, 500)}, ${shareToken}, ${typ}, ${domyslneUwagi}, ${cenyBrutto});
  `;
  return NextResponse.json({ ok: true, id });
}
