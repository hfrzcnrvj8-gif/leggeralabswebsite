import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { stanDrugiegoSkladnika } from "@/lib/twoFactor";

export const runtime = "nodejs";

/** GET /api/admin/2fa — stan drugiego składnika dla panelu.
 *
 * Świadomie NIE wydaje sekretu: sekret pokazuje się wyłącznie w oknie
 * włączania (`POST /api/admin/2fa/start`), zanim zostanie potwierdzony.
 * Po włączeniu nie ma powodu, żeby jakakolwiek trasa umiała go jeszcze
 * wypuścić — a każda, która by umiała, byłaby obejściem drugiego składnika
 * dla kogoś, kto ma otwartą sesję. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await stanDrugiegoSkladnika());
}
