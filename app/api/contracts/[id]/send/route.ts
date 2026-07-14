import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureContractsSchema, ensureContractShareToken, logClientEvent } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { CONTRACT_TYP_LABEL, type ContractTyp } from "@/lib/contracts";

export const runtime = "nodejs";

/** POST /api/contracts/:id/send — wysyła klientowi/leadowi mailem link do
 * publicznego podpisu. Admin-only. Wzorem app/api/offers/[id]/send. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await ensureContractsSchema();
    const sql = getSql();
    const rows = await sql`SELECT * FROM contracts WHERE id = ${id};`;
    const contract = rows[0];
    if (!contract) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!contract.klient_email) return NextResponse.json({ error: "Brak adresu e-mail — uzupełnij go w edytorze." }, { status: 400 });

    const typ = contract.typ as ContractTyp;
    const token = await ensureContractShareToken(sql, id, typeof contract.share_token === "string" ? contract.share_token : null);
    const segment = typ === "nda" ? "nda" : "umowa";
    const url = `${req.nextUrl.origin}/pl/${segment}/${token}`;
    const label = CONTRACT_TYP_LABEL[typ] ?? "Umowa";
    const nazwa = typeof contract.klient_nazwa === "string" && contract.klient_nazwa ? contract.klient_nazwa : "";

    await sendEmail({
      to: String(contract.klient_email),
      subject: `${label}${nazwa ? ` — ${nazwa}` : ""}`,
      text: [
        `Dzień dobry,`,
        ``,
        `w załączeniu link do dokumentu: ${label}.`,
        ``,
        url,
        ``,
        `Dokument można podejrzeć i podpisać elektronicznie pod powyższym adresem.`,
        ``,
        `Pozdrawiamy,`,
        `Leggera Labs`,
      ].join("\n"),
    });

    let status = String(contract.status);
    if (status === "Szkic") {
      await sql`UPDATE contracts SET status = 'Wysłana', updated_at = now() WHERE id = ${id};`;
      status = "Wysłana";
    }
    const clientId = typeof contract.client_id === "string" ? contract.client_id : null;
    await logClientEvent(sql, clientId, "contract_sent", `Wysłano ${label.toLowerCase()} mailem`);

    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error("[POST /api/contracts/:id/send] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd wysyłki: ${message}` }, { status: 500 });
  }
}
