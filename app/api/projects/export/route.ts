import { NextResponse } from "next/server";
import { getSql, ensureHubSchema, ensureClientsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { toCsv } from "@/lib/export";
import { todayLocalISO } from "@/lib/dates";

export const runtime = "nodejs";

/** GET /api/projects/export — CSV rejestru projektów.
 *
 * Bez zakresu dat, cały rejestr — z tego samego powodu, co przy klientach,
 * tylko mocniejszego: `projects.start` ORAZ `projects.termin` są opcjonalne
 * (obie doszły późniejszą migracją), więc filtrowanie po którejkolwiek
 * wycięłoby po cichu projekty bez daty. A `created_at` nie jest odpowiedzią,
 * bo nikt nie szuka „projektów założonych w marcu".
 *
 * Postęp liczony tak samo, jak pokazuje go lista projektów (odhaczone zadania
 * do wszystkich) — gdyby rozjechał się z UI, plik i ekran mówiłyby o tym samym
 * projekcie dwie różne rzeczy. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureHubSchema();
  await ensureClientsSchema();
  const sql = getSql();

  const rows = await sql`
    SELECT p.tytul, p.status, p.priorytet, p.zdrowie, p.start, p.termin,
      c.nazwa AS klient, l.firma AS lead, p.opis,
      (SELECT COUNT(*) FROM project_tasks t WHERE t.project_id = p.id)::int AS zadan,
      (SELECT COUNT(*) FROM project_tasks t WHERE t.project_id = p.id AND t.done)::int AS zrobionych
    FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id
    LEFT JOIN leads l ON l.id = p.lead_id
    ORDER BY p.termin ASC NULLS LAST, p.tytul ASC;
  `;

  const header = [
    "Projekt", "Klient", "Lead", "Status", "Priorytet", "Zdrowie",
    "Start", "Termin", "Zadania zrobione", "Zadania razem", "Opis",
  ];
  const body = rows.map((r) => [
    String(r.tytul ?? ""),
    String(r.klient ?? ""),
    String(r.lead ?? ""),
    String(r.status ?? ""),
    String(r.priorytet ?? ""),
    String(r.zdrowie ?? ""),
    String(r.start ?? "").slice(0, 10),
    String(r.termin ?? "").slice(0, 10),
    String(r.zrobionych ?? 0),
    String(r.zadan ?? 0),
    String(r.opis ?? ""),
  ]);

  const csv = toCsv([header, ...body]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="projekty_${todayLocalISO()}.csv"`,
    },
  });
}
