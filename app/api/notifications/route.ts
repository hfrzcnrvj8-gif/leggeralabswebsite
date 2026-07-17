import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { loadNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/notificationLog";

export const runtime = "nodejs";

/** GET /api/notifications — kronika zdarzeń (Moduł 24) od najnowszej + licznik
 * nieprzeczytanych. Woła to dzwonek w sidebarze, czyli KAŻDA strona panelu —
 * stąd jedno wejście zamiast osobnego `/count`. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await loadNotifications());
  } catch (e) {
    console.error("[GET /api/notifications] failed", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** PATCH /api/notifications — oznacza jedno powiadomienie (`{ id }`) albo
 * wszystkie (`{ all: true }`) jako przeczytane. Nie kasuje niczego: przeczytane
 * zostają w historii do końca okna retencji (30 dni). */
export async function PATCH(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; all?: unknown };
  try {
    if (body.all === true) {
      await markAllNotificationsRead();
    } else if (typeof body.id === "string" && body.id) {
      await markNotificationRead(body.id);
    } else {
      return NextResponse.json({ error: "Podaj `id` albo `all: true`." }, { status: 400 });
    }
    return NextResponse.json(await loadNotifications());
  } catch (e) {
    console.error("[PATCH /api/notifications] failed", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
