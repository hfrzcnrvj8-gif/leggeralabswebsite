import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getSql, ensureBackupSchema, zPonowieniem } from "@/lib/db";
import { ocenKopie, type BackupRun } from "@/lib/backup";
import { stanAutomatow, wczytajBledy, wczytajPrzebiegi } from "@/lib/errorLog";

export const runtime = "nodejs";

/**
 * GET /api/observability — wszystko, co panel wie o własnym zdrowiu.
 *
 * **Po co osobna trasa, skoro Pulpit już coś pokazuje.** Pulpit jest ekranem
 * „co dziś zrobić" i celowo MILCZY, gdy jest dobrze — pokazuje wyłącznie to,
 * co wymaga uwagi, i to bez przyczyny technicznej. To dobra reguła na co dzień
 * i zła w jedynym momencie, w którym te dane są naprawdę potrzebne: gdy coś
 * się psuje i trzeba wiedzieć CO.
 *
 * Zgłoszenie właściciela z 2026-07-25 brzmiało wprost: „chcę mieć logi, które
 * mówią, co jest przyczyną, żeby ją szybko zneutralizować, a nie przy problemie
 * szukać winnego". Dane były zbierane od Audytu 4 — `error_log.szczegoly`
 * trzymał przyczynę każdego błędu i **nie czytało go nic w całym systemie**.
 * Ta trasa jest brakującym czytelnikiem.
 *
 * Tylko odczyt i tylko z tabel, które już istnieją — zero nowych zapisów,
 * zero nowych usług, zero kosztów.
 */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Każdy blok osobno w try/catch — dokładnie ta sama zasada co na Pulpicie:
  // nadzór nie może wywrócić tego, co nadzoruje. Ekran o awariach, który sam
  // pokazuje białą stronę przy awarii, byłby żartem z samego siebie.
  let kopie = null;
  let kopieHistoria: BackupRun[] = [];
  let bladKopii: string | null = null;
  try {
    kopieHistoria = await zPonowieniem(async () => {
      await ensureBackupSchema();
      const sql = getSql();
      return (await sql`
        SELECT id, ok, host, powod, tabel, rozmiar_bajtow, trwalo_sekund, created_at
        FROM backup_runs ORDER BY created_at DESC LIMIT 20;
      `) as unknown as BackupRun[];
    });
    kopie = ocenKopie(kopieHistoria);
  } catch (e) {
    console.error("[GET /api/observability] kopie", e);
    bladKopii = e instanceof Error ? e.message : String(e);
  }

  let automaty = null;
  let przebiegi = null;
  let bladAutomatow: string | null = null;
  try {
    [automaty, przebiegi] = await Promise.all([stanAutomatow(), wczytajPrzebiegi()]);
  } catch (e) {
    console.error("[GET /api/observability] automaty", e);
    bladAutomatow = e instanceof Error ? e.message : String(e);
  }

  let bledy = null;
  let bladBledow: string | null = null;
  try {
    bledy = await wczytajBledy(50);
  } catch (e) {
    console.error("[GET /api/observability] błędy", e);
    bladBledow = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    kopie,
    kopieHistoria,
    bladKopii,
    automaty,
    przebiegi,
    bladAutomatow,
    bledy,
    bladBledow,
  });
}
