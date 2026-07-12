import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { lookupVies } from "@/lib/vies";

export const runtime = "nodejs";

/** GET /api/vies/:country/:vat — walidacja i autouzupełnianie danych
 * kontrahenta z UE przez VIES (dla numerów VAT-UE spoza Polski). Admin-only,
 * tylko odczyt publicznego API Komisji Europejskiej. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ country: string; vat: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { country, vat } = await params;
  const subject = await lookupVies(country, vat);
  if (!subject) {
    return NextResponse.json({ error: "Nie udało się połączyć z VIES lub numer ma zły format." }, { status: 502 });
  }
  if (!subject.valid) {
    return NextResponse.json({ error: "Numer VAT-UE nieaktywny w VIES (nieprawidłowy lub niezarejestrowany)." }, { status: 404 });
  }
  return NextResponse.json({ subject });
}
