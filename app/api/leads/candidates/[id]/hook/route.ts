import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureLeadHunterSchema } from "@/lib/db";
import { ollamaGenerate } from "@/lib/ollama";
import { HOOK_MODEL, HOOK_SYSTEM, buildHookPrompt, cleanHookText, tekstZeStrony } from "@/lib/hunter-hook";
import { adresStrony, robotsPozwala } from "@/lib/leadHunterRun";
import type { Sygnal } from "@/lib/leadHunter";

export const runtime = "nodejs";
// Ten sam model 27b co szkice odpowiedzi (Moduł 7) — ten sam limit.
export const maxDuration = 60;

const TIMEOUT_MS = 45_000;

/**
 * POST /api/leads/candidates/:id/hook — PROPOZYCJA jednego zdania „co
 * konkretnie zautomatyzować u tej firmy", lokalnym modelem przez Ollamę.
 *
 * Nic nie zapisuje. Właściciel widzi zdanie w oknie, poprawia je i sam
 * decyduje, czy trafi do notatki leada (PATCH /api/leads/:id) — dokładnie ten
 * sam kształt co Moduły 7/8/48–50.
 *
 * **Wołane tylko dla kandydatów PRZYJĘTYCH.** Sito jest deterministyczne i
 * model nie ma żadnego wpływu na to, kto wchodzi do skrzynki; nie płacimy też
 * czasem modelu za firmy, które właściciel odrzucił.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  await ensureLeadHunterSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT nazwa, branza, miasto, www, sygnaly, stan FROM lead_candidates WHERE id = ${id};
  `) as unknown as { nazwa: string; branza: string; miasto: string; www: string; sygnaly: Sygnal[] | string; stan: string }[];
  const k = rows[0];
  if (!k) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (k.stan !== "wziety") {
    return NextResponse.json({ error: "Zaczepkę można wygenerować dopiero po przyjęciu kandydata." }, { status: 400 });
  }

  // JSONB wraca z neon() jako obiekt, a z PGlite bywa stringiem — różnica,
  // której `tsc` nie widzi, a która wywala się dopiero na danych.
  const sygnaly: Sygnal[] = Array.isArray(k.sygnaly)
    ? k.sygnaly
    : (JSON.parse(typeof k.sygnaly === "string" ? k.sygnaly : "[]") as Sygnal[]);

  // Treść strony pobieramy TERAZ, a nie trzymamy jej z etapu E3: kopia całej
  // strony firmy w bazie to dane, których do niczego innego nie potrzebujemy
  // (minimalizacja, Audyt 2). Jedno żądanie, strona główna, robots.txt
  // uszanowany — te same zasady co w E3.
  let tekst = "";
  const adres = adresStrony(k.www);
  if (adres && (await robotsPozwala(adres))) {
    try {
      const res = await fetch(adres, {
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "LeggeraHubLeadHunter/1.0 (+https://leggeralabs.pl; kontakt@leggeralabs.pl)", Accept: "text/html" },
        redirect: "follow",
      });
      if (res.ok && (res.headers.get("content-type") ?? "").includes("html")) {
        tekst = tekstZeStrony((await res.text()).slice(0, 200_000));
      }
    } catch {
      // Brak strony = model dostaje samą branżę. Gorsza zaczepka, nie błąd.
    }
  }

  const raw = await ollamaGenerate({
    model: HOOK_MODEL,
    prompt: buildHookPrompt({ nazwa: k.nazwa, branza: k.branza, miasto: k.miasto, sygnaly, tekstStrony: tekst }),
    system: HOOK_SYSTEM,
    timeoutMs: TIMEOUT_MS,
  });

  if (raw == null) {
    return NextResponse.json(
      { error: "Model AI chwilowo niedostępny — napisz zaczepkę sam albo spróbuj później." },
      { status: 503 }
    );
  }

  return NextResponse.json({ zaczepka: cleanHookText(raw), zeStrony: Boolean(tekst) });
}
