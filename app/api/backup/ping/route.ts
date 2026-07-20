import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureBackupSchema } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/backup/ping — meldunek ze skryptu kopii zapasowej na NAS-ie.
 *
 * Wołane po KAŻDYM przebiegu: udanym i nieudanym. To drugie jest ważniejsze —
 * bez meldunku o porażce panel widziałby tylko ciszę, a cisza znaczy
 * jednocześnie „kopie się nie robią" i „NAS jest wyłączony", czyli nic.
 *
 * **Uwierzytelnienie osobnym sekretem**, nie sesją administratora: to melduje
 * się maszyna, a nie przeglądarka z ciasteczkiem. Ten sam wzorzec co
 * `CRON_SECRET` w /api/leads/notify.
 *
 * Fail-closed: bez ustawionego `BACKUP_PING_SECRET` trasa jest zamknięta.
 * Otwarty endpoint dopisujący wpisy do bazy byłby zaproszeniem do zaśmiecania
 * Pulpitu fałszywymi meldunkami „wszystko OK".
 */
export async function POST(req: NextRequest) {
  const sekret = process.env.BACKUP_PING_SECRET;
  if (!sekret) {
    console.error("[POST /api/backup/ping] BACKUP_PING_SECRET nie jest ustawiony — trasa zablokowana.");
    return NextResponse.json({ error: "BACKUP_PING_SECRET nie jest skonfigurowany." }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${sekret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    ok?: unknown;
    host?: unknown;
    powod?: unknown;
    tabel?: unknown;
    rozmiarBajtow?: unknown;
    trwaloSekund?: unknown;
  } | null;
  if (!body || typeof body.ok !== "boolean") {
    return NextResponse.json({ error: "Wymagane pole `ok` (true/false)." }, { status: 400 });
  }

  const liczbaAlboNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;

  await ensureBackupSchema();
  const sql = getSql();

  await sql`
    INSERT INTO backup_runs (id, ok, host, powod, tabel, rozmiar_bajtow, trwalo_sekund)
    VALUES (
      ${randomUUID()}, ${body.ok},
      ${String(body.host ?? "").slice(0, 200)},
      ${String(body.powod ?? "").slice(0, 2000)},
      ${liczbaAlboNull(body.tabel)},
      ${liczbaAlboNull(body.rozmiarBajtow)},
      ${liczbaAlboNull(body.trwaloSekund)}
    );
  `;

  // Historia ma służyć do rozpoznania wzorca („nie udaje się od trzech dni"),
  // a nie rosnąć w nieskończoność. 60 wpisów to ~2 miesiące dziennych kopii.
  await sql`
    DELETE FROM backup_runs
    WHERE id NOT IN (SELECT id FROM backup_runs ORDER BY created_at DESC LIMIT 60);
  `;

  return NextResponse.json({ ok: true });
}
