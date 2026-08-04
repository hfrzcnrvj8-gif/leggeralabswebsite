import { NextRequest, NextResponse } from "next/server";
import { getSql, ensureLeadsSchema } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/** DELETE /api/leads/:id/activity/:activityId — remove one log entry (typo correction etc). Admin-only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, activityId } = await params;
  await ensureLeadsSchema();
  const sql = getSql();
  // `kind IS NULL` w warunku, a nie osobny SELECT przed nim: wpisy SYSTEMOWE
  // (krok 4, znalezisko B1 — „wysłano ofertę", „klient otworzył", „odrzucona")
  // to zapis tego, co się STAŁO, a nie notatka do poprawienia. Ich bliźniaki
  // na osi klienta (`client_events`) nie mają w panelu żadnej drogi
  // skasowania — ta trasa nie może być tą drogą tylnymi drzwiami. Kosza przy
  // takim wpisie nie ma też w interfejsie, ale blokada w interfejsie nie jest
  // blokadą.
  const usuniete = await sql`DELETE FROM lead_activity WHERE id = ${activityId} AND lead_id = ${id} AND kind IS NULL RETURNING id;`;
  if (usuniete.length === 0) {
    // 404 również wtedy, gdy wiersz istnieje, ale jest systemowy — panel i tak
    // nie pokazuje tam kosza, więc to żądanie nie pochodzi z normalnej drogi.
    const istnieje = await sql`SELECT kind FROM lead_activity WHERE id = ${activityId} AND lead_id = ${id};`;
    if (istnieje.length > 0) {
      return NextResponse.json({ error: "Wpis systemowy — zapis zdarzenia, nie notatka. Nie da się go usunąć." }, { status: 409 });
    }
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
