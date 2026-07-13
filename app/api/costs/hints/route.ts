import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureCostsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isPlausibleDateString } from "@/lib/projects";

export const runtime = "nodejs";

/** GET /api/costs/hints?nip=...&excludeId=...&kwota=...&data=... — dwie
 * miękkie podpowiedzi liczone na bieżąco w edytorze kosztu, obie WYŁĄCZNIE
 * deterministyczne (zero AI, patrz CLAUDE.md):
 *
 * - `duplicate`: najnowszy inny koszt tego samego dostawcy (NIP) z tą samą
 *   kwotą brutto i datą wydatku w oknie ±3 dni — ryzyko podwójnego wpisania
 *   tej samej faktury (ręcznie + przez KSeF, albo zwykła pomyłka).
 * - `suggestion`: kategoria/projekt z najnowszego INNEGO kosztu tego samego
 *   dostawcy — do podpowiedzi przy wpisywaniu kolejnego kosztu od znanego
 *   kontrahenta.
 *
 * Nic nie blokuje ani nie zapisuje — tylko informuje, właściciel decyduje. */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const nipDigits = (req.nextUrl.searchParams.get("nip") ?? "").replace(/\D/g, "");
  const excludeId = req.nextUrl.searchParams.get("excludeId") ?? "";
  const kwotaParam = req.nextUrl.searchParams.get("kwota");
  const dataParam = req.nextUrl.searchParams.get("data");
  const kwotaBrutto = kwotaParam != null ? Number(kwotaParam) : NaN;

  if (nipDigits.length !== 10) return NextResponse.json({ duplicate: null, suggestion: null });

  await ensureCostsSchema();
  const sql = getSql();

  let duplicate: { id: string; dostawca_nazwa: string; kwota_brutto: number; data_wydatku: string } | null = null;
  if (Number.isFinite(kwotaBrutto) && kwotaBrutto > 0 && dataParam && isPlausibleDateString(dataParam)) {
    const rows = await sql`
      SELECT id, dostawca_nazwa, kwota_brutto::float8 AS kwota_brutto, data_wydatku
      FROM costs
      WHERE dostawca_nip = ${nipDigits}
        AND id != ${excludeId}
        AND duplikat_potwierdzony = false
        AND ABS(kwota_brutto - ${kwotaBrutto}) < 0.01
        AND ABS(data_wydatku - ${dataParam}::date) <= 3
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const r = rows[0];
    if (r) {
      duplicate = {
        id: String(r.id),
        dostawca_nazwa: String(r.dostawca_nazwa ?? ""),
        kwota_brutto: Number(r.kwota_brutto),
        data_wydatku: String(r.data_wydatku).slice(0, 10),
      };
    }
  }

  const histRows = await sql`
    SELECT c.kategoria, c.project_id, p.tytul AS project_tytul
    FROM costs c
    LEFT JOIN projects p ON p.id = c.project_id
    WHERE c.dostawca_nip = ${nipDigits} AND c.id != ${excludeId}
    ORDER BY c.created_at DESC
    LIMIT 1;
  `;
  const h = histRows[0];
  const suggestion = h ? { kategoria: String(h.kategoria ?? ""), project_id: h.project_id ? String(h.project_id) : null, project_tytul: h.project_tytul ? String(h.project_tytul) : null } : null;

  return NextResponse.json({ duplicate, suggestion });
}
