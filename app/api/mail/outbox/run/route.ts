import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { runDueOutbox } from "@/lib/mailOutbox";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/mail/outbox/run — wyślij wszystko, czego termin minął.
 *
 * **Dwa wejścia, świadomie.**
 *
 * 1. **Cron Vercela** (`vercel.json`, 8:00) — z nagłówkiem
 *    `Authorization: Bearer <CRON_SECRET>`, tak jak dzienny raport.
 * 2. **Zalogowany panel/apka** — bo cron na Vercelu ma platformowy minimalny
 *    interwał (na planie Hobby to RAZ DZIENNIE, nie „co kilka minut", jak
 *    zakładał brief). Sam cron oznaczałby, że mail odłożony na 14:00 czeka
 *    do jutra rana. Dlatego kolejkę rusza też każde wejście w Pocztę —
 *    właściciel używa apki codziennie, więc w praktyce to ten drugi
 *    mechanizm wysyła większość poczty, a cron jest siatką bezpieczeństwa.
 *
 * Konsekwencja, którą UI MUSI mówić wprost: zadeklarowana godzina to
 * NAJWCZEŚNIEJSZY moment wysyłki, nie gwarantowany. Patrz
 * `opisTerminuWysylki()` w lib/mail.ts.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const naglowek = req.headers.get("authorization");
  const zCrona = Boolean(cronSecret) && naglowek === `Bearer ${cronSecret}`;

  // Fail-closed jak w /api/leads/notify: bez sekretu i bez sesji nie
  // uruchamiamy wysyłki. To jedyna trasa w panelu, która sama z siebie
  // wysyła pocztę do klientów — nie może być otwarta.
  if (!zCrona && !(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const wynik = await runDueOutbox();
  return NextResponse.json({ ok: true, ...wynik });
}
