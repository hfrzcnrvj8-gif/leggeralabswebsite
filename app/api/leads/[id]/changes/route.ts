import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { loadFieldChanges } from "@/lib/auditLog";

export const runtime = "nodejs";

/** GET /api/leads/:id/changes — log zmian pól leada (Moduł 23).
 * Osobno od `GET /api/leads/:id` z tych samych powodów co u klientów — patrz
 * api/clients/[id]/changes/route.ts. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const changes = await loadFieldChanges("lead", id);
  return NextResponse.json({ changes });
}
