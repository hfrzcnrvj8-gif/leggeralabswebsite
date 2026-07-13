import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { ollamaHealth } from "@/lib/ollama";

export const runtime = "nodejs";

/** GET /api/ai/health — ping do lokalnej Ollamy (przez Tailscale Funnel). Admin-only. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const health = await ollamaHealth();
  return NextResponse.json(health);
}
