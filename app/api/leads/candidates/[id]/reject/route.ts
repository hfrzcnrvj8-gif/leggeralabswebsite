import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureLeadHunterSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { POWODY_ODRZUCENIA, normalizujNazwe } from "@/lib/leadHunter";

export const runtime = "nodejs";

/**
 * POST /api/leads/candidates/:id/reject — „Odrzuć" z powodem z zamkniętej listy.
 *
 * Dwie rzeczy dzieją się naraz i obie są celowe:
 *
 * 1. **Wpis na czarną listę** — raz odrzucony nie wraca. Sprawdzana jest w E1,
 *    czyli PRZED wzbogacaniem, żeby nie płacić limitem CEIDG za firmę, którą
 *    właściciel już przekreślił.
 * 2. **Minimalizacja danych (RODO, Audyt 2)** — na czarnej liście zostaje
 *    wyłącznie NIP, znormalizowana nazwa i powód. Żadnego adresu, telefonu ani
 *    maila: nie zamierzamy tej firmie niczego proponować, więc nie mamy
 *    podstawy trzymać jej profilu. Sam wiersz kandydata znika najpóźniej po
 *    30 dniach (`purgeStareKandydaty`).
 *
 * Powód jest z listy, nie z wolnego tekstu — wolnego tekstu nie da się
 * policzyć, a to właśnie te powody są drugim licznikiem pętli poprawy
 * („30× za mała firma" = próg jest źle ustawiony).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { powod?: string } | null;
  const powod = String(body?.powod ?? "").trim();
  if (!(POWODY_ODRZUCENIA as readonly string[]).includes(powod)) {
    return NextResponse.json({ error: "Podaj powód odrzucenia z listy." }, { status: 400 });
  }

  await ensureLeadHunterSchema();
  const sql = getSql();

  const rows = (await sql`SELECT id, nazwa, nazwa_norm, nip FROM lead_candidates WHERE id = ${id};`) as unknown as
    { id: string; nazwa: string; nazwa_norm: string; nip: string }[];
  const k = rows[0];
  if (!k) return NextResponse.json({ error: "not found" }, { status: 404 });

  await sql`
    UPDATE lead_candidates SET stan = 'odrzucony', powod_odrzucenia = ${powod}, updated_at = now() WHERE id = ${id};
  `;

  // Bez NIP-u i bez nazwy nie ma czego zapamiętać — taki wiersz byłby pustym
  // rekordem blokującym nic.
  const nazwaNorm = k.nazwa_norm || normalizujNazwe(k.nazwa);
  if (k.nip || nazwaNorm) {
    await sql`
      INSERT INTO lead_blacklist (id, nip, nazwa_norm, powod)
      VALUES (${randomUUID()}, ${k.nip}, ${nazwaNorm}, ${powod})
      ON CONFLICT DO NOTHING;
    `;
  }

  return NextResponse.json({ ok: true });
}
