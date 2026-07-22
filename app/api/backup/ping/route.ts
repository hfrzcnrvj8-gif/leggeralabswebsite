import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSql, ensureBackupSchema } from "@/lib/db";
import { wyslijAlarmy } from "@/lib/errorLog";

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

  // **Tu jest sedno nadzoru z Audytu 4 (2026-07-22).**
  //
  // Ping przychodzi Z ZEWNĄTRZ — ze skryptu na NAS-ie, po własnym harmonogramie,
  // niezależnie od tego, czy crony Vercela w ogóle jeszcze chodzą. To jedyne
  // miejsce w całym systemie, które działa, gdy padnie dzienny raport.
  //
  // Bez tego nadzór byłby zapętlony: cron miałby pilnować automatów, a jego
  // własną śmierć nie pilnowałby nikt. Alarm o martwym cronie musi wyjść inną
  // drogą niż ta, która właśnie umarła.
  //
  // Świadomie po zapisie meldunku i bez `await`-blokującego wyniku: kopia
  // zapasowa ma zostać odnotowana nawet wtedy, gdy wysyłka alarmu padnie.
  const alarmy = await wyslijAlarmy().catch((e) => {
    console.error("[POST /api/backup/ping] nadzór automatów nie powiódł się", e);
    return 0;
  });

  return NextResponse.json({ ok: true, alarmy });
}
