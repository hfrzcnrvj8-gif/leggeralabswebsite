import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { loadFieldChanges } from "@/lib/auditLog";

export const runtime = "nodejs";

/** GET /api/clients/:id/changes — log zmian pól klienta (Moduł 23).
 *
 * Świadomie osobno od `GET /api/clients/:id`: UI dociąga go dopiero po
 * otwarciu zakładki „Logi zmian", więc profil nie płaci zapytania za log,
 * którego zwykle nikt nie otwiera, a log nie robi się nieaktualny po edycji
 * pola w wizytówce. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const changes = await loadFieldChanges("client", id);
  return NextResponse.json({ changes });
}
