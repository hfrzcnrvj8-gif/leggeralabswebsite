import { NextResponse } from "next/server";
import { getSql, ensureDeviceTokensSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/admin/devices — lista urządzeń zalogowanych tokenem (aplikacja
 * natywna). Bez hashy tokenów — panel widzi tylko metadane. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureDeviceTokensSchema();
  const sql = getSql();
  const devices = await sql`
    SELECT id, device_name, created_at, last_used_at, revoked_at
    FROM device_tokens
    ORDER BY last_used_at DESC;
  `;
  return NextResponse.json({ devices });
}
