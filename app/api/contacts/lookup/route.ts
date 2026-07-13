import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { findContactsByPhone, type ContactMatch } from "@/lib/contactLookup";

export const runtime = "nodejs";

export type { ContactMatch };

/**
 * GET /api/contacts/lookup?telefon=... — dopasowuje leada/klienta po
 * numerze telefonu (patrz findContactsByPhone w lib/contactLookup.ts).
 * Używane przez mobilną "szybką notatkę" (Opcja A,
 * docs/plany-modulow/03-kanaly-kontaktu.md); ten sam mechanizm dopasowania
 * będzie później użyty przez webhook VoIP (/api/telefonia/webhook).
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const telefon = req.nextUrl.searchParams.get("telefon") ?? "";
  const matches = await findContactsByPhone(telefon);
  return NextResponse.json({ matches });
}
