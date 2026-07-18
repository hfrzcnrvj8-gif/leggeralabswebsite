import { NextResponse } from "next/server";
import { destroySession, revokeCurrentDeviceToken } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/admin/logout — przeglądarce kasuje ciasteczko; klientowi
 * natywnemu (nagłówek Bearer) unieważnia token JEGO urządzenia w bazie. */
export async function POST() {
  await revokeCurrentDeviceToken();
  await destroySession();
  return NextResponse.json({ ok: true });
}
