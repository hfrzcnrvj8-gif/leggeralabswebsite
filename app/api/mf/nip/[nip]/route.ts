import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { lookupNip } from "@/lib/mf";

export const runtime = "nodejs";

/** GET /api/mf/nip/:nip — autouzupełnianie danych kontrahenta z Białej Listy
 * MF (nazwa + adres) po numerze NIP. Admin-only, tylko odczyt zewnętrznego
 * publicznego API. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ nip: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { nip } = await params;
  const subject = await lookupNip(nip);
  if (!subject) return NextResponse.json({ error: "Nie znaleziono podmiotu o tym NIP." }, { status: 404 });
  return NextResponse.json({ subject });
}
