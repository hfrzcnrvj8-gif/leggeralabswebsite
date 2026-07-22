import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureContractsSchema, logClientEvent } from "@/lib/db";
import { notify } from "@/lib/notificationLog";
import { SHARE_LINK_REVOKED_MESSAGE } from "@/lib/shareLinks";

export const runtime = "nodejs";

/** POST /api/contracts/public/:token/accept — e-podpis drugiej strony
 * (klient akceptujący Umowę, albo druga strona podpisująca NDA). Wzorem
 * app/api/offers/public/[token]/accept — zapisuje imię, IP, user-agent jako
 * dowód złożenia oświadczenia woli. Prostszy niż akceptacja oferty: dokument
 * już istnieje (nic nowego nie trzeba tworzyć), więc wystarczy jedno
 * "claim"-style UPDATE bez transakcji na wielu tabelach. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  if (!name) return NextResponse.json({ error: "Podaj imię i nazwisko." }, { status: 400 });

  await ensureContractsSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM contracts WHERE share_token = ${token} AND status != 'Szkic';`;
  const contract = rows[0];
  if (!contract) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Moduł 40: to najważniejsze z sześciu miejsc. Bez tego warunku ktoś ze
  // starym linkiem mógłby PODPISAĆ umowę mimo unieważnienia.
  if (contract.share_revoked_at) return NextResponse.json({ error: SHARE_LINK_REVOKED_MESSAGE }, { status: 410 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  const claimed = await sql`
    UPDATE contracts SET status = 'Podpisana', accepted_at = now(),
      accepted_by_name = ${name}, accepted_ip = ${ip}, accepted_user_agent = ${userAgent}, updated_at = now()
    WHERE id = ${contract.id} AND status != 'Podpisana'
    RETURNING id;
  `;
  if (claimed.length === 0) return NextResponse.json({ error: "Dokument już podpisany." }, { status: 409 });

  const clientId = typeof contract.client_id === "string" ? contract.client_id : null;
  const label = contract.typ === "nda" ? "NDA" : "Umowa";
  await logClientEvent(sql, clientId, "contract_signed", `${label} podpisana przez ${name}`, null, contract.id);

  // Centrum powiadomień (Moduł 24 + 31) — TYLKO tutaj, na publicznej trasie.
  // Bliźniaczy `contracts/[id]/accept` to ręczne "Oznacz jako podpisaną",
  // czyli ruch właściciela: wie, że kliknął, więc dzwonienie mu o tym byłoby
  // szumem (ta sama zasada co przy invoice_paid — dzwoni to, co panel zrobił
  // sam). Podpis drugiej strony może paść w nocy i bez tego wpisu właściciel
  // dowiadywał się o nim dopiero wchodząc na Umowy.
  const contractId = String(contract.id);
  await notify({
    kind: "contract_signed",
    title: `${label} podpisana`,
    body: `${name} złożył(a) podpis pod dokumentem${contract.klient_nazwa ? ` — ${contract.klient_nazwa}` : ""}.${
      contract.typ === "umowa" && contract.project_id ? " Projekt można przestawić na „W trakcie”." : ""
    }`,
    entity: "contract",
    entityId: contractId,
    dedupeKey: `contract_signed:${contractId}`,
  });

  return NextResponse.json({ ok: true, acceptedByName: name });
}
